import React, { useState } from 'react';
import {
  UserCheck,
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
  ChevronDown,
  Layers,
  ArrowRight,
  Download,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  selectedLeadIds: string[];
  usersList: any[];
  isAdminOrTL: boolean;
  canExport: boolean;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onBulkStatusUpdated: (newStatus: string, count: number) => void;
  onBulkAssignModalOpen: () => void;
  onAutoDistribute: () => Promise<void>;
  onExportSelected?: () => void;
}

const BULK_STATUS_OPTIONS = [
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

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  selectedLeadIds,
  usersList,
  isAdminOrTL,
  canExport,
  onClearSelection,
  onSelectAll,
  onBulkStatusUpdated,
  onBulkAssignModalOpen,
  onAutoDistribute,
  onExportSelected,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [quickRecruiterId, setQuickRecruiterId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAutoDistributing, setIsAutoDistributing] = useState(false);

  if (selectedCount === 0) return null;

  const handleApplyStatus = async () => {
    if (!selectedStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await apiRequest('/api/leads/bulk-status', {
        method: 'POST',
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          leadStatus: selectedStatus,
        }),
      });
      onBulkStatusUpdated(selectedStatus, res.updatedCount || selectedLeadIds.length);
      setSelectedStatus('');
    } catch (err) {
      console.error('Failed bulk status update', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleQuickAssign = async () => {
    if (!quickRecruiterId) return;
    setIsAssigning(true);
    try {
      await apiRequest('/api/leads/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          targetRecruiterId: quickRecruiterId,
          reason: 'Bulk quick assignment from leads grid',
        }),
      });
      const recruiterName = usersList.find(u => u.id === quickRecruiterId)?.name || 'Recruiter';
      onBulkStatusUpdated(`Assigned to ${recruiterName}`, selectedLeadIds.length);
      setQuickRecruiterId('');
    } catch (err) {
      console.error('Failed bulk assign', err);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAutoDistributeClick = async () => {
    setIsAutoDistributing(true);
    try {
      await onAutoDistribute();
    } finally {
      setIsAutoDistributing(false);
    }
  };

  const activeRecruiters = usersList.filter(u => u.isActive && u.role === 'recruiter');

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[95%] sm:w-auto bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-2xl border border-slate-700/80 flex flex-wrap items-center justify-between sm:justify-start gap-3 text-xs animate-in fade-in slide-in-from-bottom-3 backdrop-blur-md">
      {/* Selected Counter & Select All / Deselect All */}
      <div className="flex items-center gap-2 pr-2 border-r border-slate-700/80">
        <span className="px-2.5 py-1 bg-indigo-600 font-bold rounded-lg text-white text-[11px] shadow-xs">
          {selectedCount} Selected
        </span>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-slate-300 hover:text-white underline text-[11px] font-medium"
        >
          {selectedCount === totalCount ? 'All selected' : `Select all (${totalCount})`}
        </button>
      </div>

      {/* Bulk Status Update Controls */}
      <div className="flex items-center gap-1.5 pr-2 sm:border-r border-slate-700/80">
        <span className="text-slate-400 text-[11px] font-medium hidden md:inline">Status:</span>
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg pl-2.5 pr-7 py-1.5 font-medium appearance-none focus:outline-hidden focus:border-indigo-400"
          >
            <option value="">Update Status to...</option>
            {BULK_STATUS_OPTIONS.map(st => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={handleApplyStatus}
          disabled={!selectedStatus || isUpdatingStatus}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg flex items-center gap-1 transition-colors"
          title="Apply this status to all selected candidates"
        >
          {isUpdatingStatus ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Apply
        </button>
      </div>

      {/* Bulk Assignment Controls (Admin & TL) */}
      {isAdminOrTL && (
        <div className="flex items-center gap-1.5 pr-2 sm:border-r border-slate-700/80">
          <span className="text-slate-400 text-[11px] font-medium hidden lg:inline">Assign:</span>
          <div className="relative">
            <select
              value={quickRecruiterId}
              onChange={(e) => setQuickRecruiterId(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg pl-2.5 pr-7 py-1.5 font-medium appearance-none focus:outline-hidden focus:border-indigo-400 max-w-[140px] truncate"
            >
              <option value="">Choose Recruiter...</option>
              {activeRecruiters.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={handleQuickAssign}
            disabled={!quickRecruiterId || isAssigning}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:text-slate-500 text-white font-medium rounded-lg flex items-center gap-1 transition-colors"
            title="Assign selected leads to selected recruiter"
          >
            {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Assign
          </button>

          <button
            type="button"
            onClick={handleAutoDistributeClick}
            disabled={isAutoDistributing}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-1 transition-colors"
            title="Intelligently distribute selected leads across active recruiters"
          >
            {isAutoDistributing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Auto-Distribute</span>
          </button>

          <button
            type="button"
            onClick={onBulkAssignModalOpen}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
            title="Open advanced bulk assign options"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Export Selected CSV if permitted */}
      {canExport && onExportSelected && (
        <button
          type="button"
          onClick={onExportSelected}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium rounded-lg flex items-center gap-1 transition-colors"
          title="Export only selected candidates to CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      )}

      {/* Clear selection X button */}
      <button
        type="button"
        onClick={onClearSelection}
        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-auto"
        title="Deselect all candidates"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
