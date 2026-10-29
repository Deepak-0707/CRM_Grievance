import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AbuseInvestigation, AbuseDecision, Appeal } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, ShieldCheck, CheckCircle2, XCircle, Clock,
  FileCheck, Scale, AlertCircle, RefreshCw, X, ChevronRight, UserCheck, Download, FileText,
  Flag, MessageSquare
} from 'lucide-react';

export const TrustSafetyDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [investigations, setInvestigations] = useState<AbuseInvestigation[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedInv, setSelectedInv] = useState<AbuseInvestigation | null>(null);

  // New Decision Modal Form
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [finding, setFinding] = useState('SUBSTANTIATED_ABUSE');
  const [rationale, setRationale] = useState('');
  const [evidenceExamined, setEvidenceExamined] = useState('');
  const [recommendedSanction, setRecommendedSanction] = useState('TEMPORARY_RESTRICTION');
  const [decisionLoading, setDecisionLoading] = useState(false);

  // 2nd Reviewer Approval Form
  const [selectedDecisionToApprove, setSelectedDecisionToApprove] = useState<AbuseDecision | null>(null);
  const [secondApprovalNotes, setSecondApprovalNotes] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Appeal Adjudication Modal
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [appealStatus, setAppealStatus] = useState('UPHELD');
  const [appealNotes, setAppealNotes] = useState('');
  const [appealLoading, setAppealLoading] = useState(false);

  // Flag Response Modal
  const [isFlagResponseModalOpen, setIsFlagResponseModalOpen] = useState(false);
  const [selectedResponseToFlag, setSelectedResponseToFlag] = useState<any | null>(null);
  const [flagReason, setFlagReason] = useState('DELIBERATELY_MISLEADING_CLAIM');
  const [flagDetails, setFlagDetails] = useState('');
  const [flagLoading, setFlagLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, appData] = await Promise.all([
        api.getInvestigations(),
        api.getAppeals(),
      ]);
      setInvestigations(invData);
      setAppeals(appData);
    } catch (err) {
      console.error('Failed to load Trust & Safety data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInvestigation = async (inv: AbuseInvestigation) => {
    try {
      const fullDetail = await api.getInvestigationDetail(inv.id);
      setSelectedInv(fullDetail);
    } catch {
      setSelectedInv(inv);
    }
  };

  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv || !rationale.trim() || !evidenceExamined.trim()) return;

    setDecisionLoading(true);
    try {
      await api.recordAbuseDecision(selectedInv.id, {
        finding,
        rationale: rationale.trim(),
        evidence_examined: evidenceExamined.trim(),
        recommended_sanction: recommendedSanction,
      });
      alert('Abuse decision recorded. If serious sanction, queued for 2nd reviewer approval.');
      setIsDecisionModalOpen(false);
      setRationale('');
      setEvidenceExamined('');
      await loadData();
      if (selectedInv) {
        const refreshed = await api.getInvestigationDetail(selectedInv.id);
        setSelectedInv(refreshed);
      }
    } catch (err: any) {
      alert('Failed to record decision: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleApproveSecondReviewer = async (approved: boolean) => {
    if (!selectedDecisionToApprove || !secondApprovalNotes.trim()) return;

    setApprovalLoading(true);
    try {
      await api.approveSecondReviewer(selectedDecisionToApprove.id, approved, secondApprovalNotes.trim());
      alert(`Second Reviewer ${approved ? 'APPROVED' : 'REJECTED'} sanction.`);
      setSelectedDecisionToApprove(null);
      setSecondApprovalNotes('');
      await loadData();
      if (selectedInv) {
        const refreshed = await api.getInvestigationDetail(selectedInv.id);
        setSelectedInv(refreshed);
      }
    } catch (err: any) {
      alert('Failed 2nd Reviewer action: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleAdjudicateAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal || !appealNotes.trim()) return;

    setAppealLoading(true);
    try {
      await api.adjudicateAppeal(selectedAppeal.id, appealStatus, appealNotes.trim());
      alert(`Appeal marked as ${appealStatus}.`);
      setSelectedAppeal(null);
      setAppealNotes('');
      await loadData();
    } catch (err: any) {
      alert('Failed to adjudicate appeal: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setAppealLoading(false);
    }
  };

  const handleFlagResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv || !flagDetails.trim()) return;

    setFlagLoading(true);
    try {
      const detailsPrefix = selectedResponseToFlag
        ? `[Flagged Response by ${selectedResponseToFlag.actor_role} - "${(selectedResponseToFlag.public_message || selectedResponseToFlag.internal_message || '').slice(0, 60)}..."]: `
        : `[Reviewer Portal Flag]: `;

      await api.flagComplaint(selectedInv.complaint_id, {
        flag_reason: flagReason,
        flag_details: detailsPrefix + flagDetails.trim(),
      });

      alert('Response flagged successfully. Allegation recorded and risk scoring updated.');
      setIsFlagResponseModalOpen(false);
      setSelectedResponseToFlag(null);
      setFlagDetails('');
      const refreshed = await api.getInvestigationDetail(selectedInv.id);
      setSelectedInv(refreshed);
      await loadData();
    } catch (err: any) {
      alert('Failed to flag response: ' + (err?.response?.data?.detail || err.message || err));
    } finally {
      setFlagLoading(false);
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 60) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (score >= 30) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Trust & Safety Triage Module</h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Abuse Defense
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Reviewing Officer: <span className="text-slate-200 font-semibold">{currentUser?.username}</span> • Dual-Reviewer Adjudication Protocol
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Queue
        </button>
      </div>

      {/* Investigations Table / Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold text-slate-200">
            Active Abuse Investigations ({investigations.length})
          </span>
          <span>A flag is an allegation, not proof. Rejection != Dishonesty.</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Loading triage cases...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {investigations.map((inv) => {
              let parsedSignals: any[] = [];
              try {
                parsedSignals = JSON.parse(inv.risk_signals_json || '[]');
              } catch (e) {
                parsedSignals = [];
              }

              return (
                <div
                  key={inv.id}
                  onClick={() => handleOpenInvestigation(inv)}
                  className="civic-card-interactive space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                        {inv.complaint_number}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getRiskScoreColor(inv.risk_score)}`}>
                          Risk Score: {inv.risk_score}/100
                        </span>
                        <span className="civic-badge bg-slate-800 text-slate-300 border border-slate-700">
                          {inv.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                      {inv.complaint_title}
                    </h4>

                    {/* Explanatory Signals Preview */}
                    <div className="space-y-1.5 pt-1">
                      {parsedSignals.map((sig, idx) => (
                        <div
                          key={idx}
                          className={`text-[11px] p-2 rounded-lg border ${sig.is_defense_signal
                              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                              : sig.points > 25
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                        >
                          <div className="flex items-center justify-between font-semibold font-mono text-[10px]">
                            <span>{sig.signal_name}</span>
                            <span>{sig.is_defense_signal ? 'DEFENSE ACTIVE (0 pts)' : `+${sig.points} pts`}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-tight">{sig.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between text-xs text-slate-500">
                    <span>{inv.flags.length} Community Flag(s)</span>
                    <span className="text-amber-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Inspect & Adjudicate →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Citizen Appeals Section */}
      <div className="space-y-4 pt-4">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Scale className="w-4 h-4 text-purple-400" />
          Pending Citizen Appeals ({appeals.length})
        </h3>

        {appeals.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
            No citizen appeals currently pending.
          </div>
        ) : (
          <div className="space-y-3">
            {appeals.map((app) => (
              <div
                key={app.id}
                className="civic-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-purple-400 font-bold">{app.target_type}</span>
                    <span className="civic-badge bg-slate-800 text-slate-300 border border-slate-700">
                      {app.status}
                    </span>
                    <span className="font-mono text-slate-500">{app.complainant_pseudonym_id}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{app.grounds_for_appeal}</p>
                  {app.review_notes && (
                    <div className="text-emerald-400 text-[11px] bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 mt-1">
                      Adjudication: {app.review_notes}
                    </div>
                  )}
                </div>

                {app.status === 'PENDING' && (
                  <button
                    onClick={() => setSelectedAppeal(app)}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shrink-0"
                  >
                    Adjudicate Appeal
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Investigation Detail Workspace Modal */}
      {selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative text-slate-100 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedInv(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-4 mb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-teal-400">
                  {selectedInv.complaint_number}
                </span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getRiskScoreColor(selectedInv.risk_score)}`}>
                  Risk Score: {selectedInv.risk_score}/100
                </span>
                <span className="civic-badge bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {selectedInv.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-white">{selectedInv.complaint_title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{selectedInv.complaint_description}</p>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 space-y-5 text-xs">
              {/* Evidence Examination & Forensic Checks */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span>Attached Evidence & Forensic Hashes ({selectedInv.evidence_items?.length || 0})</span>
                  </h4>
                  <span className="text-[10px] font-mono text-teal-400">SHA-256 Validated</span>
                </div>

                {(!selectedInv.evidence_items || selectedInv.evidence_items.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-1">No evidence documents attached to this grievance.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {selectedInv.evidence_items.map((ev) => (
                      <div key={ev.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-slate-200 truncate">{ev.filename}</span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                              {ev.integrity_status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 break-all">
                            SHA-256: {ev.sha256_hash.substring(0, 20)}...
                          </div>
                          {ev.evidence_description && (
                            <p className="text-slate-400 text-[11px] mt-1">{ev.evidence_description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => api.downloadEvidence(selectedInv.complaint_id, ev.id, ev.filename)}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold py-1.5 rounded text-[11px] flex items-center justify-center gap-1.5 transition-colors border border-slate-700/80"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download & Inspect</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Case Responses & Activity Channel */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                    <span>Case Responses & Activity Feed ({selectedInv.activities?.length || 0})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedResponseToFlag(null);
                      setIsFlagResponseModalOpen(true);
                    }}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <Flag className="w-3 h-3 text-rose-400" />
                    <span>+ Flag General Response</span>
                  </button>
                </div>

                {(!selectedInv.activities || selectedInv.activities.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-1">No responses or messages exchanged on this complaint.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {selectedInv.activities.map((act) => (
                      <div
                        key={act.id}
                        className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${act.actor_role === 'CITIZEN'
                            ? 'bg-teal-500/10 border-teal-500/30 text-teal-100'
                            : act.actor_role === 'OFFICER'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-100'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="font-semibold text-slate-300">
                            {act.actor_role === 'CITIZEN' ? 'Complainant Response' : `${act.actor_role} Update`} ({act.activity_type})
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{new Date(act.created_at).toLocaleDateString()}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedResponseToFlag(act);
                                setIsFlagResponseModalOpen(true);
                              }}
                              className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors font-medium"
                              title="Flag this response as abusive, fabricated, or misleading"
                            >
                              <Flag className="w-2.5 h-2.5" />
                              <span>Flag Response</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-200 text-xs leading-relaxed">{act.public_message || act.internal_message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evidence and Flags Checked */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider">
                  Community Flags Logged ({selectedInv.flags.length})
                </h4>
                {selectedInv.flags.map((f) => (
                  <div key={f.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-amber-400 font-mono font-semibold">
                      <span>Reason: {f.flag_reason}</span>
                      <span className="text-slate-500">{new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-300">{f.flag_details}</p>
                  </div>
                ))}
              </div>

              {/* Recorded Decisions & Dual-Reviewer Controls */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider">
                    Recorded Decisions & 2nd Reviewer Sanction Gates
                  </h4>
                  <button
                    onClick={() => setIsDecisionModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs"
                  >
                    + Record Reviewer Decision
                  </button>
                </div>

                {selectedInv.decisions?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No formal reviewer decisions recorded yet.</p>
                ) : (
                  selectedInv.decisions?.map((dec) => (
                    <div key={dec.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">{dec.finding}</span>
                        <span className="font-mono text-slate-400">
                          Recommended: <strong className="text-rose-400">{dec.recommended_sanction}</strong>
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs">{dec.rationale}</p>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Evidence examined: {dec.evidence_examined}
                      </div>

                      {/* 2nd Reviewer Dual-Control Status */}
                      {dec.recommended_sanction !== 'NONE' && dec.recommended_sanction !== 'WARNING' && (
                        <div className="mt-3 pt-2 border-t border-slate-800 text-xs">
                          {dec.second_reviewer_approval === true ? (
                            <div className="text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                              <span>✓ Approved by 2nd Reviewer ({dec.second_reviewer_name})</span>
                              <span className="font-mono text-[10px]">{dec.second_reviewer_notes}</span>
                            </div>
                          ) : dec.second_reviewer_approval === false ? (
                            <div className="text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/30">
                              ✗ Denied by 2nd Reviewer: {dec.second_reviewer_notes}
                            </div>
                          ) : (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg flex items-center justify-between gap-3">
                              <span className="text-amber-300 font-semibold">
                                Dual-Reviewer Approval Pending (2nd reviewer required for serious sanction)
                              </span>
                              <button
                                onClick={() => setSelectedDecisionToApprove(dec)}
                                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded text-xs shrink-0"
                              >
                                Review as 2nd Reviewer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Decision Modal */}
      {isDecisionModalOpen && selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setIsDecisionModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">Record Abuse Review Finding</h3>

            <form onSubmit={handleRecordDecision} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Adjudication Finding</label>
                <select
                  value={finding}
                  onChange={(e) => setFinding(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                >
                  <option value="SUBSTANTIATED_ABUSE">SUBSTANTIATED_ABUSE (Proven Bad Faith / Forgery)</option>
                  <option value="INSUFFICIENT_EVIDENCE">INSUFFICIENT_EVIDENCE (Lacks proof, but NOT deliberate fraud)</option>
                  <option value="DISMISSED">DISMISSED (Legitimate civic grievance)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Recommended Sanction</label>
                <select
                  value={recommendedSanction}
                  onChange={(e) => setRecommendedSanction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                >
                  <option value="NONE">NONE</option>
                  <option value="WARNING">WARNING (Official advisory)</option>
                  <option value="TEMPORARY_RESTRICTION">TEMPORARY_RESTRICTION (14-day filing pause, requires 2nd reviewer)</option>
                  <option value="SUSPENSION">SUSPENSION (30-day block, requires 2nd reviewer)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Detailed Findings & Statutory Rationale</label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={3}
                  required
                  placeholder="Articulate why the evidence substantiates fraud or why lack of evidence does not constitute fabrication..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Forensic Evidence Examined</label>
                <input
                  type="text"
                  value={evidenceExamined}
                  onChange={(e) => setEvidenceExamined(e.target.value)}
                  required
                  placeholder="E.g., SHA-256 digital invoice raster layer analysis..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDecisionModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decisionLoading}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-5 py-2 rounded-lg"
                >
                  {decisionLoading ? 'Saving...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2nd Reviewer Dual-Control Modal */}
      {selectedDecisionToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setSelectedDecisionToApprove(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2">Second Reviewer Sanction Approval</h3>
            <p className="text-xs text-slate-400 mb-4">
              Dual-Control Safeguard: Serious sanctions like <strong className="text-rose-400">{selectedDecisionToApprove.recommended_sanction}</strong> require independent verification by a distinct reviewer before activation.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 mb-4 space-y-1">
              <div><strong>Lead Reviewer:</strong> {selectedDecisionToApprove.reviewer_name}</div>
              <div><strong>Finding:</strong> {selectedDecisionToApprove.finding}</div>
              <div><strong>Rationale:</strong> {selectedDecisionToApprove.rationale}</div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Second Reviewer Independent Notes</label>
                <textarea
                  value={secondApprovalNotes}
                  onChange={(e) => setSecondApprovalNotes(e.target.value)}
                  rows={3}
                  required
                  placeholder="Concur with lead reviewer findings after independent inspection of digital checksums..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={approvalLoading || !secondApprovalNotes.trim()}
                  onClick={() => handleApproveSecondReviewer(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg"
                >
                  Deny Sanction
                </button>
                <button
                  type="button"
                  disabled={approvalLoading || !secondApprovalNotes.trim()}
                  onClick={() => handleApproveSecondReviewer(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2 rounded-lg"
                >
                  {approvalLoading ? 'Processing...' : 'Approve Sanction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjudicate Appeal Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setSelectedAppeal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2">Adjudicate Citizen Appeal</h3>
            <p className="text-xs text-slate-400 mb-4">
              Grounds: "{selectedAppeal.grounds_for_appeal}"
            </p>

            <form onSubmit={handleAdjudicateAppeal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Appeal Adjudication Outcome</label>
                <select
                  value={appealStatus}
                  onChange={(e) => setAppealStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                >
                  <option value="UPHELD">UPHELD (Citizen Appeal Validated - Revoke Sanction)</option>
                  <option value="REJECTED">REJECTED (Original Decision Upheld)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Adjudication Findings & Notes</label>
                <textarea
                  value={appealNotes}
                  onChange={(e) => setAppealNotes(e.target.value)}
                  rows={3}
                  required
                  placeholder="Record verification of emergency telemetry, telephone logs, or factual re-investigation..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAppeal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appealLoading || !appealNotes.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2 rounded-lg"
                >
                  {appealLoading ? 'Saving...' : 'Finalize Adjudication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Flag Response Modal */}
      {isFlagResponseModalOpen && selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => {
                setIsFlagResponseModalOpen(false);
                setSelectedResponseToFlag(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Flag Case Response</h3>
                <span className="text-[10px] font-mono text-slate-400">Trust & Safety Response Flagging</span>
              </div>
            </div>

            {selectedResponseToFlag && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 mb-4 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-mono">Selected Response to Flag:</div>
                <div className="font-semibold text-teal-300">Author: {selectedResponseToFlag.actor_role}</div>
                <p className="italic text-slate-400 text-[11px] line-clamp-2">
                  "{selectedResponseToFlag.public_message || selectedResponseToFlag.internal_message}"
                </p>
              </div>
            )}

            <form onSubmit={handleFlagResponse} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Flag Reason</label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                >
                  <option value="DELIBERATELY_MISLEADING_CLAIM">DELIBERATELY_MISLEADING_CLAIM (Misleading response facts)</option>
                  <option value="SUSPECTED_FABRICATED_EVIDENCE">SUSPECTED_FABRICATED_EVIDENCE (Fabricated claims or metadata)</option>
                  <option value="HARASSMENT_OR_ABUSE">HARASSMENT_OR_ABUSE (Abusive tone or threats)</option>
                  <option value="SPAM_OR_IRRELEVANT">SPAM_OR_IRRELEVANT (Unrelated spam content)</option>
                  <option value="COORDINATED_ABUSE">COORDINATED_ABUSE (Coordinated brigade pattern)</option>
                  <option value="OTHER">OTHER (Other violation)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Flag Findings & Details</label>
                <textarea
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value)}
                  rows={3}
                  required
                  placeholder="Explain why this response is being flagged (e.g., contradicts known dispatch records or includes deceptive assertions)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFlagResponseModalOpen(false);
                    setSelectedResponseToFlag(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={flagLoading || !flagDetails.trim()}
                  className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{flagLoading ? 'Submitting Flag...' : 'Confirm Response Flag'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
