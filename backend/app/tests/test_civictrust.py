import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.services.seed_service import reset_and_seed_demo_data
from app.services.audit_service import verify_audit_chain_integrity

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_clean_db():
    with SessionLocal() as db:
        reset_and_seed_demo_data(db)

def get_auth_token(username: str, password: str = "Pass1234!") -> str:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["access_token"]

def test_auth_and_roles():
    """Verify login and role tokens for different user personas."""
    # Citizen
    citizen_token = get_auth_token("priya_citizen")
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "CITIZEN"

    # Officer
    officer_token = get_auth_token("officer_sharma")
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "DEPARTMENT_OFFICER"

    # Reviewer
    reviewer_token = get_auth_token("reviewer_chen")
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "TRUST_SAFETY_REVIEWER"

    # Admin
    admin_token = get_auth_token("admin_gupta")
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "ADMINISTRATOR"

def test_public_transparency_privacy_boundary():
    """Verify public endpoint never leaks citizen identities, emails, or internal notes."""
    res = client.get("/api/v1/public/complaints")
    assert res.status_code == 200
    complaints = res.json()
    assert len(complaints) > 0

    for c in complaints:
        # Public data must never have citizen identity fields
        assert "citizen_name" not in c
        assert "email" not in c
        assert "internal_investigation_notes" not in c
        assert "rejection_reason" not in c or c["status"] == "REJECTED_WITH_REASON"
        assert "user_id" not in c

def test_officer_denied_identity_access_scenario_g():
    """
    Scenario G: Ordinary department officer attempts to access identity disclosure endpoint
    and receives strict HTTP 403 Forbidden.
    """
    officer_token = get_auth_token("officer_sharma")
    # Attempt to access identity on approved disclosure request
    # First get disclosure requests as privacy officer to find request_id
    privacy_officer_token = get_auth_token("privacy_officer_verma")
    res_reqs = client.get("/api/v1/disclosure/requests", headers={"Authorization": f"Bearer {privacy_officer_token}"})
    assert res_reqs.status_code == 200
    requests = res_reqs.json()
    approved_req = next((r for r in requests if r["status"] == "APPROVED"), None)
    assert approved_req is not None

    # Officer attempts access -> MUST RETURN 403 FORBIDDEN
    res_access = client.post(
        f"/api/v1/disclosure/requests/{approved_req['id']}/access",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res_access.status_code == 403
    assert "Department Officers are barred" in res_access.json()["detail"]

def test_coordinated_flagging_defense_scenario_h():
    """
    Scenario H: Multiple coordinated flags on a legitimate complaint are detected by the risk engine
    and do NOT trigger automatic punishment or elevated penalty score.
    """
    reviewer_token = get_auth_token("reviewer_chen")
    res = client.get("/api/v1/trust-safety/investigations", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert res.status_code == 200
    investigations = res.json()

    # Find Scenario H investigation (Case CT-2026-8008)
    inv_h = next((i for i in investigations if i.get("complaint_number") == "CT-2026-8008"), None)
    assert inv_h is not None

    # 4 flags exist, but risk score is preserved low (10.0) thanks to defense signal
    assert inv_h["risk_score"] <= 15.0
    signals = inv_h["risk_signals_json"]
    assert "COORDINATED_FLAGGING_CAMPAIGN_DETECTED" in signals

def test_complaint_rejection_without_identity_exposure_or_sanction():
    """Verify that a complaint being rejected does NOT automatically disclose identity or apply a sanction."""
    officer_token = get_auth_token("officer_sharma")
    
    # Create new complaint as citizen
    citizen_token = get_auth_token("priya_citizen")
    dept_res = client.get("/api/v1/complaints/departments")
    pwd_id = next(d["id"] for d in dept_res.json() if d["code"] == "PWD")

    res_lodge = client.post(
        "/api/v1/complaints/",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={
            "title": "Pothole on Main Road Block F",
            "description": "Small pothole requiring asphalt patching after rain.",
            "department_id": pwd_id,
            "category": "INFRASTRUCTURE_DAMAGE",
            "state": "National Capital Region",
            "district": "South-East Metro Zone",
            "approximate_location": "Main Road Block F",
            "incident_date": "2026-10-14T00:00:00Z"
        }
    )
    assert res_lodge.status_code == 200
    new_comp_id = res_lodge.json()["id"]

    # Officer rejects complaint for administrative reasons
    res_reject = client.patch(
        f"/api/v1/crm/cases/{new_comp_id}/status",
        headers={"Authorization": f"Bearer {officer_token}"},
        json={
            "status": "REJECTED_WITH_REASON",
            "rejection_reason": "Jurisdiction lies with private colony management, not state PWD.",
            "public_note": "Grievance redirected to local colony RWA."
        }
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "REJECTED_WITH_REASON"

    # Verify no sanction was placed on citizen
    res_sanctions = client.get("/api/v1/trust-safety/sanctions/my", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_sanctions.status_code == 200
    assert len(res_sanctions.json()) == 0

def test_tamper_evident_audit_chain_integrity():
    """Verify that the cryptographic hash chain of audit events is valid."""
    admin_token = get_auth_token("admin_gupta")
    res = client.get("/api/v1/audit/verify-chain", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["status"] == "VERIFIED_SECURE"
    assert data["verified_count"] > 0

def test_dual_reviewer_sanction_flow_scenario_c():
    """
    Scenario C: Dual-reviewer workflow for serious sanctions.
    Lead reviewer recommends TEMPORARY_RESTRICTION, 2nd reviewer approves it.
    """
    reviewer_1_token = get_auth_token("reviewer_chen")
    reviewer_2_token = get_auth_token("reviewer_malik")

    # Find investigation for Scenario C (CT-2026-3003)
    res_inv = client.get("/api/v1/trust-safety/investigations", headers={"Authorization": f"Bearer {reviewer_1_token}"})
    inv_c = next(i for i in res_inv.json() if i.get("complaint_number") == "CT-2026-3003")

    # Lead reviewer records finding with serious sanction
    res_dec = client.post(
        f"/api/v1/trust-safety/investigations/{inv_c['id']}/decisions",
        headers={"Authorization": f"Bearer {reviewer_1_token}"},
        json={
            "finding": "SUBSTANTIATED_ABUSE",
            "rationale": "Digital alteration verified via forensic checksum and raster layer.",
            "evidence_examined": "Altered invoice graphic.",
            "recommended_sanction": "TEMPORARY_RESTRICTION"
        }
    )
    assert res_dec.status_code == 200
    dec_id = res_dec.json()["id"]

    # Same reviewer cannot approve their own 2nd reviewer check (dual control)
    res_self_approve = client.post(
        f"/api/v1/trust-safety/decisions/{dec_id}/approve-second-reviewer",
        headers={"Authorization": f"Bearer {reviewer_1_token}"},
        json={"approved": True, "notes": "Self approval attempt"}
    )
    assert res_self_approve.status_code == 400

    # 2nd independent reviewer approves
    res_2nd_approve = client.post(
        f"/api/v1/trust-safety/decisions/{dec_id}/approve-second-reviewer",
        headers={"Authorization": f"Bearer {reviewer_2_token}"},
        json={"approved": True, "notes": "Second reviewer concur: deliberate forgery confirmed."}
    )
    assert res_2nd_approve.status_code == 200
    assert res_2nd_approve.json()["second_reviewer_approval"] is True
