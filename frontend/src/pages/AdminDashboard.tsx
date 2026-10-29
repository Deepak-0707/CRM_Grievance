import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  DashboardAnalytics, AuditEvent, DepartmentWorkload,
  ClassifierMetrics, DepartmentClassificationResult
} from '../types';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  BarChart3, ShieldCheck, Clock, CheckCircle2, AlertTriangle, KeyRound,
  FileText, Building2, RefreshCw, Lock, Sparkles, Check, XCircle,
  Sliders, Settings, X, Edit3, Cpu, Database, Tag
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [departmentWorkloads, setDepartmentWorkloads] = useState<DepartmentWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  // SLA Configuration Modal
  const [editingDept, setEditingDept] = useState<DepartmentWorkload | null>(null);
  const [slaHoursInput, setSlaHoursInput] = useState<number>(48);
  const [slaDescInput, setSlaDescInput] = useState<string>('');
  const [isUpdatingSla, setIsUpdatingSla] = useState(false);

  // Chain Verification State
  const [chainStatus, setChainStatus] = useState<any | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // ML Department Classifier & Synthetic Dataset State
  const [classifierMetrics, setClassifierMetrics] = useState<ClassifierMetrics | null>(null);
  const [isRetraining, setIsRetraining] = useState(false);
  const [testTitle, setTestTitle] = useState('Dangerous transformer buzzing and sparks falling on footpath');
  const [testDesc, setTestDesc] = useState('High tension distribution line is arcing and dangling low near residential school gate.');
  const [testDeptCode, setTestDeptCode] = useState('MC');
  const [testResult, setTestResult] = useState<DepartmentClassificationResult | null>(null);
  const [testingModel, setTestingModel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [anData, auData, wlData, mlMetrics] = await Promise.all([
        api.getDashboardAnalytics(),
        api.getAuditEvents({ limit: 50 }),
        api.getDepartmentWorkloads(),
        api.getClassifierMetrics().catch(() => null),
      ]);
      setAnalytics(anData);
      setAuditEvents(auData);
      setDepartmentWorkloads(wlData);
      setClassifierMetrics(mlMetrics);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    try {
      const res = await api.verifyAuditChain();
      setChainStatus(res);
    } catch (err) {
      alert('Verification failed: ' + err);
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleOpenSlaModal = (dept: DepartmentWorkload) => {
    setEditingDept(dept);
    setSlaHoursInput(dept.default_sla_hours);
    setSlaDescInput(dept.description || '');
  };

  const handleSaveSla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setIsUpdatingSla(true);
    try {
      await api.updateDepartmentSla(editingDept.id, slaHoursInput, slaDescInput);
      alert(`Department ${editingDept.code} SLA updated to ${slaHoursInput} hours.`);
      setEditingDept(null);
      await loadData();
    } catch (err: any) {
      alert('Failed to update SLA: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsUpdatingSla(false);
    }
  };

  const handleRetrain = async (generateFresh: boolean = false) => {
    setIsRetraining(true);
    try {
      const res = await api.retrainClassifier(generateFresh);
      setClassifierMetrics(res.metrics);
      alert(`Model successfully retrained! Overall test accuracy: ${res.metrics.test_accuracy_pct} on 200 hold-out test samples.`);
    } catch (err: any) {
      alert('Retraining failed: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsRetraining(false);
    }
  };

  const handleTestInference = async () => {
    if (!testTitle.trim() && !testDesc.trim()) return;
    setTestingModel(true);
    try {
      const res = await api.classifyDepartment({
        title: testTitle,
        description: testDesc,
        selected_department_code: testDeptCode || undefined,
      });
      setTestResult(res);
    } catch (err: any) {
      alert('Classification test failed: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setTestingModel(false);
    }
  };

  const COLORS = ['#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];

  return (
    <div className="space-y-8 py-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Executive Oversight & CRM Analytics</h2>
                <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Admin Console
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-department SLA governance, capacity allocation, AI routing models, and tamper-evident audit logs.
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Overview</span>
          </button>
        </div>

        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Active Cases
              </span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {analytics.investigating_count + analytics.submitted_count}
              </div>
              <span className="text-[10px] text-teal-400 mt-1 block">
                {analytics.resolved_count} resolved to date
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Resolution Rate
              </span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                {analytics.resolution_rate_percent}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {analytics.overdue_count} overdue cases active
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Avg Resolution Time
              </span>
              <div className="text-2xl font-bold text-indigo-400 mt-1 font-mono">
                {analytics.avg_resolution_hours}h
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Across all 7 departments</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                New Cases In Queue
              </span>
              <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">
                {analytics.submitted_count}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Awaiting department action</span>
            </div>
          </div>
        )}
      </div>

      {loading && !analytics ? (
        <div className="text-center py-16 text-xs text-slate-500">Loading system governance metrics...</div>
      ) : (
        <>
          {/* Department SLA & Capacity Allocation Matrix */}
          <div className="civic-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-400" />
                  Department SLA Configuration & Capacity Allocation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tune SLA resolution targets and monitor caseload density across civic divisions.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                    <th className="p-3">Department</th>
                    <th className="p-3">Code</th>
                    <th className="p-3 text-center">Active Officers</th>
                    <th className="p-3 text-center">Active Cases</th>
                    <th className="p-3 text-center">Overdue</th>
                    <th className="p-3 text-center">Default SLA</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {departmentWorkloads.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-3 font-sans font-medium text-slate-200">
                        {dept.name}
                        {dept.description && (
                          <span className="block text-[10px] text-slate-500 font-normal truncate max-w-xs">
                            {dept.description}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-teal-400 font-bold">{dept.code}</td>
                      <td className="p-3 text-center text-slate-300">{dept.officer_count}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          dept.active_cases > 10 ? 'bg-amber-500/10 text-amber-300' : 'text-slate-300'
                        }`}>
                          {dept.active_cases}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          dept.overdue_cases > 0 ? 'bg-rose-500/10 text-rose-400' : 'text-slate-500'
                        }`}>
                          {dept.overdue_cases}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-300">
                        <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {dept.default_sla_hours} hrs ({Math.round(dept.default_sla_hours / 24)}d)
                        </span>
                      </td>
                      <td className="p-3 text-right font-sans">
                        <button
                          onClick={() => handleOpenSlaModal(dept)}
                          className="bg-slate-800 hover:bg-slate-700 text-teal-300 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto border border-slate-700"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Configure</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analytics Charts */}
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="civic-card space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-400" />
                  Grievance Category Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.complaints_by_category}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="category" stroke="#64748b" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="civic-card space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  7-Day Intake & Resolution Velocity
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.complaint_timeline_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line type="monotone" dataKey="submitted" name="New Lodged" stroke="#0D9488" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="flagged" name="Flagged Triage" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* AI Department Classification & Synthetic Dataset Model (1,000 Records) */}
          <div className="civic-card space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    AI Department Classifier & Synthetic Dataset
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-mono lowercase">
                      1,000 synthetic records
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calibrated TF-IDF + Logistic Regression pipeline trained on 800 synthetic complaints and verified on 200 hold-out records.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRetrain(false)}
                  disabled={isRetraining}
                  className="bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
                  title="Retrain model on existing 1,000 synthetic records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
                  <span>{isRetraining ? 'Retraining...' : 'Retrain Pipeline'}</span>
                </button>
                <button
                  onClick={() => handleRetrain(true)}
                  disabled={isRetraining}
                  className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/20 disabled:opacity-50"
                  title="Generate fresh 1,000 synthetic complaints across 7 departments and retrain"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Regenerate 1,000 Records & Retrain</span>
                </button>
              </div>
            </div>

            {/* Model Evaluation Metrics Grid */}
            {classifierMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Hold-Out Test Accuracy
                  </span>
                  <div className="text-2xl font-bold text-teal-400 mt-1 font-mono">
                    {classifierMetrics.test_accuracy_pct}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Tested on {classifierMetrics.test_samples_count} hold-out records
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Macro F1-Score
                  </span>
                  <div className="text-2xl font-bold text-indigo-400 mt-1 font-mono">
                    {classifierMetrics.macro_avg_f1.toFixed(3)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Weighted F1: {classifierMetrics.weighted_avg_f1.toFixed(3)}
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Dataset Distribution
                  </span>
                  <div className="text-2xl font-bold text-white mt-1 font-mono">
                    {classifierMetrics.dataset_total_records}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    800 Train / 200 Test Split (80/20)
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Civic Departments
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                    {classifierMetrics.departments_evaluated.length}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    PWD, WATER, ELEC, MC, TRANS, HEALTH, EDU
                  </span>
                </div>
              </div>
            )}

            {/* Per-Department Performance & Extracted Semantic Features */}
            {classifierMetrics?.per_department_metrics && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Per-Department Hold-Out Validation & Top Semantic Features
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="p-3">Dept Code</th>
                        <th className="p-3">Department Name</th>
                        <th className="p-3 text-center">Precision</th>
                        <th className="p-3 text-center">Recall</th>
                        <th className="p-3 text-center">F1-Score</th>
                        <th className="p-3 text-center">Test Samples</th>
                        <th className="p-3">Top Extracted Features</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {Object.entries(classifierMetrics.per_department_metrics).map(([code, m]) => {
                        const topFeats = classifierMetrics.top_keywords_per_department?.[code]?.top_features || [];
                        return (
                          <tr key={code} className="hover:bg-slate-900/50">
                            <td className="p-3 font-bold text-teal-400">{code}</td>
                            <td className="p-3 font-sans text-slate-200">{m.department_name}</td>
                            <td className="p-3 text-center text-slate-300">{m.precision.toFixed(2)}</td>
                            <td className="p-3 text-center text-slate-300">{m.recall.toFixed(2)}</td>
                            <td className="p-3 text-center text-emerald-400 font-bold">{m.f1_score.toFixed(2)}</td>
                            <td className="p-3 text-center text-slate-400">{m.test_samples}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1 font-sans">
                                {topFeats.slice(0, 4).map((f: string, i: number) => (
                                  <span key={i} className="bg-slate-900 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Interactive Classification & Verification Test Sandbox */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  Live Grievance Classifier & Routing Verification Sandbox
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Quick Samples:</span>
                  {[
                    { label: 'Water Leak', title: 'Underground drinking water main burst', desc: 'Potable water flooding road while taps run dry', dept: 'WATER' },
                    { label: 'Power Sparks', title: 'Live transformer sparking violently', desc: 'Overhead wires hanging low and voltage fluctuation', dept: 'MC' },
                    { label: 'Bus Transit', title: 'City bus skipping bus stop', desc: 'Conductor overcharging and driver speeding on route 534', dept: 'TRANS' },
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTestTitle(s.title);
                        setTestDesc(s.desc);
                        setTestDeptCode(s.dept);
                      }}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-teal-300 border border-slate-700 px-2 py-0.5 rounded transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Grievance Title
                  </label>
                  <input
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Grievance Description
                  </label>
                  <input
                    type="text"
                    value={testDesc}
                    onChange={(e) => setTestDesc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Target Department Selection
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={testDeptCode}
                      onChange={(e) => setTestDeptCode(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    >
                      {['PWD', 'WATER', 'ELEC', 'MC', 'TRANS', 'HEALTH', 'EDU'].map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleTestInference}
                      disabled={testingModel}
                      className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all disabled:opacity-50"
                    >
                      {testingModel ? '...' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className="mt-3 p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {testResult.is_good_department ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      )}
                      <div>
                        <span className={`text-xs font-bold ${testResult.is_good_department ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {testResult.is_good_department ? 'Verified Good Department Match' : 'Department Mismatch Warning'}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          (Predicted: <strong className="text-white">{testResult.predicted_department_name}</strong> - {testResult.confidence_pct})
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Score: <strong className="text-teal-400">{testResult.verification_score}%</strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {testResult.verification_message}
                  </p>

                  {testResult.detected_keywords && testResult.detected_keywords.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-slate-500 text-[11px]">Keywords:</span>
                      {testResult.detected_keywords.map((kw, i) => (
                        <span key={i} className="bg-slate-950 border border-slate-700 text-teal-300 px-2 py-0.5 rounded text-[10px] font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tamper-Evident Audit Trail Inspector */}
          <div className="civic-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  Append-Only Audit Event Trail (Cryptographic Hash Chaining)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sequential SHA-256 hash chains ensure that transitions cannot be silently modified or purged.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {chainStatus && (
                  <div
                    className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-mono ${
                      chainStatus.is_valid
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {chainStatus.is_valid ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>Chain {chainStatus.status} ({chainStatus.verified_count} events verified)</span>
                  </div>
                )}

                <button
                  onClick={handleVerifyChain}
                  disabled={verifyingChain}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{verifyingChain ? 'Verifying Hashes...' : 'Verify Cryptographic Chain'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 z-10 font-semibold">
                  <tr>
                    <th className="p-3">Seq #</th>
                    <th className="p-3">Timestamp (UTC)</th>
                    <th className="p-3">Target Entity</th>
                    <th className="p-3">Actor Role</th>
                    <th className="p-3">Action Recorded</th>
                    <th className="p-3">Integrity Block Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {auditEvents.map((ev, idx) => (
                    <tr key={ev.id} className="hover:bg-slate-900/50">
                      <td className="p-3 text-teal-400 font-bold">#{idx + 1}</td>
                      <td className="p-3 text-slate-400">{new Date(ev.created_at).toLocaleTimeString()}</td>
                      <td className="p-3 text-slate-300">{ev.event_type} {ev.resource_id ? `(${ev.resource_id.substring(0, 6)}...)` : ''}</td>
                      <td className="p-3 text-slate-400 font-sans">
                        {ev.actor_role || 'SYSTEM'}
                      </td>
                      <td className="p-3 text-slate-200">{ev.action}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500" title={ev.tamper_hash}>
                        {ev.tamper_hash.substring(0, 16)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SLA Configuration Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setEditingDept(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Configure Department SLA</h3>
                <p className="text-xs text-slate-400">{editingDept.name} ({editingDept.code})</p>
              </div>
            </div>

            <form onSubmit={handleSaveSla} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Default Resolution SLA (Hours)
                </label>
                <input
                  type="number"
                  min="6"
                  max="720"
                  value={slaHoursInput}
                  onChange={(e) => setSlaHoursInput(parseInt(e.target.value) || 24)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-teal-500 text-sm font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Approximately {Math.round(slaHoursInput / 24)} calendar days to resolve grievances.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Department Scope & Responsibilities
                </label>
                <textarea
                  rows={3}
                  value={slaDescInput}
                  onChange={(e) => setSlaDescInput(e.target.value)}
                  placeholder="Describe civic jurisdiction, infrastructure scope, and escalation protocol..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-teal-500 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSla}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-md shadow-teal-500/20 disabled:opacity-50"
                >
                  {isUpdatingSla ? 'Saving Policy...' : 'Save SLA Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
