import React, { useState, useEffect } from 'react';
import { apiRequest, openWhatsApp } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  Clock,
  PhoneCall,
  Calendar,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Phone,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { CallModal } from '../components/leads/CallModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';

export const MyDayPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<any | null>(null);
  const [selectedLeadIdForDetail, setSelectedLeadIdForDetail] = useState<string | null>(null);

  const fetchMyDay = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/my-day');
      setData(res);
    } catch (e) {
      console.error('Failed to load My Day data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDay();
  }, [user]);

  if (isLoading || !data) {
    return <div className="p-8 text-center text-slate-500 text-xs">Loading your daily workspace tasks...</div>;
  }

  const { overdueFollowups, todayFollowups, interviewsNeedingConfirmation, pendingAttendance, upcomingJoinings, progress } = data;

  const handleConfirmInterview = async (interviewId: string) => {
    try {
      await apiRequest(`/api/interviews/${interviewId}/confirmation`, {
        method: 'PATCH',
        body: JSON.stringify({ confirmationStatus: 'Confirmed' }),
      });
      fetchMyDay();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkFollowupComplete = async (followupId: string) => {
    try {
      await apiRequest(`/api/followups/${followupId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Completed from My Day task list' }),
      });
      fetchMyDay();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto text-xs">
      {/* Header & Daily Progress */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                Daily Recruiter Flight Deck
              </span>
              <span className="text-slate-400 text-xs">• {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <h1 className="text-xl font-bold mt-1">My Day — What should I do next?</h1>
            <p className="text-slate-300 text-xs mt-0.5">
              Execute prioritized operational steps to ensure zero candidate drop-off and achieve daily call & lineup goals.
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15 min-w-[240px]">
            <div className="flex items-center justify-between font-semibold mb-1.5">
              <span>Task Completion</span>
              <span className="text-emerald-400 font-bold text-sm">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-slate-300 mt-1 flex justify-between">
              <span>{progress.completed} of {progress.total} critical actions cleared</span>
              <span>{progress.total - progress.completed} remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: Overdue Follow-ups (HIGHEST PRIORITY) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-rose-50/80 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
            <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">1</span>
            <span>Clear Overdue Follow-ups ({overdueFollowups.length})</span>
          </div>
          <span className="text-[11px] text-rose-700 font-medium">Urgent: Candidates waiting past scheduled time</span>
        </div>

        <div className="p-4">
          {overdueFollowups.length === 0 ? (
            <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Great job! No overdue follow-ups on your desk.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdueFollowups.map((flw: any) => (
                <div key={flw.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{flw.candidateName}</span>
                      <PriorityBadge priority={flw.priority} />
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        {flw.overdueLabel}
                      </span>
                    </div>
                    <div className="text-slate-600 flex items-center gap-3 text-xs">
                      <span>📞 {flw.candidatePhone}</span>
                      <span>Scheduled: {new Date(flw.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="italic text-slate-500">"{flw.reason}"</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadForCall({
                        id: flw.leadId,
                        candidateName: flw.candidateName,
                        primaryPhone: flw.candidatePhone,
                        city: '',
                        priority: flw.priority,
                        leadStatus: 'Follow-up',
                      })}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-md flex items-center gap-1.5 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Now
                    </button>
                    <button
                      type="button"
                      onClick={() => openWhatsApp(flw.candidatePhone, `Hi ${flw.candidateName}, following up regarding your recruitment discussion.`)}
                      className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkFollowupComplete(flw.id)}
                      className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: Today's Follow-ups */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
            <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">2</span>
            <span>Complete Today's Follow-ups ({todayFollowups.length})</span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Scheduled callbacks for today</span>
        </div>

        <div className="p-4">
          {todayFollowups.length === 0 ? (
            <div className="py-4 text-center text-slate-400">No remaining follow-ups scheduled for today.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todayFollowups.map((flw: any) => (
                <div key={flw.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{flw.candidateName}</span>
                      <PriorityBadge priority={flw.priority} />
                      <span className="text-slate-500 font-mono">
                        ⏰ {new Date(flw.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">Reason: {flw.reason}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadForCall({
                        id: flw.leadId,
                        candidateName: flw.candidateName,
                        primaryPhone: flw.candidatePhone,
                        city: '',
                        priority: flw.priority,
                        leadStatus: 'Follow-up',
                      })}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkFollowupComplete(flw.id)}
                      className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md font-medium"
                    >
                      Mark Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STEP 3: Confirm Tomorrow's / Today's Interviews */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">3</span>
            <span>Confirm Interview Attendance ({interviewsNeedingConfirmation.length})</span>
          </div>
          <span className="text-[11px] text-purple-700 font-medium">Prevent candidate no-shows</span>
        </div>

        <div className="p-4">
          {interviewsNeedingConfirmation.length === 0 ? (
            <div className="py-4 text-center text-slate-400">All scheduled interviews confirmed!</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {interviewsNeedingConfirmation.map((int: any) => (
                <div key={int.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{int.candidateName}</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[10px]">
                        {int.stage} at {int.time}
                      </span>
                      <span className="text-rose-600 font-semibold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Confirmation: {int.confirmationStatus}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Client: <strong>{int.clientName}</strong> ({int.jobTitle}) • Location: {int.location}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmInterview(int.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Confirm Attendance
                    </button>
                    <button
                      type="button"
                      onClick={() => openWhatsApp(int.candidatePhone, `Hi ${int.candidateName}, reminding you of your interview with ${int.clientName} on ${int.date} at ${int.time} at ${int.location}. Please confirm attendance.`)}
                      className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Send Reminder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STEP 4: Confirm Upcoming Joinings */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-teal-50/80 border-b border-teal-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
            <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">4</span>
            <span>Upcoming Joinings Verification ({upcomingJoinings.length})</span>
          </div>
          <span className="text-[11px] text-teal-700 font-medium">Verify joining reporting and documents</span>
        </div>

        <div className="p-4">
          {upcomingJoinings.length === 0 ? (
            <div className="py-4 text-center text-slate-400">No joinings scheduled for next 3 days.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingJoinings.map((join: any) => (
                <div key={join.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{join.candidateName}</span>
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded font-semibold text-[10px]">
                        Joining: {join.expectedJoiningDate}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Company: <strong>{join.clientName}</strong> • Role: {join.jobTitle} • CTC: ₹{join.offeredSalary ? join.offeredSalary.toLocaleString() : 'N/A'}/mo
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openWhatsApp(join.candidatePhone, `Hi ${join.candidateName}, wishing you all the best for your joining at ${join.clientName} on ${join.expectedJoiningDate}! Please carry your documents.`)}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Check-in on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLeadIdForDetail(join.leadId)}
                      className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Embedded Modals */}
      {selectedLeadForCall && (
        <CallModal
          isOpen={!!selectedLeadForCall}
          onClose={() => setSelectedLeadForCall(null)}
          lead={selectedLeadForCall}
          onCallLogged={fetchMyDay}
        />
      )}

      {selectedLeadIdForDetail && (
        <LeadDetailModal
          isOpen={!!selectedLeadIdForDetail}
          onClose={() => setSelectedLeadIdForDetail(null)}
          leadId={selectedLeadIdForDetail}
          onLeadUpdated={fetchMyDay}
        />
      )}
    </div>
  );
};
