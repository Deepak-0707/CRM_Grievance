import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, Eye, Lock, Building2, AlertTriangle, KeyRound,
  FileText, CheckCircle2, ArrowRight, Sparkles, Scale,
  UserCheck, Shield, Users
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { currentUser, openAuthModal } = useAuth();

  const handleLodgeGrievance = () => {
    if (currentUser?.role === 'CITIZEN') {
      onNavigate('submit');
    } else if (currentUser) {
      // Logged in as other role, navigate to submit
      onNavigate('submit');
    } else {
      openAuthModal('login');
    }
  };

  const handleOpenCitizen = () => {
    if (currentUser) {
      onNavigate('citizen');
    } else {
      openAuthModal('login');
    }
  };

  return (
    <div className="space-y-16 py-6 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800 p-8 sm:p-14 text-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/10 via-transparent to-blue-500/10 pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-6">
          <Shield className="w-3.5 h-3.5" />
          <span>Enterprise Citizen Relationship Management (CiRM)</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight mb-6">
          Privacy-Preserving Citizen Grievance CRM
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
          Empowering citizens to submit grievances about public infrastructure and civic services with zero-exposure privacy, SLA-driven government case management, and tamper-evident audit logging.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={handleLodgeGrievance}
            className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-teal-500/25 flex items-center gap-2 text-sm transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Lodge Grievance</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('public')}
            className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-6 py-3.5 rounded-xl text-sm transition-all flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-teal-400" />
            <span>Public Transparency Registry</span>
          </button>
        </div>

        {/* Security & Privacy Notice */}
        <div className="mt-10 p-4 max-w-3xl mx-auto rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 text-left flex items-start gap-3">
          <Lock className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">Zero-Knowledge Identity Vault:</span>{' '}
            Citizen identity records are stored in a physically isolated schema table. Complainant identities are never published on public pages or exposed to frontline case officers, preventing retaliation while preserving institutional accountability.
          </div>
        </div>
      </section>

      {/* 4 Pillars of CivicTrust */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Engineered for Integrity and Trust
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Balancing citizen whistleblower privacy with institutional accountability and abuse resilience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div className="civic-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Pseudonymous Data Vault</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Identity records are stored in a physically separate schema table. Public feeds and officers only see pseudonyms like <code className="text-teal-400 font-mono">CITIZEN-8A4F102B</code>.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="civic-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">CRM Case Management</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full civic CRM with department assignments, Kanban workflow, SLA countdown timers, internal officer notes, and 2-way anonymous clarification channels.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="civic-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Trust & Safety Defense</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic risk engine that evaluates evidence tampering and defends against coordinated flagging campaigns without silencing grievances.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="civic-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Dual-Control Disclosure</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              De-anonymization is strictly gated: requires documented substantiated abuse, reviewer petition, independent administrator approval, and append-only audit logging.
            </p>
          </div>
        </div>
      </section>

      {/* Citizen Eligibility Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            Citizen Eligibility Portal
          </div>
          <h3 className="text-xl font-bold text-white">Privacy-Preserving Verification</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Verify citizen eligibility to obtain an isolated pseudonymous identifier. Your personal demographics are held in an isolated vault and never passed into public complaints or case tracking pipelines.
          </p>
        </div>

        <button
          onClick={handleOpenCitizen}
          className="bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 px-5 py-3 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2"
        >
          <span>Open Citizen Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
};
