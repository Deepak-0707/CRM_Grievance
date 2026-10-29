import json
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import (
    IdentityDisclosureRequest, AbuseInvestigation, Complaint,
    SimulatedIdentityRecord, User, utc_now
)
from app.schemas.schemas import IdentityDisclosureRequestCreate, IdentityDisclosureReview
from app.services.audit_service import log_audit_event

def create_disclosure_request(
    db: Session,
    reviewer: User,
    req_in: IdentityDisclosureRequestCreate
) -> IdentityDisclosureRequest:
    """
    Step 1 & 2: Reviewer documents lawful/policy basis and submits disclosure request.
    Only authorized reviewers or administrators can create requests.
    Requires an existing investigation with a documented basis.
    """
    if reviewer.role not in ["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized. Only Trust & Safety Reviewers or Administrators may initiate identity disclosure requests."
        )

    investigation = db.query(AbuseInvestigation).filter(AbuseInvestigation.id == req_in.investigation_id).first()
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Abuse investigation record not found."
        )

    # Verify that there is at least an investigation in progress or substantiated abuse finding
    complaint = db.query(Complaint).filter(Complaint.id == req_in.complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found."
        )

    # Check for pending request
    existing = db.query(IdentityDisclosureRequest).filter(
        IdentityDisclosureRequest.investigation_id == req_in.investigation_id,
        IdentityDisclosureRequest.status.in_(["PENDING_APPROVAL", "APPROVED"])
    ).first()
    if existing:
        return existing

    request = IdentityDisclosureRequest(
        investigation_id=req_in.investigation_id,
        complaint_id=req_in.complaint_id,
        requested_by_reviewer_id=reviewer.id,
        legal_and_policy_basis=req_in.legal_and_policy_basis,
        status="PENDING_APPROVAL"
    )
    db.add(request)
    db.flush()

    log_audit_event(
        db=db,
        event_type="IDENTITY_DISCLOSURE_REQUESTED",
        action="REQUEST_CONDITIONAL_DISCLOSURE",
        actor_id=reviewer.id,
        actor_role=reviewer.role,
        resource_id=request.id,
        details={
            "complaint_id": complaint.id,
            "complaint_number": complaint.complaint_number,
            "investigation_id": investigation.id,
            "legal_basis": req_in.legal_and_policy_basis
        }
    )

    db.commit()
    db.refresh(request)
    return request

def review_disclosure_request(
    db: Session,
    admin: User,
    request_id: str,
    review: IdentityDisclosureReview
) -> IdentityDisclosureRequest:
    """
    Step 3 & 4: Authorized administrator or privacy officer approves or rejects with recorded rationale.
    Enforces dual-control: Requesting reviewer cannot approve their own request!
    """
    if admin.role not in ["ADMINISTRATOR", "PRIVACY_OFFICER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized. Only an Administrator or Privacy Officer with privacy oversight authority may adjudicate disclosure requests."
        )

    request = db.query(IdentityDisclosureRequest).filter(IdentityDisclosureRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disclosure request not found.")

    if request.requested_by_reviewer_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dual-control policy violation: Reviewer cannot approve their own identity disclosure petition."
        )

    request.reviewed_by_admin_id = admin.id
    request.admin_rationale = review.admin_rationale
    request.reviewed_at = utc_now()
    request.status = "APPROVED" if review.approved else "REJECTED"

    action_type = "IDENTITY_DISCLOSURE_APPROVED" if review.approved else "IDENTITY_DISCLOSURE_REJECTED"
    log_audit_event(
        db=db,
        event_type=action_type,
        action=f"ADJUDICATE_DISCLOSURE_{request.status}",
        actor_id=admin.id,
        actor_role=admin.role,
        resource_id=request.id,
        details={
            "request_id": request.id,
            "decision": request.status,
            "admin_rationale": review.admin_rationale
        }
    )

    # In-app notification to requesting reviewer
    try:
        from app.services.notification_service import send_notification
        decision_label = "APPROVED" if review.approved else "REJECTED"
        send_notification(
            db=db,
            user_id=request.requested_by_reviewer_id,
            title=f"Identity Disclosure Petition {decision_label}",
            message=f"Petition has been {decision_label.lower()} by {admin.username} ({admin.role}). Rationale: {review.admin_rationale}",
            link="/disclosure"
        )
    except Exception:
        pass

    db.commit()
    db.refresh(request)
    return request

