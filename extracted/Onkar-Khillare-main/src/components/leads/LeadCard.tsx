import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  ExternalLink,
  Phone,
  MessageSquare,
  Radio,
  Briefcase,
  MapPin,
  Clock,
  User,
  ChevronDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { PriorityBadge, PhoneVerifyBadge } from '../common/Badge';
import { openWhatsApp } from '../../lib/api';

interface LeadCardProps {
  lead: any;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onOpenCallModal: (lead: any) => void;
  onDialBridge: (lead: any) => void;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  isAdminOrTL?: boolean;
}

const STATUS_OPTIONS = [
  'New',
  'Calling',
  'Follow-up',
  'Interested',
  'Interview Scheduled',
  'Interview Attended',
  'Selected',
  'Joining Scheduled',
  'Joined',
  'Lost',
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  New: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Calling: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Follow-up': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Interested: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Interview Scheduled': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Interview Attended': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  Selected: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'Joining Scheduled': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  Joined: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  Lost: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  isSelected,
  onToggleSelect,
  onOpenDetail,
  onOpenCallModal,
  onDialBridge,
  onStatusChange,
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === lead.leadStatus) return;

    setIsUpdatingStatus(true);
    try {
      await onStatusChange(lead.id, newStatus);
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 1500);
    } catch (err) {
      console.error('Failed to change status inline', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusStyle = STATUS_COLORS[lead.leadStatus] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };

  return (
    <div
      className={`group relative rounded-xl border text-xs transition-all duration-150 flex flex-col justify-between overflow-hidden bg-white shadow-xs hover:shadow-md ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/25 bg-indigo-50/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Header: Selection + Candidate Name + Priority */}
      <div className="p-3.5 pb-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Checkbox */}
            <button
              type="button"
              onClick={() => onToggleSelect(lead.id)}
              className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-hidden"
              title={isSelected ? 'Deselect candidate' : 'Select candidate'}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
              )}
            </button>

            {/* Candidate Name & Link */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpenDetail(lead.id)}
                className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left flex items-center gap-1.5 truncate max-w-full group/name"
              >
                <span className="truncate">{lead.candidateName}</span>
                <ExternalLink className="w-3 h-3 text-slate-300 group-hover/name:text-indigo-500 shrink-0" />
              </button>

              {/* Location & Experience inline text */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{lead.city || 'Location N/A'}</span>
                {lead.experience && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="truncate">{lead.experience}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Priority Badge */}
          <div className="shrink-0">
            <PriorityBadge priority={lead.priority} size="sm" />
          </div>
        </div>

        {/* Target Client & Role */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-800 truncate">
            {lead.clientName || 'Open Market'}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500 truncate">{lead.jobTitle || 'Role N/A'}</span>
        </div>

        {/* Contact Phone & Instant Action Quick Buttons */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-800 min-w-0">
            <span className="truncate">{lead.primaryPhone}</span>
            {lead.isPhoneMasked && (
              <span
                className="text-[9px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-sans font-semibold shrink-0"
                title="Phone number masked for security"
              >
                Masked
              </span>
            )}
            <PhoneVerifyBadge status={lead.phoneStatus} />
          </div>

          {/* 1-Click Fast Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick SIM Bridge Dial */}
            <button
              type="button"
              onClick={() => onDialBridge(lead)}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
              title="Quick Dial via SIM Bridge (Recruiter Android Phone)"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
            </button>

            {/* Call Workspace / Log Call */}
            <button
              type="button"
              onClick={() => onOpenCallModal(lead)}
              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"
              title="Call Workspace & Disposition Log"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>

            {/* Direct WhatsApp */}
            <button
              type="button"
              onClick={() =>
                openWhatsApp(
                  lead.primaryPhone,
                  `Hi ${lead.candidateName}, this is regarding your job application with OAKsphere Connect.`
                )
              }
              className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors"
              title="Open WhatsApp Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Card Footer: Inline Status Changer & Recruiter Ownership */}
      <div className="bg-slate-50/90 px-3.5 py-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
        {/* Recruiter Ownership & Call count */}
        <div className="min-w-0 flex items-center gap-1 text-slate-500">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span
            className={`font-medium truncate ${
              lead.assignedRecruiterName === 'Unassigned'
                ? 'text-rose-600 font-semibold'
                : 'text-slate-700'
            }`}
            title={`Assigned Recruiter: ${lead.assignedRecruiterName}`}
          >
            {lead.assignedRecruiterName}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[10px] text-slate-400 shrink-0">
            {lead.callAttempts || 0} calls
          </span>
        </div>

        {/* Inline Quick Status Changer */}
        <div className="relative shrink-0">
          <div className="flex items-center gap-1">
            {isUpdatingStatus ? (
              <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
            ) : justUpdated ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ) : null}

            <select
              value={lead.leadStatus}
              onChange={handleSelectChange}
              disabled={isUpdatingStatus}
              className={`text-[10px] font-semibold py-1 pl-2 pr-6 rounded-md border cursor-pointer transition-colors appearance-none focus:outline-hidden focus:ring-1 focus:ring-indigo-500 ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
              title="Click to quickly update status without opening modal"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s} className="bg-white text-slate-800 font-normal">
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-1.5 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
