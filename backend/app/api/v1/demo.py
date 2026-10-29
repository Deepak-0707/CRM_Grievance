from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.seed_service import reset_and_seed_demo_data

router = APIRouter(prefix="/demo", tags=["Demo Scenarios"])

@router.post("/reset")
def reset_demo(db: Session = Depends(get_db)):
    """Reset and re-seed the entire database with pristine Scenarios A through H."""
    return reset_and_seed_demo_data(db)

@router.get("/scenarios")
def get_scenario_metadata():
    """Returns documentation and quick-access data for Scenarios A through H."""
    return [
        {
            "id": "A",
            "title": "Scenario A: Legitimate Complaint Lifecycle",
            "description": "Legitimate grievance (Sinkhole & Culvert damage) progresses from anonymous submission to PWD assignment and full verified resolution.",
            "case_number": "CT-2026-1001",
            "status": "RESOLVED",
            "department": "Public Works Department",
            "role_focus": "Department Officer (Sharma)"
        },
        {
            "id": "B",
            "title": "Scenario B: Insufficient Evidence != Deliberate Fabrication",
            "description": "Complaint regarding discolored water supply is flagged by community, but T&S reviewer dismisses allegation because lack of laboratory evidence is not bad faith.",
            "case_number": "CT-2026-2002",
            "status": "DISMISSED (Abuse Finding)",
            "department": "Water Supply & Sewerage Board",
            "role_focus": "Trust & Safety Reviewer (Chen)"
        },
        {
            "id": "C",
            "title": "Scenario C: Dual-Reviewer Substantiated Abuse Sanction",
            "description": "Complaint contains synthetic doctored invoice. Lead reviewer Chen documents finding and recommends temporary restriction; 2nd reviewer Malik approves.",
            "case_number": "CT-2026-3003",
            "status": "SUBSTANTIATED_ABUSE",
            "department": "Public Works Department",
            "role_focus": "2nd Reviewer (Malik)"
        },
        {
            "id": "D",
            "title": "Scenario D: Citizen Appeal Upheld",
            "description": "Citizen appeals mistaken finding regarding delayed ambulance. Independent review confirms dispatch call records, sanction revoked.",
            "case_number": "CT-2026-4004",
            "status": "UPHELD (Appeal)",
            "department": "Public Health Services",
            "role_focus": "Citizen (Rahul) & Reviewer"
        },
        {
            "id": "E",
            "title": "Scenario E: Identity Disclosure Request REJECTED",
            "description": "Reviewer requested disclosure for transit pass dispute. Admin Gupta REJECTS due to insufficient statutory basis.",
            "case_number": "CT-2026-5005",
            "status": "REJECTED (Disclosure)",
            "department": "Metropolitan Transport Authority",
            "role_focus": "Administrator (Gupta)"
        },
        {
            "id": "F",
            "title": "Scenario F: Authorized Identity Disclosure APPROVED & Audited",
            "description": "Substantiated deepfake audio extortion case against civic inspector. Admin approves disclosure petition with legal basis, access is logged in audit trail.",
            "case_number": "CT-2026-6006",
            "status": "APPROVED (Disclosure)",
            "department": "Municipal Corporation",
            "role_focus": "Administrator & Reviewer"
        },
        {
            "id": "G",
            "title": "Scenario G: Officer Barred from Identity Mapping (403 Forbidden)",
            "description": "Department officer attempting to access simulated identity records receives strict server-side 403 Forbidden and audit violation logged.",
            "case_number": "N/A (Security Boundary)",
            "status": "403_FORBIDDEN_ENFORCED",
            "department": "All Departments",
            "role_focus": "Security & Privacy Vault"
        },
        {
            "id": "H",
            "title": "Scenario H: Coordinated Brigade Flagging Defense",
            "description": "Commercial syndicate coordinates 4 rapid flags against a playground encroachment grievance. Risk scoring engine neutralizes penalty to prevent silencing legitimate public complaint.",
            "case_number": "CT-2026-8008",
            "status": "PROTECTED_BY_DEFENSE_ENGINE",
            "department": "Municipal Corporation",
            "role_focus": "Risk Scoring Engine"
        }
    ]