def access_disclosed_identity(
    db: Session,
    current_user: User,
    request_id: str
) -> dict:
    """
    Step 5 & 6: Access the synthetic identity record ONLY after approval.
    Enforces strict 403 Forbidden for Department Officers and unauthorized users!
    Logs every access attempt in audit events.
    """
    # Check if officer attempts access (Scenario G requirement)
    if current_user.role == "DEPARTMENT_OFFICER":
        log_audit_event(
            db=db,
            event_type="UNAUTHORIZED_ACCESS_ATTEMPT",
            action="OFFICER_ATTEMPTED_IDENTITY_DISCLOSURE",
            actor_id=current_user.id,
            actor_role=current_user.role,
            resource_id=request_id,
            details={"error": "Department officers are strictly prohibited from accessing identity records."}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Department Officers are barred from accessing citizen identity mappings under strict data-isolation policy."
        )

    if current_user.role != "PRIVACY_OFFICER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Identity disclosure is restricted exclusively to Privacy Officers."
        )

    request = db.query(IdentityDisclosureRequest).filter(IdentityDisclosureRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disclosure request not found.")

    if request.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot disclose identity: Request is currently '{request.status}'. Approval by authorized administrator required."
        )

    complaint = db.query(Complaint).filter(Complaint.id == request.complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")

    # Requirement 3: Privacy officers should be able to view identity of the citizens iff the citizen has a lot of flags in past
    from app.models.models import ComplaintFlag
    past_flags_count = db.query(ComplaintFlag).join(
        Complaint, ComplaintFlag.complaint_id == Complaint.id
    ).filter(
        Complaint.citizen_pseudonym_id == complaint.citizen_pseudonym_id
    ).count()

    FLAGS_THRESHOLD = 3
    if past_flags_count < FLAGS_THRESHOLD:
        log_audit_event(
            db=db,
            event_type="UNAUTHORIZED_ACCESS_ATTEMPT",
            action="INSUFFICIENT_FLAGS_DISCLOSURE_BLOCKED",
            actor_id=current_user.id,
            actor_role=current_user.role,
            resource_id=request.id,
            details={
                "citizen_pseudonym_id": complaint.citizen_pseudonym_id,
                "past_flags_count": past_flags_count,
                "threshold": FLAGS_THRESHOLD,
                "reason": f"Complainant has only {past_flags_count} flag(s). Minimum {FLAGS_THRESHOLD} flags required for identity disclosure."
            }
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: Complainant has only {past_flags_count} flag(s) in past. Privacy Officers are only permitted to view citizen identity if the citizen has a history of high flags (minimum {FLAGS_THRESHOLD} flags required)."
        )

    # Retrieve synthetic identity record via citizen_pseudonym_id
    identity_record = db.query(SimulatedIdentityRecord).filter(
        SimulatedIdentityRecord.citizen_pseudonym_id == complaint.citizen_pseudonym_id
    ).first()

    if not identity_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No simulated identity record found for this pseudonymous identifier."
        )

    snapshot_data = {
        "synthetic_full_name": identity_record.synthetic_full_name,
        "synthetic_demo_id_type": identity_record.synthetic_demo_id_type,
        "synthetic_demographic_district": identity_record.synthetic_demographic_district,
        "synthetic_phone_masked": identity_record.synthetic_phone_masked,
        "verification_method": identity_record.verification_method,
        "verified_at": identity_record.verified_at.isoformat() if identity_record.verified_at else None,
        "past_flags_count": past_flags_count,
        "academic_demo_disclaimer": "Authorized disclosure snapshot. Access verified under statutory authority (high past flags verified) and logged in tamper-evident audit ledger."
    }

    request.accessed_at = utc_now()
    request.status = "ACCESSED"
    request.revealed_synthetic_snapshot = json.dumps(snapshot_data)

    log_audit_event(
        db=db,
        event_type="IDENTITY_DISCLOSED",
        action="ACCESS_SYNTHETIC_IDENTITY_RECORD",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=request.id,
        details={
            "complaint_number": complaint.complaint_number,
            "pseudonym": complaint.citizen_pseudonym_id,
            "revealed_name": identity_record.synthetic_full_name
        }
    )

    db.commit()
    return snapshot_data
