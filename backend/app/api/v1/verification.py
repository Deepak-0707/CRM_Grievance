from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, SimulatedIdentityRecord
from app.schemas.schemas import SimulatedVerificationRequest, SimulatedVerificationOut
from app.api.deps import get_current_user
from app.services.verification_service import complete_simulated_verification

router = APIRouter(prefix="/verification", tags=["Identity Verification"])

@router.post("/verify", response_model=SimulatedVerificationOut)
def verify_eligibility(
    req: SimulatedVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return complete_simulated_verification(db=db, user=current_user, req=req)

@router.get("/status")
def get_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(SimulatedIdentityRecord).filter(
        SimulatedIdentityRecord.user_id == current_user.id
    ).first()

    return {
        "is_verified": current_user.is_verified,
        "citizen_pseudonym_id": current_user.citizen_pseudonym_id,
        "verification_date": record.verified_at.isoformat() if record and record.verified_at else None,
        "disclaimer": "CivicTrust: Privacy-Preserving Citizen Verification. Personal credentials are held in an isolated data vault and never published with complaints."
    }
