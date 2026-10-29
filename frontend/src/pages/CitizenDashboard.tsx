import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Complaint, Sanction, Appeal } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Clock, CheckCircle2, AlertTriangle, ShieldCheck,
  Send, MessageSquare, AlertCircle, Plus, Eye, ChevronRight,
  Scale, Lock, RefreshCw, X
} from 'lucide-react';

interface CitizenDashboardProps {
  onNavigateToSubmit: () => void;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({ onNavigateToSubmit }) => {
  const { currentUser, setIsVerificationModalOpen } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected complaint detail modal state
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [anonymousMessage, setAnonymousMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Appeal Modal State
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealTargetType, setAppealTargetType] = useState('COMPLAINT_REJECTION');
  const [appealTargetId, setAppealTargetId] = useState('');
  const [appealGrounds, setAppealGrounds] = useState('');
  const [appealLoading, setAppealLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compData, sancData, appData] = await Promise.all([
        api.getMyComplaints(),
        api.getMySanctions(),
        api.getAppeals(),
      ]);
      setComplaints(compData);
      setSanctions(sancData);
      setAppeals(appData);
    } catch (err) {
      console.error('Failed to load citizen data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectComplaint = async (c: Complaint) => {
    setSelectedComplaint(c);
    try {
      const refreshed = await api.getComplaintDetail(c.id);
      setSelectedComplaint(refreshed);
    } catch (err) {
      console.error('Failed to load fresh complaint detail:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !anonymousMessage.trim()) return;

    setSendingMsg(true);
    try {
      await api.sendAnonymousMessage(selectedComplaint.id, anonymousMessage.trim());
      setAnonymousMessage('');
      // Reload detail
      const refreshed = await api.getComplaintDetail(selectedComplaint.id);
      setSelectedComplaint(refreshed);
      await loadData();
    } catch (err: any) {
      alert('Failed to send anonymous reply: ' + (err?.response?.data?.detail || err?.message || err));
    } finally {
      setSendingMsg(false);
    }
  };

  const handleLodgeAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealGrounds.trim()) return;

    setAppealLoading(true);
    try {
      await api.lodgeAppeal({
        target_type: appealTargetType,
        target_id: appealTargetId,
        grounds_for_appeal: appealGrounds.trim(),
      });
      alert('Appeal lodged successfully! Assigned to Trust & Safety for review.');
      setIsAppealModalOpen(false);
      setAppealGrounds('');
      await loadData();
    } catch (err: any) {
      alert('Failed to lodge appeal: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setAppealLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="civic-badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Resolved</span>;
      case 'INVESTIGATING':
        return <span className="civic-badge bg-blue-500/10 text-blue-400 border border-blue-500/30">Investigating</span>;
      case 'ASSIGNED':
        return <span className="civic-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">Assigned</span>;
      case 'UNDER_REVIEW':
        return <span className="civic-badge bg-amber-500/10 text-amber-400 border border-amber-500/30">Under Review</span>;
      case 'AWAITING_INFORMATION':
        return <span className="civic-badge bg-purple-500/10 text-purple-400 border border-purple-500/30">Awaiting Your Info</span>;
      case 'REJECTED_WITH_REASON':
        return <span className="civic-badge bg-rose-500/10 text-rose-400 border border-rose-500/30">Closed w/ Reason</span>;
      default:
        return <span className="civic-badge bg-slate-800 text-slate-300 border border-slate-700">Submitted</span>;
    }
  };

  const activeSanctions = sanctions.filter((s) => s.is_active);

  return (
    <div className="space-y-8 py-4">
      {/* Verification & Pseudonym Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Citizen Private Workspace</h2>
              {currentUser?.is_verified ? (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified Citizen
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Unverified Citizen
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Pseudonymous ID:{' '}
              <span className="text-teal-400 font-bold">
                {currentUser?.citizen_pseudonym_id || 'CITIZEN-ANONYMOUS'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!currentUser?.is_verified && (
            <button
              onClick={() => setIsVerificationModalOpen(true)}
              className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Verify Eligibility
            </button>
          )}

          <button
            onClick={onNavigateToSubmit}
            className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Lodge New Grievance
          </button>
        </div>
      </div>

      {/* Active Sanction Alert (if any) */}
      {activeSanctions.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            Active Account Restriction Notice
          </div>
          {activeSanctions.map((s) => (
            <div key={s.id} className="text-xs text-rose-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-rose-300">{s.sanction_type}:</span> {s.reason}
              </div>
              <button
                onClick={() => {
                  setAppealTargetType('ABUSE_SANCTION');
                  setAppealTargetId(s.id);
                  setIsAppealModalOpen(true);
                }}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 px-3 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0"
              >
                Appeal This Decision
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="civic-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Lodged</div>
          <div className="text-2xl font-bold text-white mt-1">{complaints.length}</div>
        </div>
        <div className="civic-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Under Investigation</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {complaints.filter((c) => ['ASSIGNED', 'INVESTIGATING', 'UNDER_REVIEW'].includes(c.status)).length}
          </div>
        </div>
        <div className="civic-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Awaiting Your Reply</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {complaints.filter((c) => c.status === 'AWAITING_INFORMATION').length}
          </div>
        </div>
        <div className="civic-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Resolved</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {complaints.filter((c) => c.status === 'RESOLVED').length}
          </div>
        </div>
      </div>

      {/* My Complaints List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight">
            My Submitted Complaints
          </h3>
          <button
            onClick={loadData}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Loading private records...
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No complaints registered yet</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">You have not submitted any complaints under this pseudonymous account.</p>
            <button
              onClick={onNavigateToSubmit}
              className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all"
            >
              Lodge Your First Grievance
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectComplaint(c)}
                className="civic-card-interactive flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {c.complaint_number}
                    </span>
                    {getStatusBadge(c.status)}
                    {c.is_department_verified ? (
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                        ✓ AI Verified Match
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                        ⚠ Routing Advisory
                      </span>
                    )}
                    {c.status === 'AWAITING_INFORMATION' && (
                      <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded animate-pulse">
                        Officer Question Pending
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
                    {c.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{c.department_name}</span>
                    <span>•</span>
                    <span>{c.district}</span>
                    <span>•</span>
                    <span>Lodged {new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {c.status === 'REJECTED_WITH_REASON' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAppealTargetType('COMPLAINT_REJECTION');
                        setAppealTargetId(c.id);
                        setIsAppealModalOpen(true);
                      }}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Scale className="w-3.5 h-3.5 text-amber-400" />
                      Appeal Decision
                    </button>
                  )}

                  <span className="text-teal-400 text-xs font-medium flex items-center gap-1">
                    Details & Chat
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complaint Detail & 2-Way Anonymous Communication Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-slate-100 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedComplaint(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-4 mb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-teal-400">
                  {selectedComplaint.complaint_number}
                </span>
                {getStatusBadge(selectedComplaint.status)}
              </div>
              <h3 className="text-base font-bold text-white">{selectedComplaint.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{selectedComplaint.description}</p>
              
              {/* AI Department Routing & Verification Indicator */}
              {selectedComplaint.department_verification_status && (
                <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  selectedComplaint.is_department_verified
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {selectedComplaint.is_department_verified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>
                      {selectedComplaint.is_department_verified
                        ? `AI Routing Verified: Good match for ${selectedComplaint.department_name}`
                        : `AI Routing Advisory: Model predicted ${selectedComplaint.predicted_department_name || 'different department'}`}
                    </span>
                  </div>
                  {selectedComplaint.classification_confidence && (
                    <span className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      {(selectedComplaint.classification_confidence * 100).toFixed(1)}% Confidence
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Evidence Documents */}
            {((selectedComplaint.evidence_items || selectedComplaint.evidence) || []).length > 0 && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-3 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Uploaded Evidence Files ({((selectedComplaint.evidence_items || selectedComplaint.evidence) || []).length})
                </span>
                <div className="space-y-1.5">
                  {((selectedComplaint.evidence_items || selectedComplaint.evidence) || []).map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                        <div className="truncate">
                          <span className="text-slate-200 font-medium block truncate">{ev.filename}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            SHA-256: {ev.sha256_hash.slice(0, 12)}... • {(ev.file_size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => api.downloadEvidence(selectedComplaint.id, ev.id, ev.filename)}
                        className="text-teal-400 hover:text-teal-300 font-semibold text-[11px] shrink-0 border border-teal-500/30 px-2.5 py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline & Anonymous Messages */}
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                Case Activity & Anonymous Clarification Channel
              </h4>

              {selectedComplaint.resolution_summary && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-300">
                  <span className="font-bold block text-emerald-400 uppercase tracking-wider text-[10px] mb-1">
                    Official Remediation:
                  </span>
                  {selectedComplaint.resolution_summary}
                </div>
              )}

              {selectedComplaint.rejection_reason && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-xs text-rose-300">
                  <span className="font-bold block text-rose-400 uppercase tracking-wider text-[10px] mb-1">
                    Rejection / Closure Reason:
                  </span>
                  {selectedComplaint.rejection_reason}
                </div>
              )}

              <div className="space-y-3">
                {(!selectedComplaint.activities || selectedComplaint.activities.filter(a => !!a.public_message).length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-2">No clarification messages or updates logged yet.</p>
                ) : (
                  [...(selectedComplaint.activities || [])]
                    .filter((act) => !!act.public_message)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((act) => {
                      const isCitizen = act.actor_role === 'CITIZEN' || act.activity_type === 'CITIZEN_REPLY';
                      const isOfficer = act.actor_role === 'OFFICER' || act.actor_role === 'DEPARTMENT_OFFICER' || act.activity_type === 'OFFICER_QUESTION';
                      return (
                        <div
                          key={act.id}
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            isCitizen
                              ? 'bg-teal-500/10 border-teal-500/30 ml-6 text-teal-100'
                              : isOfficer
                                ? 'bg-blue-500/10 border-blue-500/30 mr-6 text-blue-100'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono opacity-80 mb-1">
                            <span className="font-semibold">
                              {isCitizen
                                ? 'You (Anonymous Complainant)'
                                : act.activity_type === 'OFFICER_QUESTION'
                                  ? 'Investigating Officer (Direct Question)'
                                  : `Department Officer (${act.activity_type.replace(/_/g, ' ')})`}
                            </span>
                            <span>{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="leading-relaxed">{act.public_message}</p>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Send Anonymous Message Form */}
            <form onSubmit={handleSendMessage} className="border-t border-slate-800 pt-3 mt-4 flex gap-2">
              <input
                type="text"
                value={anonymousMessage}
                onChange={(e) => setAnonymousMessage(e.target.value)}
                placeholder="Reply anonymously to assigned officer without revealing identity..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={sendingMsg || !anonymousMessage.trim()}
                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Appeal Submission Modal */}
      {isAppealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setIsAppealModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Scale className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Lodge Official Appeal</h3>
                <p className="text-xs text-slate-400">Request independent re-examination by Trust & Safety</p>
              </div>
            </div>

            <form onSubmit={handleLodgeAppeal} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Appeal Grounds & Supporting Justification
                </label>
                <textarea
                  value={appealGrounds}
                  onChange={(e) => setAppealGrounds(e.target.value)}
                  rows={4}
                  required
                  placeholder="Explain why the closure decision or sanction was erroneous, citing specific dates or factual corroboration..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appealLoading || !appealGrounds.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
                >
                  {appealLoading ? 'Submitting Appeal...' : 'Submit Appeal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
