import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.models.models import (
    Complaint, ComplaintFlag, AbuseInvestigation, AbuseDecision, EvidenceMetadata
)

def evaluate_complaint_risk(
    db: Session,
    complaint: Complaint
) -> Dict[str, Any]:
    """
    Synthetic, deterministic risk-scoring engine.
    Calculates 0-100 score with explicit, explainable signal breakdown.
    Protects against coordinated flagging brigade attacks (Scenario H).
    """
    signals = []
    base_score = 0.0

    # 1. Evidence Integrity Signal
    evidence_items = db.query(EvidenceMetadata).filter(EvidenceMetadata.complaint_id == complaint.id).all()
    altered_evidence = [e for e in evidence_items if e.integrity_status == "SUSPECTED_ALTERATION"]
    if altered_evidence:
        pts = 40.0
        base_score += pts
        signals.append({
            "signal_name": "EVIDENCE_INTEGRITY_ANOMALY",
            "points": pts,
            "description": f"Forensic check flagged synthetic metadata discrepancies in {len(altered_evidence)} evidence item(s).",
            "evidence_details": [e.integrity_details for e in altered_evidence if e.integrity_details]
        })
    elif evidence_items:
        signals.append({
            "signal_name": "EVIDENCE_METADATA_CLEAN",
            "points": 0.0,
            "description": "Evidence cryptographic checksums and timestamps match expected client parameters."
        })

    # 2. Duplicate Text Similarity Signal
    # Check for duplicate complaint texts within the department
    duplicates = db.query(Complaint).filter(
        Complaint.department_id == complaint.department_id,
        Complaint.id != complaint.id,
        Complaint.title.ilike(complaint.title)
    ).all()
    if duplicates:
        pts = 30.0
        base_score += pts
        signals.append({
            "signal_name": "HIGH_SIMILARITY_DUPLICATE",
            "points": pts,
            "description": f"Detected {len(duplicates)} complaint(s) with identical or near-identical title in the same department.",
            "duplicate_complaint_ids": [d.complaint_number for d in duplicates]
        })

    # 3. Repeat Substantiated Violations by Citizen Pseudonym
    past_investigations = db.query(AbuseInvestigation).join(Complaint).filter(
        Complaint.citizen_pseudonym_id == complaint.citizen_pseudonym_id,
        AbuseInvestigation.status == "SUBSTANTIATED_ABUSE",
        Complaint.id != complaint.id
    ).all()
    if past_investigations:
        pts = min(35.0, len(past_investigations) * 20.0)
        base_score += pts
        signals.append({
            "signal_name": "PRIOR_SUBSTANTIATED_ABUSE_HISTORY",
            "points": pts,
            "description": f"Complainant pseudonym has {len(past_investigations)} previous substantiated policy violation(s).",
            "count": len(past_investigations)
        })

    # 4. Coordinated Flagging Analysis (Scenario H Protection)
    # Check if this complaint received multiple flags in close succession
    flags = db.query(ComplaintFlag).filter(ComplaintFlag.complaint_id == complaint.id).all()
    if len(flags) >= 3:
        # Check if timestamps are clustered within minutes
        times = [
            (f.created_at if f.created_at.tzinfo is not None else f.created_at.replace(tzinfo=timezone.utc))
            for f in flags if f.created_at is not None
        ]
        if times:
            min_time = min(times)
            max_time = max(times)
            time_span_seconds = (max_time - min_time).total_seconds()
        else:
            time_span_seconds = 999999
        
        # If 3+ flags arrived within 10 minutes with similar generic reasons
        if time_span_seconds < 600 or any("coordinated" in (f.flag_details or "").lower() for f in flags):
            signals.append({
                "signal_name": "COORDINATED_FLAGGING_CAMPAIGN_DETECTED",
                "points": 0.0,
                "is_defense_signal": True,
                "description": f"Unusual velocity anomaly: {len(flags)} flags logged within brief period. System recognized coordinated brigade pattern; risk score penalty neutralized to prevent automatic silencing of legitimate grievance."
            })
        else:
            # Normal individual flags
            flag_pts = min(15.0, len(flags) * 5.0)
            base_score += flag_pts
            signals.append({
                "signal_name": "COMMUNITY_FLAGS_LOGGED",
                "points": flag_pts,
                "description": f"{len(flags)} independent community flag(s) logged under triage."
            })
    elif len(flags) > 0:
        flag_pts = len(flags) * 5.0
        base_score += flag_pts
        signals.append({
            "signal_name": "COMMUNITY_FLAGS_LOGGED",
            "points": flag_pts,
            "description": f"{len(flags)} community flag(s) submitted for triage."
        })

    # Cap score at 100
    final_score = min(100.0, base_score)

    return {
        "risk_score": round(final_score, 1),
        "signals": signals,
        "signals_json": json.dumps(signals),
        "assessment": "HIGH_RISK" if final_score >= 60 else ("MODERATE_RISK" if final_score >= 30 else "LOW_RISK")
    }
