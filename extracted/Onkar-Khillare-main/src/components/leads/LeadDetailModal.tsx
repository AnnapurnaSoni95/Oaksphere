import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { PriorityBadge, StatusBadge, PhoneVerifyBadge } from '../common/Badge';
import { apiRequest, openWhatsApp, formatTimeAgo } from '../../lib/api';
import {
  Phone,
  MessageSquare,
  Clock,
  Calendar,
  Briefcase,
  User,
  History,
  FileText,
  CheckCircle,
  AlertCircle,
  Edit,
  ExternalLink,
  Award,
  Sparkles,
  MapPin,
  DollarSign,
  Keyboard,
  Radio,
} from 'lucide-react';
import { CallModal } from './CallModal';
import { TemplateDrawerModal } from './TemplateDrawerModal';
import { ScreeningScorecardModal } from './ScreeningScorecardModal';
import { SmartJobMatcherModal } from './SmartJobMatcherModal';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  onLeadUpdated: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  leadId,
  onLeadUpdated,
}) => {
  const [data, setData] = useState<{
    lead: any;
    activities: any[];
    calls: any[];
    interviews: any[];
    followups: any[];
    joinings: any[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'timeline' | 'calls' | 'interviews' | 'followups' | 'joining' | 'assignment' | 'scorecard'>('timeline');
  const [isCallingModalOpen, setIsCallingModalOpen] = useState<boolean>(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isScorecardModalOpen, setIsScorecardModalOpen] = useState<boolean>(false);
  const [isJobMatcherOpen, setIsJobMatcherOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Quick edit state
  const [editPriority, setEditPriority] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const fetchLeadDetails = async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const res = await apiRequest(`/api/leads/${leadId}`);
      setData(res);
      setEditPriority(res.lead.priority);
      setEditStatus(res.lead.leadStatus);
      setEditNotes(res.lead.notesSummary || '');
    } catch (err) {
      console.error('Failed to load lead details', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails();
      setIsEditing(false);
    } else {
      setData(null);
    }
  }, [isOpen, leadId]);

  if (!isOpen || !leadId) return null;

  const lead = data?.lead;

  const handleQuickUpdate = async () => {
    try {
      await apiRequest(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priority: editPriority,
          leadStatus: editStatus,
          notesSummary: editNotes,
        }),
      });
      setIsEditing(false);
      fetchLeadDetails();
      onLeadUpdated();
    } catch (e) {
      console.error('Failed to update lead', e);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={lead ? lead.candidateName : 'Candidate Profile'}
        subtitle={lead ? `Candidate ID: ${lead.id} • Assigned to: ${lead.assignedRecruiterName}` : ''}
        maxWidth="4xl"
      >
        {isLoading || !lead ? (
          <div className="py-16 text-center text-slate-500 text-xs">Loading candidate profile...</div>
        ) : (
          <div className="space-y-4">
            {/* Top Candidate Summary Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900">{lead.candidateName}</h4>
                  <PriorityBadge priority={lead.priority} />
                  <StatusBadge status={lead.leadStatus} />
                  <PhoneVerifyBadge status={lead.phoneStatus} />
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                  <span className="font-mono font-medium text-slate-800">📞 {lead.primaryPhone}</span>
                  {lead.alternatePhone && (
                    <span className="text-slate-500 font-mono">Alt: {lead.alternatePhone}</span>
                  )}
                  {lead.email && <span>✉️ {lead.email}</span>}
                  <span>📍 {lead.city}</span>
                  <span>💼 {lead.experience || 'Experience not specified'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiRequest('/api/call-bridge/dial', {
                        method: 'POST',
                        body: JSON.stringify({
                          leadId: lead.id,
                          candidateName: lead.candidateName,
                          phoneNumber: lead.primaryPhone,
                          simSlot: 'SIM_1',
                        }),
                      });
                    } catch (e) {
                      // ignore
                    }
                    setIsCallingModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Dial candidate via your phone physical SIM"
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-200 animate-pulse" /> SIM Call
                </button>
                <button
                  type="button"
                  onClick={() => setIsCallingModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Templates
                </button>
                <button
                  type="button"
                  onClick={() => setIsScorecardModalOpen(true)}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" /> Screening Fit
                </button>
                <button
                  type="button"
                  onClick={() => setIsJobMatcherOpen(true)}
                  className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Match Jobs
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" /> {isEditing ? 'Cancel Edit' : 'Edit Status'}
                </button>
              </div>
            </div>

            {/* Quick Edit Section (if toggled) */}
            {isEditing && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-3 text-xs">
                <div className="font-semibold text-indigo-900">Quick Edit Priority & Funnel Status</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 mb-1 font-medium">Priority Level</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                    >
                      <option value="Hot">Hot</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                      <option value="Cold">Cold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 font-medium">Lead Funnel Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                    >
                      <option value="New">New</option>
                      <option value="Calling">Calling</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Interested">Interested</option>
                      <option value="Interview Scheduled">Interview Scheduled</option>
                      <option value="Interview Attended">Interview Attended</option>
                      <option value="Selected">Selected</option>
                      <option value="Joining Scheduled">Joining Scheduled</option>
                      <option value="Joined">Joined</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Lost">Lost</option>
                      <option value="Invalid Number">Invalid Number</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Notes / Remarks</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                    placeholder="Update remarks..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuickUpdate}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                >
                  Save Updates
                </button>
              </div>
            )}

            {/* Candidate Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Hiring Client</span>
                <span className="font-semibold text-slate-800">{lead.clientName || 'Open / Unassigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Job Role</span>
                <span className="font-semibold text-slate-800">{lead.jobTitle || 'General'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Current Salary</span>
                <span className="font-semibold text-slate-800">{lead.currentSalary ? `₹${lead.currentSalary.toLocaleString()}/mo` : 'Fresher / NA'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Expected Salary</span>
                <span className="font-semibold text-slate-800">{lead.expectedSalary ? `₹${lead.expectedSalary.toLocaleString()}/mo` : 'Negotiable'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Notice Period</span>
                <span className="font-semibold text-slate-800">{lead.noticePeriod || 'Immediate'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Lead Source</span>
                <span className="font-semibold text-slate-800">{lead.leadSource}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Call Attempts</span>
                <span className="font-semibold text-slate-800">{lead.callAttempts || 0} calls</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Last Call Outcome</span>
                <span className="font-semibold text-slate-800">{lead.lastCallOutcome || 'Never Called'}</span>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-slate-200 flex gap-4 text-xs font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'timeline' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Activity Timeline ({data?.activities?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calls')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'calls' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <Phone className="w-3.5 h-3.5" /> Call Logs ({data?.calls?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('followups')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'followups' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Follow-ups ({data?.followups?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('interviews')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'interviews' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Interviews ({data?.interviews?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('joining')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'joining' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Joining Status ({data?.joinings?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scorecard')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'scorecard' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-500" /> Fit Scorecard {lead.scorecard ? `(${lead.scorecard.fitScore}%)` : ''}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assignment')}
                className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'assignment' ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent hover:text-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Ownership History
              </button>
            </div>

            {/* Tab Contents */}
            <div className="min-h-[220px] max-h-[350px] overflow-y-auto text-xs pr-1">
              {/* FIT SCORECARD */}
              {activeTab === 'scorecard' && (
                <div className="space-y-3">
                  {!lead.scorecard ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <Award className="w-8 h-8 text-amber-500 mx-auto" />
                      <div className="text-slate-700 font-semibold">Candidate Not Screened Yet</div>
                      <p className="text-slate-500 max-w-sm mx-auto">
                        Evaluate English communication, shift flexibility, commute radius, typing speed, and notice period in 60 seconds.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsScorecardModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm"
                      >
                        Start 60s Screening
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Scorecard Hero */}
                      <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Screening Fit Score</div>
                          <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                            {lead.scorecard.fitScore} / 100
                          </div>
                          <div className="text-xs font-semibold text-slate-200 mt-0.5">
                            Verdict: {lead.scorecard.overallVerdict}
                          </div>
                        </div>

                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => setIsScorecardModalOpen(true)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs"
                          >
                            Re-evaluate
                          </button>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Evaluated by {lead.scorecard.evaluatedByRecruiterName}
                          </div>
                        </div>
                      </div>

                      {/* Criteria Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase block">Communication</span>
                          <span className="font-semibold text-slate-800">{lead.scorecard.communicationLevel}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase block">Shift Availability</span>
                          <span className="font-semibold text-slate-800">{lead.scorecard.shiftAvailability}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase block">Commute Distance</span>
                          <span className="font-semibold text-slate-800">{lead.scorecard.commuteDistance}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase block">Notice Period</span>
                          <span className="font-semibold text-slate-800">
                            {lead.scorecard.noticePeriodDays === 0 ? 'Immediate' : `${lead.scorecard.noticePeriodDays} Days`}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase block">Typing Speed</span>
                          <span className="font-semibold text-slate-800 font-mono">
                            {lead.scorecard.typingSpeedWpm ? `${lead.scorecard.typingSpeedWpm} WPM` : 'Not tested'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase block">Expected CTC</span>
                          <span className="font-semibold text-slate-800 font-mono">
                            ₹{lead.scorecard.expectedCtcMonthly?.toLocaleString('en-IN') || '20,000'}/mo
                          </span>
                        </div>
                      </div>

                      {/* Dealbreakers if any */}
                      {lead.scorecard.dealbreakers && lead.scorecard.dealbreakers.length > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                          <div className="font-semibold mb-1 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Dealbreakers Noted:</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                            {lead.scorecard.dealbreakers.map((d: string, idx: number) => (
                              <li key={idx}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {lead.scorecard.recruiterRemarks && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <span className="font-semibold text-slate-700 block mb-0.5">Recruiter Observations:</span>
                          <p className="text-slate-600 italic">"{lead.scorecard.recruiterRemarks}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  {(!data?.activities || data.activities.length === 0) ? (
                    <div className="py-8 text-center text-slate-400">No activity logged yet.</div>
                  ) : (
                    data.activities.map(act => (
                      <div key={act.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md shrink-0 mt-0.5">
                          {act.type === 'call' ? <Phone className="w-3.5 h-3.5" /> :
                           act.type === 'interview' ? <Calendar className="w-3.5 h-3.5" /> :
                           act.type === 'joining' ? <CheckCircle className="w-3.5 h-3.5" /> :
                           <FileText className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{act.title}</span>
                            <span className="text-[11px] text-slate-400">{formatTimeAgo(act.createdAt)}</span>
                          </div>
                          <p className="text-slate-600 mt-1">{act.description}</p>
                          <div className="text-[11px] text-slate-400 mt-1">
                            By {act.performedBy.name} ({act.performedBy.role})
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* CALL LOGS */}
              {activeTab === 'calls' && (
                <div className="space-y-2">
                  {(!data?.calls || data.calls.length === 0) ? (
                    <div className="py-8 text-center text-slate-400">No call logs recorded. Use the "Call Candidate" button to place calls.</div>
                  ) : (
                    data.calls.map(call => (
                      <div key={call.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-indigo-700">{call.disposition}</span>
                            <span className="text-slate-400">• Duration: {call.durationSeconds}s</span>
                          </div>
                          {call.notes && <p className="text-slate-700 mt-1">"{call.notes}"</p>}
                          {call.followupDate && (
                            <div className="mt-1 text-amber-700 font-medium">
                              Callback requested for {call.followupDate} at {call.followupTime} ({call.followupReason})
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1">
                            Logged by {call.recruiterName} • {formatTimeAgo(call.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* FOLLOW-UPS */}
              {activeTab === 'followups' && (
                <div className="space-y-2">
                  {(!data?.followups || data.followups.length === 0) ? (
                    <div className="py-8 text-center text-slate-400">No follow-ups scheduled for this candidate.</div>
                  ) : (
                    data.followups.map(flw => (
                      <div key={flw.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {new Date(flw.scheduledAt).toLocaleString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              flw.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {flw.status}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">{flw.reason}</p>
                          <div className="text-[11px] text-slate-400 mt-1">Assigned to: {flw.recruiterName}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* INTERVIEWS */}
              {activeTab === 'interviews' && (
                <div className="space-y-2">
                  {(!data?.interviews || data.interviews.length === 0) ? (
                    <div className="py-8 text-center text-slate-400">No interviews scheduled yet.</div>
                  ) : (
                    data.interviews.map(int => (
                      <div key={int.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-purple-800 text-sm">
                            {int.clientName} - {int.jobTitle}
                          </span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[10px]">
                            {int.stage}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1 flex flex-wrap gap-3">
                          <span>📅 {int.date} at {int.time}</span>
                          <span>🏢 {int.interviewType}</span>
                          <span>📍 {int.location}</span>
                          <span>Confirmation: <strong className="text-indigo-600">{int.confirmationStatus}</strong></span>
                        </div>
                        {int.notes && <p className="text-slate-500 mt-1 italic text-[11px]">Notes: {int.notes}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* JOINING */}
              {activeTab === 'joining' && (
                <div className="space-y-2">
                  {(!data?.joinings || data.joinings.length === 0) ? (
                    <div className="py-8 text-center text-slate-400">Candidate not yet selected for joining.</div>
                  ) : (
                    data.joinings.map(join => (
                      <div key={join.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-teal-800">
                            {join.clientName} ({join.jobTitle})
                          </span>
                          <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 rounded font-bold text-xs">
                            {join.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Selection Date</span>
                            <span className="font-medium text-slate-700">{join.selectionDate}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Expected Joining</span>
                            <span className="font-bold text-indigo-700">{join.expectedJoiningDate || 'NOT SET (ACTION REQUIRED)'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Offered Salary</span>
                            <span className="font-medium text-slate-700">{join.offeredSalary ? `₹${join.offeredSalary.toLocaleString()}/mo` : 'Pending'}</span>
                          </div>
                        </div>
                        {join.remarks && <p className="text-slate-600 mt-2 text-[11px]">Remarks: {join.remarks}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ASSIGNMENT HISTORY */}
              {activeTab === 'assignment' && (
                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 mb-2">
                    <span className="text-slate-500 block text-[11px]">Original Recruiter</span>
                    <span className="font-semibold text-slate-800">{lead.originalRecruiterName || 'Unassigned'}</span>
                  </div>
                  <div className="p-2.5 bg-indigo-50 rounded border border-indigo-200 mb-2">
                    <span className="text-indigo-600 block text-[11px]">Current Recruiter Owner</span>
                    <span className="font-semibold text-indigo-900">{lead.assignedRecruiterName || 'Unassigned'}</span>
                  </div>
                  <h5 className="font-semibold text-slate-700 mt-3 mb-1">Reassignment History</h5>
                  {(!lead.assignmentHistory || lead.assignmentHistory.length === 0) ? (
                    <div className="text-slate-400 py-3">No reassignment history.</div>
                  ) : (
                    lead.assignmentHistory.map((asg: any) => (
                      <div key={asg.id} className="p-2 border border-slate-200 rounded bg-white text-[11px]">
                        <div className="flex items-center justify-between font-medium text-slate-800">
                          <span>Assigned to: {asg.assignedToName}</span>
                          <span className="text-slate-400">{new Date(asg.assignedAt).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Assigned by: {asg.assignedByName} • Reason: {asg.reason || 'General distribution'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Embedded Calling Workspace Modal */}
      {lead && (
        <CallModal
          isOpen={isCallingModalOpen}
          onClose={() => setIsCallingModalOpen(false)}
          lead={lead}
          onCallLogged={() => {
            fetchLeadDetails();
            onLeadUpdated();
          }}
        />
      )}

      {/* Auxiliary Modals */}
      {isTemplateModalOpen && lead && (
        <TemplateDrawerModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          lead={lead}
        />
      )}

      {isScorecardModalOpen && lead && (
        <ScreeningScorecardModal
          isOpen={isScorecardModalOpen}
          onClose={() => setIsScorecardModalOpen(false)}
          lead={lead}
          onScorecardSaved={() => {
            fetchLeadDetails();
            onLeadUpdated();
          }}
        />
      )}

      {isJobMatcherOpen && lead && (
        <SmartJobMatcherModal
          isOpen={isJobMatcherOpen}
          onClose={() => setIsJobMatcherOpen(false)}
          lead={lead}
          onJobAssigned={() => {
            fetchLeadDetails();
            onLeadUpdated();
          }}
          onScheduleInterview={() => {
            setIsCallingModalOpen(true);
          }}
        />
      )}
    </>
  );
};
