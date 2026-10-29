import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, index=True)  # CITIZEN, DEPARTMENT_OFFICER, TRUST_SAFETY_REVIEWER, ADMINISTRATOR, PRIVACY_OFFICER
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    citizen_pseudonym_id = Column(String(50), unique=True, index=True, nullable=True)
    reset_token = Column(String(100), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    department = relationship("Department", back_populates="officers")
    simulated_identity = relationship("SimulatedIdentityRecord", back_populates="user", uselist=False)
    assigned_cases = relationship("Complaint", back_populates="assigned_officer", foreign_keys="Complaint.assigned_officer_id")
    notifications = relationship("Notification", back_populates="user")
    sanctions = relationship("Sanction", back_populates="user")

class SimulatedIdentityRecord(Base):
    """
    CRITICAL PRIVACY BOUNDARY:
    Stores synthetic identity records for the academic demo.
    Isolated from complaints table; ordinary officers and public APIs MUST NEVER query this table.
    """
    __tablename__ = "simulated_identity_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    citizen_pseudonym_id = Column(String(50), unique=True, index=True, nullable=False)
    synthetic_full_name = Column(String(100), nullable=False)
    synthetic_demo_id_type = Column(String(50), default="DEMO_CITIZEN_CARD")
    synthetic_demographic_district = Column(String(100), nullable=False)
    synthetic_phone_masked = Column(String(30), nullable=False)
    verification_method = Column(String(50), default="SIMULATED_ELIGIBILITY_PORTAL")
    verification_notes = Column(Text, default="Synthetic demo identity record for academic privacy testing")
    verified_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="simulated_identity")

class Department(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(20), unique=True, index=True, nullable=False)  # MC, PWD, WATER, ELEC, TRANS, HEALTH, EDU
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    default_sla_hours = Column(Integer, default=72)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    officers = relationship("User", back_populates="department")
    complaints = relationship("Complaint", back_populates="department", foreign_keys="Complaint.department_id")

class Complaint(Base):
    """
    Core complaint record. Uses citizen_pseudonym_id ONLY (never user_id or real identity).
    Public transparency views read sanitized fields only.
    """
    __tablename__ = "complaints"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_number = Column(String(30), unique=True, index=True, nullable=False)  # CT-2026-XXXX
    citizen_pseudonym_id = Column(String(50), index=True, nullable=False)  # Pseudonymous link
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=False)
    category = Column(String(50), nullable=False)  # SERVICE_FAILURE, INFRASTRUCTURE_DAMAGE, etc.
    state = Column(String(50), default="National Capital Region")
    district = Column(String(50), nullable=False)
    approximate_location = Column(String(150), nullable=False)
    incident_date = Column(DateTime, nullable=False)
    
    status = Column(String(40), default="SUBMITTED", index=True)
    # Statuses: SUBMITTED, UNDER_REVIEW, ASSIGNED, INVESTIGATING, AWAITING_INFORMATION, RESOLVED, REJECTED_WITH_REASON, APPEALED
    
    priority = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    priority_justification = Column(Text, nullable=True)
    assigned_officer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    sla_deadline = Column(DateTime, nullable=True)
    escalation_deadline = Column(DateTime, nullable=True)
    is_overdue = Column(Boolean, default=False)
    
    # Public & Internal notes
    resolution_summary = Column(Text, nullable=True)  # Public-safe
    internal_investigation_notes = Column(Text, nullable=True)  # Officer-only, NEVER public
    rejection_reason = Column(Text, nullable=True)
    
    # Department Classification & Verification (AI)
    predicted_department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    predicted_department_code = Column(String(20), nullable=True)
    classification_confidence = Column(Float, nullable=True)
    is_department_verified = Column(Boolean, default=True)
    department_verification_status = Column(String(50), default="VERIFIED_GOOD_MATCH")
    department_verification_notes = Column(Text, nullable=True)
    
    consent_given = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    department = relationship("Department", back_populates="complaints", foreign_keys=[department_id])
    predicted_department = relationship("Department", foreign_keys=[predicted_department_id])
    assigned_officer = relationship("User", back_populates="assigned_cases", foreign_keys=[assigned_officer_id])
    evidence_items = relationship("EvidenceMetadata", back_populates="complaint", cascade="all, delete-orphan")
    activities = relationship("ComplaintActivity", back_populates="complaint", cascade="all, delete-orphan", order_by="ComplaintActivity.created_at.desc()")
    flags = relationship("ComplaintFlag", back_populates="complaint", cascade="all, delete-orphan")
    investigation = relationship("AbuseInvestigation", back_populates="complaint", uselist=False)
    assignments = relationship("ComplaintAssignment", back_populates="complaint", cascade="all, delete-orphan")

class ComplaintAssignment(Base):
    __tablename__ = "complaint_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    assigned_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=utc_now)
    notes = Column(Text, nullable=True)

    complaint = relationship("Complaint", back_populates="assignments")

class EvidenceMetadata(Base):
    __tablename__ = "evidence_metadata"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    evidence_description = Column(Text, nullable=True)
    sha256_hash = Column(String(64), nullable=False)
    integrity_status = Column(String(40), default="UNVERIFIED")  # VERIFIED, SUSPECTED_ALTERATION, UNVERIFIED
    integrity_details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    complaint = relationship("Complaint", back_populates="evidence_items")

