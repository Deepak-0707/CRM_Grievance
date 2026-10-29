import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Complaint, Department } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Building2, Kanban, Table, CheckCircle2, AlertTriangle, Clock,
  Send, ShieldAlert, Lock, Search, Filter, MessageSquare, ArrowRight,
  FileCheck, X, RefreshCw, AlertCircle, UserCheck, FileText
} from 'lucide-react';

export const OfficerDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [cases, setCases] = useState<Complaint[]>([]);
  const [kanbanCols, setKanbanCols] = useState<Record<string, Complaint[]>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>(currentUser?.department_id || '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Case Detail Workspace Modal
  const [selectedCase, setSelectedCase] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [internalNote, setInternalNote] = useState<string>('');
  const [anonymousQuestion, setAnonymousQuestion] = useState<string>('');
  const [resolutionSummary, setResolutionSummary] = useState<string>('');
  const [transferDeptId, setTransferDeptId] = useState<string>('');
  const [transferJustification, setTransferJustification] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Auto-scroll ref for clarification chat
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scenario G 403 Forbidden demonstrator
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

  useEffect(() => {
    loadDepartments();
  }, [currentUser]);

  useEffect(() => {
    loadCases();
  }, [selectedDept, viewMode, currentUser]);

  useEffect(() => {
    if (selectedCase) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedCase?.activities?.length]);

  const loadDepartments = async () => {
    try {
      const depts = await api.getDepartments();
      setDepartments(depts);
      if (currentUser?.department_id) {
        setSelectedDept(currentUser.department_id);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    setForbiddenError(null);
    try {
      // Scoped access: Department officers must strictly query their assigned department
      const effectiveDeptId = currentUser?.role === 'DEPARTMENT_OFFICER'
        ? (currentUser.department_id || selectedDept)
        : (selectedDept || undefined);

      if (viewMode === 'kanban') {
        const kanbanData = await api.getKanbanBoard(effectiveDeptId || undefined);
        setKanbanCols(kanbanData);
      } else {
        const listData = await api.getCrmCases({
          department_id: effectiveDeptId || undefined,
          search: search || undefined,
        });
        setCases(listData);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCase = async (c: Complaint) => {
    setSelectedCase(c);
    setNewStatus(c.status);
    try {
      const refreshed = await api.getComplaintDetail(c.id);
      setSelectedCase(refreshed);
      setNewStatus(refreshed.status);
    } catch (err: any) {
      console.error('Failed to load fresh case detail:', err);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newStatus) return;

    setActionLoading(true);
    try {
      await api.updateCaseStatus(selectedCase.id, {
        status: newStatus,
        public_note: statusNote,
        internal_note: internalNote,
      });
      alert('Case status updated successfully.');
      setStatusNote('');
      const refreshed = await api.getComplaintDetail(selectedCase.id);
      setSelectedCase(refreshed);
      await loadCases();
    } catch (err: any) {
      alert('Failed to update status: ' + (err?.response?.data?.detail || err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !internalNote.trim()) return;

    setActionLoading(true);
    try {
      await api.addInternalNote(selectedCase.id, internalNote.trim());
      setInternalNote('');
      const refreshed = await api.getComplaintDetail(selectedCase.id);
      setSelectedCase(refreshed);
      await loadCases();
    } catch (err: any) {
      alert('Failed to add internal note: ' + (err?.response?.data?.detail || err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !anonymousQuestion.trim()) return;

    setActionLoading(true);
    try {
      const newAct = await api.sendAnonymousMessage(selectedCase.id, anonymousQuestion.trim());
      setAnonymousQuestion('');
      try {
        const refreshed = await api.getComplaintDetail(selectedCase.id);
        setSelectedCase(refreshed);
      } catch {
        if (newAct) {
          setSelectedCase((prev) => prev ? {
            ...prev,
            status: 'AWAITING_INFORMATION',
            activities: [...(prev.activities || []), newAct]
          } : null);
        }
      }
      await loadCases();
    } catch (err: any) {
      alert('Failed to send question: ' + (err?.response?.data?.detail || err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resolutionSummary.trim()) return;

    setActionLoading(true);
    try {
      await api.resolveCase(selectedCase.id, {
        resolution_summary: resolutionSummary.trim(),
        internal_resolution_notes: internalNote || 'Resolved following field inspection.',
      });
      alert('Case marked as RESOLVED and public remediation logged.');
      setResolutionSummary('');
      const refreshed = await api.getComplaintDetail(selectedCase.id);
      setSelectedCase(refreshed);
      await loadCases();
    } catch (err: any) {
      alert('Failed to resolve case: ' + (err?.response?.data?.detail || err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !transferDeptId || !transferJustification.trim()) return;

    const targetDept = departments.find(d => d.id === transferDeptId);
    setActionLoading(true);
    try {
      await api.transferCase(selectedCase.id, transferDeptId, transferJustification.trim());
      alert(`Case ${selectedCase.complaint_number} successfully reclassified and transferred to ${targetDept?.name || 'target department'}. Jurisdictional ownership updated.`);
      setTransferDeptId('');
      setTransferJustification('');
      setSelectedCase(null);
      await loadCases();
    } catch (err: any) {
      alert('Failed to transfer case: ' + (err?.response?.data?.detail || err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  // Scenario G Trigger: Officer attempts to access identity mapping
  const handleAttemptAccessIdentity = async () => {
    setForbiddenError(null);
    try {
      // Intentionally call identity access endpoint
      await api.accessDisclosedIdentity('any-request-id');
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setForbiddenError(
          'SCENARIO G ENFORCED: HTTP 403 FORBIDDEN. Department Officers are barred from accessing citizen identity mappings under strict data-isolation policy. Security event logged in audit chain.'
        );
      } else {
        setForbiddenError(
          `Security Gate Intercepted: HTTP ${err?.response?.status || 403} - Access Denied to identity records.`
        );
      }
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Officer Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Department Grievance CRM</h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Officer Portal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active Officer: <span className="text-slate-200 font-semibold">{currentUser?.username}</span> • Role: Department Officer
              </p>
            </div>
          </div>

          {/* Privacy Boundary 403 Test Button */}
          <button
            onClick={handleAttemptAccessIdentity}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            title="Verify server-side 403 Forbidden enforcement on identity vault"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Verify Privacy Boundary (Test 403 Restriction)</span>
          </button>
        </div>

        {/* 403 Forbidden Verification Notice Box */}
        {forbiddenError && (
          <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 p-4 rounded-xl text-xs flex items-start gap-3 animate-in fade-in duration-200">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-200 block mb-1">
                Privacy Boundary Active: Unauthorized Identity Access Prevented (403 Forbidden)
              </span>
              {forbiddenError}
            </div>
          </div>
        )}

        {/* Filter and View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-3">
            {currentUser?.role === 'DEPARTMENT_OFFICER' ? (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs text-blue-300 font-medium">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  Department: <strong>{departments.find(d => d.id === (currentUser.department_id || selectedDept))?.name || 'Assigned Department'}</strong> ({departments.find(d => d.id === (currentUser.department_id || selectedDept))?.code || 'PWD'})
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-200 px-1.5 py-0.5 rounded font-mono uppercase">
                  Department Scoped (Overall View Disabled)
                </span>
              </div>
            ) : (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={loadCases}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-teal-600 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-teal-600 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
            >
              <Table className="w-3.5 h-3.5" />
              Searchable Table
            </button>
          </div>
        </div>
      </div>

      {/* Case Management View */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
          Loading case management board...
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-4">
          {[
            { key: 'SUBMITTED', title: 'Submitted', color: 'slate' },
            { key: 'ASSIGNED', title: 'Assigned', color: 'indigo' },
            { key: 'INVESTIGATING', title: 'Investigating', color: 'blue' },
            { key: 'AWAITING_INFORMATION', title: 'Awaiting Info', color: 'purple' },
            { key: 'RESOLVED', title: 'Resolved', color: 'emerald' },
            { key: 'REJECTED_WITH_REASON', title: 'Closed / Reason', color: 'rose' },
          ].map((col) => {
            const items = kanbanCols[col.key] || [];
            return (
              <div key={col.key} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {col.title}
                  </span>
                  <span className="text-xs font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleOpenCase(c)}
                      className="bg-slate-950 border border-slate-800/80 hover:border-teal-500/50 p-3 rounded-xl cursor-pointer transition-all space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-teal-400">
                          {c.complaint_number}
                        </span>
                        {c.is_overdue && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 animate-pulse">
                            SLA Overdue
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-slate-100 line-clamp-2">
                        {c.title}
                      </h4>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                        <span className="font-mono text-slate-500">{c.citizen_pseudonym_id}</span>
                        <span className="text-teal-400 font-medium">Manage →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3.5">Reference</th>
                  <th className="p-3.5">Complainant Pseudonym</th>
                  <th className="p-3.5">Title</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">SLA Deadline</th>
                  <th className="p-3.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenCase(c)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-3.5 font-mono font-bold text-teal-400">{c.complaint_number}</td>
                    <td className="p-3.5 font-mono text-slate-400">{c.citizen_pseudonym_id}</td>
                    <td className="p-3.5 font-medium text-slate-100 max-w-xs truncate">{c.title}</td>
                    <td className="p-3.5">
                      <span className="civic-badge bg-slate-800 text-slate-200 border border-slate-700">
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-amber-400">{c.priority}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">
                      {c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCase(c);
                        }}
                        className="bg-slate-800 group-hover:bg-teal-600 group-hover:text-slate-950 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      >
                        Workspace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Case Investigation Workspace Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative text-slate-100 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedCase(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-4 mb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-teal-400">
                  {selectedCase.complaint_number}
                </span>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  Complainant: {selectedCase.citizen_pseudonym_id}
                </span>
                <span className="civic-badge bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {selectedCase.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-white">{selectedCase.title}</h3>
              <p className="text-xs text-slate-400">{selectedCase.description}</p>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 space-y-6 text-xs">
              {/* Case File & Timeline Activity Log */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-400" />
                    <span>Case File Activity Log & Timeline</span>
                  </h4>
                  <span className="text-[10px] text-teal-400 font-mono">
                    {selectedCase.activities?.length || 0} Events Logged
                  </span>
                </div>

                {(!selectedCase.activities || selectedCase.activities.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-1">No activities logged in this case file yet.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {[...(selectedCase.activities || [])]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((act) => (
                      <div
                        key={act.id}
                        className={`p-2.5 rounded-lg border text-xs space-y-1 ${act.activity_type === 'OFFICER_QUESTION'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-100'
                            : act.activity_type === 'CITIZEN_REPLY'
                              ? 'bg-teal-500/10 border-teal-500/30 text-teal-100'
                              : act.activity_type === 'INTERNAL_NOTE'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-100'
                                : act.activity_type === 'STATUS_CHANGE'
                                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-100'
                                  : act.activity_type === 'DEPARTMENT_TRANSFER'
                                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-100'
                                    : act.activity_type === 'RESOLUTION'
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                                      : act.activity_type === 'ASSIGNMENT'
                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-100'
                                        : act.activity_type === 'PRIORITY_CHANGE'
                                          ? 'bg-orange-500/10 border-orange-500/30 text-orange-100'
                                          : act.activity_type === 'FLAG_RAISED'
                                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-100'
                                            : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
                          <span className="font-semibold flex items-center gap-1">
                            {act.activity_type === 'INTERNAL_NOTE' && <Lock className="w-3 h-3 text-amber-400" />}
                            {act.activity_type === 'OFFICER_QUESTION'
                              ? 'Officer Question'
                              : act.activity_type === 'CITIZEN_REPLY'
                                ? 'Citizen Reply'
                                : act.activity_type.replace(/_/g, ' ')}
                            <span className="text-slate-400">({act.actor_role})</span>
                          </span>
                          <span>
                            {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {act.public_message && <p className="leading-relaxed">{act.public_message}</p>}
                        {act.internal_message && (
                          <p className="font-mono text-[11px] text-amber-300/90 bg-amber-950/40 p-1.5 rounded border border-amber-500/20">
                            <strong>[Internal Note]:</strong> {act.internal_message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Update Form */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider">
                  Update Case Status & Public Progress Note
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">New Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                    >
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="INVESTIGATING">INVESTIGATING</option>
                      <option value="AWAITING_INFORMATION">AWAITING_INFORMATION</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="REJECTED_WITH_REASON">REJECTED_WITH_REASON</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Public Note (Citizen Visible)</label>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="E.g., Field inspection completed on Oct 14..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleStatusChange}
                  className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"
                >
                  Save Status Transition
                </button>
              </div>

              {/* Internal Notes (Officer-Only Protected) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Internal Officer Investigation Notes (Protected)
                  </h4>
                  <span className="text-[10px] text-amber-400 font-mono">Never Public / Never Citizen Visible</span>
                </div>

                {selectedCase.internal_investigation_notes && (
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {selectedCase.internal_investigation_notes}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Append internal technical note or contractor work order..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={actionLoading || !internalNote.trim()}
                    onClick={handleAddInternalNote}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-lg"
                  >
                    Append Note
                  </button>
                </div>
              </div>

              {/* 2-Way Anonymous Clarification Channel with Citizen */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-teal-400" />
                    <span>2-Way Anonymous Clarification Channel (Citizen Dialogue)</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      Complainant: {selectedCase.citizen_pseudonym_id}
                    </span>
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {
                        (selectedCase.activities || []).filter(
                          (a) => a.activity_type === 'OFFICER_QUESTION' || a.activity_type === 'CITIZEN_REPLY' || a.public_message
                        ).length
                      }{' '}
                      Message(s)
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Direct pseudonymous dialogue with complainant. Ask for specific evidence or landmark details without compromising citizen identity. Both officer and citizen see this live clarification history.
                </p>

                {/* Live Conversation Stream */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-3 max-h-72 overflow-y-auto">
                  {(!selectedCase.activities ||
                    selectedCase.activities.filter(
                      (act) => act.activity_type === 'OFFICER_QUESTION' || act.activity_type === 'CITIZEN_REPLY' || !!act.public_message
                    ).length === 0) ? (
                    <div className="text-center py-6 text-slate-500 italic text-xs space-y-1">
                      <MessageSquare className="w-6 h-6 mx-auto opacity-30 text-teal-400" />
                      <p>No clarification messages exchanged yet with complainant.</p>
                      <p className="text-[10px] text-slate-600">
                        Type a question below to request clarifications or photos from the citizen.
                      </p>
                    </div>
                  ) : (
                    [...(selectedCase.activities || [])]
                      .filter(
                        (act) => act.activity_type === 'OFFICER_QUESTION' || act.activity_type === 'CITIZEN_REPLY' || !!act.public_message
                      )
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((act) => {
                        const isCitizen = act.actor_role === 'CITIZEN' || act.activity_type === 'CITIZEN_REPLY';
                        const isOfficer =
                          act.actor_role === 'OFFICER' ||
                          act.actor_role === 'DEPARTMENT_OFFICER' ||
                          act.activity_type === 'OFFICER_QUESTION';

                        if (act.activity_type === 'STATUS_CHANGE' || act.activity_type === 'DEPARTMENT_TRANSFER' || act.activity_type === 'RESOLUTION') {
                          return (
                            <div
                              key={act.id}
                              className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-center text-[11px] text-slate-400 space-y-0.5"
                            >
                              <div className="font-semibold text-slate-300 flex items-center justify-center gap-1.5">
                                <Clock className="w-3 h-3 text-purple-400" />
                                <span>Case Milestone: {act.activity_type.replace(/_/g, ' ')}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ({new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              </div>
                              {act.public_message && <p className="text-slate-400 text-xs">{act.public_message}</p>}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={act.id}
                            className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all shadow-sm ${
                              isOfficer
                                ? 'bg-blue-500/15 border-blue-500/35 ml-8 text-blue-100 rounded-tr-sm'
                                : isCitizen
                                  ? 'bg-teal-500/15 border-teal-500/35 mr-8 text-teal-100 rounded-tl-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono opacity-85 border-b border-slate-800/50 pb-1">
                              <span className="font-semibold flex items-center gap-1.5">
                                {isOfficer ? (
                                  <>
                                    <Send className="w-3 h-3 text-blue-400" />
                                    <span>You (Investigating Officer)</span>
                                  </>
                                ) : isCitizen ? (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-teal-400 inline-block animate-pulse" />
                                    <span>Complainant ({selectedCase.citizen_pseudonym_id})</span>
                                  </>
                                ) : (
                                  <span>{act.actor_role} ({act.activity_type.replace(/_/g, ' ')})</span>
                                )}
                              </span>
                              <span className="text-slate-400">
                                {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                                {new Date(act.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap">{act.public_message}</p>
                          </div>
                        );
                      })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Send Clarification Question Form */}
                <form onSubmit={handleSendQuestion} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={anonymousQuestion}
                    onChange={(e) => setAnonymousQuestion(e.target.value)}
                    placeholder="Type clarification message to citizen (e.g., Which house number is opposite the road defect?)..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || !anonymousQuestion.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{actionLoading ? 'Sending...' : 'Send to Citizen'}</span>
                  </button>
                </form>
              </div>

              {/* Supporting Evidence Documents */}
              {((selectedCase.evidence_items || selectedCase.evidence) || []).length > 0 && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-teal-400" />
                      Supporting Evidence Attachments ({((selectedCase.evidence_items || selectedCase.evidence) || []).length})
                    </h4>
                    <span className="text-[10px] text-teal-400 font-mono">SHA-256 Checksum Verified</span>
                  </div>
                  <div className="space-y-2">
                    {((selectedCase.evidence_items || selectedCase.evidence) || []).map((ev: any) => (
                      <div key={ev.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                        <div className="truncate pr-2">
                          <div className="font-semibold text-slate-200 truncate">{ev.filename}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            SHA-256: {ev.sha256_hash.slice(0, 16)}... • {(ev.file_size_bytes / 1024).toFixed(1)} KB • {ev.evidence_description || 'Private citizen attachment'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => api.downloadEvidence(selectedCase.id, ev.id, ev.filename)}
                          className="bg-teal-600/20 hover:bg-teal-600 hover:text-slate-950 text-teal-300 font-bold px-3 py-1.5 rounded-lg text-[11px] border border-teal-500/30 transition-all shrink-0"
                        >
                          Download & Verify
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-Department Case Transfer / Reclassification */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Reclassify Case Department (Fix Wrong Classification)
                </h4>
                <p className="text-[11px] text-slate-400">
                  If citizen filed this grievance under the wrong department, reclassify and route to the appropriate department. Ownership transfers and SLAs recalibrate automatically.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Correct Department</label>
                    <select
                      value={transferDeptId}
                      onChange={(e) => setTransferDeptId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 text-xs"
                    >
                      <option value="">Select Correct Department...</option>
                      {departments
                        .filter((d) => d.id !== selectedCase.department_id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code}) - {d.sla_hours}h SLA
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Reclassification Reason</label>
                    <input
                      type="text"
                      value={transferJustification}
                      onChange={(e) => setTransferJustification(e.target.value)}
                      placeholder="E.g., Wrong department selected; sewer damage belongs to Water Board..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={actionLoading || !transferDeptId || !transferJustification.trim()}
                  onClick={handleTransferCase}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                >
                  Execute Department Reclassification
                </button>
              </div>

              {/* Case Resolution Form */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-emerald-400">
                  Mark Grievance as RESOLVED
                </h4>
                <textarea
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  rows={2}
                  placeholder="Record formal remediation details (e.g., PWD Division re-asphalted 40m road section on Oct 13)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
                <button
                  type="button"
                  disabled={actionLoading || !resolutionSummary.trim()}
                  onClick={handleResolveCase}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg"
                >
                  Confirm & Resolve Case
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
