import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiRequest, openWhatsApp } from '../../lib/api';
import { Phone, MessageSquare, Clock, Calendar, Briefcase, Building, CheckCircle2, AlertTriangle, Sparkles, Award, Radio } from 'lucide-react';
import { TemplateDrawerModal } from './TemplateDrawerModal';
import { ScreeningScorecardModal } from './ScreeningScorecardModal';
import { SmartJobMatcherModal } from './SmartJobMatcherModal';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    candidateName: string;
    primaryPhone: string;
    city: string;
    clientId?: string;
    clientName?: string;
    jobId?: string;
    jobTitle?: string;
    priority: string;
    leadStatus: string;
    notesSummary?: string;
  } | null;
  onCallLogged: () => void;
}

const DISPOSITIONS = [
  'Connected – Interested',
  'Callback',
  'Interview Scheduled',
  'Call Back Later',
  'No Answer',
  'Busy',
  'Switched Off',
  'Unreachable',
  'WhatsApp Only',
  'Not Interested',
  'Salary Issue',
  'Location Issue',
  'Job Mismatch',
  'Already Working',
  'Invalid Number',
];

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  lead,
  onCallLogged,
}) => {
  const [disposition, setDisposition] = useState<string>('Connected – Interested');
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  
  // Conditional fields
  const [followupDate, setFollowupDate] = useState<string>('');
  const [followupTime, setFollowupTime] = useState<string>('14:00');
  const [followupReason, setFollowupReason] = useState<string>('');

  const [interviewDate, setInterviewDate] = useState<string>('');
  const [interviewTime, setInterviewTime] = useState<string>('11:00');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [interviewType, setInterviewType] = useState<string>('Face-to-face');
  const [interviewLocation, setInterviewLocation] = useState<string>('');

  const [expectedJoiningDate, setExpectedJoiningDate] = useState<string>('');
  const [lostReason, setLostReason] = useState<string>('');

  const [clients, setClients] = useState<Array<{ id: string; companyName: string; location: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; clientId: string; positionTitle: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isScorecardModalOpen, setIsScorecardModalOpen] = useState<boolean>(false);
  const [isJobMatcherOpen, setIsJobMatcherOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      setFollowupDate(today);
      setInterviewDate(tomorrow);
      setFollowupReason('Candidate requested callback for detailed discussion');
      setLostReason('');
      setNotes('');
      setDisposition('Connected – Interested');

      // Fetch clients and jobs for interview selection
      apiRequest<{ clients: any[] }>('/api/clients').then(res => setClients(res.clients)).catch(() => {});
      apiRequest<{ jobs: any[] }>('/api/jobs').then(res => setJobs(res.jobs)).catch(() => {});

      if (lead) {
        if (lead.clientId) setSelectedClient(lead.clientId);
        if (lead.jobId) setSelectedJob(lead.jobId);
      }
    }
  }, [isOpen, lead]);

  if (!lead) return null;

  const handleLaunchWhatsApp = () => {
    const text = `Hi ${lead.candidateName}, this is regarding your job application with OAKsphere Connect for the ${lead.jobTitle || 'recruitment'} opportunity. Are you available for a quick discussion?`;
    openWhatsApp(lead.primaryPhone, text);
  };

  const handleLaunchTel = () => {
    window.location.href = `tel:${lead.primaryPhone}`;
  };

  const [isSimCalling, setIsSimCalling] = useState<boolean>(false);
  const [simCallFeedback, setSimCallFeedback] = useState<string | null>(null);

  const handleTriggerSimCall = async () => {
    setIsSimCalling(true);
    setSimCallFeedback(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/call-bridge/dial', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead.id,
          candidateName: lead.candidateName,
          phoneNumber: lead.primaryPhone,
          simSlot: 'SIM_1',
        }),
      });
      setSimCallFeedback(res.message || 'Call command sent to mobile phone SIM!');
    } catch (e: any) {
      setSimCallFeedback(`SIM bridge error: ${e.message || 'Failed to trigger SIM call'}`);
    } finally {
      setIsSimCalling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // --- Strict Frontend Conditional Validations matching Server-side rules ---
    if (disposition === 'Callback' || disposition === 'Call Back Later') {
      if (!followupDate || !followupTime || !followupReason.trim()) {
        setErrorMsg('Please specify Follow-up Date, Time, and Reason for callback.');
        return;
      }
    }

    if (disposition === 'Interview Scheduled') {
      if (!interviewDate || !interviewTime || !selectedClient || !selectedJob) {
        setErrorMsg('Please provide Interview Date, Time, Client, and Job.');
        return;
      }
    }

    if (['Not Interested', 'Salary Issue', 'Location Issue', 'Job Mismatch'].includes(disposition)) {
      if (!lostReason.trim() && !notes.trim()) {
        setErrorMsg(`Please specify why candidate is ${disposition} to prevent candidate leakage.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/calls', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead.id,
          disposition,
          durationSeconds,
          notes,
          followupDate: (disposition === 'Callback' || disposition === 'Call Back Later') ? followupDate : undefined,
          followupTime: (disposition === 'Callback' || disposition === 'Call Back Later') ? followupTime : undefined,
          followupReason: (disposition === 'Callback' || disposition === 'Call Back Later') ? followupReason : undefined,
          interviewDate: disposition === 'Interview Scheduled' ? interviewDate : undefined,
          interviewTime: disposition === 'Interview Scheduled' ? interviewTime : undefined,
          clientId: disposition === 'Interview Scheduled' ? selectedClient : undefined,
          jobId: disposition === 'Interview Scheduled' ? selectedJob : undefined,
          interviewType: disposition === 'Interview Scheduled' ? interviewType : undefined,
          interviewLocation: disposition === 'Interview Scheduled' ? interviewLocation : undefined,
          expectedJoiningDate: expectedJoiningDate || undefined,
          lostReason: lostReason || undefined,
        }),
      });

      onCallLogged();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record call');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredJobs = selectedClient ? jobs.filter(j => j.clientId === selectedClient) : jobs;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Calling Workspace: ${lead.candidateName}`}
      subtitle={`Phone: ${lead.primaryPhone} • City: ${lead.city} • Current Status: ${lead.leadStatus}`}
      maxWidth="2xl"
    >
      {/* Quick Dial & WhatsApp Header Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerSimCall}
            disabled={isSimCalling}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
            title="Dial candidate using your paired smartphone physical SIM"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
            <span>{isSimCalling ? 'Triggering...' : 'Dial via Phone SIM'}</span>
          </button>
          <button
            type="button"
            onClick={handleLaunchTel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> Direct Tel
          </button>
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Templates
          </button>
          <button
            type="button"
            onClick={() => setIsScorecardModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-xs font-medium transition-colors"
          >
            <Award className="w-3.5 h-3.5 text-amber-600" /> Screening Fit
          </button>
          <button
            type="button"
            onClick={() => setIsJobMatcherOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-md text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Match Jobs
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Target Role: <span className="font-semibold text-slate-800">{lead.jobTitle || 'General Application'}</span>
        </div>
      </div>

      {simCallFeedback && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
            <span className="font-medium">{simCallFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setSimCallFeedback(null)}
            className="text-xs text-indigo-700 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Call Disposition selection */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">
            Call Outcome / Disposition <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {DISPOSITIONS.map(d => {
              const isSelected = disposition === d;
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDisposition(d)}
                  className={`px-2.5 py-2 text-left rounded-md border text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-slate-600 mb-1">Call Duration (seconds)</label>
            <input
              type="number"
              min="0"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 text-xs"
              placeholder="e.g. 120"
            />
          </div>
        </div>

        {/* CONDITIONAL SECTION 1: Callback / Follow-up */}
        {(disposition === 'Callback' || disposition === 'Call Back Later') && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Schedule Mandatory Follow-up Call</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-amber-900 mb-1 font-medium">Follow-up Date *</label>
                <input
                  type="date"
                  required
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-amber-300 rounded-md bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-amber-900 mb-1 font-medium">Follow-up Time *</label>
                <input
                  type="time"
                  required
                  value={followupTime}
                  onChange={(e) => setFollowupTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-amber-300 rounded-md bg-white text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-amber-900 mb-1 font-medium">Reason for Follow-up *</label>
              <input
                type="text"
                required
                value={followupReason}
                onChange={(e) => setFollowupReason(e.target.value)}
                placeholder="e.g. Candidate in metro, asked to call back after 3 PM"
                className="w-full px-2.5 py-1.5 border border-amber-300 rounded-md bg-white text-xs"
              />
            </div>
          </div>
        )}

        {/* CONDITIONAL SECTION 2: Interview Scheduled */}
        {disposition === 'Interview Scheduled' && (
          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-purple-900">
              <Calendar className="w-4 h-4 text-purple-700" />
              <span>Schedule Candidate Interview</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-purple-900 mb-1 font-medium">Hiring Client *</label>
                <select
                  required
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-md bg-white text-xs"
                >
                  <option value="">-- Select Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-purple-900 mb-1 font-medium">Job Opening *</label>
                <select
                  required
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-md bg-white text-xs"
                >
                  <option value="">-- Select Position --</option>
                  {filteredJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.positionTitle}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-purple-900 mb-1 font-medium">Interview Date *</label>
                <input
                  type="date"
                  required
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-md bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-purple-900 mb-1 font-medium">Interview Time *</label>
                <input
                  type="time"
                  required
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-md bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-purple-900 mb-1 font-medium">Mode</label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-md bg-white text-xs"
                >
                  <option value="Face-to-face">Face-to-face / Walk-in</option>
                  <option value="Virtual">Virtual / Video Call</option>
                  <option value="Telephonic">Telephonic</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-purple-900 mb-1 font-medium">Interview Location / Link</label>
              <input
                type="text"
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="e.g. Hinjewadi Phase 3 Office / Google Meet Link"
                className="w-full px-2.5 py-1.5 border border-purple-300 rounded-md bg-white text-xs"
              />
            </div>
          </div>
        )}

        {/* CONDITIONAL SECTION 3: Lost / Not Interested */}
        {['Not Interested', 'Salary Issue', 'Location Issue', 'Job Mismatch', 'Already Working'].includes(disposition) && (
          <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg">
            <label className="block text-red-900 font-semibold mb-1">
              Candidate Drop-off Reason * (Mandatory for Funnel Leakage Auditing)
            </label>
            <input
              type="text"
              required
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Expecting ₹35k, client budget is max ₹25k; or distance too far"
              className="w-full px-2.5 py-1.5 border border-red-300 rounded-md bg-white text-xs"
            />
          </div>
        )}

        {/* Recruiter Notes */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Call Notes & Candidate Feedback</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add relevant notes (spoken English level, willingness for night shift, current CTC verification...)"
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 text-xs"
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'Recording Call...' : 'Save Call & Update Funnel'}
          </button>
        </div>
      </form>

      {/* Auxiliary Modals */}
      {isTemplateModalOpen && (
        <TemplateDrawerModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          lead={lead}
        />
      )}

      {isScorecardModalOpen && (
        <ScreeningScorecardModal
          isOpen={isScorecardModalOpen}
          onClose={() => setIsScorecardModalOpen(false)}
          lead={lead as any}
          onScorecardSaved={() => {
            onCallLogged();
          }}
        />
      )}

      {isJobMatcherOpen && (
        <SmartJobMatcherModal
          isOpen={isJobMatcherOpen}
          onClose={() => setIsJobMatcherOpen(false)}
          lead={lead as any}
          onJobAssigned={() => {
            onCallLogged();
          }}
          onScheduleInterview={(matchedJob) => {
            setSelectedJob(matchedJob.id);
            setSelectedClient(matchedJob.clientId);
            setDisposition('Interview Scheduled');
          }}
        />
      )}
    </Modal>
  );
};
