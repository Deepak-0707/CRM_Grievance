import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { IdentityDisclosureRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  KeyRound, ShieldCheck, Lock, CheckCircle2, XCircle, AlertCircle,
  FileText, Scale, Eye, RefreshCw, X, ShieldAlert
} from 'lucide-react';

export const DisclosurePanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<IdentityDisclosureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Review (Admin Adjudication) Modal
  const [selectedReqForReview, setSelectedReqForReview] = useState<IdentityDisclosureRequest | null>(null);
  const [adminRationale, setAdminRationale] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Revealed Identity Modal
  const [revealedData, setRevealedData] = useState<any | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getDisclosureRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load disclosure requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjudicate = async (approved: boolean) => {
    if (!selectedReqForReview || !adminRationale.trim()) return;

    setActionLoading(true);
    try {
      await api.reviewDisclosureRequest(selectedReqForReview.id, approved, adminRationale.trim());
      alert(`Disclosure request ${approved ? 'APPROVED' : 'REJECTED'}. Audit event recorded.`);
      setSelectedReqForReview(null);
      setAdminRationale('');
      await loadRequests();
    } catch (err: any) {
      alert('Failed to adjudicate: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccessIdentity = async (requestId: string) => {
    try {
      const res = await api.accessDisclosedIdentity(requestId);
      setRevealedData(res.identity_record);
      await loadRequests();
    } catch (err: any) {
      alert('Access Denied: ' + (err?.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-8 py-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Controlled Identity Disclosure Vault</h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Dual-Control Gateway
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Statutory Lawful Basis Verification • Administrator Privacy Oversight • Append-Only Audit Trail
              </p>
            </div>
          </div>

          <button
            onClick={loadRequests}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Petitions
          </button>
        </div>

        {/* Legal Gateway Policy Explainer */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
          <span className="font-semibold text-slate-200 block">Strict Conditional Disclosure Policy:</span>
          <p>
            Ordinary complaint handlers, frontline officers, and public viewers are structurally barred from accessing citizen identities. De-anonymization is restricted to rare instances of substantiated malicious criminal abuse (e.g. synthetic deepfake extortion). Access requires an independent administrator's recorded approval, and every decryption is cryptographically committed to the tamper-evident audit log.
          </p>
        </div>
      </div>

      {/* Petitions Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold text-slate-200">
            Identity Disclosure Petitions ({requests.length})
          </span>
          <span className="font-mono text-purple-400">Admin Dual-Authorization Required</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Loading disclosure vault...
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No identity disclosure petitions pending</p>
            <p className="text-xs text-slate-500 mt-1">All complaint identities remain securely quarantined.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="civic-card space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded">
                        Case: {req.complaint_number || 'N/A'}
                      </span>
                      <span className="text-xs text-slate-400">
                        Petition by: <strong className="text-slate-200">{req.requested_by_name}</strong>
                      </span>
                    </div>
                    {/* Citizen Past Flags Indicator for Privacy Officers */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="font-mono text-[11px] text-slate-400">Complainant: {req.citizen_pseudonym_id || 'Sealed'}</span>
                      <span className="text-slate-600">•</span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${(req.past_flags_count || 0) >= 3
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-semibold'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                        Past Flags Logged: {req.past_flags_count || 0} {(req.past_flags_count || 0) >= 3 ? '(Substantial History ≥ 3)' : '(Low History < 3)'}
                      </span>
                      {(req.past_flags_count || 0) >= 3 ? (
                        <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          ✓ Threshold Met (Identity Decryption Eligible)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                          ✗ Identity Sealed (Requires ≥ 3 Past Flags)
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    {req.status === 'APPROVED' && (
                      <span className="civic-badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ✓ Approved by Admin
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="civic-badge bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        ✗ Rejected by Admin
                      </span>
                    )}
                    {req.status === 'PENDING_APPROVAL' && (
                      <span className="civic-badge bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Pending Admin Review
                      </span>
                    )}
                    {req.status === 'ACCESSED' && (
                      <span className="civic-badge bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        Disclosed & Audited
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                    Documented Lawful & Statutory Basis:
                  </span>
                  <p className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed">
                    {req.legal_and_policy_basis}
                  </p>
                </div>

                {req.admin_rationale && (
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] block">
                      Administrator Adjudication Rationale ({req.reviewed_by_admin_name || 'Admin'}):
                    </span>
                    <p
                      className={`p-3 rounded-lg border text-[11px] font-mono leading-relaxed ${req.status === 'APPROVED'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        }`}
                    >
                      {req.admin_rationale}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-500">
                    Logged: {new Date(req.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Privacy Officer Adjudication Button */}
                    {currentUser?.role === 'PRIVACY_OFFICER' && req.status === 'PENDING_APPROVAL' && (
                      <button
                        onClick={() => setSelectedReqForReview(req)}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Adjudicate Petition</span>
                      </button>
                    )}

                    {/* Access Approved Identity Button */}
                    {(req.status === 'APPROVED' || req.status === 'ACCESSED') && (
                      <button
                        onClick={() => {
                          if ((req.past_flags_count || 0) < 3) {
                            alert(`Access Denied: Complainant has only ${req.past_flags_count || 0} flag(s) in past. Privacy Officers are only permitted to view citizen identity if the citizen has a significant history of flags (minimum 3 flags required).`);
                            return;
                          }
                          handleAccessIdentity(req.id);
                        }}
                        className={`font-bold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${(req.past_flags_count || 0) >= 3
                            ? 'bg-teal-600 hover:bg-teal-500 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed hover:bg-slate-800'
                          }`}
                        title={(req.past_flags_count || 0) < 3 ? 'Requires at least 3 past flags to decrypt' : 'View verified identity mapping'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Disclosed Identity Record {(req.past_flags_count || 0) < 3 ? '(Locked: < 3 Flags)' : ''}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Adjudication Modal */}
      {selectedReqForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setSelectedReqForReview(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2">Adjudicate Identity Disclosure Request</h3>
            <p className="text-xs text-slate-400 mb-4">
              Dual-Control Security Rule: Request must cite clear statutory basis for investigating deliberate criminal abuse. Ordinary administrative grievances must be rejected.
            </p>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs mb-4">
              <span className="font-bold text-slate-400 block uppercase text-[10px] mb-1">Claimed Lawful Basis:</span>
              <p className="text-slate-300 font-mono text-[11px]">{selectedReqForReview.legal_and_policy_basis}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Administrator Legal & Policy Rationale
                </label>
                <textarea
                  value={adminRationale}
                  onChange={(e) => setAdminRationale(e.target.value)}
                  rows={3}
                  required
                  placeholder="Record formal statutory reasoning for approval or rejection..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading || !adminRationale.trim()}
                  onClick={() => handleAdjudicate(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg"
                >
                  Reject Petition
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !adminRationale.trim()}
                  onClick={() => handleAdjudicate(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2 rounded-lg"
                >
                  Approve Disclosure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revealed Synthetic Identity Modal */}
      {revealedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setRevealedData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Controlled Identity Revealed</h3>
                <span className="text-[10px] font-mono text-teal-400">Access Event Logged in Audit Trail</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Verified Full Name</span>
                <span className="text-sm font-bold text-white">{revealedData.synthetic_full_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Jurisdiction District</span>
                <span className="text-slate-300">{revealedData.synthetic_demographic_district}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Registered Contact (Masked)</span>
                <span className="text-slate-300">{revealedData.synthetic_phone_masked}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Credential Verification Status</span>
                <span className="text-teal-400">Verified Citizen Token</span>
              </div>
              {revealedData.past_flags_count !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Prior Abuse Flag Count</span>
                  <span className="text-amber-400 font-bold">{revealedData.past_flags_count} flags logged (Satisfies ≥ 3 High-Flag De-anonymization Policy)</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 italic">
                Authorized identity disclosure access recorded in immutable cryptographic audit chain.
              </div>
            </div>

            <button
              onClick={() => setRevealedData(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl text-xs mt-4 transition-colors"
            >
              Close & Lock Vault View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
