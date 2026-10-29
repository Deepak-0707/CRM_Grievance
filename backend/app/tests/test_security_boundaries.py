import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.services.seed_service import reset_and_seed_demo_data

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_clean_db():
    with SessionLocal() as db:
        reset_and_seed_demo_data(db)

def get_auth_token(username: str, password: str = "Pass1234!") -> str:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["access_token"]

def test_cross_citizen_complaint_isolation():
    """Citizens must only access their own private complaints and evidence."""
    priya_token = get_auth_token("priya_citizen")
    rahul_token = get_auth_token("rahul_citizen")

    # Get Priya's complaints
    res_priya = client.get("/api/v1/complaints/my", headers={"Authorization": f"Bearer {priya_token}"})
    assert res_priya.status_code == 200
    priya_cases = res_priya.json()
    assert len(priya_cases) > 0
    priya_case_id = priya_cases[0]["id"]

    # Rahul attempts to view Priya's complaint via private detail endpoint -> MUST RECEIVE 403
    res_cross = client.get(f"/api/v1/complaints/{priya_case_id}", headers={"Authorization": f"Bearer {rahul_token}"})
    assert res_cross.status_code == 403
    assert "Forbidden" in res_cross.json()["detail"]

def test_citizen_cannot_perform_officer_or_admin_status_update():
    """Citizens must not be able to update case status or escalate permissions."""
    priya_token = get_auth_token("priya_citizen")
    res_priya = client.get("/api/v1/complaints/my", headers={"Authorization": f"Bearer {priya_token}"})
    priya_case_id = res_priya.json()[0]["id"]

    # Citizen attempts to mark case as RESOLVED via CRM endpoint -> MUST RECEIVE 403
    res_hack = client.patch(
        f"/api/v1/crm/cases/{priya_case_id}/status",
        headers={"Authorization": f"Bearer {priya_token}"},
        json={"status": "RESOLVED", "public_note": "Self-resolved"}
    )
    assert res_hack.status_code == 403
    assert "Forbidden" in res_hack.json()["detail"]

def test_cross_department_officer_evidence_isolation():
    """Officers from Water Board cannot download evidence belonging to Public Works Department."""
    anita_token = get_auth_token("officer_anita")  # Water Board
    sharma_token = get_auth_token("officer_sharma")  # PWD

    # Find PWD complaint with evidence
    res_cases = client.get("/api/v1/crm/cases", headers={"Authorization": f"Bearer {sharma_token}"})
    pwd_cases = res_cases.json()
    assert len(pwd_cases) > 0
    pwd_case = pwd_cases[0]

    if pwd_case.get("evidence"):
        evidence_id = pwd_case["evidence"][0]["id"]
        # Officer Anita from Water attempts to download PWD evidence -> MUST RECEIVE 403
        res_cross_dl = client.get(
            f"/api/v1/complaints/{pwd_case['id']}/evidence/{evidence_id}/download",
            headers={"Authorization": f"Bearer {anita_token}"}
        )
        assert res_cross_dl.status_code == 403
        assert "different government department" in res_cross_dl.json()["detail"]

def test_unauthenticated_evidence_download_forbidden():
    """Public visitor without bearer token cannot download evidence files."""
    sharma_token = get_auth_token("officer_sharma")
    res_cases = client.get("/api/v1/crm/cases", headers={"Authorization": f"Bearer {sharma_token}"})
    pwd_case = res_cases.json()[0]

    if pwd_case.get("evidence"):
        evidence_id = pwd_case["evidence"][0]["id"]
        # Public download attempt -> MUST RECEIVE 401
        res_anon = client.get(f"/api/v1/complaints/{pwd_case['id']}/evidence/{evidence_id}/download")
        assert res_anon.status_code == 401

def test_dual_control_disclosure_requester_self_approval_blocked():
    """A reviewer who submits an identity disclosure petition cannot self-approve it."""
    reviewer_token = get_auth_token("reviewer_chen")

    # Get Scenario E investigation
    res_inv = client.get("/api/v1/trust-safety/investigations", headers={"Authorization": f"Bearer {reviewer_token}"})
    inv_e = next(i for i in res_inv.json() if i.get("complaint_number") == "CT-2026-5005")

    # Reviewer Chen submits a disclosure request
    res_req = client.post(
        "/api/v1/disclosure/requests",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={
            "investigation_id": inv_e["id"],
            "complaint_id": inv_e["complaint_id"],
            "legal_and_policy_basis": "Statutory inspection request"
        }
    )
    assert res_req.status_code == 200
    req_id = res_req.json()["request_id"]

    # Reviewer Chen attempts to self-adjudicate -> MUST RECEIVE 403 or 400 Dual-Control violation
    res_self = client.patch(
        f"/api/v1/disclosure/requests/{req_id}/review",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"approved": True, "admin_rationale": "I approve my own request"}
    )
    # Role checker restricts review to ADMINISTRATOR / PRIVACY_OFFICER, so reviewer receives 403
    assert res_self.status_code == 403

def test_privacy_officer_adjudication_and_dual_control():
    """Privacy Officer can adjudicate disclosure requests, and separation of duties is enforced."""
    privacy_officer_token = get_auth_token("privacy_officer_verma")
    reviewer_token = get_auth_token("reviewer_chen")

    # Privacy Officer can list requests
    res_list = client.get("/api/v1/disclosure/requests", headers={"Authorization": f"Bearer {privacy_officer_token}"})
    assert res_list.status_code == 200
    requests = res_list.json()
    assert len(requests) > 0

    # Privacy officer rejects ungrounded request
    pending_req = next((r for r in requests if r["status"] == "PENDING_APPROVAL"), None)
    if not pending_req:
        # Create one via Reviewer Chen
        res_inv = client.get("/api/v1/trust-safety/investigations", headers={"Authorization": f"Bearer {reviewer_token}"})
        inv = res_inv.json()[0]
        res_new_req = client.post(
            "/api/v1/disclosure/requests",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={
                "investigation_id": inv["id"],
                "complaint_id": inv["complaint_id"],
                "legal_and_policy_basis": "Audit justification test"
            }
        )
        req_id = res_new_req.json()["request_id"]
    else:
        req_id = pending_req["id"]

    # Privacy Officer rejects with documented rationale
    res_review = client.patch(
        f"/api/v1/disclosure/requests/{req_id}/review",
        headers={"Authorization": f"Bearer {privacy_officer_token}"},
        json={
            "approved": False,
            "admin_rationale": "Denied under privacy proportionality standard: insufficient factual nexus."
        }
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "REJECTED"

def test_rejected_disclosure_request_never_leaks_identity():
    """Accessing identity on a REJECTED disclosure petition returns HTTP 400/403 and zero identity data."""
    privacy_officer_token = get_auth_token("privacy_officer_verma")

    res_list = client.get("/api/v1/disclosure/requests", headers={"Authorization": f"Bearer {privacy_officer_token}"})
    requests = res_list.json()
    rejected_req = next(r for r in requests if r["status"] == "REJECTED")

    # Attempt to access identity on rejected petition
    res_access = client.post(
        f"/api/v1/disclosure/requests/{rejected_req['id']}/access",
        headers={"Authorization": f"Bearer {privacy_officer_token}"}
    )
    assert res_access.status_code == 400
    assert "Cannot disclose identity" in res_access.json()["detail"]
