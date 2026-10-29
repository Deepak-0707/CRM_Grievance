import secrets
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import User, SimulatedIdentityRecord, utc_now
from app.schemas.schemas import SimulatedVerificationRequest, SimulatedVerificationOut
from app.services.audit_service import log_audit_event

def generate_citizen_pseudonym() -> str:
    token = secrets.token_hex(4).upper()
    return f"CITIZEN-{token}"

def complete_simulated_verification(
    db: Session,
    user: User,
    req: SimulatedVerificationRequest
) -> SimulatedVerificationOut:
    """
    Executes the simulated identity verification workflow for the academic demo.
    Issues a pseudonymous citizen identifier and isolates identity records.
    """
    if not req.acknowledgment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must acknowledge that this is a simulated academic prototype verification."
        )

    # Check if already verified
    existing_record = db.query(SimulatedIdentityRecord).filter(SimulatedIdentityRecord.user_id == user.id).first()
    if existing_record:
        return SimulatedVerificationOut(
            is_verified=True,
            citizen_pseudonym_id=existing_record.citizen_pseudonym_id,
            synthetic_full_name=existing_record.synthetic_full_name,
            synthetic_demographic_district=existing_record.synthetic_demographic_district,
            verified_at=existing_record.verified_at,
            message="Account is already verified with simulated credentials."
        )

    pseudonym = generate_citizen_pseudonym()
    # Ensure pseudonym is unique
    while db.query(SimulatedIdentityRecord).filter(SimulatedIdentityRecord.citizen_pseudonym_id == pseudonym).first():
        pseudonym = generate_citizen_pseudonym()

    record = SimulatedIdentityRecord(
        user_id=user.id,
        citizen_pseudonym_id=pseudonym,
        synthetic_full_name=req.synthetic_full_name,
        synthetic_demo_id_type="DEMO_CITIZEN_CARD",
        synthetic_demographic_district=req.synthetic_demographic_district,
        synthetic_phone_masked=req.synthetic_phone_masked,
        verification_method="SIMULATED_ELIGIBILITY_PORTAL",
        verification_notes="Simulated academic credential verification. Not linked to real identity providers.",
        verified_at=utc_now()
    )
    db.add(record)

    user.is_verified = True
    user.citizen_pseudonym_id = pseudonym
    db.flush()

    log_audit_event(
        db=db,
        event_type="SIMULATED_VERIFICATION_COMPLETED",
        action="VERIFY_CITIZEN_ELIGIBILITY",
        actor_id=user.id,
        actor_role=user.role,
        resource_id=pseudonym,
        details={
            "synthetic_district": req.synthetic_demographic_district,
            "pseudonym_issued": pseudonym,
            "notes": "Simulated identity token issued without persisting real identity documents."
        }
    )

    db.commit()
    db.refresh(record)

    return SimulatedVerificationOut(
        is_verified=True,
        citizen_pseudonym_id=record.citizen_pseudonym_id,
        synthetic_full_name=record.synthetic_full_name,
        synthetic_demographic_district=record.synthetic_demographic_district,
        verified_at=record.verified_at,
        message="Simulated eligibility verified successfully. Pseudonymous token issued."
    )
