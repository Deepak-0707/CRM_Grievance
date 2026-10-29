import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Building2, MapPin, Upload, CheckCircle2, AlertCircle,
  ArrowRight, ArrowLeft, Shield, Lock, Sparkles, Check,
  AlertTriangle, Cpu, Tag, ChevronDown, ChevronUp, Bot, RefreshCw
} from 'lucide-react';
import { Department, Complaint, DepartmentClassificationResult } from '../types';

interface ComplaintWizardProps {
  onSuccess: (complaint: Complaint) => void;
}

interface SampleGrievance {
  icon: string;
  tag: string;
  deptCode: string;
  title: string;
  description: string;
}

const SAMPLE_GRIEVANCES: SampleGrievance[] = [
  {
    icon: '💧',
    tag: 'Water Board',
    deptCode: 'WATER',
    title: 'Severe pipeline burst gushing drinking water across roadway',
    description: 'Underground clean drinking water pipe cracked near the market junction, flooding the entire street and cutting off water pressure for 400 households.',
  },
  {
    icon: '⚡',
    tag: 'Electricity',
    deptCode: 'ELEC',
    title: 'High-voltage electric wire snapped and hanging low over sidewalk',
    description: 'Electric transformer sparking violently after rain, live 440V distribution line hanging low near school gate posing immediate risk of electrocution.',
  },
  {
    icon: '🕳️',
    tag: 'Public Works',
    deptCode: 'PWD',
    title: 'Deep crater potholes and damaged concrete culvert bridge',
    description: 'Heavy asphalt disintegration and large 3-foot deep pothole trench causing repeated vehicle axle damage and pedestrian fall injuries on Sector 14 link road.',
  },
  {
    icon: '🗑️',
    tag: 'Municipal Corp',
    deptCode: 'MC',
    title: 'Uncollected solid municipal waste and animal carcass on street corner',
    description: 'Municipal garbage collection truck has not visited in 8 days. Decaying organic waste and plastic rubbish spilling over the open community bin spreading foul stench.',
  },
  {
    icon: '🏥',
    tag: 'Public Health',
    deptCode: 'HEALTH',
    title: 'Govt dispensary locked during working hours and essential medicines out of stock',
    description: 'Primary health center doctor is routinely absent without notice. Dispensary pharmacy has zero stocks of rabies injections, paracetamol, or basic bandages.',
  },
  {
    icon: '🏫',
    tag: 'Education',
    deptCode: 'EDU',
    title: 'Cracked ceiling plaster and collapsed desks in government secondary school',
    description: 'Classroom ceiling plaster in Sarvodaya Senior Secondary School is falling on students during monsoon, with broken benches and zero functional sanitation facilities.',
  },
  {
    icon: '🚌',
    tag: 'Transport',
    deptCode: 'TRANS',
    title: 'City transit route 544 buses skipping scheduled station stops',
    description: 'Metropolitan transport buses on route 544 consistently skip the morning transit stop, leaving hundreds of office commuters stranded for over 90 minutes.',
  },
];

