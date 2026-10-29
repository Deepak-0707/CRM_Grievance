import pytest
import io
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

def test_complete_complaint_and_evidence_lifecycle():
    """Citizen files complaint, uploads private evidence, downloads with authorization, and receives messages."""
    citizen_token = get_auth_token("priya_citizen")
    officer_token = get_auth_token("officer_sharma")

    # 1. Fetch departments
    res_depts = client.get("/api/v1/complaints/departments")
    assert res_depts.status_code == 200
    pwd_dept = next(d for d in res_depts.json() if d["code"] == "PWD")

    # 2. Citizen lodges complaint
    res_lodge = client.post(
        "/api/v1/complaints/",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={
            "title": "Severe Waterlogging and Broken Culvert on Sector 14 Ring Road",
            "description": "Monsoon overflow caused culvert collapse; street impassable for 48 hours.",
            "department_id": pwd_dept["id"],
            "category": "INFRASTRUCTURE_DAMAGE",
            "state": "National Capital Region",
            "district": "South-East Metro Zone",
            "approximate_location": "Sector 14 Ring Road Junction",
            "incident_date": "2026-10-18T10:00:00Z"
        }
    )
    assert res_lodge.status_code == 200
    comp_data = res_lodge.json()
    complaint_id = comp_data["id"]
    complaint_number = comp_data["complaint_number"]
    assert complaint_number.startswith("CT-")

    # 3. Citizen uploads evidence file
    file_bytes = b"%PDF-1.4 Mock civic culvert structural survey data"
    file_upload = ("culvert_report.pdf", io.BytesIO(file_bytes), "application/pdf")
    res_upload = client.post(
        f"/api/v1/complaints/{complaint_id}/evidence",
        headers={"Authorization": f"Bearer {citizen_token}"},
        files={"file": file_upload},
        data={"description": "Site structural assessment report"}
    )
    assert res_upload.status_code == 200
    upload_json = res_upload.json()
    evidence_id = upload_json["id"]
    assert upload_json["integrity_status"] == "VERIFIED"
    assert len(upload_json["sha256_hash"]) == 64

    # 4. Citizen downloads their own evidence
    res_dl_citizen = client.get(
        f"/api/v1/complaints/{complaint_id}/evidence/{evidence_id}/download",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert res_dl_citizen.status_code == 200
    assert len(res_dl_citizen.content) > 0

    # 5. Assigned officer downloads evidence
    res_dl_officer = client.get(
        f"/api/v1/complaints/{complaint_id}/evidence/{evidence_id}/download",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res_dl_officer.status_code == 200

    # 6. Officer sends clarification message to citizen
    res_msg_officer = client.post(
        f"/api/v1/complaints/{complaint_id}/message",
        headers={"Authorization": f"Bearer {officer_token}"},
        json={"message": "Can you confirm if road barricading was placed by local police?"}
    )
    assert res_msg_officer.status_code == 200

    # 7. Citizen replies anonymously
    res_msg_citizen = client.post(
        f"/api/v1/complaints/{complaint_id}/message",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"message": "No official barricading present; residents placed emergency warning flags."}
    )
    assert res_msg_citizen.status_code == 200

def test_officer_crm_workflow_and_case_transfer():
    """Test officer case assignment, priority update, internal notes, transfer across departments."""
    officer_sharma_token = get_auth_token("officer_sharma")
    officer_anita_token = get_auth_token("officer_anita")
    admin_token = get_auth_token("admin_gupta")

    # Get PWD cases
    res_cases = client.get("/api/v1/crm/cases", headers={"Authorization": f"Bearer {officer_sharma_token}"})
    assert res_cases.status_code == 200
    pwd_case = res_cases.json()[0]
    case_id = pwd_case["id"]

    # Assign case to officer
    res_officers = client.get(
        f"/api/v1/crm/departments/{pwd_case['department_id']}/officers",
        headers={"Authorization": f"Bearer {officer_sharma_token}"}
    )
    assert res_officers.status_code == 200
    officer_id = res_officers.json()[0]["id"]

    res_assign = client.patch(
        f"/api/v1/crm/cases/{case_id}/assign",
        headers={"Authorization": f"Bearer {officer_sharma_token}"},
        json={"assigned_to_id": officer_id, "notes": "Assigned to primary field engineer."}
    )
    assert res_assign.status_code == 200

    # Update priority with recorded reason
    res_priority = client.patch(
        f"/api/v1/crm/cases/{case_id}/priority",
        headers={"Authorization": f"Bearer {officer_sharma_token}"},
        json={"priority": "HIGH", "priority_justification": "Risk of urban traffic gridlock."}
    )
    assert res_priority.status_code == 200
    assert res_priority.json()["priority"] == "HIGH"

    # Add restricted internal note (never shown to public)
    res_note = client.post(
        f"/api/v1/crm/cases/{case_id}/internal-notes",
        headers={"Authorization": f"Bearer {officer_sharma_token}"},
        json={"internal_note": "Field contractor contacted for asphalt shipment dispatch."}
    )
    assert res_note.status_code == 200
    assert "asphalt shipment" in res_note.json()["notes"]

    # Transfer case to Water Board (e.g. underlying sewer line issue)
    depts = client.get("/api/v1/complaints/departments").json()
    water_dept = next(d for d in depts if d["code"] == "WATER")

    res_transfer = client.post(
        f"/api/v1/crm/cases/{case_id}/transfer",
        headers={"Authorization": f"Bearer {officer_sharma_token}"},
        json={
            "new_department_id": water_dept["id"],
            "transfer_justification": "Excavation revealed rupture in municipal drainage trunk line."
        }
    )
    assert res_transfer.status_code == 200
    assert res_transfer.json()["department_id"] == water_dept["id"]

    # Water Board officer now sees the transferred case
    res_water_cases = client.get(
        f"/api/v1/crm/cases?department_id={water_dept['id']}",
        headers={"Authorization": f"Bearer {officer_anita_token}"}
    )
    assert res_water_cases.status_code == 200
    case_ids = [c["id"] for c in res_water_cases.json()]
    assert case_id in case_ids

def test_case_resolution_and_in_app_notifications():
    """Formal case resolution generates citizen in-app notification; citizen marks as read."""
    officer_sharma_token = get_auth_token("officer_sharma")
    citizen_token = get_auth_token("priya_citizen")

    # Find a complaint belonging to Priya assigned to Officer Sharma's department (PWD)
    res_my = client.get("/api/v1/complaints/my", headers={"Authorization": f"Bearer {citizen_token}"})
    priya_case = next(c for c in res_my.json() if c.get("department_name") == "Public Works Department")
    case_id = priya_case["id"]

    # Resolve the case
    res_res = client.post(
        f"/api/v1/crm/cases/{case_id}/resolve",
        headers={"Authorization": f"Bearer {officer_sharma_token}"},
        json={
            "resolution_summary": "Pothole filled with composite asphalt; road reopened for traffic.",
            "internal_resolution_notes": "Contractor work order closed under budget code PWD-402."
        }
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"

    # Priya checks notifications
    res_notifs = client.get("/api/v1/notifications/", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_notifs.status_code == 200
    notifs = res_notifs.json()
    assert len(notifs) > 0

    # Check unread count
    res_unread = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_unread.status_code == 200
    assert res_unread.json()["unread_count"] > 0

    # Mark single notification as read
    first_notif_id = notifs[0]["id"]
    res_mark = client.patch(f"/api/v1/notifications/{first_notif_id}/read", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_mark.status_code == 200
    assert res_mark.json()["is_read"] is True

    # Mark all notifications as read
    res_all = client.post("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_all.status_code == 200

    # Unread count should now be 0
    res_unread_post = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_unread_post.json()["unread_count"] == 0

def test_password_reset_flow_and_session_invalidation():
    """Verify forgot-password token generation, password update, and logout audit."""
    # 1. Request password reset
    res_forgot = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "priya.citizen@civictrust.gov"}
    )
    assert res_forgot.status_code == 200
    reset_token = res_forgot.json()["reset_token"]
    assert reset_token is not None

    # 2. Reset password
    res_reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "NewSecretPass2026!"}
    )
    assert res_reset.status_code == 200

    # 3. Old password fails
    res_old_login = client.post(
        "/api/v1/auth/login",
        json={"username": "priya_citizen", "password": "Pass1234!"}
    )
    assert res_old_login.status_code == 401

    # 4. New password succeeds
    res_new_login = client.post(
        "/api/v1/auth/login",
        json={"username": "priya_citizen", "password": "NewSecretPass2026!"}
    )
    assert res_new_login.status_code == 200
    new_token = res_new_login.json()["access_token"]

    # 5. Logout session invalidation
    res_logout = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {new_token}"})
    assert res_logout.status_code == 200
    assert "invalidated" in res_logout.json()["message"]

def test_department_workload_and_sla_configuration():
    """Admin configures department SLA hours; workload metrics accurately calculated."""
    admin_token = get_auth_token("admin_gupta")

    # Get department workloads
    res_wl = client.get("/api/v1/crm/departments", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_wl.status_code == 200
    workloads = res_wl.json()
    assert len(workloads) > 0
    pwd_dept = next(w for w in workloads if w["code"] == "PWD")
    assert pwd_dept["officer_count"] >= 1
    assert pwd_dept["default_sla_hours"] > 0

    # Admin updates SLA policy for PWD
    res_update_sla = client.patch(
        f"/api/v1/crm/departments/{pwd_dept['id']}/sla",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"default_sla_hours": 36, "description": "Accelerated municipal emergency response policy."}
    )
    assert res_update_sla.status_code == 200
    assert res_update_sla.json()["default_sla_hours"] == 36
