export type UserRole = 'CITIZEN' | 'DEPARTMENT_OFFICER' | 'TRUST_SAFETY_REVIEWER' | 'ADMINISTRATOR' | 'PRIVACY_OFFICER' | 'PUBLIC';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  department_id?: string;
  is_active: boolean;
  is_verified: boolean;
  citizen_pseudonym_id?: string;
  created_at: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  sla_hours: number;
}

export interface EvidenceItem {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  evidence_description?: string;
  sha256_hash: string;
  integrity_status: string;
  integrity_details?: string;
  created_at: string;
}

export interface ComplaintActivity {
  id: string;
  actor_role: string;
  activity_type: string;
  public_message?: string;
  internal_message?: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  complaint_number: string;
  citizen_pseudonym_id: string;
  title: string;
  description: string;
  department_id: string;
  department_name?: string;
  category: string;
  state: string;
  district: string;
  approximate_location: string;
  incident_date: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'INVESTIGATING' | 'AWAITING_INFORMATION' | 'RESOLVED' | 'REJECTED_WITH_REASON' | 'APPEALED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority_justification?: string;
  assigned_officer_id?: string;
  assigned_officer_name?: string;
  sla_deadline?: string;
  escalation_deadline?: string;
  is_overdue: boolean;
  resolution_summary?: string;
  internal_investigation_notes?: string;
  rejection_reason?: string;
  predicted_department_id?: string;
  predicted_department_code?: string;
  predicted_department_name?: string;
  classification_confidence?: number;
  is_department_verified?: boolean;
  department_verification_status?: string;
  department_verification_notes?: string;
  created_at: string;
  updated_at: string;
  evidence_items?: EvidenceItem[];
  evidence?: EvidenceItem[];
  activities?: ComplaintActivity[];
}

export interface DepartmentRankingItem {
  code: string;
  name: string;
  probability: number;
  percentage: string;
}

export interface DepartmentClassificationResult {
  predicted_department_code: string;
  predicted_department_name: string;
  predicted_department_id?: string;
  confidence: number;
  confidence_pct: string;
  is_good_department: boolean;
  verification_status: 'VERIFIED_GOOD_MATCH' | 'ACCEPTABLE_MATCH' | 'WARNING_MISMATCH' | 'PLAUSIBLE_OVERLAP' | 'UNCERTAIN' | string;
  verification_score: number;
  verification_message: string;
  selected_department_code?: string;
  selected_department_name?: string;
  recommended_department_code?: string;
  recommended_department_name?: string;
  recommended_department_id?: string;
  detected_keywords: string[];
  department_rankings: DepartmentRankingItem[];
}

export interface ClassifierMetrics {
  dataset_total_records: number;
  train_samples_count: number;
  test_samples_count: number;
  test_accuracy: number;
  test_accuracy_pct: string;
  macro_avg_f1: number;
  weighted_avg_f1: number;
  departments_evaluated: string[];
  per_department_metrics: Record<string, {
    department_name: string;
    precision: number;
    recall: number;
    f1_score: number;
    test_samples: number;
  }>;
  confusion_matrix: {
    classes: string[];
    matrix: number[][];
  };
  top_keywords_per_department: Record<string, {
    department_name: string;
    top_features: string[];
  }>;
}

export interface PublicComplaint {
  id: string;
  complaint_number: string;
  category: string;
  department_name: string;
  general_location: string;
  incident_date: string;
  status: string;
  resolution_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplaintFlag {
  id: string;
  complaint_id: string;
  flagged_by_role: string;
  flag_reason: string;
  flag_details: string;
  is_reviewed: boolean;
  created_at: string;
}

export interface AbuseDecision {
  id: string;
  investigation_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  finding: string;
  rationale: string;
  evidence_examined: string;
  recommended_sanction: string;
  second_reviewer_id?: string;
  second_reviewer_name?: string;
  second_reviewer_approval?: boolean | null;
  second_reviewer_notes?: string;
  appeal_deadline?: string;
  decision_timestamp: string;
}

export interface AbuseInvestigation {
  id: string;
  complaint_id: string;
  complaint_number: string;
  complaint_title: string;
  complaint_description?: string;
  complaint_category?: string;
  status: 'FLAGGED' | 'TRIAGE' | 'UNDER_INVESTIGATION' | 'INSUFFICIENT_EVIDENCE' | 'SUBSTANTIATED_ABUSE' | 'DISMISSED' | 'APPEALED';
  lead_reviewer_id?: string;
  lead_reviewer_name?: string;
  risk_score: number;
  risk_signals_json: string;
  alleged_violation?: string;
  evidence_examined?: string;
  created_at: string;
  updated_at: string;
  flags: ComplaintFlag[];
  evidence_items?: EvidenceItem[];
  decisions?: AbuseDecision[];
  activities?: ComplaintActivity[];
}

export interface Sanction {
  id: string;
  user_id: string;
  citizen_pseudonym_id: string;
  sanction_type: string;
  reason: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

export interface Appeal {
  id: string;
  target_type: string;
  target_id: string;
  complainant_pseudonym_id: string;
  grounds_for_appeal: string;
  status: 'PENDING' | 'UPHELD' | 'OVERTURNED' | 'REJECTED';
  reviewer_id?: string;
  review_notes?: string;
  decided_at?: string;
  created_at: string;
}

export interface IdentityDisclosureRequest {
  id: string;
  investigation_id: string;
  complaint_id: string;
  complaint_number?: string;
  requested_by_reviewer_id: string;
  requested_by_name?: string;
  legal_and_policy_basis: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACCESSED';
  reviewed_by_admin_id?: string;
  reviewed_by_admin_name?: string;
  admin_rationale?: string;
  reviewed_at?: string;
  accessed_at?: string;
  revealed_synthetic_snapshot?: string;
  citizen_pseudonym_id?: string;
  past_flags_count?: number;
  is_flag_threshold_met?: boolean;
  flags_threshold?: number;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  actor_id?: string;
  actor_role?: string;
  ip_address?: string;
  resource_id?: string;
  action: string;
  details_json: string;
  previous_hash: string;
  tamper_hash: string;
  created_at: string;
}

export interface DashboardAnalytics {
  total_complaints: number;
  resolved_count: number;
  investigating_count: number;
  submitted_count: number;
  overdue_count: number;
  resolution_rate_percent: number;
  avg_resolution_hours: number;
  complaints_by_department: Array<{
    department_id: string;
    department_code: string;
    department_name: string;
    total_complaints: number;
    resolved_complaints: number;
  }>;
  complaints_by_category: Array<{
    category: string;
    count: number;
  }>;
  complaints_by_status: Array<{
    status: string;
    label: string;
    count: number;
  }>;
  complaint_timeline_trend: Array<{
    date: string;
    submitted: number;
    resolved: number;
    flagged: number;
  }>;
  trust_and_safety: {
    total_flags: number;
    unreviewed_flags: number;
    investigations_count: number;
    substantiated_count: number;
    dismissed_count: number;
    appeals_count: number;
    pending_appeals_count: number;
    disclosure_requests_count: number;
    pending_disclosure_count: number;
  };
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  case_number: string;
  status: string;
  department: string;
  role_focus: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface DepartmentWorkload {
  id: string;
  code: string;
  name: string;
  description?: string;
  default_sla_hours: number;
  is_active: boolean;
  officer_count: number;
  active_cases: number;
  overdue_cases: number;
}
