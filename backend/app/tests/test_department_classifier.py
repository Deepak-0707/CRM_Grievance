import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.services.seed_service import reset_and_seed_demo_data
from app.services.department_classifier_service import (
    classify_department, verify_department_routing, get_classifier_metrics, load_classifier_pipeline
)
from app.ml.dataset_generator import generate_1000_records
from app.models.models import Department, Complaint

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_clean_db():
    with SessionLocal() as db:
        reset_and_seed_demo_data(db)

def get_auth_token(username: str, password: str = "Pass1234!") -> str:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]

def test_synthetic_dataset_1000_records():
    """Verify that exactly 1,000 synthetic records are generated with balanced departments."""
    records = generate_1000_records()
    assert len(records) == 1000, f"Expected 1,000 records, got {len(records)}"

    dept_counts = {}
    for r in records:
        assert "id" in r
        assert "title" in r and len(r["title"]) > 5
        assert "description" in r and len(r["description"]) > 20
        assert "department_code" in r
        dept_counts[r["department_code"]] = dept_counts.get(r["department_code"], 0) + 1

    expected_depts = {"PWD", "WATER", "ELEC", "MC", "TRANS", "HEALTH", "EDU"}
    assert set(dept_counts.keys()) == expected_depts
    # Check balanced distribution (~142-143 each)
    for code, count in dept_counts.items():
        assert 140 <= count <= 145, f"Department {code} has unbalanced count: {count}"

def test_model_pipeline_evaluation_metrics():
    """Verify model pipeline achieves high accuracy (>95%) on 200 hold-out test samples."""
    metrics = get_classifier_metrics()
    assert metrics["dataset_total_records"] == 1000
    assert metrics["train_samples_count"] == 800
    assert metrics["test_samples_count"] == 200
    assert metrics["test_accuracy"] >= 0.95
    assert metrics["macro_avg_f1"] >= 0.95
    assert len(metrics["departments_evaluated"]) == 7

def test_department_classification_accuracy():
    """Verify predictions across each domain category."""
    test_cases = [
        ("Dangerous sinkhole and crater on arterial road", "Asphalt has eroded and deep potholes are damaging car tires", "PWD"),
        ("Brown muddy tap water and low pressure", "Underground drinking water main broken and sewage contamination in pipeline", "WATER"),
        ("Buzzing distribution transformer and voltage surge", "Sparks flying from live overhead electricity wire hanging near footpath", "ELEC"),
        ("Rotting garbage heap and stray dog aggression", "Sanitation tippers have not collected trash and dead animal carcass on corner", "MC"),
        ("Bus skipping stop and broken ticketing machine", "Driver speeding recklessly and conductor overcharging on route 534", "TRANS"),
        ("Primary health dispensary closed during OPD", "Shortage of anti-rabies vaccine and urgent dengue mosquito fogging needed", "HEALTH"),
        ("Unhygienic mid-day meal at government school", "Cracked concrete classroom ceiling plaster falling on student desks", "EDU"),
    ]

    for title, desc, expected_code in test_cases:
        res = classify_department(title, desc)
        assert res["predicted_department_code"] == expected_code, f"Failed for {title}: got {res['predicted_department_code']}"
        assert res["confidence"] > 0.40
        assert len(res["department_rankings"]) == 7

def test_verify_department_good_match():
    """Verify routing verification accepts valid department selections."""
    with SessionLocal() as db:
        pwd = db.query(Department).filter(Department.code == "PWD").first()
        res = verify_department_routing(
            title="Deep road potholes",
            description="Large crater on outer ring road asphalt causing skidding",
            selected_department_id=pwd.id,
            db=db
        )
        assert res["is_good_department"] is True
        assert res["verification_status"] in ["VERIFIED_GOOD_MATCH", "ACCEPTABLE_MATCH"]
        assert res["selected_department_code"] == "PWD"
        assert res["predicted_department_code"] == "PWD"

def test_verify_department_mismatch_warning():
    """Verify routing verification detects severe department misroutes with actionable guidance."""
    with SessionLocal() as db:
        mc = db.query(Department).filter(Department.code == "MC").first()
        elec = db.query(Department).filter(Department.code == "ELEC").first()

        # Grievance is clearly electrical, but citizen selects Municipal Corporation
        res = verify_department_routing(
            title="Live wire and transformer buzzing violently",
            description="High voltage cable dangling and sparks flying from power transformer near house",
            selected_department_id=mc.id,
            db=db
        )

        assert res["is_good_department"] is False
        assert res["verification_status"] == "WARNING_MISMATCH"
        assert res["selected_department_code"] == "MC"
        assert res["predicted_department_code"] == "ELEC"
        assert res["recommended_department_code"] == "ELEC"
        assert "Mismatch Warning" in res["verification_message"]
        assert "State Electricity Distribution" in res["verification_message"]

def test_api_classify_department_endpoint():
    """Verify HTTP API endpoint for real-time classification and verification."""
    with SessionLocal() as db:
        water = db.query(Department).filter(Department.code == "WATER").first()

    payload = {
        "title": "Severe contaminated tap water supply",
        "description": "For three days our municipal pipeline water has yellow silt and sewage stench.",
        "selected_department_id": water.id
    }
    res = client.post("/api/v1/complaints/classify-department", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["predicted_department_code"] == "WATER"
    assert data["is_good_department"] is True
    assert data["verification_status"] in ["VERIFIED_GOOD_MATCH", "ACCEPTABLE_MATCH"]
    assert len(data["department_rankings"]) == 7

def test_api_classifier_metrics_endpoint():
    """Verify metrics API returns evaluation report from 1,000 synthetic records."""
    res = client.get("/api/v1/complaints/classifier/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_total_records"] == 1000
    assert data["train_samples_count"] == 800
    assert data["test_samples_count"] == 200
    assert "test_accuracy_pct" in data
    assert "per_department_metrics" in data

def test_complaint_submission_stores_verification():
    """Verify lodged complaint automatically records classification and verification metadata."""
    citizen_token = get_auth_token("priya_citizen")

    with SessionLocal() as db:
        pwd = db.query(Department).filter(Department.code == "PWD").first()

    new_case = {
        "title": "Dangerous Potholes on Express Highway Service Lane",
        "description": "Multiple large craters and cracked asphalt on the service lane causing vehicle damage.",
        "department_id": pwd.id,
        "category": "INFRASTRUCTURE_DAMAGE",
        "state": "National Capital Region",
        "district": "South-East Metro Zone",
        "approximate_location": "Near Sector 15 Junction",
        "incident_date": "2026-10-29T10:00:00Z",
        "consent_given": True
    }

    res = client.post("/api/v1/complaints/", json=new_case, headers={"Authorization": f"Bearer {citizen_token}"})
    assert res.status_code == 200
    data = res.json()

    assert data["predicted_department_code"] == "PWD"
    assert data["is_department_verified"] is True
    assert data["department_verification_status"] in ["VERIFIED_GOOD_MATCH", "ACCEPTABLE_MATCH"]
    assert data["classification_confidence"] is not None
    assert data["classification_confidence"] > 0.40

