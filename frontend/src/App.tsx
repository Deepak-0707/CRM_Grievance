import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { SimulatedVerificationModal } from './components/SimulatedVerificationModal';
import { LandingPage } from './pages/LandingPage';
import { PublicPortal } from './pages/PublicPortal';
import { CitizenDashboard } from './pages/CitizenDashboard';
import { ComplaintWizard } from './pages/ComplaintWizard';
import { OfficerDashboard } from './pages/OfficerDashboard';
import { TrustSafetyDashboard } from './pages/TrustSafetyDashboard';
import { DisclosurePanel } from './pages/DisclosurePanel';
import { AdminDashboard } from './pages/AdminDashboard';
import { Complaint } from './types';
import { ShieldCheck } from 'lucide-react';

const MainApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const { activeRole } = useAuth();

  const handleComplaintSubmitted = (complaint: Complaint) => {
    setCurrentTab('citizen');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {currentTab === 'home' && (
          <LandingPage
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'public' && <PublicPortal />}

        {currentTab === 'citizen' && (
          <CitizenDashboard onNavigateToSubmit={() => setCurrentTab('submit')} />
        )}

        {currentTab === 'submit' && (
          <ComplaintWizard onSuccess={handleComplaintSubmitted} />
        )}

        {currentTab === 'crm' && <OfficerDashboard />}

        {currentTab === 'trust-safety' && <TrustSafetyDashboard />}

        {currentTab === 'disclosure' && (
          activeRole === 'PRIVACY_OFFICER' ? (
            <DisclosurePanel />
          ) : (
            <div className="text-center py-24 text-rose-400 font-semibold space-y-2">
              <div className="text-lg">Access Denied: 403 Forbidden</div>
              <p className="text-xs text-slate-400">Identity disclosure controls are strictly restricted to Privacy Officers under data protection policy.</p>
            </div>
          )
        )}

        {currentTab === 'admin' && <AdminDashboard />}
      </main>

      {/* Global Modals */}
      <AuthModal />
      <SimulatedVerificationModal />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 px-4 text-xs text-slate-500 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span className="font-semibold text-slate-400">CivicTrust (CiRM)</span>
            <span>• Privacy-Preserving Citizen Grievance CRM</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setCurrentTab('public')}
              className="hover:text-slate-300"
            >
              Public Transparency
            </button>
            <span>•</span>
            <span className="text-slate-600 font-mono">Zero-Knowledge Identity Vault</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
