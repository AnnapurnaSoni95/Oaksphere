import React, { useState, useEffect } from 'react';
import { apiRequest, openWhatsApp } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Phone,
  MessageSquare,
  CheckCircle,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
} from 'lucide-react';
import { PriorityBadge } from '../components/common/Badge';
import { CallModal } from '../components/leads/CallModal';
import { Modal } from '../components/common/Modal';

export const FollowupsPage: React.FC = () => {
  const { user } = useAuth();
  const [followups, setFollowups] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'upcoming' | 'completed'>('overdue');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Actions
  const [callingLead, setCallingLead] = useState<any | null>(null);
  const [rescheduleItem, setRescheduleItem] = useState<any | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('14:00');
  const [newReason, setNewReason] = useState<string>('');

  const fetchFollowups = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/followups');
      setFollowups(res.followups || []);
    } catch (e) {
      console.error('Failed to load follow-ups', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, [user]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const overdueList = followups.filter(f => f.status === 'PENDING' && f.isOverdue);
  const todayList = followups.filter(f => f.status === 'PENDING' && f.isToday && !f.isOverdue);
  const upcomingList = followups.filter(f => f.status === 'PENDING' && !f.isToday && !f.isOverdue && new Date(f.scheduledAt) > now);
  const completedList = followups.filter(f => f.status === 'COMPLETED');

  const currentList =
    activeTab === 'overdue'
      ? overdueList
      : activeTab === 'today'
      ? todayList
      : activeTab === 'upcoming'
      ? upcomingList
      : completedList;

  const handleComplete = async (id: string) => {
    try {
      await apiRequest(`/api/followups/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Follow-up resolved by recruiter' }),
      });
      fetchFollowups();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleItem) return;
    try {
      await apiRequest(`/api/followups/${rescheduleItem.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          newDate,
          newTime,
          reason: newReason,
        }),
      });
      setRescheduleItem(null);
      fetchFollowups();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Follow-up Engine & Escalations
            </h1>
            {overdueList.length > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px] animate-pulse">
                {overdueList.length} Overdue
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Aging calculations and auto-escalation to ensure zero recruiter forgetfulness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">
            Overdue Escalation Threshold: <strong>4h to Team Leader</strong>, <strong>24h to Admin</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Overdue ({overdueList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'today'
              ? 'bg-amber-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Today's Scheduled ({todayList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'upcoming'
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Upcoming ({upcomingList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" /> Completed ({completedList.length})
        </button>
      </div>

      {/* Follow-ups List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Contact Number</th>
                <th className="py-2.5 px-3">Scheduled Time & Aging</th>
                <th className="py-2.5 px-3">Follow-up Reason</th>
                <th className="py-2.5 px-3">Recruiter / Team</th>
                <th className="py-2.5 px-3">Escalation Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading follow-ups...</td>
                </tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No follow-ups in this tab.
                  </td>
                </tr>
              ) : (
                currentList.map((flw: any) => (
                  <tr key={flw.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{flw.candidateName}</div>
                      <PriorityBadge priority={flw.priority} />
                    </td>

                    <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                      {flw.candidatePhone}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">
                        {new Date(flw.scheduledAt).toLocaleString()}
                      </div>
                      {flw.isOverdue && (
                        <div className="font-black text-rose-600 text-[10px] mt-0.5">
                          {flw.overdueLabel}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-slate-700 max-w-sm">
                      {flw.reason}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{flw.recruiterName}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      {flw.escalatedToTL ? (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-200">
                          🚨 Escalated to TL
                        </span>
                      ) : flw.isOverdue ? (
                        <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-amber-100 text-amber-800">
                          Pending Escalation
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Normal</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {flw.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setCallingLead({
                                id: flw.leadId,
                                candidateName: flw.candidateName,
                                primaryPhone: flw.candidatePhone,
                                city: '',
                                priority: flw.priority,
                                leadStatus: 'Follow-up',
                              })}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold flex items-center gap-1 shadow-xs"
                              title="Call Candidate"
                            >
                              <Phone className="w-3 h-3" /> Call
                            </button>
                            <button
                              type="button"
                              onClick={() => openWhatsApp(flw.candidatePhone, `Hi ${flw.candidateName}, following up regarding our earlier discussion.`)}
                              className="p-1 bg-green-600 hover:bg-green-700 text-white rounded"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleItem(flw);
                                setNewDate(todayStr);
                                setNewReason(flw.reason);
                              }}
                              className="p-1 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded"
                              title="Reschedule"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleComplete(flw.id)}
                              className="px-2 py-1 border border-slate-300 hover:bg-emerald-50 text-emerald-700 rounded font-medium"
                              title="Mark Complete"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {flw.status === 'COMPLETED' && (
                          <span className="text-emerald-600 font-semibold text-[11px]">✓ Cleared</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleItem && (
        <Modal
          isOpen={!!rescheduleItem}
          onClose={() => setRescheduleItem(null)}
          title={`Reschedule Follow-up: ${rescheduleItem.candidateName}`}
          subtitle="Set a new date and time with updated notes"
          maxWidth="md"
        >
          <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 mb-1 font-medium">New Follow-up Date *</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">New Follow-up Time *</label>
              <input
                type="time"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Reason for Rescheduling</label>
              <input
                type="text"
                required
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleItem(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 text-white font-semibold rounded-md shadow-xs"
              >
                Update Schedule
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Calling Modal */}
      {callingLead && (
        <CallModal
          isOpen={!!callingLead}
          onClose={() => setCallingLead(null)}
          lead={callingLead}
          onCallLogged={fetchFollowups}
        />
      )}
    </div>
  );
};
