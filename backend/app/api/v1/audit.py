from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import AuditEvent, User
from app.schemas.schemas import AuditEventOut
from app.api.deps import require_role
from app.services.audit_service import verify_audit_chain_integrity

router = APIRouter(prefix="/audit", tags=["Audit Logs"])

@router.get("/events", response_model=List[AuditEventOut])
def list_audit_events(
    event_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(["ADMINISTRATOR", "TRUST_SAFETY_REVIEWER", "PRIVACY_OFFICER"])),
    db: Session = Depends(get_db)
):
    """
    Returns immutable append-only audit event log entries with SHA-256 hash chains.
    """
    query = db.query(AuditEvent)
    if event_type:
        query = query.filter(AuditEvent.event_type == event_type)
    return query.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).offset(offset).limit(limit).all()

@router.get("/verify-chain")
def check_chain_integrity(
    current_user: User = Depends(require_role(["ADMINISTRATOR", "TRUST_SAFETY_REVIEWER", "PRIVACY_OFFICER"])),
    db: Session = Depends(get_db)
):
    """
    Cryptographic verification endpoint: checks all sequential hashes from genesis to latest.
    """
    return verify_audit_chain_integrity(db)
