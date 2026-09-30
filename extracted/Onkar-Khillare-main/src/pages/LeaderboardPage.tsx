import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import {
  Trophy,
  Medal,
  Flame,
  TrendingUp,
  Award,
  DollarSign,
  PhoneCall,
  CheckCircle2,
  Calendar,
  Sparkles,
  Users,
  Target,
} from 'lucide-react';

interface LeaderboardItem {
  userId: string;
  name: string;
  email: string;
  role: string;
  teamName: string;
  phone: string;
  rank: number;
  streakDays: number;
  today: {
    calls: number;
    connected: number;
    targetCalls: number;
    targetAchievedPct: number;
  };
  month: {
    calls: number;
    connected: number;
    interviews: number;
    attended: number;
    selected: number;
    joined: number;
    joiningTarget: number;
    joiningTargetPct: number;
  };
  rates: {
    connectionRatePct: number;
    turnoutRatePct: number;
  };
  incentive: {
    baseRate: number;
    multiplier: number;
    earnedTotal: number;
    nextTierGain: number;
  };
}

export const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Incentive simulator state
  const [basePayout, setBasePayout] = useState<number>(4500);
  const [retentionBonus, setRetentionBonus] = useState<number>(1500);
  const [selectedUserSim, setSelectedUserSim] = useState<string>('');

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ leaderboard: LeaderboardItem[] }>('/api/analytics/leaderboard');
      setLeaderboard(res.leaderboard);
      if (res.leaderboard.length > 0 && !selectedUserSim) {
        setSelectedUserSim(res.leaderboard[0].userId);
      }
    } catch (e) {
      console.error('Failed to load leaderboard', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  const simulatedRecruiter = leaderboard.find(u => u.userId === selectedUserSim) || top1;

  // Simulator calculation
  const joinedCount = simulatedRecruiter?.month.joined || 0;
  let multiplier = 1.0;
  if (joinedCount >= 8) multiplier = 1.4;
  else if (joinedCount >= 5) multiplier = 1.2;

  const simBaseEarned = joinedCount * basePayout;
  const simTierBonus = Math.round(joinedCount * basePayout * (multiplier - 1));
  const simRetentionEarned = joinedCount * retentionBonus;
  const simTotalEarnings = simBaseEarned + simTierBonus + simRetentionEarned;

  const nextTierJoined = joinedCount + 1;
  const nextTierMultiplier = nextTierJoined >= 8 ? 1.4 : nextTierJoined >= 5 ? 1.2 : 1.0;
  const simNextTotal = Math.round(nextTierJoined * basePayout * nextTierMultiplier + nextTierJoined * retentionBonus);
  const jumpDifference = simNextTotal - simTotalEarnings;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Recruiter Performance Leaderboard & Incentive Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time agency rankings, target streaks, conversion rates, and live placement commission calculator.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg font-medium border border-emerald-200">
            <Flame className="w-4 h-4 text-emerald-600" />
            <span>Active Sprint: September 2026</span>
          </span>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 items-end">
          {/* 2nd Place */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col items-center text-center order-2 md:order-1 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-slate-300" />
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg mb-2 relative">
              🥈
              <span className="absolute -bottom-1 -right-1 bg-slate-700 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                2
              </span>
            </div>
            <div className="font-bold text-sm text-slate-900">{top2.name}</div>
            <div className="text-[11px] text-slate-400">{top2.teamName}</div>

            <div className="mt-3 grid grid-cols-2 gap-2 w-full pt-3 border-t border-slate-100 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="font-bold text-slate-900 text-base">{top2.month.joined}</div>
                <div className="text-[10px] text-slate-400">Joinings</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="font-bold text-slate-900 text-base">{top2.month.interviews}</div>
                <div className="text-[10px] text-slate-400">Lineups</div>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>{top2.streakDays} Day Streak</span>
            </div>
          </div>

          {/* 1st Place - Gold Champion */}
          <div className="bg-amber-50/50 border-2 border-amber-400 rounded-xl p-6 shadow-md flex flex-col items-center text-center order-1 md:order-2 relative overflow-hidden scale-105 z-10">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-400" />
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-2xl mb-2 relative shadow-inner">
              🥇
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-sm">
                1
              </span>
            </div>
            <div className="font-bold text-base text-slate-900">{top1.name}</div>
            <div className="text-xs text-amber-800 font-medium">{top1.teamName} · Top Performer</div>

            <div className="mt-4 grid grid-cols-3 gap-2 w-full pt-3 border-t border-amber-200/60 text-xs">
              <div className="p-2 bg-white rounded-lg border border-amber-100 shadow-xs">
                <div className="font-bold text-emerald-700 text-base">{top1.month.joined}</div>
                <div className="text-[10px] text-slate-400">Joinings</div>
              </div>
              <div className="p-2 bg-white rounded-lg border border-amber-100 shadow-xs">
                <div className="font-bold text-slate-800 text-base">{top1.month.interviews}</div>
                <div className="text-[10px] text-slate-400">Lineups</div>
              </div>
              <div className="p-2 bg-white rounded-lg border border-amber-100 shadow-xs">
                <div className="font-bold text-slate-800 text-base">{top1.month.calls}</div>
                <div className="text-[10px] text-slate-400">Calls</div>
              </div>
            </div>

            <div className="mt-3 text-xs font-semibold text-emerald-700 flex items-center gap-1.5 bg-emerald-100/60 px-3 py-1 rounded-full">
              <DollarSign className="w-3.5 h-3.5" />
              <span>₹{top1.incentive.earnedTotal.toLocaleString('en-IN')} Earned This Month</span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col items-center text-center order-3 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-amber-600" />
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 font-bold text-lg mb-2 relative">
              🥉
              <span className="absolute -bottom-1 -right-1 bg-amber-700 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                3
              </span>
            </div>
            <div className="font-bold text-sm text-slate-900">{top3.name}</div>
            <div className="text-[11px] text-slate-400">{top3.teamName}</div>

            <div className="mt-3 grid grid-cols-2 gap-2 w-full pt-3 border-t border-slate-100 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="font-bold text-slate-900 text-base">{top3.month.joined}</div>
                <div className="text-[10px] text-slate-400">Joinings</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="font-bold text-slate-900 text-base">{top3.month.interviews}</div>
                <div className="text-[10px] text-slate-400">Lineups</div>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>{top3.streakDays} Day Streak</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Incentive Simulator Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Live Placement Incentive & Commission Simulator</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Forecast Recruiter Commissions & Milestone Bonuses
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300">Evaluate Recruiter:</span>
            <select
              value={selectedUserSim}
              onChange={e => setSelectedUserSim(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-400"
            >
              {leaderboard.map(u => (
                <option key={u.userId} value={u.userId}>
                  {u.name} ({u.month.joined} Joinings)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sliders for Commission Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-slate-300 font-medium">Base Payout Per Joined Candidate</label>
              <span className="font-mono text-emerald-400 font-bold text-sm">
                ₹{basePayout.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={10000}
              step={500}
              value={basePayout}
              onChange={e => setBasePayout(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>₹2,000 / hire</span>
              <span>Standard: ₹4,500</span>
              <span>₹10,000 / hire</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-slate-300 font-medium">30-Day Candidate Retention Bonus</label>
              <span className="font-mono text-indigo-300 font-bold text-sm">
                ₹{retentionBonus.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5000}
              step={250}
              value={retentionBonus}
              onChange={e => setRetentionBonus(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>₹0 (None)</span>
              <span>Standard: ₹1,500</span>
              <span>₹5,000 / hire</span>
            </div>
          </div>
        </div>

        {/* Calculated Earnings Breakdown */}
        {simulatedRecruiter && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
              <div className="text-[11px] text-slate-400">Base Commission</div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ₹{simBaseEarned.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {joinedCount} joinings × ₹{basePayout.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
              <div className="text-[11px] text-slate-400">Milestone Tier Bonus</div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                +₹{simTierBonus.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Multiplier: {multiplier}x {joinedCount >= 8 ? '(Superstar Tier)' : joinedCount >= 5 ? '(Pro Tier)' : '(Standard)'}
              </div>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
              <div className="text-[11px] text-slate-400">Retention Allowance</div>
              <div className="text-lg font-bold font-mono text-indigo-300 mt-1">
                +₹{simRetentionEarned.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Paid after 30 days active service
              </div>
            </div>

            <div className="p-4 bg-emerald-950/70 rounded-xl border border-emerald-500/50">
              <div className="text-[11px] text-emerald-300 font-semibold">Total Projected Incentive</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                ₹{simTotalEarnings.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-emerald-300/80 mt-0.5 font-medium">
                +1 more joining jumps to ₹{simNextTotal.toLocaleString('en-IN')} (+₹{jumpDifference.toLocaleString('en-IN')})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span>Complete Recruiter Sprints & Efficiency Matrix</span>
          </h3>
          <span className="text-xs text-slate-400">{leaderboard.length} Active Recruiters</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4 text-center">Rank</th>
                <th className="py-3 px-4">Recruiter</th>
                <th className="py-3 px-4 text-center">Streak</th>
                <th className="py-3 px-4 text-center">Calls (Today)</th>
                <th className="py-3 px-4 text-center">Calls (Month)</th>
                <th className="py-3 px-4 text-center">Connected %</th>
                <th className="py-3 px-4 text-center">Lineups</th>
                <th className="py-3 px-4 text-center">Attended</th>
                <th className="py-3 px-4 text-center font-bold text-indigo-900">Joined</th>
                <th className="py-3 px-4 text-right">Incentive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map(u => (
                <tr key={u.userId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-center font-bold">
                    {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-[10px] text-slate-400">{u.teamName}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      <Flame className="w-3 h-3 text-amber-500" />
                      {u.streakDays}d
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-mono font-medium text-slate-800">{u.today.calls} / {u.today.targetCalls}</div>
                    <div className="text-[10px] text-slate-400">{u.today.targetAchievedPct}%</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-700">
                    {u.month.calls}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-medium text-slate-800">
                    {u.rates.connectionRatePct}%
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-semibold text-purple-700">
                    {u.month.interviews}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-700">
                    {u.month.attended}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 text-sm">
                    {u.month.joined}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{u.incentive.earnedTotal.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
