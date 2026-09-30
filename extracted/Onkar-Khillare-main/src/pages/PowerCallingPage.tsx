import React, { useState, useEffect } from 'react';
import { apiRequest, openWhatsApp } from '../lib/api';
import { Lead, Job } from '../lib/types';
import {
  Zap,
  Phone,
  PhoneCall,
  Clock,
  MessageSquare,
  Sparkles,
  Award,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
  Building,
  Radio,
} from 'lucide-react';
import { TemplateDrawerModal } from '../components/leads/TemplateDrawerModal';
import { ScreeningScorecardModal } from '../components/leads/ScreeningScorecardModal';
import { SmartJobMatcherModal } from '../components/leads/SmartJobMatcherModal';

export const PowerCallingPage: React.FC = () => {
  const [queue, setQueue] = useState<Lead[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Live Call Timer
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Session counters
  const [sessionCompletedCalls, setSessionCompletedCalls] = useState<number>(0);
  const [sessionConnected, setSessionConnected] = useState<number>(0);
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastDispositionToast, setLastDispositionToast] = useState<string | null>(null);
  const [isSimCalling, setIsSimCalling] = useState<boolean>(false);

  // Auxiliary modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isScorecardModalOpen, setIsScorecardModalOpen] = useState<boolean>(false);
  const [isJobMatcherOpen, setIsJobMatcherOpen] = useState<boolean>(false);

  const handleSimBridgeDial = async () => {
    if (!currentLead) return;
    setIsSimCalling(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/call-bridge/dial', {
        method: 'POST',
        body: JSON.stringify({
          leadId: currentLead.id,
          candidateName: currentLead.candidateName,
          phoneNumber: currentLead.primaryPhone,
          simSlot: 'SIM_1',
        }),
      });
      setLastDispositionToast(res.message || `Phone SIM calling ${currentLead.candidateName}...`);
      setTimeout(() => setLastDispositionToast(null), 4000);
      setTimerSeconds(0);
      setIsTimerRunning(true);
    } catch (e: any) {
      setLastDispositionToast(`SIM Bridge error: ${e.message}`);
      setTimeout(() => setLastDispositionToast(null), 3000);
    } finally {
      setIsSimCalling(false);
    }
  };

  // Fetch queue
  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ leads: Lead[] }>('/api/calling-queue?limit=40');
      setQueue(res.leads);
      setCurrentIndex(0);
      setTimerSeconds(0);
    } catch (e) {
      console.error('Failed to load power queue', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const currentLead = queue[currentIndex];

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if typing in textarea
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }
      if (e.key === '1') handleQuickDisposition('No Answer');
      if (e.key === '2') handleQuickDisposition('Callback');
      if (e.key === '3') handleQuickDisposition('Connected – Interested');
      if (e.key === '4') handleQuickDisposition('Interview Scheduled');
      if (e.key === '5') handleQuickDisposition('Not Interested');
      if (e.key === 'ArrowRight') handleSkipCandidate();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, queue, timerSeconds, quickNotes]);

  const handleQuickDisposition = async (disposition: string) => {
    if (!currentLead || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const isConn = disposition.startsWith('Connected') || disposition === 'Interview Scheduled';
      await apiRequest('/api/calls', {
        method: 'POST',
        body: JSON.stringify({
          leadId: currentLead.id,
          disposition,
          durationSeconds: timerSeconds,
          notes: quickNotes || `Power Calling log: ${disposition}`,
          followupDate: disposition === 'Callback' ? new Date().toISOString().split('T')[0] : undefined,
          followupTime: '15:00',
          followupReason: disposition === 'Callback' ? 'Candidate requested callback' : undefined,
          interviewDate: disposition === 'Interview Scheduled' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : undefined,
          interviewTime: '11:00 AM',
          clientId: currentLead.clientId,
          jobId: currentLead.jobId,
        }),
      });

      setSessionCompletedCalls(prev => prev + 1);
      if (isConn) setSessionConnected(prev => prev + 1);

      setLastDispositionToast(`Logged "${disposition}" for ${currentLead.candidateName}`);
      setTimeout(() => setLastDispositionToast(null), 3000);

      // Reset for next candidate
      setQuickNotes('');
      setTimerSeconds(0);

      if (currentIndex + 1 < queue.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Queue finished
        alert('🎉 Power Calling queue completed! Refreshing queue...');
        fetchQueue();
      }
    } catch (e) {
      console.error('Failed to log call', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipCandidate = () => {
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
      setTimerSeconds(0);
      setQuickNotes('');
    }
  };

  const handlePrevCandidate = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setTimerSeconds(0);
      setQuickNotes('');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-900 text-white rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight text-white">Power Calling Mode</h1>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                DISTRACTION-FREE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              High-speed keyboard-driven dialer with auto-queue advancement.
            </p>
          </div>
        </div>

        {/* Live Session Counter */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Session Calls</div>
            <div className="text-base font-bold text-white">{sessionCompletedCalls} logged</div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Connected</div>
            <div className="text-base font-bold text-emerald-400">{sessionConnected} calls</div>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {lastDispositionToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-xl flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{lastDispositionToast}</span>
        </div>
      )}

      {/* Main Dialing Console */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Loading calling queue candidates...
        </div>
      ) : !currentLead ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Calling Queue All Caught Up!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Great job! You have called all prioritized candidates in this queue batch.
          </p>
          <button
            onClick={fetchQueue}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            Fetch Next Batch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidate Card (2 columns) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Queue Counter Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-3">
              <span className="font-semibold text-slate-800">
                Candidate {currentIndex + 1} of {queue.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={handlePrevCandidate}
                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentIndex === queue.length - 1}
                  onClick={handleSkipCandidate}
                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded"
                  title="Skip to next (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Candidate Primary Bio */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {currentLead.candidateName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>{currentLead.city}</span>
                  <span aria-hidden="true">·</span>
                  <span>Exp: {currentLead.experience || 'Fresher'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Expected: ₹{currentLead.expectedSalary?.toLocaleString('en-IN') || '20,000'}/mo</span>
                  <span aria-hidden="true">·</span>
                  <span>Source: {currentLead.leadSource}</span>
                </div>
              </div>

              {/* Fit Badge */}
              <div className="text-right">
                {currentLead.scorecard ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono font-bold">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Fit Score: {currentLead.scorecard.fitScore}%</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsScorecardModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Evaluate Fit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Click-to-dial & WhatsApp Large Launchers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handleSimBridgeDial}
                disabled={isSimCalling}
                className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
                title="Dial candidate via your paired smartphone physical SIM"
              >
                <Radio className="w-4 h-4 text-emerald-200 animate-pulse" />
                <span>{isSimCalling ? 'Triggering...' : 'Dial via Phone SIM'}</span>
              </button>

              <a
                href={`tel:${currentLead.primaryPhone}`}
                className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all"
              >
                <Phone className="w-4 h-4" />
                <span>Direct Tel (+91 {currentLead.primaryPhone})</span>
              </a>

              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm shadow-sm transition-all"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp Pitch</span>
              </button>
            </div>

            {/* Candidate Openings & Matching Open Jobs */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Target Role:</span>{' '}
                <strong className="text-indigo-900">{currentLead.jobTitle || 'Executive Customer Operations'}</strong>
                {currentLead.clientName && (
                  <span className="text-slate-600"> at {currentLead.clientName}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsJobMatcherOpen(true)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Other Matching Jobs</span>
              </button>
            </div>

            {/* Quick Call Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quick Discussion Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={quickNotes}
                onChange={e => setQuickNotes(e.target.value)}
                placeholder="Candidate agreed for tomorrow's walk-in / Asked to call back after 4 PM..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono shadow-inner"
              />
            </div>
          </div>

          {/* Rapid Hotkey Action Dispositions (1 column) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4">
            <div>
              {/* Call Timer Gauge */}
              <div className="p-4 bg-slate-900 text-white rounded-xl text-center space-y-1 mb-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Call Stopwatch Duration</span>
                </div>
                <div className="text-3xl font-mono font-bold text-emerald-400">
                  {formatTimer(timerSeconds)}
                </div>
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(r => !r)}
                  className="text-[10px] text-slate-400 hover:text-white underline"
                >
                  {isTimerRunning ? 'Pause Timer' : 'Resume Timer'}
                </button>
              </div>

              {/* Hotkey Instructions */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  One-Touch Dispositions
                </h3>
                <span className="text-[10px] text-slate-400">Press 1–5 on keyboard</span>
              </div>

              {/* Disposition Buttons */}
              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDisposition('Connected – Interested')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 font-semibold transition-all shadow-xs"
                >
                  <span>Connected – Interested</span>
                  <kbd className="px-2 py-0.5 bg-emerald-200 text-emerald-950 font-mono text-[10px] rounded font-bold shadow-xs">
                    3
                  </kbd>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDisposition('Interview Scheduled')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-purple-300 bg-purple-50/70 hover:bg-purple-100/70 text-purple-900 font-semibold transition-all shadow-xs"
                >
                  <span>Interview Scheduled</span>
                  <kbd className="px-2 py-0.5 bg-purple-200 text-purple-950 font-mono text-[10px] rounded font-bold shadow-xs">
                    4
                  </kbd>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDisposition('Callback')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 font-semibold transition-all shadow-xs"
                >
                  <span>Callback / Call Later</span>
                  <kbd className="px-2 py-0.5 bg-amber-200 text-amber-950 font-mono text-[10px] rounded font-bold shadow-xs">
                    2
                  </kbd>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDisposition('No Answer')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium transition-all"
                >
                  <span>No Answer / Switched Off</span>
                  <kbd className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono text-[10px] rounded font-bold">
                    1
                  </kbd>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDisposition('Not Interested')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 font-medium transition-all"
                >
                  <span>Not Interested / Rejected</span>
                  <kbd className="px-2 py-0.5 bg-rose-200 text-rose-950 font-mono text-[10px] rounded font-bold">
                    5
                  </kbd>
                </button>
              </div>
            </div>

            {/* Skip / Next Footer Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSkipCandidate}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Skip Candidate Without Logging</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auxiliary Modals */}
      {isTemplateModalOpen && currentLead && (
        <TemplateDrawerModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          lead={currentLead}
        />
      )}

      {isScorecardModalOpen && currentLead && (
        <ScreeningScorecardModal
          isOpen={isScorecardModalOpen}
          onClose={() => setIsScorecardModalOpen(false)}
          lead={currentLead}
          onScorecardSaved={updated => {
            setQueue(prev => prev.map(l => (l.id === updated.id ? updated : l)));
          }}
        />
      )}

      {isJobMatcherOpen && currentLead && (
        <SmartJobMatcherModal
          isOpen={isJobMatcherOpen}
          onClose={() => setIsJobMatcherOpen(false)}
          lead={currentLead}
          onJobAssigned={() => {
            fetchQueue();
          }}
          onScheduleInterview={() => {
            handleQuickDisposition('Interview Scheduled');
          }}
        />
      )}
    </div>
  );
};
