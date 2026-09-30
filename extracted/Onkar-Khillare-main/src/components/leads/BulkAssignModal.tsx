import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiRequest } from '../../lib/api';
import { UserCheck, Sparkles, AlertCircle } from 'lucide-react';

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds: string[];
  onAssigned: () => void;
}

export const BulkAssignModal: React.FC<BulkAssignModalProps> = ({
  isOpen,
  onClose,
  selectedLeadIds,
  onAssigned,
}) => {
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [targetRecruiterId, setTargetRecruiterId] = useState<string>('');
  const [reason, setReason] = useState<string>('Bulk redistribution via CRM');
  const [isAutoDistributing, setIsAutoDistributing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatusMsg(null);
      apiRequest('/api/users').then(res => {
        const activeRecruiters = (res.users || []).filter((u: any) => u.isActive && u.role === 'recruiter');
        setRecruiters(activeRecruiters);
        if (activeRecruiters.length > 0) setTargetRecruiterId(activeRecruiters[0].id);
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleManualBulkAssign = async () => {
    if (!targetRecruiterId) {
      setStatusMsg({ type: 'error', text: 'Please select a recruiter.' });
      return;
    }
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await apiRequest('/api/leads/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          targetRecruiterId,
          reason,
        }),
      });
      setStatusMsg({ type: 'success', text: res.message });
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Bulk assignment failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoDistribute = async () => {
    setIsAutoDistributing(true);
    setStatusMsg(null);
    try {
      const res = await apiRequest('/api/leads/auto-distribute', {
        method: 'POST',
        body: JSON.stringify({
          leadIds: selectedLeadIds,
        }),
      });
      setStatusMsg({ type: 'success', text: res.message });
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Auto-distribution failed.' });
    } finally {
      setIsAutoDistributing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign ${selectedLeadIds.length} Candidate Leads`}
      subtitle="Select a target recruiter or use intelligent workload auto-distribution"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {statusMsg && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Option 1: Workload Auto Distribution */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Smart Workload-Balanced Auto-Distribution</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Equally spreads candidate leads across active recruiters by weighing current open leads, priority mix (ensuring hot leads are split evenly), and recruiter status.
          </p>
          <button
            type="button"
            disabled={isAutoDistributing || isSubmitting}
            onClick={handleAutoDistribute}
            className="w-full mt-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isAutoDistributing ? 'Balancing & Distributing...' : `Auto-Distribute ${selectedLeadIds.length} Leads Evenly`}
          </button>
        </div>

        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-white px-2 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Or Assign to Recruiter</span>
        </div>

        {/* Option 2: Single Recruiter Assignment */}
        <div className="space-y-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Active Recruiter</label>
            <select
              value={targetRecruiterId}
              onChange={(e) => setTargetRecruiterId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
            >
              {recruiters.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.teamName || 'General Team'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Reason for Assignment</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <button
            type="button"
            disabled={isSubmitting || isAutoDistributing}
            onClick={handleManualBulkAssign}
            className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" />
            {isSubmitting ? 'Assigning...' : `Assign All to Selected Recruiter`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
