import json
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import (
    AbuseInvestigation, AbuseDecision, ComplaintFlag, Complaint,
    Sanction, Appeal, User, utc_now
)
from app.schemas.schemas import (
    AbuseInvestigationOut, AbuseDecisionCreate, AbuseDecisionOut,
    SecondReviewerApprovalRequest, AppealCreate, AppealReview, AppealOut,
    SanctionOut
)
from app.api.deps import get_current_user, require_role
from app.services.audit_service import log_audit_event
from app.services.risk_scoring_service import evaluate_complaint_risk
from app.services.notification_service import notify_citizen

router = APIRouter(prefix="/trust-safety", tags=["Trust & Safety Module"])

@router.get("/investigations")
def list_investigations(
    status: Optional[str] = Query(None),
    min_risk_score: Optional[float] = Query(None),
    current_user: User = Depends(require_role(["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    query = db.query(AbuseInvestigation)
    if status:
        query = query.filter(AbuseInvestigation.status == status)
    if min_risk_score is not None:
        query = query.filter(AbuseInvestigation.risk_score >= min_risk_score)

    investigations = query.order_by(AbuseInvestigation.risk_score.desc(), AbuseInvestigation.created_at.desc()).all()

    results = []
    for inv in investigations:
        complaint = inv.complaint
        flags = [
            {
                "id": f.id,
                "complaint_id": f.complaint_id,
                "flagged_by_role": f.flagged_by_role,
                "flag_reason": f.flag_reason,
                "flag_details": f.flag_details,
                "is_reviewed": f.is_reviewed,
                "created_at": f.created_at
            }
            for f in complaint.flags
        ]
        results.append({
            "id": inv.id,
            "complaint_id": inv.complaint_id,
            "complaint_number": complaint.complaint_number if complaint else "N/A",
            "complaint_title": complaint.title if complaint else "N/A",
            "status": inv.status,
            "lead_reviewer_id": inv.lead_reviewer_id,
            "lead_reviewer_name": inv.lead_reviewer_id,
            "risk_score": inv.risk_score,
            "risk_signals_json": inv.risk_signals_json,
            "alleged_violation": inv.alleged_violation,
            "evidence_examined": inv.evidence_examined,
            "created_at": inv.created_at,
            "updated_at": inv.updated_at,
            "flags": flags
        })

    return results

@router.get("/investigations/{investigation_id}")
def get_investigation_detail(
    investigation_id: str,
    current_user: User = Depends(require_role(["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    inv = db.query(AbuseInvestigation).filter(AbuseInvestigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    complaint = inv.complaint
    decisions = []
    for d in inv.decisions:
        decisions.append({
            "id": d.id,
            "investigation_id": d.investigation_id,
            "reviewer_id": d.reviewer_id,
            "reviewer_name": d.reviewer.username if d.reviewer else None,
            "finding": d.finding,
            "rationale": d.rationale,
            "evidence_examined": d.evidence_examined,
            "recommended_sanction": d.recommended_sanction,
            "second_reviewer_id": d.second_reviewer_id,
            "second_reviewer_name": d.second_reviewer.username if d.second_reviewer else None,
            "second_reviewer_approval": d.second_reviewer_approval,
            "second_reviewer_notes": d.second_reviewer_notes,
            "appeal_deadline": d.appeal_deadline,
            "decision_timestamp": d.decision_timestamp
        })

    flags = [
        {
            "id": f.id,
            "complaint_id": f.complaint_id,
            "flagged_by_role": f.flagged_by_role,
            "flag_reason": f.flag_reason,
            "flag_details": f.flag_details,
            "is_reviewed": f.is_reviewed,
            "created_at": f.created_at
        }
        for f in complaint.flags
    ]

    evidence_items = [
        {
            "id": e.id,
            "filename": e.filename,
            "file_type": e.file_type,
            "file_size_bytes": e.file_size_bytes,
            "evidence_description": e.evidence_description,
            "sha256_hash": e.sha256_hash,
            "integrity_status": e.integrity_status,
            "created_at": e.created_at
        }
        for e in complaint.evidence_items
    ]

    activities = [
        {
            "id": a.id,
            "actor_role": a.actor_role,
            "activity_type": a.activity_type,
            "public_message": a.public_message,
            "internal_message": a.internal_message,
            "created_at": a.created_at
        }
        for a in complaint.activities
    ]

    return {
        "id": inv.id,
        "complaint_id": inv.complaint_id,
        "complaint_number": complaint.complaint_number,
        "complaint_title": complaint.title,
        "complaint_description": complaint.description,
        "complaint_category": complaint.category,
        "status": inv.status,
        "risk_score": inv.risk_score,
        "risk_signals_json": inv.risk_signals_json,
        "alleged_violation": inv.alleged_violation,
        "evidence_examined": inv.evidence_examined,
        "created_at": inv.created_at,
        "updated_at": inv.updated_at,
        "flags": flags,
        "evidence_items": evidence_items,
        "decisions": decisions,
        "activities": activities
    }

@router.post("/investigations/{investigation_id}/decisions", response_model=AbuseDecisionOut)
def record_abuse_decision(
    investigation_id: str,
    decision_in: AbuseDecisionCreate,
    current_user: User = Depends(require_role(["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    """
    Records an initial reviewer decision.
    If a serious sanction is recommended (TEMPORARY_RESTRICTION, SUSPENSION),
    requires a second reviewer's approval before sanction takes effect.
    """
    inv = db.query(AbuseInvestigation).filter(AbuseInvestigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    appeal_deadline = utc_now() + timedelta(days=decision_in.appeal_deadline_days)
    requires_second_reviewer = decision_in.recommended_sanction in ["TEMPORARY_RESTRICTION", "SUSPENSION"]

    decision = AbuseDecision(
        investigation_id=inv.id,
        reviewer_id=current_user.id,
        finding=decision_in.finding,
        rationale=decision_in.rationale,
        evidence_examined=decision_in.evidence_examined,
        recommended_sanction=decision_in.recommended_sanction,
        second_reviewer_approval=None if requires_second_reviewer else True,
        appeal_deadline=appeal_deadline,
        decision_timestamp=utc_now()
    )
    db.add(decision)
    db.flush()

    inv.status = decision_in.finding
    inv.alleged_violation = decision_in.finding
    inv.evidence_examined = decision_in.evidence_examined
    inv.updated_at = utc_now()

    # If sanction is WARNING or NONE, apply immediately
    if decision_in.recommended_sanction == "WARNING":
        complaint = inv.complaint
        sanction = Sanction(
            user_id=complaint.citizen_pseudonym_id,  # or lookup user_id safely
            citizen_pseudonym_id=complaint.citizen_pseudonym_id,
            sanction_type="WARNING",
            reason=f"Official Warning: {decision_in.rationale}",
            is_active=True
        )
        db.add(sanction)
        notify_citizen(
            db=db,
            citizen_pseudonym_id=complaint.citizen_pseudonym_id,
            title="Trust & Safety Notice: Official Advisory Warning",
            message=f"An advisory warning was recorded regarding complaint {complaint.complaint_number}: {decision_in.rationale}",
            link="/citizen"
        )

    log_audit_event(
        db=db,
        event_type="ABUSE_DECISION_RECORDED",
        action="RECORD_ABUSE_FINDING",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=decision.id,
        details={
            "investigation_id": inv.id,
            "finding": decision_in.finding,
            "recommended_sanction": decision_in.recommended_sanction,
            "requires_second_reviewer": requires_second_reviewer
        }
    )

    db.commit()
    db.refresh(decision)
    return decision

@router.post("/decisions/{decision_id}/approve-second-reviewer", response_model=AbuseDecisionOut)
def approve_second_reviewer(
    decision_id: str,
    approval_in: SecondReviewerApprovalRequest,
    current_user: User = Depends(require_role(["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    """
    Second Reviewer Dual-Control approval for serious sanctions.
    The 2nd reviewer CANNOT be the lead reviewer who made the initial decision.
    """
    decision = db.query(AbuseDecision).filter(AbuseDecision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Abuse decision record not found")

    if decision.reviewer_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dual-control policy violation: Second reviewer must be an independent, distinct reviewer."
        )

    decision.second_reviewer_id = current_user.id
    decision.second_reviewer_approval = approval_in.approved
    decision.second_reviewer_notes = approval_in.notes

    # If approved, activate sanction
    if approval_in.approved and decision.recommended_sanction in ["TEMPORARY_RESTRICTION", "SUSPENSION"]:
        complaint = decision.investigation.complaint
        user = db.query(User).filter(User.citizen_pseudonym_id == complaint.citizen_pseudonym_id).first()
        if user:
            sanction = Sanction(
                user_id=user.id,
                citizen_pseudonym_id=complaint.citizen_pseudonym_id,
                sanction_type=decision.recommended_sanction,
                reason=f"Substantiated abuse sanction approved by dual reviewers: {approval_in.notes}",
                start_date=utc_now(),
                end_date=utc_now() + timedelta(days=14 if decision.recommended_sanction == "TEMPORARY_RESTRICTION" else 30),
                is_active=True
            )
            db.add(sanction)
            notify_citizen(
                db=db,
                citizen_pseudonym_id=complaint.citizen_pseudonym_id,
                title=f"Account Notice: Policy Sanction Enacted",
                message=f"A sanction of {decision.recommended_sanction.replace('_', ' ')} has been enacted following secondary review. You may lodge a formal appeal.",
                link="/citizen"
            )

    log_audit_event(
        db=db,
        event_type="SECOND_REVIEWER_ADJUDICATION",
        action="APPROVE_SANCTION" if approval_in.approved else "REJECT_SANCTION",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=decision.id,
        details={
            "approved": approval_in.approved,
            "sanction": decision.recommended_sanction,
            "notes": approval_in.notes
        }
    )

    db.commit()
    db.refresh(decision)
    return decision

# Citizen Appeals
@router.post("/appeals", response_model=AppealOut)
def lodge_appeal(
    appeal_in: AppealCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pseudonym = current_user.citizen_pseudonym_id or "ANONYMOUS_APPELLANT"

    appeal = Appeal(
        target_type=appeal_in.target_type,
        target_id=appeal_in.target_id,
        complainant_pseudonym_id=pseudonym,
        grounds_for_appeal=appeal_in.grounds_for_appeal,
        status="PENDING",
        created_at=utc_now()
    )
    db.add(appeal)

    log_audit_event(
        db=db,
        event_type="APPEAL_LODGED",
        action="LODGE_CITIZEN_APPEAL",
        actor_id=pseudonym,
        actor_role="CITIZEN",
        resource_id=appeal.id,
        details={"target_type": appeal_in.target_type, "target_id": appeal_in.target_id}
    )

    db.commit()
    db.refresh(appeal)
    return appeal

@router.get("/appeals", response_model=List[AppealOut])
def list_appeals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Appeal)
    if current_user.role == "CITIZEN":
        if not current_user.citizen_pseudonym_id:
            return []
        query = query.filter(Appeal.complainant_pseudonym_id == current_user.citizen_pseudonym_id)
    return query.order_by(Appeal.created_at.desc()).all()

@router.patch("/appeals/{appeal_id}/adjudicate", response_model=AppealOut)
def adjudicate_appeal(
    appeal_id: str,
    review_in: AppealReview,
    current_user: User = Depends(require_role(["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    appeal.status = review_in.status  # UPHELD, OVERTURNED, REJECTED
    appeal.reviewer_id = current_user.id
    appeal.review_notes = review_in.review_notes
    appeal.decided_at = utc_now()

    # If appeal is UPHELD (citizen appeal succeeded), revoke or deactivate corresponding sanction
    if review_in.status == "UPHELD":
        sanction = db.query(Sanction).filter(
            Sanction.citizen_pseudonym_id == appeal.complainant_pseudonym_id,
            Sanction.is_active == True
        ).first()
        if sanction:
            sanction.is_active = False

    notify_citizen(
        db=db,
        citizen_pseudonym_id=appeal.complainant_pseudonym_id,
        title=f"Appeal Determination: {review_in.status}",
        message=f"Your appeal regarding {appeal.target_type} has been {review_in.status}. Findings: {review_in.review_notes}",
        link="/citizen"
    )

    log_audit_event(
        db=db,
        event_type="APPEAL_ADJUDICATED",
        action=f"ADJUDICATE_APPEAL_{review_in.status}",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=appeal.id,
        details={"status": review_in.status, "notes": review_in.review_notes}
    )

    db.commit()
    db.refresh(appeal)
    return appeal

@router.get("/sanctions/my", response_model=List[SanctionOut])
def get_my_sanctions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.citizen_pseudonym_id:
        return []
    return db.query(Sanction).filter(
        Sanction.citizen_pseudonym_id == current_user.citizen_pseudonym_id
    ).order_by(Sanction.created_at.desc()).all()
