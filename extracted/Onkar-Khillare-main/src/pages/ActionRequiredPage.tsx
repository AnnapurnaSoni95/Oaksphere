import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Clock,
  PhoneOff,
  UserX,
  Calendar,
  CheckCircle,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { CallModal } from '../components/leads/CallModal';

export const ActionRequiredPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [activeCallLead, setActiveCallLead] = useState<any | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const fetchExceptions = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/action-required');
      setData(res);
    } catch (e) {
      console.error('Failed to load action required exceptions', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [user]);

  if (isLoading || !data) {
    return <div className="p-8 text-center text-slate-500 text-xs">Scanning CRM for operational exceptions...</div>;
  }

  const {
    overdueFollowups,
    neverCalledLeads,
    selectedWithoutJoiningDate,
    unassignedLeads,
    staleUntouchedLeads,
    underperformingRecruiters,
  } = data;

  const totalExceptions =
    overdueFollowups.length +
    neverCalledLeads.length +
    selectedWithoutJoiningDate.length +
    unassignedLeads.length +
    staleUntouchedLeads.length +
    underperformingRecruiters.length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Header */}
      <div className="bg-rose-900 text-white p-5 rounded-2xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 font-bold text-[10px] uppercase tracking-wider border border-rose-400/40">
                Operational Exception Desk
              </span>
              <span className="text-rose-200 text-xs">• Real-time Risk Mitigation</span>
            </div>
            <h1 className="text-xl font-bold mt-1">Action Required Dashboard</h1>
            <p className="text-rose-100 text-xs mt-0.5">
              Zero candidate drop-off guarantee: Track missed follow-ups, stale untouched records, unassigned leads, and target shortfalls.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
            <span className="text-[11px] text-rose-200 uppercase font-semibold">Total Exceptions</span>
            <div className="text-2xl font-black text-white">{totalExceptions}</div>
          </div>
        </div>
      </div>

      {/* Exception Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Overdue Follow-ups */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <Clock className="w-4 h-4 text-rose-600" />
              <span>Overdue Follow-ups</span>
            </div>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
              {overdueFollowups.length}
            </span>
          </div>

          {overdueFollowups.length === 0 ? (
            <div className="py-4 text-center text-slate-400">All follow-ups on time!</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 space-y-2">
              {overdueFollowups.slice(0, 5).map((f: any) => (
                <div key={f.id} className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{f.candidateName}</div>
                    <div className="text-[10px] text-rose-600 font-bold">{f.overdueLabel}</div>
                    <div className="text-[10px] text-slate-400">Recruiter: {f.recruiterName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCallLead({
                      id: f.leadId,
                      candidateName: f.candidateName,
                      primaryPhone: f.candidatePhone,
                      city: '',
                      priority: f.priority,
                      leadStatus: 'Follow-up',
                    })}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-[11px]"
                  >
                    Call
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-right">
            <Link to="/followups" className="text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
              View Follow-up Engine <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 2. Never-Called Leads */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <PhoneOff className="w-4 h-4 text-amber-600" />
              <span>Never-Called Leads</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
              {neverCalledLeads.length}
            </span>
          </div>

          {neverCalledLeads.length === 0 ? (
            <div className="py-4 text-center text-slate-400">All leads have been called!</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 space-y-2">
              {neverCalledLeads.slice(0, 5).map((l: any) => (
                <div key={l.id} className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{l.candidateName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{l.primaryPhone}</div>
                    <div className="text-[10px] text-slate-400">Assigned: {l.assignedRecruiterName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCallLead(l)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-[11px]"
                  >
                    Dial Lead
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-right">
            <Link to="/calling-queue" className="text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
              Open Calling Queue <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 3. Selected Candidates Missing Expected Joining Date */}
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-purple-900">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Selected Missing Joining Date</span>
            </div>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-bold text-[10px]">
              {selectedWithoutJoiningDate.length}
            </span>
          </div>

          {selectedWithoutJoiningDate.length === 0 ? (
            <div className="py-4 text-center text-slate-400">All selected candidates have joining dates!</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 space-y-2">
              {selectedWithoutJoiningDate.map((j: any) => (
                <div key={j.id} className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{j.candidateName}</div>
                    <div className="text-[10px] text-purple-700 font-semibold">{j.clientName}</div>
                    <div className="text-[10px] text-rose-600 font-bold">Needs expected joining date</div>
                  </div>
                  <Link
                    to="/joinings"
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded text-[11px]"
                  >
                    Set Date
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-right">
            <Link to="/joinings" className="text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
              Go to Joining Tracker <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 4. Unassigned Leads */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <UserX className="w-4 h-4 text-rose-600" />
              <span>Unassigned Candidate Leads</span>
            </div>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
              {unassignedLeads.length}
            </span>
          </div>

          {unassignedLeads.length === 0 ? (
            <div className="py-4 text-center text-slate-400">No unassigned leads in CRM.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 space-y-2">
              {unassignedLeads.map((l: any) => (
                <div key={l.id} className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{l.candidateName}</div>
                    <div className="text-[10px] text-slate-500">{l.city} • {l.leadSource}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailLeadId(l.id)}
                    className="px-2.5 py-1 bg-slate-900 text-white font-semibold rounded text-[11px]"
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-right">
            <Link to="/leads?view=unassigned" className="text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
              Bulk Distribute Leads <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 5. Stale / Untouched Leads (>7 days) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Stale Untouched Leads (&gt;7d)</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
              {staleUntouchedLeads.length}
            </span>
          </div>

          {staleUntouchedLeads.length === 0 ? (
            <div className="py-4 text-center text-slate-400">No stale leads in CRM.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 space-y-2">
              {staleUntouchedLeads.map((l: any) => (
                <div key={l.id} className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{l.candidateName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Assigned: {l.assignedRecruiterName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCallLead(l)}
                    className="px-2.5 py-1 bg-indigo-600 text-white font-semibold rounded text-[11px]"
                  >
                    Dial
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-right">
            <Link to="/leads" className="text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
              View All Leads <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 6. Recruiters Below Target */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>Recruiters Below Daily Targets</span>
            </div>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
              {underperformingRecruiters.length}
            </span>
          </div>

          {underperformingRecruiters.length === 0 ? (
            <div className="py-4 text-center text-slate-400">All recruiters achieving KPI targets!</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 space-y-2">
              {underperformingRecruiters.map((r: any) => (
                <div key={r.id} className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{r.name}</div>
                    <div className="text-[10px] text-slate-500">Team: {r.teamName || 'General'}</div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                      {r.actualCalls} / {r.targetCalls} Calls
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-right">
            <Link to="/recruiters" className="text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
              Recruiter Productivity Hub <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Embedded Modals */}
      {activeCallLead && (
        <CallModal
          isOpen={!!activeCallLead}
          onClose={() => setActiveCallLead(null)}
          lead={activeCallLead}
          onCallLogged={fetchExceptions}
        />
      )}

      {detailLeadId && (
        <LeadDetailModal
          isOpen={!!detailLeadId}
          onClose={() => setDetailLeadId(null)}
          leadId={detailLeadId}
          onLeadUpdated={fetchExceptions}
        />
      )}
    </div>
  );
};
