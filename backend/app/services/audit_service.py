import json
import hashlib
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import AuditEvent, utc_now

def get_latest_audit_hash(db: Session) -> str:
    """Fetch the tamper hash of the most recent audit event to chain to the new one."""
    latest = db.query(AuditEvent).order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).first()
    if latest and latest.tamper_hash:
        return latest.tamper_hash
    # Genesis hash for the initial state of the audit chain
    return "0000000000000000000000000000000000000000000000000000000000000000"

def log_audit_event(
    db: Session,
    event_type: str,
    action: str,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: str = "127.0.0.1"
) -> AuditEvent:
    """
    Append an audit event with cryptographic tamper-evident hash chaining.
    """
    details_str = json.dumps(details or {}, sort_keys=True, default=str)
    previous_hash = get_latest_audit_hash(db)
    now = utc_now()
    
    # Calculate SHA-256 hash chaining previous_hash + event content
    hasher = hashlib.sha256()
    hasher.update(previous_hash.encode("utf-8"))
    hasher.update(event_type.encode("utf-8"))
    hasher.update((actor_id or "ANONYMOUS").encode("utf-8"))
    hasher.update(action.encode("utf-8"))
    hasher.update(details_str.encode("utf-8"))
    hasher.update(now.isoformat().encode("utf-8"))
    tamper_hash = hasher.hexdigest()

    event = AuditEvent(
        event_type=event_type,
        actor_id=actor_id,
        actor_role=actor_role,
        ip_address=ip_address,
        resource_id=resource_id,
        action=action,
        details_json=details_str,
        previous_hash=previous_hash,
        tamper_hash=tamper_hash,
        created_at=now
    )
    db.add(event)
    db.flush()
    return event

def verify_audit_chain_integrity(db: Session) -> Dict[str, Any]:
    """Verify that the append-only audit trail has not been tampered with or altered."""
    events = db.query(AuditEvent).order_by(AuditEvent.created_at.asc(), AuditEvent.id.asc()).all()
    if not events:
        return {"status": "HEALTHY", "verified_count": 0, "is_valid": True}

    prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
    for idx, ev in enumerate(events):
        if ev.previous_hash != prev_hash:
            return {
                "status": "TAMPER_DETECTED",
                "broken_index": idx,
                "event_id": ev.id,
                "is_valid": False,
                "expected_prev": prev_hash,
                "actual_prev": ev.previous_hash
            }
        prev_hash = ev.tamper_hash

    return {
        "status": "VERIFIED_SECURE",
        "verified_count": len(events),
        "is_valid": True,
        "latest_hash": prev_hash
    }
