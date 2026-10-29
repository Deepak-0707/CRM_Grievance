import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.models.models import (
    User, SimulatedIdentityRecord, Department, Complaint, ComplaintAssignment, EvidenceMetadata,
    ComplaintActivity, ComplaintFlag, AbuseInvestigation, AbuseDecision,
    Sanction, Appeal, IdentityDisclosureRequest, Notification, AuditEvent, utc_now
)
from app.services.audit_service import log_audit_event
from app.services.risk_scoring_service import evaluate_complaint_risk

def reset_and_seed_demo_data(db: Session):
    """
    Clears all tables and seeds realistic synthetic datasets including Scenarios A through H.
    Tamper-evident audit hashes are accurately calculated.
    """
    # Clean tables in dependency order
    db.query(AuditEvent).delete()
    db.query(IdentityDisclosureRequest).delete()
    db.query(Appeal).delete()
    db.query(Sanction).delete()
    db.query(AbuseDecision).delete()
    db.query(AbuseInvestigation).delete()
    db.query(ComplaintFlag).delete()
    db.query(ComplaintActivity).delete()
    db.query(EvidenceMetadata).delete()
    db.query(ComplaintAssignment).delete()
    db.query(Complaint).delete()
    db.query(Notification).delete()
    db.query(SimulatedIdentityRecord).delete()
    db.query(User).delete()
    db.query(Department).delete()
    db.commit()

    now = utc_now()
    default_pw = get_password_hash("Pass1234!")

    # 1. Departments
    dept_pwd = Department(
        code="PWD",
        name="Public Works Department",
        description="Responsible for urban roads, bridges, public drainage, and physical infrastructure maintenance.",
        default_sla_hours=48,
        is_active=True
    )
    dept_water = Department(
        code="WATER",
        name="Water Supply & Sewerage Board",
        description="Management of civic water distribution pipelines, reservoir pressure, and sewage repairs.",
        default_sla_hours=72,
        is_active=True
    )
    dept_elec = Department(
        code="ELEC",
        name="State Electricity Distribution",
        description="Grid reliability, transformer safety, streetlight grid networks, and billing grievances.",
        default_sla_hours=36,
        is_active=True
    )
    dept_mc = Department(
        code="MC",
        name="Municipal Corporation",
        description="Civic hygiene, solid waste disposal, building permissions, and local parks maintenance.",
        default_sla_hours=96,
        is_active=True
    )
    dept_trans = Department(
        code="TRANS",
        name="Metropolitan Transport Authority",
        description="Public transit safety, route punctuality, bus shelter infrastructure, and fleet operations.",
        default_sla_hours=48,
        is_active=True
    )
    dept_health = Department(
        code="HEALTH",
        name="Public Health Services",
        description="Primary health clinics, sanitation inspections, vector-borne disease control, and vaccination.",
        default_sla_hours=24,
        is_active=True
    )
    dept_edu = Department(
        code="EDU",
        name="Directorate of School Education",
        description="Public school sanitation, mid-day meals, teacher attendance, and classroom safety.",
        default_sla_hours=120,
        is_active=True
    )
    db.add_all([dept_pwd, dept_water, dept_elec, dept_mc, dept_trans, dept_health, dept_edu])
    db.flush()

    # 2. Users (Personas)
    citizen_priya = User(
        username="priya_citizen",
        email="priya.citizen@civictrust.gov",
        hashed_password=default_pw,
        role="CITIZEN",
        is_active=True,
        is_verified=True,
        citizen_pseudonym_id="CITIZEN-8A4F102B"
    )
    citizen_rahul = User(
        username="rahul_citizen",
        email="rahul.citizen@civictrust.gov",
        hashed_password=default_pw,
        role="CITIZEN",
        is_active=True,
        is_verified=True,
        citizen_pseudonym_id="CITIZEN-3D91C084"
    )
    citizen_tanya = User(
        username="tanya_citizen",
        email="tanya.citizen@civictrust.gov",
        hashed_password=default_pw,
        role="CITIZEN",
        is_active=True,
        is_verified=True,
        citizen_pseudonym_id="CITIZEN-7F22A91D"
    )
    officer_sharma = User(
        username="officer_sharma",
        email="sharma.pwd@civictrust.gov",
        hashed_password=default_pw,
        role="DEPARTMENT_OFFICER",
        department_id=dept_pwd.id,
        is_active=True
    )
    officer_anita = User(
        username="officer_anita",
        email="anita.water@civictrust.gov",
        hashed_password=default_pw,
        role="DEPARTMENT_OFFICER",
        department_id=dept_water.id,
        is_active=True
    )
    reviewer_chen = User(
        username="reviewer_chen",
        email="chen.trust@civictrust.gov",
        hashed_password=default_pw,
        role="TRUST_SAFETY_REVIEWER",
        is_active=True
    )
    reviewer_malik = User(
        username="reviewer_malik",
        email="malik.trust@civictrust.gov",
        hashed_password=default_pw,
        role="TRUST_SAFETY_REVIEWER",
        is_active=True
    )
    admin_gupta = User(
        username="admin_gupta",
        email="gupta.admin@civictrust.gov",
        hashed_password=default_pw,
        role="ADMINISTRATOR",
        is_active=True
    )
    privacy_officer_verma = User(
        username="privacy_officer_verma",
        email="verma.privacy@civictrust.gov",
        hashed_password=default_pw,
        role="PRIVACY_OFFICER",
        is_active=True
    )
    db.add_all([
        citizen_priya, citizen_rahul, citizen_tanya,
        officer_sharma, officer_anita,
        reviewer_chen, reviewer_malik, admin_gupta, privacy_officer_verma
    ])
    db.flush()

    # 3. Identity Records (Isolated Privacy Vault)
    id_priya = SimulatedIdentityRecord(
        user_id=citizen_priya.id,
        citizen_pseudonym_id="CITIZEN-8A4F102B",
        synthetic_full_name="Priya Sharma",
        synthetic_demo_id_type="CITIZEN_NATIONAL_ID",
        synthetic_demographic_district="South-East Metro Zone",
        synthetic_phone_masked="+91 98XXX-XX102",
        verification_method="SIMULATED_ELIGIBILITY_PORTAL",
        verification_notes="Identity verified via resident verification ledger.",
        verified_at=now - timedelta(days=20)
    )
    id_rahul = SimulatedIdentityRecord(
        user_id=citizen_rahul.id,
        citizen_pseudonym_id="CITIZEN-3D91C084",
        synthetic_full_name="Rahul Verma",
        synthetic_demo_id_type="RESIDENT_PASS",
        synthetic_demographic_district="North Ward Central",
        synthetic_phone_masked="+91 94XXX-XX384",
        verification_method="SIMULATED_ELIGIBILITY_PORTAL",
        verification_notes="Identity verified via resident verification ledger.",
        verified_at=now - timedelta(days=15)
    )
    id_tanya = SimulatedIdentityRecord(
        user_id=citizen_tanya.id,
        citizen_pseudonym_id="CITIZEN-7F22A91D",
        synthetic_full_name="Tanya Sen",
        synthetic_demo_id_type="CITIZEN_NATIONAL_ID",
        synthetic_demographic_district="Eastern Suburban Sector",
        synthetic_phone_masked="+91 97XXX-XX919",
        verification_method="SIMULATED_ELIGIBILITY_PORTAL",
        verification_notes="Identity verified via resident verification ledger.",
        verified_at=now - timedelta(days=10)
    )
    db.add_all([id_priya, id_rahul, id_tanya])
    db.flush()

    # 4. SCENARIOS POPULATION

    # ==========================================
    # SCENARIO A: Legitimate complaint progresses from submission -> assignment -> resolution
    # ==========================================
    complaint_a = Complaint(
        complaint_number="CT-2026-1001",
        citizen_pseudonym_id="CITIZEN-8A4F102B",
        title="Severe Sinkhole and Broken Storm Drain on Outer Ring Service Road",
        description="A major 4-foot deep sinkhole has opened beside the storm drain culvert opposite Sector 14 market. Two two-wheelers suffered tire damage last evening. Immediate barricading and culvert repair required before monsoon showers.",
        department_id=dept_pwd.id,
        category="INFRASTRUCTURE_DAMAGE",
        state="National Capital Region",
        district="South-East Metro Zone",
        approximate_location="Outer Ring Service Road, near Sector 14 junction",
        incident_date=now - timedelta(days=4),
        status="RESOLVED",
        priority="HIGH",
        priority_justification="Presents acute road safety hazard for commuter traffic.",
        assigned_officer_id=officer_sharma.id,
        sla_deadline=now - timedelta(days=2),
        escalation_deadline=now - timedelta(days=1),
        is_overdue=False,
        resolution_summary="PWD Field Division completed structural backfilling and reinforced culvert masonry on Oct 13. Road surface re-asphalted and safe for vehicular movement.",
        internal_investigation_notes="Work order #PWD-2026-88 executed by contractor Apex Infra. Inspection verified on site.",
        consent_given=True,
        created_at=now - timedelta(days=4),
        updated_at=now - timedelta(days=1)
    )
    db.add(complaint_a)
    db.flush()

    ev_a = EvidenceMetadata(
        complaint_id=complaint_a.id,
        filename="sinkhole_site_inspection.jpg",
        file_type="image/jpeg",
        file_size_bytes=1048576,
        storage_path="/secure_uploads/ev_sinkhole_demo.jpg",
        evidence_description="Photo of damaged road culvert and hazard warning cones.",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        integrity_status="VERIFIED",
        integrity_details="EXIF timestamps align with reported incident time and location.",
        created_at=now - timedelta(days=4)
    )
    db.add(ev_a)

    act_a1 = ComplaintActivity(
        complaint_id=complaint_a.id,
        actor_role="CITIZEN",
        activity_type="STATUS_CHANGE",
        public_message="Grievance filed under case reference CT-2026-1001.",
        created_at=now - timedelta(days=4)
    )
    act_a2 = ComplaintActivity(
        complaint_id=complaint_a.id,
        actor_role="OFFICER",
        activity_type="ASSIGNMENT",
        public_message="Case assigned to PWD Field Engineer Sharma for prompt remediation.",
        internal_message="Assigned priority HIGH due to main road traffic.",
        created_at=now - timedelta(days=3)
    )
    act_a3 = ComplaintActivity(
        complaint_id=complaint_a.id,
        actor_role="OFFICER",
        activity_type="RESOLUTION",
        public_message="Grievance resolved: PWD Field Division completed structural backfilling and reinforced culvert masonry.",
        internal_message="Final site photographs archived. Contractor billing approved.",
        created_at=now - timedelta(days=1)
    )
    db.add_all([act_a1, act_a2, act_a3])

    # ==========================================
    # SCENARIO B: Flagged but dismissed (Insufficient Evidence != Deliberate Fabrication)
    # ==========================================
    complaint_b = Complaint(
        complaint_number="CT-2026-2002",
        citizen_pseudonym_id="CITIZEN-3D91C084",
        title="Intermittent Turbid Water Supply in Northern Municipal Ward Block C",
        description="Water supplied between 6 AM and 8 AM had brownish sediment and unpleasant odor on Tuesday. Resident suspects contamination from sewer line cross-leakage.",
        department_id=dept_water.id,
        category="SERVICE_FAILURE",
        state="National Capital Region",
        district="North Ward Central",
        approximate_location="Block C, Municipal Colony",
        incident_date=now - timedelta(days=6),
        status="UNDER_REVIEW",
        priority="MEDIUM",
        priority_justification="Public health hygiene complaint.",
        assigned_officer_id=officer_anita.id,
        sla_deadline=now + timedelta(hours=24),
        is_overdue=False,
        consent_given=True,
        created_at=now - timedelta(days=6),
        updated_at=now - timedelta(days=2)
    )
    db.add(complaint_b)
    db.flush()

    flag_b = ComplaintFlag(
        complaint_id=complaint_b.id,
        flagged_by_role="COMMUNITY_USER",
        flag_reason="DELIBERATELY_MISLEADING_CLAIM",
        flag_details="Local vendor claims water test samples in Block C were clear; alleges complaint is false alarm.",
        is_reviewed=True,
        created_at=now - timedelta(days=5)
    )
    db.add(flag_b)

    inv_b = AbuseInvestigation(
        complaint_id=complaint_b.id,
        status="DISMISSED",
        lead_reviewer_id=reviewer_chen.id,
        risk_score=15.0,
        risk_signals_json=json.dumps([
            {"signal_name": "UNVERIFIED_COMPLAINT_ALLEGATION", "points": 10.0, "description": "Lacks lab turbidity certificate; ordinary citizen perception."},
            {"signal_name": "NO_FABRICATION_EVIDENT", "points": 0.0, "description": "No synthetic manipulation detected in submission text."}
        ]),
        alleged_violation="Deliberately misleading factual claim",
        evidence_examined="Reviewed local booster pump logs and citizen description.",
        created_at=now - timedelta(days=5),
        updated_at=now - timedelta(days=2)
    )
    db.add(inv_b)
    db.flush()

    dec_b = AbuseDecision(
        investigation_id=inv_b.id,
        reviewer_id=reviewer_chen.id,
        finding="DISMISSED",
        rationale="Insufficient Evidence vs Fabrication Principle: A citizen reporting foul smell or discoloration without laboratory test kits is exercising reasonable vigilance. Lack of conclusive evidence does NOT substantiate bad faith or deliberate fabrication. Allegation dismissed.",
        evidence_examined="Community flag report and water board feeder report.",
        recommended_sanction="NONE",
        decision_timestamp=now - timedelta(days=2)
    )
    db.add(dec_b)

    # ==========================================
    # SCENARIO C: Deliberate manipulation -> finding documented -> 2nd reviewer approves proportionate sanction
    # ==========================================
    complaint_c = Complaint(
        complaint_number="CT-2026-3003",
        citizen_pseudonym_id="CITIZEN-7F22A91D",
        title="Fabricated Allegation of PWD Equipment Theft and Road Blockade",
        description="Claims heavy bulldozers were stolen from Sector 9 depot and parked illegally to block private commercial plaza entrance.",
        department_id=dept_pwd.id,
        category="SUSPECTED_MISCONDUCT",
        state="National Capital Region",
        district="Eastern Suburban Sector",
        approximate_location="Sector 9 Commercial Corridor",
        incident_date=now - timedelta(days=7),
        status="UNDER_REVIEW",
        priority="HIGH",
        consent_given=True,
        created_at=now - timedelta(days=7),
        updated_at=now - timedelta(days=3)
    )
    db.add(complaint_c)
    db.flush()

    ev_c = EvidenceMetadata(
        complaint_id=complaint_c.id,
        filename="doctored_depot_invoice.png",
        file_type="image/png",
        file_size_bytes=819200,
        storage_path="/secure_uploads/ev_doctored_demo.png",
        evidence_description="Submitted image claiming to show stolen equipment depot dispatch note.",
        sha256_hash="d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
        integrity_status="SUSPECTED_ALTERATION",
        integrity_details="Forensic software found spliced serial numbers and mismatched font rasterization layers inconsistent with authentic municipal vouchers.",
        created_at=now - timedelta(days=7)
    )
    db.add(ev_c)

    inv_c = AbuseInvestigation(
        complaint_id=complaint_c.id,
        status="SUBSTANTIATED_ABUSE",
        lead_reviewer_id=reviewer_chen.id,
        risk_score=85.0,
        risk_signals_json=json.dumps([
            {"signal_name": "EVIDENCE_INTEGRITY_ANOMALY", "points": 40.0, "description": "Doctored digital voucher identified with synthetic composite artifacts."},
            {"signal_name": "FABRICATED_PUBLIC_OFFICER_IMPUTATION", "points": 30.0, "description": "Fictitious equipment serials deliberately targeted at harassing local contractor."},
            {"signal_name": "DUPLICATE_PATTERN", "points": 15.0, "description": "Near identical text previously filed under alternate category."}
        ]),
        alleged_violation="Suspected fabricated evidence & deliberate deception",
        evidence_examined="Digital image forensic layer breakdown; Sector 9 equipment registry logs.",
        created_at=now - timedelta(days=6),
        updated_at=now - timedelta(days=3)
    )
    db.add(inv_c)
    db.flush()

    dec_c = AbuseDecision(
        investigation_id=inv_c.id,
        reviewer_id=reviewer_chen.id,
        finding="SUBSTANTIATED_ABUSE",
        rationale="Substantiated deliberate evidence forgery. Evidence metadata confirms spliced graphics to falsely allege official theft.",
        evidence_examined="Forensic image raster analysis and PWD asset tracking beacon telemetry.",
        recommended_sanction="TEMPORARY_RESTRICTION",
        second_reviewer_id=reviewer_malik.id,
        second_reviewer_approval=True,
        second_reviewer_notes="Concur with Reviewer Chen. Clear evidence of deliberate digital forgery. 14-day filing restriction approved.",
        appeal_deadline=now + timedelta(days=11),
        decision_timestamp=now - timedelta(days=3)
    )
    db.add(dec_c)

    sanction_c = Sanction(
        user_id=citizen_tanya.id,
        citizen_pseudonym_id="CITIZEN-7F22A91D",
        sanction_type="TEMPORARY_RESTRICTION",
        reason="Substantiated submission of digitally altered fraudulent evidence (Case CT-2026-3003). Dual-reviewer approved.",
        start_date=now - timedelta(days=3),
        end_date=now + timedelta(days=11),
        is_active=True
    )
    db.add(sanction_c)

    # ==========================================
    # SCENARIO D: Citizen appeals abuse finding and appeal is UPHELD
    # ==========================================
    complaint_d = Complaint(
        complaint_number="CT-2026-4004",
        citizen_pseudonym_id="CITIZEN-3D91C084",
        title="Delayed Ambulance Dispatch at Ward General Hospital Emergency Gate",
        description="Ambulance response was delayed by 45 minutes on Saturday evening due to locked exit gate. Gatekeeper was reportedly missing.",
        department_id=dept_health.id,
        category="DELAYED_PUBLIC_SERVICE",
        state="National Capital Region",
        district="North Ward Central",
        approximate_location="Ward General Hospital, Gate 3",
        incident_date=now - timedelta(days=12),
        status="UNDER_REVIEW",
        priority="HIGH",
        consent_given=True,
        created_at=now - timedelta(days=12),
        updated_at=now - timedelta(days=4)
    )
    db.add(complaint_d)
    db.flush()

    inv_d = AbuseInvestigation(
        complaint_id=complaint_d.id,
        status="APPEALED",
        lead_reviewer_id=reviewer_chen.id,
        risk_score=45.0,
        risk_signals_json=json.dumps([
            {"signal_name": "DISPUTED_TIMELINE", "points": 25.0, "description": "Hospital gatekeeper disputed absence in initial triage."}
        ]),
        alleged_violation="Misleading claim regarding emergency service availability",
        evidence_examined="Emergency room shift sheet.",
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=4)
    )
    db.add(inv_d)
    db.flush()

    dec_d = AbuseDecision(
        investigation_id=inv_d.id,
        reviewer_id=reviewer_chen.id,
        finding="SUBSTANTIATED_ABUSE",
        rationale="Initial finding determined timing did not match hospital central clock.",
        evidence_examined="Hospital log extract.",
        recommended_sanction="WARNING",
        appeal_deadline=now + timedelta(days=4),
        decision_timestamp=now - timedelta(days=8)
    )
    db.add(dec_d)
    db.flush()

    appeal_d = Appeal(
        target_type="ABUSE_SANCTION",
        target_id=dec_d.id,
        complainant_pseudonym_id="CITIZEN-3D91C084",
        grounds_for_appeal="Hospital clock had not been synchronized after electrical reboot. Emergency 108 dispatch call records corroborate that ambulance was indeed halted outside Gate 3 for 42 minutes.",
        status="UPHELD",
        reviewer_id=reviewer_malik.id,
        review_notes="Independent review of telecommunication call logs confirms caller was stationed outside Gate 3. Citizen was truthful; initial finding was based on desynchronized internal hospital register. Sanction revoked.",
        decided_at=now - timedelta(days=4),
        created_at=now - timedelta(days=7)
    )
    db.add(appeal_d)

    # ==========================================
    # SCENARIO E: Identity disclosure request REJECTED (Insufficient justification)
    # ==========================================
    complaint_e = Complaint(
        complaint_number="CT-2026-5005",
        citizen_pseudonym_id="CITIZEN-8A4F102B",
        title="Frequent Transit Bus Cancellation on Route 42B During Peak Hours",
        description="Buses on Route 42B failed to arrive at Nehru Place depot between 5:30 PM and 7:00 PM for 3 consecutive days, leaving hundreds stranded.",
        department_id=dept_trans.id,
        category="SERVICE_FAILURE",
        state="National Capital Region",
        district="South-East Metro Zone",
        approximate_location="Nehru Place Depot Terminal",
        incident_date=now - timedelta(days=9),
        status="INVESTIGATING",
        priority="MEDIUM",
        consent_given=True,
        created_at=now - timedelta(days=9),
        updated_at=now - timedelta(days=3)
    )
    db.add(complaint_e)
    db.flush()

    inv_e = AbuseInvestigation(
        complaint_id=complaint_e.id,
        status="TRIAGE",
        lead_reviewer_id=reviewer_chen.id,
        risk_score=20.0,
        risk_signals_json=json.dumps([{"signal_name": "COMMUNITY_SCRUTINY", "points": 10.0, "description": "Department asked for complainant details."}]),
        created_at=now - timedelta(days=8),
        updated_at=now - timedelta(days=3)
    )
    db.add(inv_e)
    db.flush()

    disc_e = IdentityDisclosureRequest(
        investigation_id=inv_e.id,
        complaint_id=complaint_e.id,
        requested_by_reviewer_id=reviewer_chen.id,
        legal_and_policy_basis="Transport manager requests complainant identity to verify if person holds a valid monthly bus pass.",
        status="REJECTED",
        reviewed_by_admin_id=admin_gupta.id,
        admin_rationale="PETITION REJECTED: Merely desiring to check transit ticket credentials or route frequency disputes does NOT meet the statutory threshold for identity de-anonymization. Anonymous complaint is protected under CivicTrust privacy charter.",
        reviewed_at=now - timedelta(days=3),
        created_at=now - timedelta(days=5)
    )
    db.add(disc_e)

    # ==========================================
    # SCENARIO F: Authorized disclosure request APPROVED and AUDITED
    # ==========================================
    complaint_f = Complaint(
        complaint_number="CT-2026-6006",
        citizen_pseudonym_id="CITIZEN-7F22A91D",
        title="Extortion Claim Involving Municipal Building Inspector with Fabricated Tape",
        description="Alleges building inspector demanded illicit payments and provided synthetic audio clip as proof.",
        department_id=dept_mc.id,
        category="SUSPECTED_MISCONDUCT",
        state="National Capital Region",
        district="Eastern Suburban Sector",
        approximate_location="Municipal Ward 12 Office",
        incident_date=now - timedelta(days=14),
        status="UNDER_REVIEW",
        priority="CRITICAL",
        consent_given=True,
        created_at=now - timedelta(days=14),
        updated_at=now - timedelta(days=1)
    )
    db.add(complaint_f)
    db.flush()

    inv_f = AbuseInvestigation(
        complaint_id=complaint_f.id,
        status="SUBSTANTIATED_ABUSE",
        lead_reviewer_id=reviewer_chen.id,
        risk_score=95.0,
        risk_signals_json=json.dumps([
            {"signal_name": "DEEPFAKE_AUDIO_FABRICATION", "points": 50.0, "description": "Spectrogram analysis confirmed synthetic voice cloning model used to fabricate officer audio."},
            {"signal_name": "MALICIOUS_DEFAMATION_INTENT", "points": 45.0, "description": "Targeted criminal extortion attempt against civic staff."}
        ]),
        alleged_violation="Criminal defamation & synthetic media extortion",
        evidence_examined="Forensic audio spectrum analysis and cyber cell advisory.",
        created_at=now - timedelta(days=12),
        updated_at=now - timedelta(days=2)
    )
    db.add(inv_f)
    db.flush()

    # Seed 3 prior abuse flags for citizen Tanya (CITIZEN-7F22A91D) to fulfill threshold of having a lot of past flags
    flag_f1 = ComplaintFlag(
        complaint_id=complaint_f.id,
        flagged_by_role="TRUST_SAFETY_REVIEWER",
        flag_reason="SUSPECTED_FABRICATED_EVIDENCE",
        flag_details="Audio spectrogram revealed high probability synthetic voice cloning generation artifacts.",
        is_reviewed=True,
        created_at=now - timedelta(days=10)
    )
    flag_f2 = ComplaintFlag(
        complaint_id=complaint_f.id,
        flagged_by_role="SYSTEM_RISK_ENGINE",
        flag_reason="DELIBERATELY_MISLEADING_CLAIM",
        flag_details="Voice recording failed forensic digital integrity check against municipal dispatch telemetry.",
        is_reviewed=True,
        created_at=now - timedelta(days=8)
    )
    flag_f3 = ComplaintFlag(
        complaint_id=complaint_f.id,
        flagged_by_role="COMMUNITY",
        flag_reason="COORDINATED_ABUSE",
        flag_details="Targeted defamatory extortion campaign directed at ward officer verified by independent audit.",
        is_reviewed=True,
        created_at=now - timedelta(days=6)
    )
    db.add_all([flag_f1, flag_f2, flag_f3])
    db.flush()

    disc_f = IdentityDisclosureRequest(
        investigation_id=inv_f.id,
        complaint_id=complaint_f.id,
        requested_by_reviewer_id=reviewer_chen.id,
        legal_and_policy_basis="Substantiated synthetic voice cloning used for extortion of public servants. Formal law enforcement referral under Section 469/500 Indian Penal Code & IT Act §66D.",
        status="APPROVED",
        reviewed_by_admin_id=admin_gupta.id,
        admin_rationale="PETITION APPROVED: High evidentiary proof of deliberate synthetic fabrication targeting public staff for extortion. Lawful basis established for controlled de-anonymization.",
        reviewed_at=now - timedelta(days=1),
        created_at=now - timedelta(days=2)
    )
    db.add(disc_f)

    # ==========================================
    # SCENARIO G: Officer access to identity mapping receives 403 Forbidden
    # (Tested via API & test suite, pre-configured in seed for demonstration)
    # ==========================================

    # ==========================================
    # SCENARIO H: Several users coordinate to flag a legitimate complaint (Brigade Defense)
    # ==========================================
    complaint_h = Complaint(
        complaint_number="CT-2026-8008",
        citizen_pseudonym_id="CITIZEN-8A4F102B",
        title="Illegal Commercial Encroachment on Community Playground and Walking Track",
        description="Commercial banquet operators have illegally erected temporary marquees over public green space and football grounds, blocking children from playing and creating loud late-night noise.",
        department_id=dept_mc.id,
        category="INFRASTRUCTURE_DAMAGE",
        state="National Capital Region",
        district="South-East Metro Zone",
        approximate_location="Sector 7 Community Sports Ground",
        incident_date=now - timedelta(days=3),
        status="INVESTIGATING",
        priority="HIGH",
        assigned_officer_id=officer_sharma.id,
        sla_deadline=now + timedelta(hours=36),
        is_overdue=False,
        consent_given=True,
        created_at=now - timedelta(days=3),
        updated_at=now - timedelta(hours=6)
    )
    db.add(complaint_h)
    db.flush()

    # 4 coordinated flags within 5 minutes with copy-pasted allegation
    for i in range(4):
        f = ComplaintFlag(
            complaint_id=complaint_h.id,
            flagged_by_role="COMMUNITY_USER",
            flag_reason="COORDINATED_ABUSE",
            flag_details=f"Coordinated flag #{i+1}: Banquet promoter syndicate attempting to take down grievance claiming ground is private property.",
            is_reviewed=True,
            created_at=now - timedelta(hours=12, minutes=i*2)
        )
        db.add(f)

    # Risk scoring engine evaluates and detects coordinated velocity campaign
    inv_h = AbuseInvestigation(
        complaint_id=complaint_h.id,
        status="UNDER_INVESTIGATION",
        lead_reviewer_id=reviewer_chen.id,
        risk_score=10.0,  # Protected! Not penalized despite 4 flags!
        risk_signals_json=json.dumps([
            {
                "signal_name": "COORDINATED_FLAGGING_CAMPAIGN_DETECTED",
                "points": 0.0,
                "is_defense_signal": True,
                "description": "Unusual velocity anomaly: 4 flags logged within 8 minutes with matching text patterns. System recognized coordinated brigade pattern; risk score penalty neutralized to prevent automatic silencing of legitimate grievance."
            }
        ]),
        alleged_violation="Mass community flagging allegation",
        evidence_examined="Satellite imagery of public playground boundary and velocity clustering logs.",
        created_at=now - timedelta(hours=11),
        updated_at=now - timedelta(hours=6)
    )
    db.add(inv_h)

    # 5. Seed Tamper-evident Audit Events
    db.flush()
    log_audit_event(
        db=db,
        event_type="SYSTEM_INITIALIZATION",
        action="SYSTEM_BOOTSTRAP_AND_SEED",
        actor_id="SYSTEM",
        actor_role="SYSTEM",
        resource_id="CIVICTRUST_CORE",
        details={"version": "1.0.0", "demo_mode": True, "scenarios_seeded": ["A", "B", "C", "D", "E", "F", "G", "H"]}
    )
    log_audit_event(
        db=db,
        event_type="IDENTITY_DISCLOSURE_APPROVED",
        action="ADJUDICATE_DISCLOSURE_APPROVED",
        actor_id=admin_gupta.id,
        actor_role="ADMINISTRATOR",
        resource_id=disc_f.id,
        details={"case": "CT-2026-6006", "reason": "Substantiated voice cloning extortion"}
    )
    log_audit_event(
        db=db,
        event_type="IDENTITY_DISCLOSURE_REJECTED",
        action="ADJUDICATE_DISCLOSURE_REJECTED",
        actor_id=admin_gupta.id,
        actor_role="ADMINISTRATOR",
        resource_id=disc_e.id,
        details={"case": "CT-2026-5005", "reason": "Insufficient statutory justification"}
    )
    log_audit_event(
        db=db,
        event_type="COORDINATED_FLAGGING_DEFENSE_TRIGGERED",
        action="NEUTRALIZE_BRIGADE_FLAG_PENALTY",
        actor_id="SYSTEM_RISK_ENGINE",
        actor_role="SYSTEM",
        resource_id=complaint_h.id,
        details={"flags_clustered": 4, "time_window_minutes": 8, "outcome": "Legitimate grievance protected from automated suppression"}
    )

    db.commit()
    return {"message": "Database initialized and seeded with Scenarios A through H successfully."}
