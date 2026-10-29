import axios from 'axios';
import {
  User, Department, Complaint, PublicComplaint, ComplaintFlag,
  AbuseInvestigation, AbuseDecision, Appeal, IdentityDisclosureRequest,
  AuditEvent, DashboardAnalytics, DemoScenario, Sanction,
  NotificationItem, DepartmentWorkload, DepartmentClassificationResult, ClassifierMetrics
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('civictrust_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password });
    return res.data;
  },
  register: async (userData: { username: string; email: string; password: string; role?: string; department_id?: string }) => {
    const res = await apiClient.post('/auth/register', userData);
    return res.data;
  },
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    }
  },
  forgotPassword: async (email: string) => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  },
  resetPassword: async (token: string, newPassword: string) => {
    const res = await apiClient.post('/auth/reset-password', { token, new_password: newPassword });
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  // Verification
  verifyEligibility: async (data: {
    synthetic_full_name: string;
    synthetic_demographic_district: string;
    synthetic_phone_masked: string;
    acknowledgment: boolean;
  }) => {
    const res = await apiClient.post('/verification/verify', data);
    return res.data;
  },
  getVerificationStatus: async () => {
    const res = await apiClient.get('/verification/status');
    return res.data;
  },

  // Public Transparency Portal
  getPublicComplaints: async (params?: { search?: string; department_id?: string; status?: string; category?: string }): Promise<PublicComplaint[]> => {
    const res = await apiClient.get('/public/complaints', { params });
    return res.data;
  },
  getPublicComplaintTimeline: async (complaintNumber: string) => {
    const res = await apiClient.get(`/public/complaints/${complaintNumber}`);
    return res.data;
  },

  // Departments
  getDepartments: async (): Promise<Department[]> => {
    const res = await apiClient.get('/complaints/departments');
    return res.data;
  },

  // Complaints
  lodgeComplaint: async (data: any): Promise<Complaint> => {
    const res = await apiClient.post('/complaints/', data);
    return res.data;
  },
  getMyComplaints: async (): Promise<Complaint[]> => {
    const res = await apiClient.get('/complaints/my');
    return res.data;
  },
  getComplaintDetail: async (id: string): Promise<Complaint> => {
    const res = await apiClient.get(`/complaints/${id}`);
    return res.data;
  },
  uploadEvidence: async (complaintId: string, file: File, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    const res = await apiClient.post(`/complaints/${complaintId}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // AI Classification & Verification
  classifyDepartment: async (data: {
    title: string;
    description: string;
    selected_department_id?: string;
    selected_department_code?: string;
  }): Promise<DepartmentClassificationResult> => {
    const res = await apiClient.post('/complaints/classify-department', data);
    return res.data;
  },
  getClassifierMetrics: async (): Promise<ClassifierMetrics> => {
    const res = await apiClient.get('/complaints/classifier/metrics');
    return res.data;
  },
  retrainClassifier: async (generateFreshData: boolean = false): Promise<{ message: string; metrics: ClassifierMetrics }> => {
    const res = await apiClient.post('/complaints/classifier/retrain', { generate_fresh_data: generateFreshData });
    return res.data;
  },
  downloadEvidence: async (complaintId: string, evidenceId: string, filename: string) => {
    const res = await apiClient.get(`/complaints/${complaintId}/evidence/${evidenceId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  sendAnonymousMessage: async (complaintId: string, message: string) => {
    const res = await apiClient.post(`/complaints/${complaintId}/message`, { message });
    return res.data;
  },
  flagComplaint: async (complaintId: string, data: { flag_reason: string; flag_details: string }): Promise<ComplaintFlag> => {
    const res = await apiClient.post(`/complaints/${complaintId}/flag`, { complaint_id: complaintId, ...data });
    return res.data;
  },

  // CRM Case Management
  getCrmCases: async (params?: { department_id?: string; status?: string; priority?: string; assigned_to_me?: boolean; search?: string }): Promise<Complaint[]> => {
    const res = await apiClient.get('/crm/cases', { params });
    return res.data;
  },
  getKanbanBoard: async (department_id?: string): Promise<Record<string, Complaint[]>> => {
    const res = await apiClient.get('/crm/kanban', { params: { department_id } });
    return res.data;
  },
  updateCaseStatus: async (complaintId: string, data: { status: string; rejection_reason?: string; public_note?: string; internal_note?: string }) => {
    const res = await apiClient.patch(`/crm/cases/${complaintId}/status`, data);
    return res.data;
  },
  assignCase: async (complaintId: string, assignedToId: string, notes?: string) => {
    const res = await apiClient.patch(`/crm/cases/${complaintId}/assign`, { assigned_to_id: assignedToId, notes });
    return res.data;
  },
  updatePriority: async (complaintId: string, priority: string, priority_justification: string) => {
    const res = await apiClient.patch(`/crm/cases/${complaintId}/priority`, { priority, priority_justification });
    return res.data;
  },
  addInternalNote: async (complaintId: string, note: string) => {
    const res = await apiClient.post(`/crm/cases/${complaintId}/internal-notes`, { internal_note: note });
    return res.data;
  },
  resolveCase: async (complaintId: string, data: { resolution_summary: string; internal_resolution_notes?: string }) => {
    const res = await apiClient.post(`/crm/cases/${complaintId}/resolve`, data);
    return res.data;
  },
  getDepartmentWorkloads: async (): Promise<DepartmentWorkload[]> => {
    const res = await apiClient.get('/crm/departments');
    return res.data;
  },
  updateDepartmentSla: async (departmentId: string, slaHours: number, description?: string) => {
    const res = await apiClient.patch(`/crm/departments/${departmentId}/sla`, {
      default_sla_hours: slaHours,
      description,
    });
    return res.data;
  },
  getDepartmentOfficers: async (departmentId: string): Promise<{ id: string; username: string; email: string }[]> => {
    const res = await apiClient.get(`/crm/departments/${departmentId}/officers`);
    return res.data;
  },
  transferCase: async (complaintId: string, newDepartmentId: string, transferJustification: string): Promise<Complaint> => {
    const res = await apiClient.post(`/crm/cases/${complaintId}/transfer`, {
      new_department_id: newDepartmentId,
      transfer_justification: transferJustification,
    });
    return res.data;
  },

  // Trust & Safety
  getInvestigations: async (params?: { status?: string; min_risk_score?: number }): Promise<AbuseInvestigation[]> => {
    const res = await apiClient.get('/trust-safety/investigations', { params });
    return res.data;
  },
  getInvestigationDetail: async (id: string): Promise<AbuseInvestigation> => {
    const res = await apiClient.get(`/trust-safety/investigations/${id}`);
    return res.data;
  },
  recordAbuseDecision: async (investigationId: string, data: { finding: string; rationale: string; evidence_examined: string; recommended_sanction: string }): Promise<AbuseDecision> => {
    const res = await apiClient.post(`/trust-safety/investigations/${investigationId}/decisions`, data);
    return res.data;
  },
  approveSecondReviewer: async (decisionId: string, approved: boolean, notes: string): Promise<AbuseDecision> => {
    const res = await apiClient.post(`/trust-safety/decisions/${decisionId}/approve-second-reviewer`, { approved, notes });
    return res.data;
  },
  lodgeAppeal: async (data: { target_type: string; target_id: string; grounds_for_appeal: string }): Promise<Appeal> => {
    const res = await apiClient.post('/trust-safety/appeals', data);
    return res.data;
  },
  getAppeals: async (): Promise<Appeal[]> => {
    const res = await apiClient.get('/trust-safety/appeals');
    return res.data;
  },
  adjudicateAppeal: async (appealId: string, status: string, review_notes: string): Promise<Appeal> => {
    const res = await apiClient.patch(`/trust-safety/appeals/${appealId}/adjudicate`, { status, review_notes });
    return res.data;
  },
  getMySanctions: async (): Promise<Sanction[]> => {
    const res = await apiClient.get('/trust-safety/sanctions/my');
    return res.data;
  },

  // Identity Disclosure
  getDisclosureRequests: async (): Promise<IdentityDisclosureRequest[]> => {
    const res = await apiClient.get('/disclosure/requests');
    return res.data;
  },
  submitDisclosureRequest: async (data: { investigation_id: string; complaint_id: string; legal_and_policy_basis: string }) => {
    const res = await apiClient.post('/disclosure/requests', data);
    return res.data;
  },
  reviewDisclosureRequest: async (requestId: string, approved: boolean, admin_rationale: string) => {
    const res = await apiClient.patch(`/disclosure/requests/${requestId}/review`, { approved, admin_rationale });
    return res.data;
  },
  accessDisclosedIdentity: async (requestId: string) => {
    const res = await apiClient.post(`/disclosure/requests/${requestId}/access`);
    return res.data;
  },

  // Analytics & Audit
  getDashboardAnalytics: async (departmentId?: string): Promise<DashboardAnalytics> => {
    const res = await apiClient.get('/analytics/dashboard', { params: { department_id: departmentId } });
    return res.data;
  },
  getAuditEvents: async (params?: { event_type?: string; limit?: number; offset?: number }): Promise<AuditEvent[]> => {
    const res = await apiClient.get('/audit/events', { params });
    return res.data;
  },
  verifyAuditChain: async () => {
    const res = await apiClient.get('/audit/verify-chain');
    return res.data;
  },

  // In-App Notifications
  getNotifications: async (): Promise<NotificationItem[]> => {
    const res = await apiClient.get('/notifications/');
    return res.data;
  },
  getUnreadNotificationCount: async (): Promise<{ unread_count: number }> => {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data;
  },
  markNotificationRead: async (notificationId: string): Promise<NotificationItem> => {
    const res = await apiClient.patch(`/notifications/${notificationId}/read`);
    return res.data;
  },
  markAllNotificationsRead: async () => {
    const res = await apiClient.post('/notifications/read-all');
    return res.data;
  },

  // Demo Scenarios & Reset
  getScenarios: async (): Promise<DemoScenario[]> => {
    const res = await apiClient.get('/demo/scenarios');
    return res.data;
  },
  resetDemoDatabase: async () => {
    const res = await apiClient.post('/demo/reset');
    return res.data;
  },
};