export const ComplaintWizard: React.FC<ComplaintWizardProps> = ({ onSuccess }) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [category, setCategory] = useState('INFRASTRUCTURE_DAMAGE');
  const [district, setDistrict] = useState('South-East Metro Zone');
  const [approxLocation, setApproxLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [consentGiven, setConsentGiven] = useState(true);

  // Result state
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);

  // AI Classification & Department Verification State
  const [isAutoRouting, setIsAutoRouting] = useState(true); // ML model auto-classifies and assigns department by itself!
  const [aiResult, setAiResult] = useState<DepartmentClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [showRankings, setShowRankings] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const runClassificationAndVerification = async (
    customTitle?: string,
    customDesc?: string,
    targetDeptId?: string,
    autoAssign: boolean = isAutoRouting
  ) => {
    const t = (customTitle !== undefined ? customTitle : title).trim();
    const d = (customDesc !== undefined ? customDesc : description).trim();
    if (t.length < 3 && d.length < 6) return;

    setIsClassifying(true);
    try {
      const activeDeptId = targetDeptId !== undefined ? targetDeptId : departmentId;
      const res = await api.classifyDepartment({
        title: t || 'Civic Grievance',
        description: d || t,
        selected_department_id: activeDeptId || undefined,
      });

      if (autoAssign && res.predicted_department_id) {
        setDepartmentId(res.predicted_department_id);
        // Verify with the predicted department
        const reVerify = await api.classifyDepartment({
          title: t || 'Civic Grievance',
          description: d || t,
          selected_department_id: res.predicted_department_id,
        });
        setAiResult(reVerify);
      } else {
        setAiResult(res);
      }
    } catch (err) {
      console.warn('AI classification failed:', err);
    } finally {
      setIsClassifying(false);
    }
  };

  // Debounced auto-classification as the citizen types: ML model classifies by itself!
  useEffect(() => {
    if (title.trim().length >= 3 || description.trim().length >= 6) {
      const timer = setTimeout(() => {
        runClassificationAndVerification(undefined, undefined, undefined, isAutoRouting);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [title, description, isAutoRouting]);

  const handleDepartmentChange = (newDeptId: string) => {
    setIsAutoRouting(false); // User manually changed it
    setDepartmentId(newDeptId);
    if (title.trim().length >= 3 || description.trim().length >= 6) {
      runClassificationAndVerification(undefined, undefined, newDeptId, false);
    }
  };

  const handleApplySample = (sample: SampleGrievance) => {
    setTitle(sample.title);
    setDescription(sample.description);
    setIsAutoRouting(true);
    runClassificationAndVerification(sample.title, sample.description, undefined, true);
  };

  const handleRevertToAiRecommendation = () => {
    if (aiResult?.recommended_department_id) {
      setDepartmentId(aiResult.recommended_department_id);
      setIsAutoRouting(true);
      runClassificationAndVerification(title, description, aiResult.recommended_department_id, false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await api.getDepartments();
      setDepartments(data);
      if (data.length > 0 && !departmentId) {
        setDepartmentId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const categories = [
    { value: 'SERVICE_FAILURE', label: 'Service Failure' },
    { value: 'INFRASTRUCTURE_DAMAGE', label: 'Infrastructure Damage' },
    { value: 'DELAYED_PUBLIC_SERVICE', label: 'Delayed Public Service' },
    { value: 'SUSPECTED_MISCONDUCT', label: 'Suspected Misconduct' },
    { value: 'UNRESOLVED_GRIEVANCE', label: 'Unresolved Public Grievance' },
    { value: 'OTHER', label: 'Other' },
  ];

  const handleSubmit = async () => {
    if (!consentGiven) {
      setError('Consent to reporting and privacy policy is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newComplaint = await api.lodgeComplaint({
        title,
        description,
        department_id: departmentId || undefined,
        category,
        state: 'National Capital Region',
        district,
        approximate_location: approxLocation || 'General Civic Area',
        incident_date: new Date(incidentDate).toISOString(),
        consent_given: consentGiven,
        evidence_description: evidenceDescription,
      });

      // Upload file if selected
      if (evidenceFile) {
        try {
          await api.uploadEvidence(newComplaint.id, evidenceFile, evidenceDescription);
        } catch (evErr) {
          console.warn('Evidence upload failed:', evErr);
        }
      }

      setSubmittedComplaint(newComplaint);
      setStep(5); // Success step
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit complaint.');
    } finally {
      setLoading(false);
    }
  };

  const currentDeptObj = departments.find((d) => d.id === departmentId);

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        {/* Wizard Header & Stepper */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              Citizen Submission Wizard
            </div>
            <div className="text-xs font-mono text-slate-400">
              Submitting as:{' '}
              <span className="text-teal-400 font-bold">
                {currentUser?.citizen_pseudonym_id || 'CITIZEN-ANONYMOUS'}
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            Lodge Anonymous Grievance
          </h2>

          {/* Stepper indicators */}
          {step <= 4 && (
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[
                { n: 1, label: 'Details' },
                { n: 2, label: 'Location' },
                { n: 3, label: 'Evidence' },
                { n: 4, label: 'Consent' },
              ].map((s) => (
                <div key={s.n} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      step >= s.n ? 'bg-teal-500' : 'bg-slate-800'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium block ${
                      step >= s.n ? 'text-teal-400' : 'text-slate-500'
                    }`}
                  >
                    {s.n}. {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Quick-fill sample buttons to test the ML classifier */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  Try an example to see ML classify by itself:
                </span>
                <span className="text-[10px] text-teal-400 font-mono">1,000 Synthetic Samples Trained</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_GRIEVANCES.map((s) => (
                  <button
                    key={s.deptCode}
                    type="button"
                    onClick={() => handleApplySample(s)}
                    className="bg-slate-950/80 hover:bg-teal-950/60 border border-slate-800 hover:border-teal-500/50 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 hover:text-teal-200 transition-all flex items-center gap-1"
                  >
                    <span>{s.icon}</span>
                    <span>{s.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grievance Title */}
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                Grievance Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Severe Potholes and Damaged Culvert on Main Sector Road"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                Detailed Description & Impact
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Explain the service disruption, location impact, duration of neglect, and any prior reference numbers..."
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* AI Automated Department Classifier & Verification Card */}
            <div className="bg-slate-950 border border-teal-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg shadow-teal-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        AI Department Auto-Classifier
                      </h4>
                      {isAutoRouting ? (
                        <span className="text-[10px] bg-teal-500/20 text-teal-300 font-mono px-2 py-0.5 rounded-full border border-teal-500/40">
                          Auto-Routing Active
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/40">
                          Manual Override
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Trained TF-IDF + Multinomial Naive Bayes model automatically selects & verifies the appropriate department.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoRouting(true);
                      runClassificationAndVerification(undefined, undefined, undefined, true);
                    }}
                    disabled={isClassifying || (title.trim().length < 3 && description.trim().length < 6)}
                    className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all disabled:opacity-40"
                    title="Classify grievance with ML model"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isClassifying ? 'Classifying...' : 'Classify Now'}</span>
                  </button>
                </div>
              </div>

              {/* Status / Prediction Result */}
              {isClassifying ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-teal-300 flex items-center gap-3 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                  <span>ML Model analyzing text context and matching civic departments...</span>
                </div>
              ) : aiResult ? (
                <div className="space-y-3.5">
                  {/* Result Header Badge */}
                  <div className={`p-4 rounded-xl border ${
                    aiResult.verification_status === 'WARNING_MISMATCH'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {aiResult.verification_status === 'WARNING_MISMATCH' ? (
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          )}
                          <span className="font-bold text-sm">
                            {aiResult.verification_status === 'WARNING_MISMATCH'
                              ? 'Routing Mismatch Detected'
                              : `Auto-Assigned: ${aiResult.predicted_department_name}`}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-300 leading-relaxed">
                          {aiResult.verification_message}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                          aiResult.verification_status === 'WARNING_MISMATCH'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {aiResult.confidence_pct} Confidence
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Code: {aiResult.predicted_department_code}
                        </div>
                      </div>
                    </div>

                    {/* Quick Button to adopt ML recommendation if mismatch */}
                    {aiResult.verification_status === 'WARNING_MISMATCH' && aiResult.recommended_department_id && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                        <span className="text-[11px] text-amber-300">
                          Recommended Department: <strong>{aiResult.recommended_department_name}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={handleRevertToAiRecommendation}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Switch to Recommended</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Detected Domain Keywords */}
                  {aiResult.detected_keywords && aiResult.detected_keywords.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-teal-400" /> Key Features Detected by ML:
                      </span>
                      {aiResult.detected_keywords.map((kw, i) => (
                        <span key={i} className="bg-slate-900 border border-slate-700 text-teal-300 px-2.5 py-0.5 rounded-md font-mono text-[11px]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expandable Department Probability Breakdown */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRankings(!showRankings)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
                    >
                      <span>{showRankings ? 'Hide' : 'Inspect'} ML Probability across all 7 civic departments</span>
                      {showRankings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showRankings && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2">
                        {aiResult.department_rankings.map((r) => {
                          const isSelected = r.code === aiResult.selected_department_code;
                          const isPredicted = r.code === aiResult.predicted_department_code;
                          return (
                            <div
                              key={r.code}
                              className={`p-2.5 rounded-xl border text-[11px] transition-all ${
                                isPredicted
                                  ? 'bg-teal-950/30 border-teal-500/50'
                                  : isSelected
                                  ? 'bg-slate-900 border-amber-500/40'
                                  : 'bg-slate-950 border-slate-800'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-semibold text-slate-200">
                                  {r.code} - {r.name}
                                </span>
                                <span className={`font-mono text-[10px] ${isPredicted ? 'text-teal-400 font-bold' : 'text-slate-400'}`}>
                                  {r.percentage} {isPredicted && '(Top)'}
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${isPredicted ? 'bg-teal-500' : 'bg-slate-600'}`}
                                  style={{ width: `${Math.max(r.probability * 100, 3)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-400 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>
                    As soon as you enter a title or description (or click an example above), the trained ML model will automatically classify and assign the department.
                  </span>
                </div>
              )}
            </div>

            {/* Department Selection (Auto or Manual Override) & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Assigned Civic Department
                  </label>
                  {isAutoRouting ? (
                    <button
                      type="button"
                      onClick={() => setIsAutoRouting(false)}
                      className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors"
                    >
                      Override Manually
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoRouting(true);
                        runClassificationAndVerification(undefined, undefined, undefined, true);
                      }}
                      className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold transition-colors"
                    >
                      Re-enable AI Routing
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={departmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none ${
                      isAutoRouting ? 'border-teal-500/60 ring-1 ring-teal-500/20' : 'border-slate-700 focus:border-teal-500'
                    }`}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {isAutoRouting ? '✓ Automatically updated by ML Model based on grievance text' : '⚠ Manually selected department'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                  Complaint Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  if (title.length < 5 || description.length < 15) {
                    setError('Please provide a title (min 5 chars) and description (min 15 chars).');
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all"
              >
                <span>Continue to Location</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Location & Date */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200">Approximate Location Policy:</span> Provide general landmarks (e.g. "Opposite Sector 14 Gate"). Avoid specifying your personal home apartment or private house number to maintain privacy.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                  District / Zone
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="E.g., South-East Metro Zone"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                  Incident Date
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                Approximate Location / Street Landmark
              </label>
              <input
                type="text"
                value={approxLocation}
                onChange={(e) => setApproxLocation(e.target.value)}
                placeholder="E.g., Near Sector 14 Market Crossing and Bus Terminal"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-5 py-2.5 rounded-xl text-xs flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!approxLocation) {
                    setError('Please specify approximate landmark or location.');
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
                className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all"
              >
                <span>Continue to Evidence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Evidence */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-2 border-dashed border-slate-700 hover:border-teal-500/50 rounded-2xl p-6 text-center transition-all bg-slate-950/40">
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-200 mb-1">
                Upload Supporting Evidence (Optional)
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Attach photos, invoices, or utility notices (PDF, JPG, PNG, up to 10MB).
              </p>

              <input
                type="file"
                id="evidence-file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setEvidenceFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <label
                htmlFor="evidence-file"
                className="inline-block bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-xs px-4 py-2 rounded-xl border border-slate-700 cursor-pointer transition-colors"
              >
                {evidenceFile ? evidenceFile.name : 'Choose File'}
              </label>

              {evidenceFile && (
                <div className="mt-3 text-xs text-teal-400 font-mono">
                  Selected: {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                Evidence Description / Context
              </label>
              <input
                type="text"
                value={evidenceDescription}
                onChange={(e) => setEvidenceDescription(e.target.value)}
                placeholder="E.g., Photograph showing water main leak on Wednesday morning..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-5 py-2.5 rounded-xl text-xs flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all"
              >
                <span>Continue to Consent</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Consent & Review */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Submission Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Title:</span>
                  <span className="font-semibold text-slate-200">{title}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Category:</span>
                  <span className="font-semibold text-slate-200">{category}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Assigned Department:</span>
                  <span className="font-semibold text-slate-200">
                    {currentDeptObj?.name || 'Selected Department'} ({currentDeptObj?.code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">AI Routing Verification:</span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    aiResult?.is_good_department !== false ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {aiResult?.is_good_department !== false ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Good Match ({aiResult?.confidence_pct || 'High Confidence'})</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Routing Mismatch Flagged</span>
                      </>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Location:</span>
                  <span className="font-semibold text-slate-200">{approxLocation || 'Civic Area'}, {district}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Complainant Pseudonym:</span>
                  <span className="font-mono font-bold text-teal-400">
                    {currentUser?.citizen_pseudonym_id || 'CITIZEN-ANONYMOUS'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 rounded border-slate-700 text-teal-600 focus:ring-teal-500 bg-slate-950"
                />
                <span className="text-xs text-slate-400 leading-relaxed">
                  I consent to lodging this grievance under CivicTrust's privacy-preserving protocol. I understand my submission will be reviewed by the municipal department under an anonymous case identifier, and that false deliberate forgery of evidence is prohibited under the Trust & Safety policy.
                </span>
              </label>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-5 py-2.5 rounded-xl text-xs flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
              >
                {loading ? 'Submitting Grievance...' : 'Submit Grievance Now'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Success Screen */}
        {step === 5 && submittedComplaint && (
          <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto text-teal-400">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Grievance Successfully Registered</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your complaint has been queued for department assignment under an anonymous tracking token.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-md mx-auto text-left space-y-3 font-mono">
              <div>
                <span className="text-[11px] text-slate-500 block uppercase">Public Case Reference</span>
                <span className="text-xl font-bold text-teal-400">{submittedComplaint.complaint_number}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase">Complainant Pseudonym</span>
                <span className="text-xs text-slate-300">{submittedComplaint.citizen_pseudonym_id}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase">Department & Routing Status</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-200">
                    {submittedComplaint.department_name || currentDeptObj?.name}
                  </span>
                  {submittedComplaint.is_department_verified ? (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      ✓ AI Verified Good Match
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      ⚠ Routing Advisory
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase">Current Status</span>
                <span className="text-xs text-amber-400 font-bold">{submittedComplaint.status}</span>
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={() => onSuccess(submittedComplaint)}
                className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all"
              >
                View in Private Tracker
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
