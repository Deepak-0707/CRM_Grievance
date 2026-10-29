from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import IdentityDisclosureRequest, User, Complaint, ComplaintFlag
from app.schemas.schemas import (
    IdentityDisclosureRequestCreate, IdentityDisclosureReview,
    IdentityDisclosureRequestOut
)
from app.api.deps import get_current_user, require_role
from app.services.disclosure_service import (
    create_disclosure_request, review_disclosure_request, access_disclosed_identity
)

router = APIRouter(prefix="/disclosure", tags=["Conditional Identity Disclosure"])

@router.get("/requests")
def list_disclosure_requests(
    current_user: User = Depends(require_role(["PRIVACY_OFFICER"])),
    db: Session = Depends(get_db)
):
    requests = db.query(IdentityDisclosureRequest).order_by(IdentityDisclosureRequest.created_at.desc()).all()
    results = []
    for r in requests:
        complaint = r.investigation.complaint if r.investigation else None
        past_flags_count = 0
        if complaint:
            past_flags_count = db.query(ComplaintFlag).join(
                Complaint, ComplaintFlag.complaint_id == Complaint.id
            ).filter(
                Complaint.citizen_pseudonym_id == complaint.citizen_pseudonym_id
            ).count()
        FLAGS_THRESHOLD = 3
        is_threshold_met = past_flags_count >= FLAGS_THRESHOLD

        results.append({
            "id": r.id,
            "investigation_id": r.investigation_id,
            "complaint_id": r.complaint_id,
            "complaint_number": complaint.complaint_number if complaint else "N/A",
            "citizen_pseudonym_id": complaint.citizen_pseudonym_id if complaint else "N/A",
            "requested_by_reviewer_id": r.requested_by_reviewer_id,
            "requested_by_name": r.requested_by.username if r.requested_by else "Reviewer",
            "legal_and_policy_basis": r.legal_and_policy_basis,
            "status": r.status,
            "reviewed_by_admin_id": r.reviewed_by_admin_id,
            "reviewed_by_admin_name": r.reviewed_by.username if r.reviewed_by else None,
            "admin_rationale": r.admin_rationale,
            "past_flags_count": past_flags_count,
            "is_flag_threshold_met": is_threshold_met,
            "flags_threshold": FLAGS_THRESHOLD,
            "reviewed_at": r.reviewed_at,
            "accessed_at": r.accessed_at,
            "revealed_synthetic_snapshot": r.revealed_synthetic_snapshot,
            "created_at": r.created_at
        })
    return results

@router.post("/requests")
def submit_disclosure_request(
    req_in: IdentityDisclosureRequestCreate,
    current_user: User = Depends(require_role(["TRUST_SAFETY_REVIEWER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    request = create_disclosure_request(db=db, reviewer=current_user, req_in=req_in)
    return {"message": "Disclosure request submitted for administrative review.", "request_id": request.id, "status": request.status}

@router.patch("/requests/{request_id}/review")
def adjudicate_disclosure_request(
    request_id: str,
    review_in: IdentityDisclosureReview,
    current_user: User = Depends(require_role(["PRIVACY_OFFICER"])),
    db: Session = Depends(get_db)
):
    request = review_disclosure_request(db=db, admin=current_user, request_id=request_id, review=review_in)
    return {"message": f"Disclosure request {request.status}.", "status": request.status, "request_id": request.id}

@router.post("/requests/{request_id}/access")
def access_identity_record(
    request_id: str,
    current_user: User = Depends(get_current_user),  # Check role inside service to enforce Scenario G 403 for Officers!
    db: Session = Depends(get_db)
):
    """
    CRITICAL ACCESS GATE:
    Accesses synthetic identity record ONLY if request is APPROVED.
    Department Officers receive 403 Forbidden (Scenario G).
    """
    snapshot = access_disclosed_identity(db=db, current_user=current_user, request_id=request_id)
    return {
        "access_status": "AUTHORIZED",
        "identity_record": snapshot,
        "audit_notice": "Identity disclosure logged with cryptographic timestamp in append-only audit trail."
    }
