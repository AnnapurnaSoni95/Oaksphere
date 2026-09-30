import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
  Target,
  Download,
  Calendar,
  Filter,
  PhoneCall,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'funnel' | 'missed' | 'aging'>('funnel');

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/reports/funnel');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user]);

  if (isLoading || !data) {
    return <div className="p-8 text-center text-slate-500 text-xs">Computing recruitment funnel analytics...</div>;
  }

  const { funnel, aging, missedFollowups, recruiters } = data;

  const funnelSteps = [
    { label: 'Total Leads', count: funnel.totalLeads, color: 'bg-blue-600', text: 'text-blue-900', bg: 'bg-blue-50' },
    { label: 'Called', count: funnel.called, color: 'bg-sky-600', text: 'text-sky-900', bg: 'bg-sky-50' },
    { label: 'Connected', count: funnel.connected, color: 'bg-indigo-600', text: 'text-indigo-900', bg: 'bg-indigo-50' },
    { label: 'Interested', count: funnel.interested, color: 'bg-emerald-600', text: 'text-emerald-900', bg: 'bg-emerald-50' },
    { label: 'Interviews Booked', count: funnel.interviews, color: 'bg-purple-600', text: 'text-purple-900', bg: 'bg-purple-50' },
    { label: 'Attended Lineup', count: funnel.attended, color: 'bg-violet-600', text: 'text-violet-900', bg: 'bg-violet-50' },
    { label: 'Selected (Offers)', count: funnel.selected, color: 'bg-teal-600', text: 'text-teal-900', bg: 'bg-teal-50' },
    { label: 'Successfully Joined', count: funnel.joined, color: 'bg-emerald-700', text: 'text-emerald-950', bg: 'bg-emerald-100' },
  ];

  const maxVal = Math.max(...funnelSteps.map(s => s.count), 1);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Recruitment Funnel & Operational Reports
            </h1>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px]">
              Agency Intelligence
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            End-to-end recruitment funnel conversions, missed follow-up audits, and candidate aging buckets.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('funnel')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'funnel' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> End-to-End Funnel
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('missed')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'missed' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Missed Follow-up Audit ({missedFollowups.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aging')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'aging' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Lead Aging & Untouched Buckets
        </button>

        <Link
          to="/telephony"
          className="ml-auto px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors text-xs"
        >
          <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
          <span>Telephony & Call Analytics</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-200 text-sky-800">LIVE</span>
        </Link>
      </div>

      {/* 1. FUNNEL TAB */}
      {activeTab === 'funnel' && (
        <div className="space-y-6">
          {/* Visual Horizontal Funnel Graph */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm">Overall Recruitment Funnel Conversion</h2>

            <div className="space-y-3">
              {funnelSteps.map((step, idx) => {
                const widthPercent = Math.max(8, Math.round((step.count / maxVal) * 100));
                const convFromTop = funnel.totalLeads > 0 ? Math.round((step.count / funnel.totalLeads) * 100) : 0;

                return (
                  <div key={step.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{idx + 1}. {step.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900 text-sm">{step.count} candidates</span>
                        <span className="text-slate-400 text-[11px]">({convFromTop}% of total)</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 h-6 rounded-md overflow-hidden p-0.5">
                      <div
                        className={`${step.color} h-full rounded text-white font-bold text-[10px] flex items-center px-2 transition-all duration-500`}
                        style={{ width: `${widthPercent}%` }}
                      >
                        {widthPercent > 15 ? `${step.count}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recruiter Performance Funnel Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="font-bold text-slate-900 text-sm">Recruiter Calling & Lineup Funnel Matrix</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2 px-3">Recruiter</th>
                    <th className="py-2 px-3 text-center">Daily Calls</th>
                    <th className="py-2 px-3 text-center">Connected</th>
                    <th className="py-2 px-3 text-center">Contact %</th>
                    <th className="py-2 px-3 text-center">Lineups Booked</th>
                    <th className="py-2 px-3 text-center">Monthly Joinings</th>
                    <th className="py-2 px-3 text-center">Target Quota Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recruiters.map((r: any) => {
                    const contactRate = r.actualDailyCalls > 0 ? Math.round((r.actualDailyConnected / r.actualDailyCalls) * 100) : 0;
                    const quotaProgress = Math.min(100, Math.round((r.actualDailyCalls / (r.dailyCallTarget || 1)) * 100));

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{r.name}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">{r.actualDailyCalls}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-indigo-600 font-bold">{r.actualDailyConnected}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">{contactRate}%</td>
                        <td className="py-2.5 px-3 text-center font-mono text-purple-700 font-bold">{r.actualDailyLineups}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-800 font-black">{r.actualMonthlyJoinings}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            quotaProgress >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {quotaProgress}% of Daily Quota
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. MISSED FOLLOW-UPS AUDIT */}
      {activeTab === 'missed' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Missed & Delayed Follow-up Audit Trail</h2>
              <p className="text-slate-500 text-xs">Exposes any recruiter delays in reaching candidates past scheduled follow-up time.</p>
            </div>
            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg">
              {missedFollowups.length} Delayed Follow-ups
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3">Recruiter</th>
                  <th className="py-2 px-3">Candidate</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Scheduled Time</th>
                  <th className="py-2 px-3">Delay / Aging</th>
                  <th className="py-2 px-3">Priority</th>
                  <th className="py-2 px-3">Reason / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missedFollowups.map((mf: any) => (
                  <tr key={mf.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{mf.recruiter}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{mf.candidate}</td>
                    <td className="py-2.5 px-3 font-mono">{mf.phone}</td>
                    <td className="py-2.5 px-3">{new Date(mf.scheduledAt).toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-rose-600">{mf.delay}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <PriorityBadge priority={mf.priority} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{mf.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. AGING BUCKETS */}
      {activeTab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Fresh (&lt;24 hours)</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{aging.under1Day}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Top conversion zone</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">1 - 3 Days</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">{aging.days1to3}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Active calling</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">4 - 7 Days</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{aging.days4to7}</div>
              <div className="text-[10px] text-amber-600 mt-0.5 font-medium">Re-engagement needed</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Stale (15+ Days)</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{aging.days15Plus}</div>
              <div className="text-[10px] text-rose-600 mt-0.5 font-bold">Cold lead bucket</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