class ComplaintActivity(Base):
    """
    Append-only timeline of case events and messages.
    Supports anonymous citizen communication channel.
    """
    __tablename__ = "complaint_activity"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    actor_role = Column(String(30), nullable=False)  # CITIZEN, OFFICER, SYSTEM, REVIEWER, ADMIN
    activity_type = Column(String(40), nullable=False)  
    # STATUS_CHANGE, ASSIGNMENT, NOTE_ADDED, CITIZEN_REPLY, OFFICER_QUESTION, EVIDENCE_UPLOAD, RESOLUTION, APPEAL_FILED
    public_message = Column(Text, nullable=True)  # Safe for citizen & public view
    internal_message = Column(Text, nullable=True)  # Officer only (omitted for public & citizen)
    created_at = Column(DateTime, default=utc_now)

    complaint = relationship("Complaint", back_populates="activities")

class ComplaintFlag(Base):
    """
    Flags raised against complaints. A flag is an allegation, not proof.
    """
    __tablename__ = "complaint_flags"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    flagged_by_role = Column(String(30), nullable=False)
    flag_reason = Column(String(50), nullable=False)
    # DUPLICATE_SUBMISSION, SUSPECTED_FABRICATED_EVIDENCE, DELIBERATELY_MISLEADING_CLAIM, COORDINATED_ABUSE, SPAM_OR_IRRELEVANT, OTHER
    flag_details = Column(Text, nullable=False)
    is_reviewed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    complaint = relationship("Complaint", back_populates="flags")

class AbuseInvestigation(Base):
    """
    Trust & Safety Investigation workspace.
    Maintains separate lifecycle from Complaint status.
    """
    __tablename__ = "abuse_investigations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), unique=True, nullable=False)
    status = Column(String(40), default="FLAGGED")
    # FLAGGED, TRIAGE, UNDER_INVESTIGATION, INSUFFICIENT_EVIDENCE, SUBSTANTIATED_ABUSE, DISMISSED, APPEALED
    lead_reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    risk_score = Column(Float, default=0.0)  # 0 to 100
    risk_signals_json = Column(Text, default="{}")  # Deterministic breakdown of signals
    alleged_violation = Column(String(100), nullable=True)
    evidence_examined = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    complaint = relationship("Complaint", back_populates="investigation")
    decisions = relationship("AbuseDecision", back_populates="investigation", cascade="all, delete-orphan")
    disclosure_requests = relationship("IdentityDisclosureRequest", back_populates="investigation")

class AbuseDecision(Base):
    """
    Reviewer decision on abuse allegations.
    Requires 2nd reviewer approval for serious or repeated sanctions.
    """
    __tablename__ = "abuse_decisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("abuse_investigations.id"), nullable=False)
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    finding = Column(String(40), nullable=False)
    # SUBSTANTIATED_ABUSE, INSUFFICIENT_EVIDENCE, DISMISSED
    rationale = Column(Text, nullable=False)
    evidence_examined = Column(Text, nullable=False)
    recommended_sanction = Column(String(40), default="NONE")
    # NONE, WARNING, TEMPORARY_RESTRICTION, SUSPENSION
    
    # Dual-Reviewer Control for serious sanctions
    second_reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    second_reviewer_approval = Column(Boolean, nullable=True)  # True = Approved, False = Denied, None = Pending
    second_reviewer_notes = Column(Text, nullable=True)
    
    appeal_deadline = Column(DateTime, nullable=True)
    decision_timestamp = Column(DateTime, default=utc_now)

    investigation = relationship("AbuseInvestigation", back_populates="decisions")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    second_reviewer = relationship("User", foreign_keys=[second_reviewer_id])

class Sanction(Base):
    __tablename__ = "sanctions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    citizen_pseudonym_id = Column(String(50), index=True, nullable=False)
    sanction_type = Column(String(40), nullable=False)  # WARNING, TEMPORARY_RESTRICTION, SUSPENSION
    reason = Column(Text, nullable=False)
    start_date = Column(DateTime, default=utc_now)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="sanctions")

class Appeal(Base):
    """
    Citizen appeal against complaint rejection or abuse sanction.
    """
    __tablename__ = "appeals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    target_type = Column(String(40), nullable=False)  # COMPLAINT_REJECTION, ABUSE_SANCTION
    target_id = Column(String(36), nullable=False)  # complaint_id or abuse_decision_id
    complainant_pseudonym_id = Column(String(50), nullable=False)
    grounds_for_appeal = Column(Text, nullable=False)
    status = Column(String(30), default="PENDING")  # PENDING, UPHELD, OVERTURNED, REJECTED
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

class IdentityDisclosureRequest(Base):
    """
    Restricted conditional identity disclosure workflow.
    Requires substantiated abuse finding + legal basis + Admin dual authorization.
    """
    __tablename__ = "identity_disclosure_requests"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("abuse_investigations.id"), nullable=False)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    requested_by_reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    legal_and_policy_basis = Column(Text, nullable=False)
    
    status = Column(String(30), default="PENDING_APPROVAL")  # PENDING_APPROVAL, APPROVED, REJECTED, ACCESSED
    reviewed_by_admin_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    admin_rationale = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Audit trail of identity access
    accessed_at = Column(DateTime, nullable=True)
    revealed_synthetic_snapshot = Column(Text, nullable=True)  # Populated only when accessed post-approval
    created_at = Column(DateTime, default=utc_now)

    investigation = relationship("AbuseInvestigation", back_populates="disclosure_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_reviewer_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_admin_id])

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(200), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="notifications")

class AuditEvent(Base):
    """
    Strictly append-only audit event log.
    Includes tamper-evident cryptographic hash chain.
    """
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_type = Column(String(60), index=True, nullable=False)
    actor_id = Column(String(50), nullable=True)
    actor_role = Column(String(30), nullable=True)
    ip_address = Column(String(50), default="127.0.0.1")
    resource_id = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)
    details_json = Column(Text, default="{}")
    previous_hash = Column(String(64), nullable=False)
    tamper_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=utc_now, index=True)

    __table_args__ = (
        Index("idx_audit_event_timestamp", "created_at"),
    )
