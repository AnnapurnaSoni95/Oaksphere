import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiRequest } from '../../lib/api';
import { Lead, Job } from '../../lib/types';
import {
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Building,
  MapPin,
  DollarSign,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

interface MatchItem {
  job: Job;
  matchScore: number;
  reasons: string[];
  dealbreakers: string[];
  isTopMatch: boolean;
}

interface SmartJobMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onJobAssigned: () => void;
  onScheduleInterview?: (job: Job) => void;
}

export const SmartJobMatcherModal: React.FC<SmartJobMatcherModalProps> = ({
  isOpen,
  onClose,
  lead,
  onJobAssigned,
  onScheduleInterview,
}) => {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [taggingJobId, setTaggingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lead?.id) {
      setIsLoading(true);
      apiRequest<{ matches: MatchItem[] }>(`/api/leads/${lead.id}/matching-jobs`)
        .then(res => setMatches(res.matches))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, lead?.id]);

  if (!isOpen || !lead) return null;

  const handleTagJob = async (match: MatchItem) => {
    setTaggingJobId(match.job.id);
    try {
      await apiRequest(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          jobId: match.job.id,
          jobTitle: match.job.positionTitle,
          clientId: match.job.clientId,
          clientName: match.job.clientName,
        }),
      });
      onJobAssigned();
      onClose();
    } catch (e) {
      console.error('Failed to tag job', e);
    } finally {
      setTaggingJobId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Smart Job Matching & Recommendation Engine"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Candidate Context */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Candidate:</span>{' '}
            <strong className="text-slate-800">{lead.candidateName}</strong>
            <span className="ml-2 text-slate-500">
              ({lead.city} · Exp: {lead.experience || 'Fresher'} · Expected: ₹{lead.expectedSalary?.toLocaleString('en-IN') || '20,000'}/mo)
            </span>
          </div>
          {lead.jobTitle && (
            <div className="text-[11px] text-slate-500">
              Current Tag: <span className="font-semibold text-slate-700">{lead.jobTitle}</span>
            </div>
          )}
        </div>

        {/* Matches list */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Analyzing candidate profile against open client mandates...
          </div>
        ) : matches.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No active client openings currently match this candidate profile.
          </div>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {matches.map(m => {
              const isCurrent = lead.jobId === m.job.id;
              return (
                <div
                  key={m.job.id}
                  className={`p-4 rounded-xl border transition-all ${
                    m.isTopMatch
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{m.job.positionTitle}</h4>
                        {m.isTopMatch && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Top Match
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                            Currently Tagged
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-700">{m.job.clientName}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.job.location}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.job.salaryRange}</span>
                        </span>
                      </div>
                    </div>

                    {/* Score Gauge */}
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold font-mono text-slate-900">
                        {m.matchScore}%
                      </div>
                      <div className="text-[10px] text-slate-400">Match Fit</div>
                    </div>
                  </div>

                  {/* Match criteria & dealbreakers */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {m.reasons.length > 0 && (
                      <div className="space-y-1">
                        {m.reasons.slice(0, 3).map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-emerald-700 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {m.dealbreakers.length > 0 && (
                      <div className="space-y-1">
                        {m.dealbreakers.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-rose-600 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      {m.job.numberOfOpenings} Openings Active
                    </span>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          type="button"
                          disabled={taggingJobId === m.job.id}
                          onClick={() => handleTagJob(m)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
                        >
                          {taggingJobId === m.job.id ? 'Tagging...' : 'Tag Candidate to Job'}
                        </button>
                      )}

                      {onScheduleInterview && (
                        <button
                          type="button"
                          onClick={() => {
                            onScheduleInterview(m.job);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm inline-flex items-center gap-1"
                        >
                          <span>Line up for this Job</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-right pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
