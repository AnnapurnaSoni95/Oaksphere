import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Phone,
  PhoneCall,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Target,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest('/api/dashboard/stats');
        setData(res);
      } catch (e) {
        console.error('Failed to load dashboard metrics', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, [user]);

  if (isLoading || !data) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading real-time recruitment metrics...
      </div>
    );
  }

  const { today, monthly, recruiters, exceptions } = data;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Welcome & Operational Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Welcome back, {user?.name}
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs">
            {user?.role === 'admin'
              ? 'Complete agency-wide recruitment pipeline overview across all teams and recruiters.'
              : user?.role === 'team_leader'
              ? `Monitoring calling performance and interview lineups for team ${user.teamName}.`
              : 'Here is your active calling queue, today\'s follow-ups, and interview confirmations.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/my-day"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <CheckCircle className="w-4 h-4" /> Start My Day Workflow
          </Link>
          <Link
            to="/calling-queue"
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <PhoneCall className="w-4 h-4" /> Open Calling Workspace
          </Link>
        </div>
      </div>

      {/* Action Required Alert Ribbon (if any exceptions exist) */}
      {(exceptions.overdueFollowups > 0 || exceptions.unassignedLeads > 0 || exceptions.selectedWithoutJoiningDate > 0) && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold">Operational Exceptions Requiring Immediate Action: </span>
              <span>
                {exceptions.overdueFollowups} Overdue Follow-ups, {exceptions.neverCalledLeads} Never-Called Leads, {exceptions.selectedWithoutJoiningDate} Selected Missing Joining Date, {exceptions.unassignedLeads} Unassigned Leads.
              </span>
            </div>
          </div>
          <Link
            to="/action-required"
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-md shrink-0 flex items-center gap-1"
          >
            Resolve Now <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* TODAY'S RECRUITMENT KPIs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" /> Today's Recruitment Pulse
          </h2>
          <span className="text-slate-400 text-[11px]">Updated live from recruiter call logs</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Calls Placed</span>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{today.calls}</div>
            <div className="text-[10px] text-slate-500 mt-1">Daily attempts</div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Connected</span>
            <div className="text-xl font-extrabold text-indigo-600 mt-1">{today.connected}</div>
            <div className="text-[10px] text-emerald-600 mt-1">
              {today.calls > 0 ? `${Math.round((today.connected / today.calls) * 100)}% contact rate` : '0%'}
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Interested</span>
            <div className="text-xl font-extrabold text-emerald-600 mt-1">{today.interested}</div>
            <div className="text-[10px] text-slate-500 mt-1">Hot leads</div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Follow-ups Due</span>
            <div className="text-xl font-extrabold text-amber-600 mt-1">{today.followupsDue}</div>
            <div className="text-[10px] text-slate-500 mt-1">Scheduled today</div>
          </div>

          <div className={`p-3 border rounded-xl shadow-xs ${
            today.followupsOverdue > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'
          }`}>
            <span className="text-slate-400 block text-[11px] font-medium">Overdue Follow-ups</span>
            <div className={`text-xl font-extrabold mt-1 ${today.followupsOverdue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {today.followupsOverdue}
            </div>
            <div className="text-[10px] text-rose-500 mt-1">Immediate call</div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Interviews Today</span>
            <div className="text-xl font-extrabold text-purple-600 mt-1">{today.interviews}</div>
            <div className="text-[10px] text-purple-600 mt-1">Lineups</div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Attended</span>
            <div className="text-xl font-extrabold text-teal-600 mt-1">{today.attendance}</div>
            <div className="text-[10px] text-teal-600 mt-1">Show-ups</div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-slate-400 block text-[11px] font-medium">Joined Today</span>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">{today.joined}</div>
            <div className="text-[10px] text-emerald-600 mt-1">Revenue locked</div>
          </div>
        </div>
      </div>

      {/* MONTHLY CONVERSION FUNNEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Monthly Recruitment Funnel
            </h2>
            <p className="text-[11px] text-slate-500">Live conversion math from Leads to Joined</p>
          </div>
          <Link to="/reports" className="text-indigo-600 hover:underline font-semibold text-xs flex items-center gap-1">
            Detailed Funnel Analytics <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Visual Funnel Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">1. Total Leads</div>
            <div className="text-lg font-black text-blue-900 mt-1">{monthly.leads}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Top of Funnel</div>
          </div>

          <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">2. Called</div>
            <div className="text-lg font-black text-sky-900 mt-1">{monthly.called}</div>
            <div className="text-[10px] text-sky-700 mt-0.5 font-medium">
              {monthly.leads > 0 ? `${Math.round((monthly.called / monthly.leads) * 100)}% dialed` : '0%'}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">3. Connected</div>
            <div className="text-lg font-black text-indigo-900 mt-1">{monthly.connected}</div>
            <div className="text-[10px] text-indigo-700 mt-0.5 font-medium">
              {monthly.called > 0 ? `${Math.round((monthly.connected / monthly.called) * 100)}% reach` : '0%'}
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">4. Interested</div>
            <div className="text-lg font-black text-emerald-900 mt-1">{monthly.interested}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
              {monthly.connected > 0 ? `${Math.round((monthly.interested / monthly.connected) * 100)}% fit` : '0%'}
            </div>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">5. Interviews</div>
            <div className="text-lg font-black text-purple-900 mt-1">{monthly.interviews}</div>
            <div className="text-[10px] text-purple-700 mt-0.5 font-medium">Lineups booked</div>
          </div>

          <div className="p-3 bg-violet-50/70 border border-violet-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">6. Attended</div>
            <div className="text-lg font-black text-violet-900 mt-1">{monthly.attendance}</div>
            <div className="text-[10px] text-violet-700 mt-0.5 font-medium">
              {monthly.interviews > 0 ? `${Math.round((monthly.attendance / monthly.interviews) * 100)}% show rate` : '0%'}
            </div>
          </div>

          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg">
            <div className="text-slate-500 text-[10px] uppercase font-bold">7. Selected</div>
            <div className="text-lg font-black text-teal-900 mt-1">{monthly.selected}</div>
            <div className="text-[10px] text-teal-700 mt-0.5 font-medium">Offers in pipeline</div>
          </div>

          <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-lg">
            <div className="text-emerald-900 text-[10px] uppercase font-black">8. Joined</div>
            <div className="text-lg font-black text-emerald-950 mt-1">{monthly.joined}</div>
            <div className="text-[10px] text-emerald-800 mt-0.5 font-bold">Final Placements</div>
          </div>
        </div>
      </div>

      {/* RECRUITER PERFORMANCE COMPARISON */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Target className="w-4 h-4 text-indigo-600" /> Recruiter Target vs Actual Performance
            </h2>
            <p className="text-[11px] text-slate-500">Live monitoring of recruiter productivity against configured KPI targets</p>
          </div>
          <Link to="/recruiters" className="text-indigo-600 hover:underline font-semibold text-xs flex items-center gap-1">
            Manage Targets & Teams <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Recruiter</th>
                <th className="py-2.5 px-3">Team</th>
                <th className="py-2.5 px-3 text-center">Daily Calls (Act / Tgt)</th>
                <th className="py-2.5 px-3 text-center">Connected Calls</th>
                <th className="py-2.5 px-3 text-center">Daily Lineups</th>
                <th className="py-2.5 px-3 text-center">Monthly Joinings</th>
                <th className="py-2.5 px-3 text-center">Performance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recruiters.map((r: any) => {
                const callProgress = Math.min(100, Math.round((r.actualDailyCalls / (r.dailyCallTarget || 1)) * 100));
                const isUnderperforming = callProgress < 50;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                          {r.name.charAt(0)}
                        </div>
                        <span>{r.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.teamName || 'General'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="font-bold text-slate-900">{r.actualDailyCalls}</span>
                      <span className="text-slate-400"> / {r.dailyCallTarget}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="font-bold text-indigo-600">{r.actualDailyConnected}</span>
                      <span className="text-slate-400"> / {r.dailyConnectedTarget}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="font-bold text-purple-600">{r.actualDailyLineups}</span>
                      <span className="text-slate-400"> / {r.dailyLineupTarget}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="font-bold text-emerald-700">{r.actualMonthlyJoinings}</span>
                      <span className="text-slate-400"> / {r.monthlyJoiningTarget}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        callProgress >= 80
                          ? 'bg-emerald-100 text-emerald-800'
                          : callProgress >= 50
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {callProgress >= 80 ? 'On Track' : callProgress >= 50 ? 'Moderate' : 'Below Target'}
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
  );
};
