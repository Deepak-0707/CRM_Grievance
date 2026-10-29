import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2, X, Sparkles, Key, Shield } from 'lucide-react';

export const SimulatedVerificationModal: React.FC = () => {
  const { isVerificationModalOpen, setIsVerificationModalOpen, currentUser, refreshUser } = useAuth();
  
  const [fullName, setFullName] = useState(currentUser?.username ? `${currentUser.username.replace(/_/g, ' ')}` : 'Citizen Resident');
  const [district, setDistrict] = useState('Central Civic District');
  const [phone, setPhone] = useState('+91 98XXX-XX102');
  const [acknowledgment, setAcknowledgment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pseudonym: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isVerificationModalOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgment) {
      setError('Please acknowledge the privacy isolation policy to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.verifyEligibility({
        synthetic_full_name: fullName.trim(),
        synthetic_demographic_district: district.trim(),
        synthetic_phone_masked: phone.trim(),
        acknowledgment: true,
      });

      setResult({
        pseudonym: res.citizen_pseudonym_id,
        message: 'Your citizen identity has been verified and your pseudonymous token is active.',
      });
      await refreshUser();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Verification request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVerificationModalOpen(false);
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-slate-100">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Verify Citizen Eligibility
              </h3>
              <span className="text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded border border-teal-500/40 font-semibold">
                Privacy Vault
              </span>
            </div>
            <p className="text-xs text-slate-400">Zero-Knowledge identity separation for safe grievance filing</p>
          </div>
        </div>

        {/* Privacy Isolation Guarantee Banner */}
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3.5 mb-5 text-xs text-teal-200/90 flex gap-2.5">
          <Shield className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-teal-300 block mb-0.5">Privacy Boundary Guarantee:</span>
            Your real demographic details are stored strictly in an isolated privacy vault. Frontline municipal officers and public registries will only ever see your pseudonymous token.
          </div>
        </div>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-base font-bold text-white mb-1">Citizen Eligibility Verified!</h4>
              <p className="text-xs text-slate-300 mb-3">{result.message}</p>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 inline-block text-left w-full">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <Key className="w-3.5 h-3.5 text-teal-400" />
                  Your Pseudonymous Grievance Identifier:
                </div>
                <div className="text-base font-mono font-bold text-teal-400 tracking-wider">
                  {result.pseudonym}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  All grievances filed by you will reference this pseudonym only. Ordinary officers and public readers cannot view your personal identity.
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-md shadow-teal-500/20"
            >
              Done & Return to Workspace
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4 text-sm">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Legal Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  District / Municipal Ward
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. North District"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contact Number (Masked)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98XXX-XX102"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgment}
                  onChange={(e) => setAcknowledgment(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-teal-600 focus:ring-teal-500 bg-slate-950"
                />
                <span className="text-xs text-slate-400">
                  I confirm my resident eligibility. I understand that my demographic details are stored in an isolated privacy vault and are never attached to public grievances.
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-teal-500/20 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Eligibility'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
