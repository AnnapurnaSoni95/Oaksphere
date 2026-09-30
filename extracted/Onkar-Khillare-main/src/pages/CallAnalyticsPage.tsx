import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  PhoneForwarded,
  PhoneIncoming,
  Radio,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Users,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Filter,
  Search,
  CheckCircle2,
  ChevronRight,
  Shield,
  Smartphone,
  BarChart2,
  Calendar,
  Sparkles,
  Volume2,
  X,
  Target,
  Flame,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TelephonyDashboardData } from '../lib/types';

export const CallAnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTL = user?.role === 'team_leader';

  // Mode: Live Monitor vs Analytics
  const [viewMode, setViewMode] = useState<'analytics' | 'live'>('analytics');
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('all');
  const [selectedSim, setSelectedSim] = useState<'all' | 'SIM_1' | 'SIM_2'>('all');
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [selectedDispositionFilter, setSelectedDispositionFilter] = useState<string>('all');

  // Data & Loading
  const [data, setData] = useState<TelephonyDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Active call ending modal state
  const [endingCallId, setEndingCallId] = useState<string | null>(null);
  const [endDisposition, setEndDisposition] = useState<string>('Connected – Interested');
  const [endNotes, setEndNotes] = useState<string>('');

  // Simulator modal
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [simCandidateName, setSimCandidateName] = useState<string>('Priya Deshpande');
  const [simPhone, setSimPhone] = useState<string>('9820499182');
  const [simMode, setSimMode] = useState<'live' | 'completed'>('live');
  const [simDisposition, setSimDisposition] = useState<string>('Connected – Interested');
  const [simSlot, setSimSlot] = useState<'SIM_1' | 'SIM_2'>('SIM_1');

  // Simulated audio player
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const audioIntervalRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const q = new URLSearchParams({
        period,
        recruiterId: selectedRecruiter,
        sim: selectedSim,
      });
      const res = await apiRequest<TelephonyDashboardData>(`/api/telephony/dashboard?${q.toString()}`);
      setData(res);
    } catch (err: any) {
      console.error('Error fetching telephony dashboard:', err);
      showToast('Failed to refresh telephony analytics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period, selectedRecruiter, selectedSim]);

  // Live poll every 8 seconds for live mode or 20s for analytics
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, viewMode === 'live' ? 6000 : 15000);
    return () => clearInterval(interval);
  }, [viewMode, period, selectedRecruiter, selectedSim]);

  // Audio player simulation timer
  useEffect(() => {
    if (playingAudioId) {
      audioIntervalRef.current = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            setPlayingAudioId(null);
            return 0;
          }
          return prev + 4;
        });
      }, 400);
    } else {
      clearInterval(audioIntervalRef.current);
      setAudioProgress(0);
    }
    return () => clearInterval(audioIntervalRef.current);
  }, [playingAudioId]);

  const handleToggleAudio = (callId: string) => {
    if (playingAudioId === callId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(callId);
      setAudioProgress(0);
    }
  };

  const handleEndActiveCall = async (callId: string) => {
    try {
      await apiRequest('/api/telephony/end-call', {
        method: 'POST',
        body: JSON.stringify({
          callId,
          disposition: endDisposition,
          notes: endNotes || `Logged from Live Telephony monitor`,
          durationSeconds: 95,
        }),
      });
      setEndingCallId(null);
      setEndNotes('');
      showToast(`Call ended and recorded as "${endDisposition}".`);
      fetchDashboardData(true);
    } catch (err) {
      showToast('Failed to end call.');
    }
  };

  const handleRunSimulator = async () => {
    try {
      await apiRequest('/api/telephony/simulate-call', {
        method: 'POST',
        body: JSON.stringify({
          candidateName: simCandidateName,
          phoneNumber: simPhone,
          simSlot,
          mode: simMode,
          disposition: simDisposition,
          durationSeconds: 120,
        }),
      });
      setShowSimModal(false);
      showToast(
        simMode === 'live' 
          ? `⚡ Live ongoing call launched for ${simCandidateName}! Check Live Monitor.`
          : `✅ Completed call logged for ${simCandidateName}.`
      );
      if (simMode === 'live') {
        setViewMode('live');
      }
      fetchDashboardData(true);
    } catch (e) {
      showToast('Simulator error.');
    }
  };

  const handleExportCsv = () => {
    window.location.href = '/api/telephony/export-csv';
  };

  if (isLoading && !data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-slate-500 text-xs">
        <Activity className="w-8 h-8 text-sky-500 animate-pulse mb-3" />
        <span className="font-semibold text-slate-700">Loading Telephony Analytics Engine...</span>
        <span className="text-[11px] text-slate-400 mt-1">Aggregating SIM bridge logs, connect rates & gap analysis</span>
      </div>
    );
  }

  const kpis = data?.kpis;
  const gap = data?.gapAnalysis;
  const summary = data?.callSummary;
  const activeCalls = data?.activeCalls || [];
  const recruiters = data?.recruiterPerformance || [];
  const presence = data?.recruiterPresence || [];
  const logs = data?.callLogs || [];

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.candidateName.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.recruiterName.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.phoneNumber.includes(searchLogQuery);

    const matchesDisp = 
      selectedDispositionFilter === 'all' || 
      (log.disposition && log.disposition.toLowerCase().includes(selectedDispositionFilter.toLowerCase()));

    return matchesSearch && matchesDisp;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto text-xs font-sans">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER BAR (Directly mirrors uploaded image: Title, subtitle, Live/Analytics toggle, period filters) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Telephony Dashboard</h1>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE SYNC
                </span>
                {activeCalls.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 animate-pulse">
                    {activeCalls.length} Call{activeCalls.length > 1 ? 's' : ''} in Progress
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Today vs yesterday, weekly trend • Dual-SIM bridge performance & agent calling analytics
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher: Live vs Analytics (High-contrast toggle) */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'live'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${viewMode === 'live' ? 'animate-pulse' : ''}`} />
              <span>Live Monitor</span>
              {activeCalls.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${viewMode === 'live' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {activeCalls.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'analytics'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-[11px] font-medium text-slate-600">
            {(['today', 'yesterday', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded capitalize transition-colors ${
                  period === p ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200' : 'hover:text-slate-900'
                }`}
              >
                {p === 'week' ? 'Weekly Trend' : p === 'month' ? 'Month' : p}
              </button>
            ))}
          </div>

          {/* Recruiter filter dropdown */}
          <select
            value={selectedRecruiter}
            onChange={e => setSelectedRecruiter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Recruiters</option>
            {presence.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role === 'team_leader' ? 'TL' : 'Recruiter'})
              </option>
            ))}
          </select>

          {/* SIM Line Filter */}
          <select
            value={selectedSim}
            onChange={e => setSelectedSim(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All SIM Lines</option>
            <option value="SIM_1">SIM 1 (Jio 5G)</option>
            <option value="SIM_2">SIM 2 (Airtel 4G)</option>
          </select>

          {/* Test Call / Simulator Trigger */}
          <button
            type="button"
            onClick={() => setShowSimModal(true)}
            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-sky-600" />
            <span>Simulate Call</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            title="Download CSV report of calls"
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 TOP TELEPHONY KPI CARDS (Matches Image Specifications) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Calls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Total Calls</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{kpis?.totalCalls.value ?? 0}</span>
            {kpis?.totalCalls.vsYesterdayPercent !== undefined && (
              <span
                className={`text-[11px] font-bold flex items-center gap-0.5 ${
                  kpis.totalCalls.vsYesterdayPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {kpis.totalCalls.vsYesterdayPercent >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {kpis.totalCalls.vsYesterdayPercent >= 0 ? '+' : ''}
                {kpis.totalCalls.vsYesterdayPercent}% vs yesterday
              </span>
            )}
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Goal: {kpis?.totalCalls.target || 60} calls</span>
              <span className="font-semibold text-slate-700">{kpis?.totalCalls.achievementPercent || 0}% reached</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, kpis?.totalCalls.achievementPercent || 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Connected Calls & Connect Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Connected Calls</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{kpis?.connectedCalls.value ?? 0}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {kpis?.connectedCalls.connectRate ?? 0}% Rate
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Target connect: 50%</span>
              <span className="font-semibold text-emerald-600">
                {kpis?.connectedCalls.vsYesterdayPercent !== undefined && kpis.connectedCalls.vsYesterdayPercent >= 0 ? '+' : ''}
                {kpis?.connectedCalls.vsYesterdayPercent}% vs yesterday
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (kpis?.connectedCalls.connectRate || 0) * 2)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Total Talk Time & Avg Duration */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Talk Time (Duration)</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{kpis?.talkTime.totalFormatted ?? '0s'}</span>
            <span className="text-xs font-medium text-slate-500">
              Avg: <span className="font-bold text-slate-700">{kpis?.talkTime.avgFormatted ?? '0s'}</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Industry benchmark: 2m 00s</span>
              <span className="text-slate-600 font-medium">Handle time</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(((kpis?.talkTime.avgSeconds || 0) / 180) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 4: Productive Outcomes / Screenings */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Productive Conversions</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{kpis?.productiveOutcomes.value ?? 0}</span>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {kpis?.productiveOutcomes.conversionRate ?? 0}% of conn.
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Interested + Lineups</span>
              <span className="text-amber-700 font-semibold">High Intent Leads</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (kpis?.productiveOutcomes.conversionRate || 0) * 2)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CALL SUMMARY: 8 METRIC CARDS BREAKDOWN (Explicit in image description) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Activity className="w-4 h-4 text-sky-600" />
            <span>Call Summary (Disposition Breakdown)</span>
          </div>
          <span className="text-[11px] text-slate-400">Total {kpis?.totalCalls.value ?? 0} calls processed in {data?.periodLabel}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* 1. Connected */}
          <div className="bg-white border-l-4 border-l-emerald-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Connected</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.connected.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">{summary?.connected.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Avg {summary?.connected.avgDuration || '0s'}</div>
          </div>

          {/* 2. Busy */}
          <div className="bg-white border-l-4 border-l-amber-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Busy</span>
              <PhoneOff className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.busy.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-amber-600 mt-0.5">{summary?.busy.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Line engaged</div>
          </div>

          {/* 3. No Answer */}
          <div className="bg-white border-l-4 border-l-orange-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>No Answer</span>
              <PhoneMissed className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.noAnswer.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-orange-600 mt-0.5">{summary?.noAnswer.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Ringing timeout</div>
          </div>

          {/* 4. Switched Off */}
          <div className="bg-white border-l-4 border-l-slate-400 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Switched Off</span>
              <Radio className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.switchedOff.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-0.5">{summary?.switchedOff.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Out of coverage</div>
          </div>

          {/* 5. Declined / Rejected */}
          <div className="bg-white border-l-4 border-l-rose-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Declined</span>
              <PhoneForwarded className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.declined.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-rose-600 mt-0.5">{summary?.declined.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Call rejected</div>
          </div>

          {/* 6. Invalid Number */}
          <div className="bg-white border-l-4 border-l-red-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Invalid</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.invalidNumber.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-red-600 mt-0.5">{summary?.invalidNumber.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Needs verification</div>
          </div>

          {/* 7. Inbound Calls */}
          <div className="bg-white border-l-4 border-l-sky-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Inbound</span>
              <PhoneIncoming className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.inbound.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-sky-600 mt-0.5">{summary?.inbound.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Returned calls</div>
          </div>

          {/* 8. Follow-up / Scheduled */}
          <div className="bg-white border-l-4 border-l-purple-500 border border-slate-200 rounded-lg p-3 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Follow-up</span>
              <Clock className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{summary?.followup.count ?? 0}</div>
            <div className="text-[11px] font-semibold text-purple-600 mt-0.5">{summary?.followup.percent ?? 0}%</div>
            <div className="text-[10px] text-slate-400 mt-1">Callback set</div>
          </div>
        </div>
      </div>

      {/* CONNECTED & GAP ANALYSIS SECTION (Explicit in image with visual progress indicators for week & month) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Target vs Actual Gap Progress (Week & Month) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <Target className="w-4 h-4 text-indigo-600" />
              <span>Connected & Gap Analysis</span>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Agency Quota
            </span>
          </div>

          {/* Daily Gap */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800">Daily Target Gap</span>
              <span className={`font-bold ${gap?.dailyGap && gap.dailyGap >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {gap?.dailyGap && gap.dailyGap >= 0 ? '+' : ''}{gap?.dailyGap ?? 0} Calls
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Actual: <strong className="text-slate-800">{gap?.dailyActual ?? 0}</strong></span>
              <span>Target: <strong className="text-slate-800">{gap?.dailyTarget ?? 60}</strong></span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  (gap?.dailyPercent || 0) >= 100 ? 'bg-emerald-500' : (gap?.dailyPercent || 0) >= 70 ? 'bg-sky-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, gap?.dailyPercent || 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>{gap?.dailyPercent ?? 0}% completed</span>
              <span>{Math.max(0, (gap?.dailyTarget || 60) - (gap?.dailyActual || 0))} calls remaining</span>
            </div>
          </div>

          {/* Weekly Gap Progress (with visual indicator) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800">Weekly Target Progress</span>
              <span className={`font-bold ${gap?.weeklyGap && gap.weeklyGap >= 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                {gap?.weeklyPercent ?? 0}% Achieved
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Logged: <strong className="text-slate-800">{gap?.weeklyActual ?? 0}</strong></span>
              <span>Weekly Target: <strong className="text-slate-800">{gap?.weeklyTarget ?? 300}</strong></span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, gap?.weeklyPercent || 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>Pace: {gap?.weeklyPercent && gap.weeklyPercent >= 70 ? '🟢 On Schedule' : '🟡 Behind Run-rate'}</span>
              <span>Gap: {gap?.weeklyGap ?? 0} calls</span>
            </div>
          </div>

          {/* Monthly Target Progress */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800">Monthly Volume Run-rate</span>
              <span className="font-bold text-sky-700">{gap?.monthlyPercent ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Done: <strong className="text-slate-800">{gap?.monthlyActual ?? 0}</strong></span>
              <span>Target: <strong className="text-slate-800">{gap?.monthlyTarget ?? 1200}</strong></span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sky-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, gap?.monthlyPercent || 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>Target Gap: {gap?.monthlyGap ?? 0}</span>
              <span>Projected: {Math.round((gap?.monthlyActual || 1) * 1.25)}</span>
            </div>
          </div>
        </div>

        {/* Center: Hourly Calling Distribution & Connect Rate Heatmap */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                Hourly Calling Distribution & Peak Connect Analysis
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hourly call volume vs connected responses across working hours (9 AM - 7 PM)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-sky-500 inline-block" />
                <span className="text-slate-600">Total Dialed</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span className="text-slate-600">Connected</span>
              </div>
            </div>
          </div>

          <div className="h-56 w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gap?.hourlyDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hourLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any, name: any) => [value, name === 'calls' ? 'Dialed' : 'Connected']}
                />
                <Bar dataKey="calls" fill="#0284c7" radius={[4, 4, 0, 0]} name="calls" />
                <Bar dataKey="connected" fill="#10b981" radius={[4, 4, 0, 0]} name="connected" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Peak connection windows: <strong className="text-slate-900">10:00 AM - 12:00 PM</strong> and <strong className="text-slate-900">3:00 PM - 5:00 PM</strong>
            </span>
            <span className="text-slate-400">Higher connect rates during lunch and post-commute windows</span>
          </div>
        </div>
      </div>

      {/* ACTIVE CALLS / LIVE MONITOR SECTION (Explicit in image description) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                Live Active Calls & Agent Presence
              </h2>
              {activeCalls.length > 0 ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] animate-pulse">
                  {activeCalls.length} Active Right Now
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium text-[10px]">
                  All Agents Idle
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Real-time in-call stopwatch, recruiter SIM bridge line status, and supervisory monitor
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSimMode('live');
                setShowSimModal(true);
              }}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold flex items-center gap-1.5 transition-colors text-xs"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simulate Ongoing Live Call</span>
            </button>
          </div>
        </div>

        {/* Live Active Calls Table / Cards */}
        {activeCalls.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
              <PhoneCall className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">No active calls in progress</h3>
            <p className="text-slate-500 text-[11px] mt-1 max-w-sm mx-auto">
              Recruiters are currently between calls, completing dispositions, or reviewing profiles.
            </p>
            <button
              type="button"
              onClick={() => {
                setSimMode('live');
                setShowSimModal(true);
              }}
              className="mt-3 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600" /> Test Live Monitor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeCalls.map(c => (
              <div
                key={c.id}
                className="bg-white border-2 border-emerald-500/80 rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden animate-in fade-in"
              >
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-600 text-white font-extrabold text-[10px] rounded-bl-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  LIVE ON CALL
                </div>

                <div className="flex items-start justify-between gap-2 pt-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{c.candidateName}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.phoneNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Recruiter: <strong className="text-slate-800">{c.recruiterName}</strong> ({c.teamName})</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-semibold text-[10px]">
                      {c.simUsed} ({c.carrierName})
                    </span>
                    <span className="flex items-center gap-1 font-mono font-bold text-emerald-700 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      {Math.floor(c.liveDurationSeconds / 60).toString().padStart(2, '0')}:
                      {(c.liveDurationSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => showToast(`🎧 Whisper mode activated for ${c.recruiterName}. Audio bridge connected.`)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-semibold transition-colors"
                    >
                      Listen / Whisper
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndingCallId(c.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1"
                    >
                      <PhoneOff className="w-3 h-3" /> End Call
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recruiter Live Status Grid */}
        <div className="pt-2">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Recruiter SIM Bridge Telephony Status</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {presence.map(p => (
              <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs truncate">{p.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.status === 'in_call'
                        ? 'bg-emerald-500 animate-ping'
                        : p.status === 'available'
                        ? 'bg-emerald-400'
                        : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div className="text-[10px] text-slate-500 truncate">{p.teamName}</div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{p.todayCalls} calls today</span>
                  <span className="font-semibold text-slate-700">{p.todayTalkFormatted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECRUITER PERFORMANCE LEADERBOARD TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              Recruiter Telephony Productivity & Quota Gap
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Individual agent call attempts, connect rate, talk handle time, and conversion outcomes
            </p>
          </div>
          <span className="text-[11px] text-slate-500">Period: <strong>{data?.periodLabel}</strong></span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px] bg-slate-50/50">
                <th className="py-2.5 px-3">Recruiter</th>
                <th className="py-2.5 px-3 text-center">Calls Made</th>
                <th className="py-2.5 px-3 text-center">Target</th>
                <th className="py-2.5 px-3 text-center">Target Gap</th>
                <th className="py-2.5 px-3 text-center">Connected</th>
                <th className="py-2.5 px-3 text-center">Connect %</th>
                <th className="py-2.5 px-3 text-center">Total Talk Time</th>
                <th className="py-2.5 px-3 text-center">Avg Talk (AHT)</th>
                <th className="py-2.5 px-3 text-center">Interested</th>
                <th className="py-2.5 px-3 text-center">Lineups</th>
                <th className="py-2.5 px-3 text-right">Pace Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recruiters.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-800">{r.name}</div>
                    <div className="text-[10px] text-slate-400">{r.teamName}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">{r.outboundCalls}</td>
                  <td className="py-2.5 px-3 text-center text-slate-500">{r.targetCalls}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                        r.gap >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {r.gap >= 0 ? '+' : ''}{r.gap}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">{r.connectedCalls}</td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1 font-semibold text-emerald-700">
                      {r.connectRate}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-700">{r.totalTalkFormatted}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600">{r.avgTalkFormatted}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">{r.interestedCount}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-700">{r.interviewsScheduled}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.paceStatus === 'Ahead'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.paceStatus === 'On Track'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.paceStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED CALL HISTORY LOGS & AUDIO PLAYBACK */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-sky-600" />
              Telephony Call Records & Audio Recording Archive
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Verified call audit trail, duration, SIM slot, and simulated call recording player
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchLogQuery}
                onChange={e => setSearchLogQuery(e.target.value)}
                placeholder="Search candidate, recruiter, phone..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 w-48 sm:w-60"
              />
            </div>

            <select
              value={selectedDispositionFilter}
              onChange={e => setSelectedDispositionFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="all">All Dispositions</option>
              <option value="Connected">Connected</option>
              <option value="Interested">Interested</option>
              <option value="Interview Scheduled">Interview Scheduled</option>
              <option value="Callback">Callback</option>
              <option value="Busy">Busy</option>
              <option value="No Answer">No Answer</option>
              <option value="Switched Off">Switched Off</option>
              <option value="Invalid">Invalid Number</option>
            </select>
          </div>
        </div>

        {/* Audio Waveform Player Simulation Preview (when an audio is playing) */}
        {playingAudioId && (
          <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPlayingAudioId(null)}
                className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center font-bold transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Listening to call audio verification</span>
                  <span className="text-[10px] text-sky-400 font-mono">16kHz High-Fidelity Audio</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Dual-SIM Audio Recorded via Mobile Bridge Companion
                </div>
              </div>
            </div>

            {/* Simulated Animated Waveform */}
            <div className="flex-1 max-w-md hidden sm:flex items-center gap-1 h-6">
              {[40, 70, 30, 90, 60, 100, 45, 80, 20, 65, 95, 50, 85, 30, 75, 40, 90, 60, 100, 50].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-sky-400 rounded-full transition-all duration-150"
                  style={{
                    height: `${Math.max(15, (h * (audioProgress % 20 + 5)) / 25)}%`,
                    opacity: i * 5 <= audioProgress ? 1 : 0.3,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
              <span>{Math.floor(audioProgress * 0.9)}s</span>
              <button
                type="button"
                onClick={() => setPlayingAudioId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px] bg-slate-50/50">
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Recruiter</th>
                <th className="py-2.5 px-3">SIM Slot / Carrier</th>
                <th className="py-2.5 px-3">Disposition</th>
                <th className="py-2.5 px-3 text-center">Duration</th>
                <th className="py-2.5 px-3 text-center">Audio Record</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.slice(0, 25).map(log => {
                const isConn = log.durationSeconds > 0;
                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{log.candidateName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {log.phoneNumber}
                      {log.isPhoneMasked && (
                        <span className="ml-1 text-[9px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-sans">
                          Masked
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{log.recruiterName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold border border-slate-200">
                        {log.simUsed} ({log.carrierName})
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.disposition?.includes('Interested')
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.disposition?.includes('Interview')
                            ? 'bg-purple-100 text-purple-800'
                            : log.disposition?.includes('Callback')
                            ? 'bg-sky-100 text-sky-800'
                            : log.disposition === 'Busy'
                            ? 'bg-amber-100 text-amber-800'
                            : log.disposition === 'No Answer'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.disposition || 'Completed'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700 font-medium">
                      {log.durationFormatted || `${log.durationSeconds}s`}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isConn ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAudio(log.id)}
                          className={`p-1.5 rounded-full transition-colors ${
                            playingAudioId === log.id
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          }`}
                          title="Play simulated audio recording"
                        >
                          {playingAudioId === log.id ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                      {new Date(log.initiatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* END ACTIVE CALL MODAL */}
      {endingCallId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <PhoneOff className="w-4 h-4 text-rose-600" />
                <span>Wrap-up & Log Completed Call</span>
              </div>
              <button
                type="button"
                onClick={() => setEndingCallId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 text-xs">Call Outcome / Disposition</label>
              <select
                value={endDisposition}
                onChange={e => setEndDisposition(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="Connected – Interested">Connected – Interested (Walk-in pitch accepted)</option>
                <option value="Interview Scheduled">Interview Scheduled (Date/Time confirmed)</option>
                <option value="Callback">Callback (Candidate asked to call later)</option>
                <option value="Not Interested">Not Interested (Declined offer/role)</option>
                <option value="Salary Issue">Salary Issue (Expectation too high)</option>
                <option value="Location Issue">Location Issue (Commute too far)</option>
                <option value="Busy">Busy (Engaged line)</option>
                <option value="No Answer">No Answer (Rang out)</option>
                <option value="Switched Off">Switched Off / Unreachable</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 text-xs">Recruiter Notes</label>
              <textarea
                value={endNotes}
                onChange={e => setEndNotes(e.target.value)}
                rows={3}
                placeholder="Key takeaways, candidate feedback, agreed walk-in slot..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEndingCallId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleEndActiveCall(endingCallId)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
              >
                Save & Complete Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATOR MODAL (Allows user to trigger calls to see live analytics reaction) */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Zap className="w-4 h-4 text-sky-600" />
                <span>Telephony Call Event Simulator</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-500 text-xs">
              Simulate telephony events to test live ticking timers, connect rate calculations, and gap analysis progress.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">Simulation Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimMode('live')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      simMode === 'live'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ongoing Live Call</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('completed')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      simMode === 'completed'
                        ? 'bg-sky-50 border-sky-500 text-sky-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Completed Call Log</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">Candidate Name</label>
                <input
                  type="text"
                  value={simCandidateName}
                  onChange={e => setSimCandidateName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">Phone Number</label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={e => setSimPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">SIM Line</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimSlot('SIM_1')}
                    className={`p-2 rounded-lg text-xs font-semibold border ${
                      simSlot === 'SIM_1' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    SIM 1 (Jio 5G)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimSlot('SIM_2')}
                    className={`p-2 rounded-lg text-xs font-semibold border ${
                      simSlot === 'SIM_2' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    SIM 2 (Airtel 4G)
                  </button>
                </div>
              </div>

              {simMode === 'completed' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">Disposition</label>
                  <select
                    value={simDisposition}
                    onChange={e => setSimDisposition(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Connected – Interested">Connected – Interested</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Callback">Callback</option>
                    <option value="Busy">Busy</option>
                    <option value="No Answer">No Answer</option>
                    <option value="Switched Off">Switched Off</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunSimulator}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> Trigger Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
