import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { PublicComplaint, Department } from '../types';
import {
  Search, Filter, Eye, CheckCircle2, Clock, AlertCircle, Building2,
  Calendar, MapPin, X, ChevronRight, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';

export const PublicPortal: React.FC = () => {
  const [complaints, setComplaints] = useState<PublicComplaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Timeline Modal State
  const [selectedTimeline, setSelectedTimeline] = useState<any | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedStatus, selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compData, deptData] = await Promise.all([
        api.getPublicComplaints({
          search: search || undefined,
          department_id: selectedDept || undefined,
          status: selectedStatus || undefined,
          category: selectedCategory || undefined,
        }),
        api.getDepartments(),
      ]);
      setComplaints(compData);
      setDepartments(deptData);
    } catch (err) {
      console.error('Failed to load public portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openTimelineModal = async (complaintNumber: string) => {
    setTimelineLoading(true);
    try {
      const data = await api.getPublicComplaintTimeline(complaintNumber);
      setSelectedTimeline(data);
    } catch (err) {
      alert('Failed to load public timeline: ' + err);
    } finally {
      setTimelineLoading(false);
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
        return <span className="civic-badge bg-purple-500/10 text-purple-400 border border-purple-500/30">Awaiting Info</span>;
      case 'REJECTED_WITH_REASON':
        return <span className="civic-badge bg-rose-500/10 text-rose-400 border border-rose-500/30">Closed w/ Reason</span>;
      default:
        return <span className="civic-badge bg-slate-800 text-slate-300 border border-slate-700">Submitted</span>;
    }
  };

  return (
    <div className="space-y-8 py-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 uppercase tracking-wider mb-2">
              <Eye className="w-4 h-4" />
              Public Transparency Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Civic Grievance Transparency Registry
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
              Publicly accessible sanitized complaint tracker. Citizen identities and private evidence are strictly scrubbed to guarantee safety and prevent retaliatory actions.
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 max-w-xs">
            <span className="font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-teal-400" />
              Allegation Disclosure:
            </span>
            A complaint filed on this portal constitutes an allegation and does not independently prove administrative misconduct until fully investigated.
          </div>
        </div>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference (e.g. CT-2026-1001) or area..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED_WITH_REASON">Closed / Reason</option>
            </select>
          </div>

          <button
            type="submit"
            className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Apply Filters
          </button>
        </form>
      </div>

      {/* Complaints Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Displaying {complaints.length} public grievance records</span>
          <span className="font-mono text-teal-400">Strictly PII-Scrubbed</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Fetching public registry data...
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No public records found matching criteria</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting search filters or query parameters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {complaints.map((c) => (
              <div
                key={c.id}
                onClick={() => openTimelineModal(c.complaint_number)}
                className="civic-card-interactive flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/20">
                      {c.complaint_number}
                    </span>
                    {getStatusBadge(c.status)}
                  </div>

                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{c.department_name}</span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{c.general_location}</span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                    Category: {c.category.replace(/_/g, ' ')}
                  </div>

                  {c.resolution_summary && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-xs text-emerald-300/90 mt-2">
                      <span className="font-semibold block text-[10px] text-emerald-400 uppercase tracking-wider mb-0.5">
                        Resolution Summary:
                      </span>
                      {c.resolution_summary}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>

                  <span className="text-teal-400 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform font-medium">
                    View Progress
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Timeline Modal */}
      {selectedTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-slate-100 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedTimeline(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-4 mb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-teal-400">
                  {selectedTimeline.complaint_number}
                </span>
                {getStatusBadge(selectedTimeline.status)}
              </div>
              <h3 className="text-sm font-bold text-white">{selectedTimeline.department}</h3>
              <p className="text-xs text-slate-400">{selectedTimeline.general_location}</p>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {selectedTimeline.resolution_summary && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-300">
                  <span className="font-bold block text-emerald-400 uppercase tracking-wider text-[10px] mb-1">
                    Official Remediation:
                  </span>
                  {selectedTimeline.resolution_summary}
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Public Activity Timeline
                </h4>

                {selectedTimeline.timeline_updates?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No public updates logged yet.</p>
                ) : (
                  selectedTimeline.timeline_updates?.map((item: any, idx: number) => (
                    <div key={idx} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-400 ring-4 ring-teal-500/20" />
                        {idx !== selectedTimeline.timeline_updates.length - 1 && (
                          <div className="w-0.5 flex-1 bg-slate-800 my-1" />
                        )}
                      </div>
                      <div className="space-y-0.5 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{item.public_update}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          Actor: {item.actor_role}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 mt-4 text-[11px] text-slate-500 leading-tight">
              {selectedTimeline.transparency_notice}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
