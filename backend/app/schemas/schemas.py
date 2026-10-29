from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    citizen_pseudonym_id: Optional[str] = None
    department_id: Optional[str] = None
    is_verified: bool

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(..., min_length=6)
    role: str = "CITIZEN"  # Default role
    department_id: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: str
    department_id: Optional[str] = None
    is_active: bool
    is_verified: bool
    citizen_pseudonym_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)

# Verification Schemas
class SimulatedVerificationRequest(BaseModel):
    synthetic_full_name: str
    synthetic_demographic_district: str
    synthetic_phone_masked: str
    acknowledgment: bool = Field(..., description="Acknowledge this is synthetic demo data")

class SimulatedVerificationOut(BaseModel):
    is_verified: bool
    citizen_pseudonym_id: str
    synthetic_full_name: str
    synthetic_demographic_district: str
    verified_at: datetime
    message: str

# Department Schemas
class DepartmentBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    default_sla_hours: int = 72

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DepartmentWorkloadOut(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    default_sla_hours: int
    is_active: bool
    officer_count: int
    active_cases: int
    overdue_cases: int

class DepartmentSLAUpdate(BaseModel):
    default_sla_hours: int = Field(..., ge=1, le=720)
    description: Optional[str] = None

class CaseDepartmentTransfer(BaseModel):
    new_department_id: str
    transfer_justification: str = Field(..., min_length=5)

# Evidence Schemas
class EvidenceOut(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size_bytes: int
    evidence_description: Optional[str] = None
    sha256_hash: str
    integrity_status: str
    integrity_details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Complaint Schemas
class ComplaintCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=15)
    department_id: Optional[str] = None
    category: str = "INFRASTRUCTURE_DAMAGE"
    state: str = "National Capital Region"
    district: str
    approximate_location: str
    incident_date: datetime
    consent_given: bool = True
    evidence_description: Optional[str] = None

class ComplaintPublicOut(BaseModel):
    """
    CRITICAL PRIVACY BOUNDARY:
    Strictly sanitized public representation.
    NEVER leaks citizen identities, emails, tokens, internal notes, or private evidence.
    """
    id: str
    complaint_number: str
    category: str
    department_name: str
    general_location: str  # approx location + district
    incident_date: datetime
    status: str
    resolution_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplaintActivityOut(BaseModel):
    id: str
    actor_role: str
    activity_type: str
    public_message: Optional[str] = None
    internal_message: Optional[str] = None  # Filtered out for public/citizens
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplaintDetailOut(BaseModel):
    id: str
    complaint_number: str
    citizen_pseudonym_id: str
    title: str
    description: str
    department_id: str
    department_name: Optional[str] = None
    category: str
    state: str
    district: str
    approximate_location: str
    incident_date: datetime
    status: str
    priority: str
    priority_justification: Optional[str] = None
    assigned_officer_id: Optional[str] = None
    assigned_officer_name: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    escalation_deadline: Optional[datetime] = None
    is_overdue: bool
    resolution_summary: Optional[str] = None
    internal_investigation_notes: Optional[str] = None  # Only for officers/admins
    rejection_reason: Optional[str] = None
    predicted_department_id: Optional[str] = None
    predicted_department_code: Optional[str] = None
    predicted_department_name: Optional[str] = None
    classification_confidence: Optional[float] = None
    is_department_verified: Optional[bool] = True
    department_verification_status: Optional[str] = None
    department_verification_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    evidence_items: List[EvidenceOut] = []
    activities: List[ComplaintActivityOut] = []

    model_config = ConfigDict(from_attributes=True)

# Department Classification & Verification Schemas
class DepartmentClassificationRequest(BaseModel):
    title: str = Field(..., min_length=2)
    description: str = Field(..., min_length=5)
    selected_department_id: Optional[str] = None
    selected_department_code: Optional[str] = None

class DepartmentRankingItem(BaseModel):
    code: str
    name: str
    probability: float
    percentage: str

class DepartmentClassificationOut(BaseModel):
    predicted_department_code: str
    predicted_department_name: str
    predicted_department_id: Optional[str] = None
    confidence: float
    confidence_pct: str
    is_good_department: bool
    verification_status: str
    verification_score: int
    verification_message: str
    selected_department_code: Optional[str] = None
    selected_department_name: Optional[str] = None
    recommended_department_code: Optional[str] = None
    recommended_department_name: Optional[str] = None
    recommended_department_id: Optional[str] = None
    detected_keywords: List[str] = []
    department_rankings: List[DepartmentRankingItem] = []

class RetrainClassifierRequest(BaseModel):
    generate_fresh_data: bool = False

# Case Management CRM Actions
class CaseStatusUpdate(BaseModel):
    status: str  # SUBMITTED, UNDER_REVIEW, ASSIGNED, INVESTIGATING, AWAITING_INFORMATION, RESOLVED, REJECTED_WITH_REASON, APPEALED
    rejection_reason: Optional[str] = None
    public_note: Optional[str] = None
    internal_note: Optional[str] = None

class CaseAssignmentUpdate(BaseModel):
    assigned_to_id: str
    notes: Optional[str] = None

class CasePriorityUpdate(BaseModel):
    priority: str  # LOW, MEDIUM, HIGH, CRITICAL
    priority_justification: str

class InternalNoteCreate(BaseModel):
    internal_note: str

class AnonymousMessageCreate(BaseModel):
    message: str
    is_question_from_officer: bool = False

class ResolutionCreate(BaseModel):
    resolution_summary: str
    internal_resolution_notes: Optional[str] = None

# Flagging and Trust & Safety Schemas
class ComplaintFlagCreate(BaseModel):
    complaint_id: str
    flag_reason: str  # DUPLICATE_SUBMISSION, SUSPECTED_FABRICATED_EVIDENCE, DELIBERATELY_MISLEADING_CLAIM, COORDINATED_ABUSE, SPAM_OR_IRRELEVANT, OTHER
    flag_details: str

class ComplaintFlagOut(BaseModel):
    id: str
    complaint_id: str
    flagged_by_role: str
    flag_reason: str
    flag_details: str
    is_reviewed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AbuseInvestigationOut(BaseModel):
    id: str
    complaint_id: str
    complaint_number: Optional[str] = None
    complaint_title: Optional[str] = None
    status: str
    lead_reviewer_id: Optional[str] = None
    lead_reviewer_name: Optional[str] = None
    risk_score: float
    risk_signals_json: str
    alleged_violation: Optional[str] = None
    evidence_examined: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    flags: List[ComplaintFlagOut] = []

    model_config = ConfigDict(from_attributes=True)

class AbuseDecisionCreate(BaseModel):
    finding: str  # SUBSTANTIATED_ABUSE, INSUFFICIENT_EVIDENCE, DISMISSED
    rationale: str
    evidence_examined: str
    recommended_sanction: str = "NONE"  # NONE, WARNING, TEMPORARY_RESTRICTION, SUSPENSION
    appeal_deadline_days: int = 14

class AbuseDecisionOut(BaseModel):
    id: str
    investigation_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    finding: str
    rationale: str
    evidence_examined: str
    recommended_sanction: str
    second_reviewer_id: Optional[str] = None
    second_reviewer_name: Optional[str] = None
    second_reviewer_approval: Optional[bool] = None
    second_reviewer_notes: Optional[str] = None
    appeal_deadline: Optional[datetime] = None
    decision_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class SecondReviewerApprovalRequest(BaseModel):
    approved: bool
    notes: str

class SanctionOut(BaseModel):
    id: str
    user_id: str
    citizen_pseudonym_id: str
    sanction_type: str
    reason: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Appeals Schemas
class AppealCreate(BaseModel):
    target_type: str  # COMPLAINT_REJECTION, ABUSE_SANCTION
    target_id: str
    grounds_for_appeal: str

class AppealReview(BaseModel):
    status: str  # UPHELD, OVERTURNED, REJECTED
    review_notes: str

class AppealOut(BaseModel):
    id: str
    target_type: str
    target_id: str
    complainant_pseudonym_id: str
    grounds_for_appeal: str
    status: str
    reviewer_id: Optional[str] = None
    review_notes: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Identity Disclosure Schemas
class IdentityDisclosureRequestCreate(BaseModel):
    investigation_id: str
    complaint_id: str
    legal_and_policy_basis: str

class IdentityDisclosureReview(BaseModel):
    approved: bool
    admin_rationale: str

class IdentityDisclosureRequestOut(BaseModel):
    id: str
    investigation_id: str
    complaint_id: str
    complaint_number: Optional[str] = None
    requested_by_reviewer_id: str
    requested_by_name: Optional[str] = None
    legal_and_policy_basis: str
    status: str
    reviewed_by_admin_id: Optional[str] = None
    reviewed_by_admin_name: Optional[str] = None
    admin_rationale: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    accessed_at: Optional[datetime] = None
    revealed_synthetic_snapshot: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Audit & Notifications
class AuditEventOut(BaseModel):
    id: str
    event_type: str
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    ip_address: Optional[str] = None
    resource_id: Optional[str] = None
    action: str
    details_json: str
    previous_hash: str
    tamper_hash: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Dashboard Analytics Schemas
class DashboardAnalytics(BaseModel):
    total_complaints: int
    resolution_rate_percent: float
    avg_resolution_hours: float
    overdue_complaints: int
    complaints_by_department: List[Dict[str, Any]]
    complaints_by_status: List[Dict[str, Any]]
    complaints_by_category: List[Dict[str, Any]]
    complaint_timeline_trend: List[Dict[str, Any]]
    abuse_reviews_summary: Dict[str, int]
    disclosure_requests_count: int
