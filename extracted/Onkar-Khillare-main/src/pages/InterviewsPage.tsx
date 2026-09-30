import React, { useState, useEffect } from 'react';
import { apiRequest, openWhatsApp } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle,
  XCircle,
  Building,
  User,
  Filter,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const InterviewsPage: React.FC = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Result recording modal
  const [resultItem, setResultItem] = useState<any | null>(null);
  const [selectedResultStage, setSelectedResultStage] = useState<string>('Attended');
  const [resultNotes, setResultNotes] = useState<string>('');
  const [expectedJoiningDate, setExpectedJoiningDate] = useState<string>('');
  const [offeredSalary, setOfferedSalary] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchInterviews = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/interviews');
      setInterviews(res.interviews || []);
    } catch (e) {
      console.error('Failed to load interviews', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [user]);

  const handleUpdateConfirmation = async (id: string, confirmationStatus: string) => {
    try {
      await apiRequest(`/api/interviews/${id}/confirmation`, {
        method: 'PATCH',
        body: JSON.stringify({ confirmationStatus }),
      });
      fetchInterviews();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultItem) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/interviews/${resultItem.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage: selectedResultStage,
          resultNotes,
          expectedJoiningDate: selectedResultStage === 'Selected' ? expectedJoiningDate : undefined,
          offeredSalary: selectedResultStage === 'Selected' ? Number(offeredSalary) : undefined,
        }),
      });
      setResultItem(null);
      fetchInterviews();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInterviews = interviews.filter(i => {
    if (stageFilter === 'today') return i.stage === 'Today';
    if (stageFilter === 'tomorrow') return i.stage === 'Tomorrow';
    if (stageFilter === 'selected') return i.stage === 'Selected';
    if (stageFilter === 'attended') return i.stage === 'Attended';
    if (stageFilter === 'scheduled') return ['Scheduled', 'Today', 'Tomorrow'].includes(i.stage);
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Interview Lineup Management
            </h1>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-bold text-[10px]">
              {interviews.length} Scheduled Lineups
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Track interview attendance, confirm candidate presence, and transition selections to the joining pipeline.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Interviews' },
            { id: 'today', label: "Today's Lineups" },
            { id: 'tomorrow', label: "Tomorrow's Lineups" },
            { id: 'scheduled', label: 'All Scheduled' },
            { id: 'attended', label: 'Attended' },
            { id: 'selected', label: '★ Selected' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStageFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                stageFilter === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interviews Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Client & Job Opening</th>
                <th className="py-2.5 px-3">Date, Time & Mode</th>
                <th className="py-2.5 px-3">Location / Link</th>
                <th className="py-2.5 px-3">Stage / Result</th>
                <th className="py-2.5 px-3">Attendance Confirmation</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading interviews...</td>
                </tr>
              ) : filteredInterviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No interviews found for this view.
                  </td>
                </tr>
              ) : (
                filteredInterviews.map((int: any) => (
                  <tr key={int.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Candidate */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{int.candidateName}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{int.candidatePhone}</div>
                      <div className="text-[10px] text-slate-400">Recruiter: {int.recruiterName}</div>
                    </td>

                    {/* Client & Job */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">{int.clientName}</div>
                      <div className="text-slate-500 text-[11px]">{int.jobTitle}</div>
                    </td>

                    {/* Date & Time */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-purple-900">{int.date} at {int.time}</div>
                      <div className="text-slate-500 text-[11px]">{int.interviewType}</div>
                    </td>

                    {/* Location */}
                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-700" title={int.location}>
                      {int.location}
                    </td>

                    {/* Stage / Result */}
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        int.stage === 'Selected' ? 'bg-teal-100 text-teal-800' :
                        int.stage === 'Attended' ? 'bg-indigo-100 text-indigo-800' :
                        int.stage === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                        int.stage === 'Today' ? 'bg-amber-100 text-amber-800' :
                        int.stage === 'Tomorrow' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {int.stage}
                      </span>
                    </td>

                    {/* Confirmation */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          int.confirmationStatus === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : int.confirmationStatus === 'Reschedule Requested'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {int.confirmationStatus}
                        </span>

                        {int.confirmationStatus !== 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateConfirmation(int.id, 'Confirmed')}
                            className="p-1 hover:bg-emerald-50 text-emerald-600 rounded transition-colors"
                            title="Confirm Attendance"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResultItem(int);
                            setSelectedResultStage(int.stage === 'Scheduled' || int.stage === 'Today' || int.stage === 'Tomorrow' ? 'Attended' : int.stage);
                            setResultNotes(int.notes || '');
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded text-xs transition-colors"
                        >
                          Update Result
                        </button>
                        <button
                          type="button"
                          onClick={() => openWhatsApp(int.candidatePhone, `Hi ${int.candidateName}, interview reminder for ${int.jobTitle} with ${int.clientName} on ${int.date} at ${int.time}. Location: ${int.location}.`)}
                          className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded"
                          title="WhatsApp Reminder"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Result Recording Modal */}
      {resultItem && (
        <Modal
          isOpen={!!resultItem}
          onClose={() => setResultItem(null)}
          title={`Update Interview Status: ${resultItem.candidateName}`}
          subtitle={`Client: ${resultItem.clientName} • Job: ${resultItem.jobTitle}`}
          maxWidth="lg"
        >
          <form onSubmit={handleResultSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Interview Outcome / Stage *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'Attended', label: 'Attended Round' },
                  { id: 'Selected', label: '★ Selected (Offer)' },
                  { id: 'Not Attended', label: 'Not Attended (No Show)' },
                  { id: 'Rejected', label: 'Client Rejected' },
                  { id: 'Rescheduled', label: 'Rescheduled' },
                  { id: 'Dropped', label: 'Candidate Dropped' },
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setSelectedResultStage(opt.id)}
                    className={`px-2.5 py-2 rounded-lg border text-left font-medium transition-all ${
                      selectedResultStage === opt.id
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-500 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* If Selected, prompt for expected joining date and CTC */}
            {selectedResultStage === 'Selected' && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg space-y-3">
                <div className="font-bold text-teal-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-teal-600" />
                  <span>Candidate Selected! Add to Joining Pipeline</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-teal-900 mb-1 font-medium">Expected Joining Date *</label>
                    <input
                      type="date"
                      required
                      value={expectedJoiningDate}
                      onChange={(e) => setExpectedJoiningDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-teal-300 rounded-md bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-teal-900 mb-1 font-medium">Offered Salary (₹/month)</label>
                    <input
                      type="number"
                      value={offeredSalary}
                      onChange={(e) => setOfferedSalary(e.target.value)}
                      placeholder="e.g. 35000"
                      className="w-full px-2.5 py-1.5 border border-teal-300 rounded-md bg-white text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Feedback & Interview Notes</label>
              <textarea
                rows={3}
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                placeholder="Enter client round feedback, interviewer remarks, reason for rejection or selection..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setResultItem(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save & Cascade Funnel'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
