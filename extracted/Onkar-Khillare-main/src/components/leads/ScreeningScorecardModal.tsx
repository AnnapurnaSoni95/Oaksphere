import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiRequest } from '../../lib/api';
import { Lead, ScreeningScorecard } from '../../lib/types';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  Clock,
  MapPin,
  DollarSign,
  Keyboard,
  MessageSquare,
} from 'lucide-react';

interface ScreeningScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onScorecardSaved: (updatedLead: Lead) => void;
}

export const ScreeningScorecardModal: React.FC<ScreeningScorecardModalProps> = ({
  isOpen,
  onClose,
  lead,
  onScorecardSaved,
}) => {
  const [commLevel, setCommLevel] = useState<'Basic' | 'Average' | 'Good' | 'Excellent'>('Good');
  const [shift, setShift] = useState<'Day Only' | '24/7 Rotational' | 'Night Shift' | 'US Shift'>('24/7 Rotational');
  const [commute, setCommute] = useState<'Within 10km' | '10-25km' | '25km+' | 'Transport Needed' | 'Relocation Ready'>('Within 10km');
  const [typingWpm, setTypingWpm] = useState<number>(28);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Customer Service', 'Voice Inbound']);
  const [noticeDays, setNoticeDays] = useState<number>(0);
  const [expectedCtc, setExpectedCtc] = useState<number>(22000);
  const [currentCtc, setCurrentCtc] = useState<number>(18000);
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load existing scorecard if present on lead
  useEffect(() => {
    if (lead) {
      if (lead.scorecard) {
        setCommLevel(lead.scorecard.communicationLevel);
        setShift(lead.scorecard.shiftAvailability);
        setCommute(lead.scorecard.commuteDistance);
        setTypingWpm(lead.scorecard.typingSpeedWpm || 25);
        setSelectedSkills(lead.scorecard.skills || ['Customer Service']);
        setNoticeDays(lead.scorecard.noticePeriodDays || 0);
        setExpectedCtc(lead.scorecard.expectedCtcMonthly || lead.expectedSalary || 20000);
        setCurrentCtc(lead.scorecard.currentCtcMonthly || lead.currentSalary || 16000);
        setRemarks(lead.scorecard.recruiterRemarks || '');
      } else {
        setCommLevel('Good');
        setShift((lead.preferredShift as any) || '24/7 Rotational');
        setCommute('Within 10km');
        setTypingWpm(28);
        setSelectedSkills(lead.skills || ['Customer Service', 'Voice Inbound']);
        setNoticeDays(lead.noticePeriod?.includes('Immediate') ? 0 : 15);
        setExpectedCtc(lead.expectedSalary || 22000);
        setCurrentCtc(lead.currentSalary || 18000);
        setRemarks('');
      }
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  // Live client-side preview of fit calculation
  let calculatedScore = 0;
  const liveDealbreakers: string[] = [];

  // Comm
  if (commLevel === 'Excellent') calculatedScore += 25;
  else if (commLevel === 'Good') calculatedScore += 20;
  else if (commLevel === 'Average') calculatedScore += 14;
  else {
    calculatedScore += 6;
    liveDealbreakers.push('Basic English: candidate cannot be submitted for voice processes');
  }

  // Shift
  if (shift === '24/7 Rotational' || shift === 'US Shift') calculatedScore += 20;
  else if (shift === 'Night Shift') calculatedScore += 18;
  else {
    calculatedScore += 12;
    if (lead.jobTitle?.toLowerCase().includes('bpo') || lead.jobTitle?.toLowerCase().includes('voice')) {
      liveDealbreakers.push('Day-only constraint restricts 24/7 BPO rotational shifts');
    }
  }

  // Commute
  if (commute === 'Within 10km') calculatedScore += 20;
  else if (commute === '10-25km') calculatedScore += 15;
  else if (commute === 'Transport Needed') calculatedScore += 12;
  else if (commute === 'Relocation Ready') calculatedScore += 14;
  else {
    calculatedScore += 8;
    liveDealbreakers.push('Candidate located 25km+ away without guaranteed transport');
  }

  // Notice
  if (noticeDays === 0) calculatedScore += 15;
  else if (noticeDays <= 7) calculatedScore += 13;
  else if (noticeDays <= 15) calculatedScore += 10;
  else if (noticeDays <= 30) calculatedScore += 6;
  else {
    calculatedScore += 2;
    liveDealbreakers.push('Notice period exceeds 30 days');
  }

  // Salary
  if (expectedCtc && expectedCtc <= 25000) calculatedScore += 10;
  else if (expectedCtc && expectedCtc <= 32000) calculatedScore += 7;
  else {
    calculatedScore += 4;
    liveDealbreakers.push('High salary expectation (>₹32,000/mo) may exceed entry band');
  }

  // Skills & Typing
  if (typingWpm >= 30) calculatedScore += 5;
  else if (typingWpm >= 20) calculatedScore += 3;
  if (selectedSkills.length >= 2) calculatedScore += 5;

  const fitScore = Math.min(100, Math.max(0, calculatedScore));
  let verdict: 'Strong Fit' | 'Borderline Fit' | 'High Risk' | 'Not Qualified' = 'Strong Fit';
  if (liveDealbreakers.length > 0 || fitScore < 50) {
    verdict = liveDealbreakers.length > 1 || fitScore < 45 ? 'Not Qualified' : 'High Risk';
  } else if (fitScore < 70) {
    verdict = 'Borderline Fit';
  }

  const allSkills = [
    'Customer Service',
    'Voice Inbound',
    'Voice Outbound',
    'Telesales',
    'Email/Chat Support',
    'Basic Excel',
    'Advanced Excel',
    'Collections',
    'Lead Generation',
  ];

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleSaveScorecard = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiRequest<{ lead: Lead; scorecard: ScreeningScorecard }>(
        `/api/leads/${lead.id}/scorecard`,
        {
          method: 'POST',
          body: JSON.stringify({
            communicationLevel: commLevel,
            shiftAvailability: shift,
            commuteDistance: commute,
            typingSpeedWpm: typingWpm,
            skills: selectedSkills,
            noticePeriodDays: noticeDays,
            expectedCtcMonthly: expectedCtc,
            currentCtcMonthly: currentCtc,
            recruiterRemarks: remarks,
          }),
        }
      );
      onScorecardSaved(res.lead);
      onClose();
    } catch (e) {
      console.error('Failed to save scorecard', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Candidate 60-Second Screening & Fit Scorecard"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Candidate Bar & Live Fit Badge */}
        <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{lead.candidateName}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {lead.city} · {lead.jobTitle || 'General Pool'} · {lead.leadSource}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-2xl font-bold font-mono tracking-tight text-white">{fitScore}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">
              {verdict === 'Strong Fit' && <span className="text-emerald-400">● Strong Fit</span>}
              {verdict === 'Borderline Fit' && <span className="text-amber-400">● Borderline Fit</span>}
              {verdict === 'High Risk' && <span className="text-rose-400">● High Risk</span>}
              {verdict === 'Not Qualified' && <span className="text-rose-500 font-bold">● Not Qualified</span>}
            </div>
          </div>
        </div>

        {/* Live Dealbreaker Alert */}
        {liveDealbreakers.length > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Dealbreaker Warnings Detected:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-rose-700 pl-1 space-y-0.5">
              {liveDealbreakers.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Form Controls */}
        <div className="space-y-3.5 text-xs">
          {/* Communication Level */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              <span>1. English / Hindi Communication Assessment</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Basic', 'Average', 'Good', 'Excellent'] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCommLevel(lvl)}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                    commLevel === lvl
                      ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-900 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>{lvl}</div>
                  <div className="text-[10px] text-slate-400">
                    {lvl === 'Basic' && 'Non-Voice only'}
                    {lvl === 'Average' && 'Semi-Voice'}
                    {lvl === 'Good' && 'Domestic Voice'}
                    {lvl === 'Excellent' && 'International Voice'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Shift & Commute */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>2. Shift Flexibility</span>
              </label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="24/7 Rotational">24/7 Rotational (Best Fit)</option>
                <option value="US Shift">US Shift / Night Windows</option>
                <option value="Night Shift">Fixed Night Shift</option>
                <option value="Day Only">Day Shift Only (Restricted)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>3. Commute Distance to Hub</span>
              </label>
              <select
                value={commute}
                onChange={e => setCommute(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Within 10km">Within 10km (Easy commute)</option>
                <option value="10-25km">10 - 25km (Acceptable)</option>
                <option value="Transport Needed">Requires Company Cab/Transport</option>
                <option value="Relocation Ready">Relocating near office</option>
                <option value="25km+">25km+ (High dropout risk)</option>
              </select>
            </div>
          </div>

          {/* Notice Period & Typing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-500" />
                <span>4. Notice Period (Days)</span>
              </label>
              <div className="flex gap-1.5">
                {[
                  { days: 0, label: 'Immediate' },
                  { days: 7, label: '7 Days' },
                  { days: 15, label: '15 Days' },
                  { days: 30, label: '30 Days' },
                ].map(item => (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => setNoticeDays(item.days)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      noticeDays === item.days
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-sky-500" />
                <span>5. Typing Speed (WPM)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={typingWpm}
                  onChange={e => setTypingWpm(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <span className="text-[11px] text-slate-500">
                  {typingWpm >= 30 ? '✅ Clears 30 WPM cutoff' : '⚠️ Below 30 WPM standard'}
                </span>
              </div>
            </div>
          </div>

          {/* Salary Expectations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span>Current Monthly CTC (₹)</span>
              </label>
              <input
                type="number"
                step={1000}
                value={currentCtc}
                onChange={e => setCurrentCtc(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span>Expected Monthly CTC (₹)</span>
              </label>
              <input
                type="number"
                step={1000}
                value={expectedCtc}
                onChange={e => setExpectedCtc(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Skills checklist */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">Candidate Core Competencies</label>
            <div className="flex flex-wrap gap-1.5">
              {allSkills.map(skill => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Recruiter Screening Observations</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g., Confident candidate, willing to do night shifts, clear voice modulation..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-500">
            Saves directly to candidate profile and generates fit tags.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveScorecard}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
            >
              {isSubmitting ? 'Evaluating...' : 'Save Fit Scorecard'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
