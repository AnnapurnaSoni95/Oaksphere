import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Copy,
  AlertTriangle,
  GitMerge,
  CheckCircle,
  ShieldAlert,
  ArrowRight,
  User,
  Phone,
  Clock,
  History,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';

export const DuplicateMergePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [duplicateSets, setDuplicateSets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);

  // Merge selection state
  const [masterLeadId, setMasterLeadId] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState<string>('');

  const fetchDuplicates = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/duplicates');
      setDuplicateSets(res.duplicateSets || []);
      if (res.duplicateSets && res.duplicateSets.length > 0) {
        setSelectedSetIndex(0);
        setMasterLeadId(res.duplicateSets[0].leads[0].id);
      } else {
        setSelectedSetIndex(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, [user]);

  const activeSet = selectedSetIndex !== null ? duplicateSets[selectedSetIndex] : null;

  const handleExecuteMerge = async () => {
    if (!activeSet || !masterLeadId) return;
    const secondaryLead = activeSet.leads.find((l: any) => l.id !== masterLeadId);
    if (!secondaryLead) return;

    if (!window.confirm(`Are you sure you want to merge candidate '${secondaryLead.candidateName}' into Master '${activeSet.leads.find((l: any) => l.id === masterLeadId)?.candidateName}'? All calls, interviews, follow-ups, and activity history will be safely preserved.`)) {
      return;
    }

    setIsMerging(true);
    setMergeSuccessMsg('');
    try {
      const res = await apiRequest('/api/duplicates/merge', {
        method: 'POST',
        body: JSON.stringify({
          masterLeadId,
          secondaryLeadId: secondaryLead.id,
        }),
      });
      setMergeSuccessMsg(res.message);
      fetchDuplicates();
    } catch (e: any) {
      alert(e.message || 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="font-semibold text-slate-800">Access Restricted</p>
        <p className="mt-1">Duplicate merge requires Administrator authorization.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Copy className="w-5 h-5 text-amber-600" />
              Duplicate Candidate Review & Historical Merge
            </h1>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
              {duplicateSets.length} Duplicate Clusters Detected
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Side-by-side duplicate comparison. Preserves 100% of historical calls, activities, notes, interviews, and audit logs.
          </p>
        </div>
      </div>

      {mergeSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{mergeSuccessMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Scanning CRM database for duplicate records...</div>
      ) : duplicateSets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-900 text-sm">No Duplicate Candidates Found!</h3>
          <p className="text-slate-400 text-xs mt-1">Your CRM database is completely deduplicated and clean.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cluster Selector List */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 lg:col-span-1">
            <h3 className="font-bold text-slate-800 mb-2">Duplicate Clusters</h3>
            <div className="space-y-1.5">
              {duplicateSets.map((ds, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setSelectedSetIndex(idx);
                    setMasterLeadId(ds.leads[0].id);
                    setMergeSuccessMsg('');
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    selectedSetIndex === idx
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-mono text-slate-900">📞 {ds.normalizedPhone}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ds.leads.length} candidates share this number
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Side-by-side Comparison & Merge Workspace */}
          {activeSet && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 lg:col-span-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Side-by-Side Duplicate Comparison (Phone: {activeSet.normalizedPhone})
                  </h3>
                  <p className="text-slate-500 text-xs">
                    Select which candidate profile will serve as the Master surviving record.
                  </p>
                </div>
              </div>

              {/* Side by side cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSet.leads.map((l: any) => {
                  const isMaster = masterLeadId === l.id;

                  return (
                    <div
                      key={l.id}
                      onClick={() => setMasterLeadId(l.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isMaster
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="masterLead"
                            checked={isMaster}
                            onChange={() => setMasterLeadId(l.id)}
                            className="text-indigo-600"
                          />
                          <span className={`font-bold text-sm ${isMaster ? 'text-indigo-900' : 'text-slate-900'}`}>
                            {l.candidateName}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isMaster ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isMaster ? 'Master (Surviving)' : 'Secondary (To Merge)'}
                        </span>
                      </div>

                      <div className="space-y-2 text-[11px] divide-y divide-slate-100">
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Lead ID</span>
                          <span className="font-mono text-slate-700">{l.id}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Raw Phone</span>
                          <span className="font-mono font-semibold">{l.primaryPhone}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Alt Phone</span>
                          <span className="font-mono text-slate-600">{l.alternatePhone || 'None'}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Email</span>
                          <span>{l.email || 'None'}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">City</span>
                          <span className="font-semibold">{l.city}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Experience</span>
                          <span>{l.experience || 'Fresher'}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Lead Source</span>
                          <span className="font-semibold">{l.leadSource}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Assigned Recruiter</span>
                          <span className="font-bold text-indigo-700">{l.assignedRecruiterName}</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Priority & Status</span>
                          <div className="flex gap-1">
                            <PriorityBadge priority={l.priority} />
                            <StatusBadge status={l.leadStatus} />
                          </div>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Call Attempts</span>
                          <span>{l.callAttempts || 0} calls</span>
                        </div>
                        <div className="pt-1 flex justify-between">
                          <span className="text-slate-500">Created Date</span>
                          <span className="text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                        </div>
                        {l.notesSummary && (
                          <div className="pt-1">
                            <span className="text-slate-500 block">Notes:</span>
                            <p className="text-slate-700 italic mt-0.5">{l.notesSummary}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data Preservation Guarantee Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 space-y-1 text-[11px]">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-600" />
                  <span>Historical Data Preservation Guarantee</span>
                </div>
                <p>
                  Upon merging: All call logs, scheduled follow-ups, client interviews, joinings, recruiter assignment records, and timeline activities from the secondary candidate will be safely moved to the Master record. No historical data will be lost.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  disabled={isMerging}
                  onClick={handleExecuteMerge}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
                >
                  <GitMerge className="w-4 h-4" />
                  {isMerging ? 'Merging Records Safely...' : 'Execute Historical Merge'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
