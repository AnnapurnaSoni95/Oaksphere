import React, { useState, useEffect } from 'react';
import { apiRequest, openWhatsApp } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  Clock,
  Calendar,
  Phone,
  MessageSquare,
  AlertTriangle,
  Building,
  User,
  ArrowRight,
  Edit,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const JoiningsPage: React.FC = () => {
  const { user } = useAuth();
  const [joinings, setJoinings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edit joining modal
  const [editItem, setEditItem] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Joining Confirmed');
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [actualDate, setActualDate] = useState<string>('');
  const [offeredSalary, setOfferedSalary] = useState<string>('');
  const [confirmationStatus, setConfirmationStatus] = useState<string>('Confirmed');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchJoinings = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/joinings');
      setJoinings(res.joinings || []);
    } catch (e) {
      console.error('Failed to load joinings', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJoinings();
  }, [user]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/joinings/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          expectedJoiningDate: expectedDate || undefined,
          actualJoiningDate: newStatus === 'Joined' ? (actualDate || new Date().toISOString().split('T')[0]) : undefined,
          offeredSalary: offeredSalary ? Number(offeredSalary) : undefined,
          confirmationStatus,
          remarks,
        }),
      });
      setEditItem(null);
      fetchJoinings();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredJoinings = joinings.filter(j => {
    if (statusFilter === 'confirmed') return j.status === 'Joining Confirmed';
    if (statusFilter === 'joined') return j.status === 'Joined';
    if (statusFilter === 'pending') return ['Selected', 'Documents Pending', 'Offer Pending', 'Offer Released'].includes(j.status);
    if (statusFilter === 'missing_date') return !j.expectedJoiningDate && j.status !== 'Joined';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600" />
              Candidate Joining & Placement Tracker
            </h1>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full font-bold text-[10px]">
              {joinings.length} In Placement Pipeline
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Track selected candidates through offer release, document collection, reporting confirmation, and final joined milestone.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All In Pipeline' },
            { id: 'confirmed', label: 'Joining Confirmed' },
            { id: 'missing_date', label: '⚠️ Missing Joining Date' },
            { id: 'pending', label: 'Offer & Docs Pending' },
            { id: 'joined', label: '✓ Joined Successfully' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Joinings Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Client & Role</th>
                <th className="py-2.5 px-3">Offered Salary</th>
                <th className="py-2.5 px-3">Joining Status</th>
                <th className="py-2.5 px-3">Expected Joining Date</th>
                <th className="py-2.5 px-3">Confirmation Status</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading joinings...</td>
                </tr>
              ) : filteredJoinings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No records found for this joining status.
                  </td>
                </tr>
              ) : (
                filteredJoinings.map((join: any) => {
                  const isMissingDate = !join.expectedJoiningDate && join.status !== 'Joined';

                  return (
                    <tr
                      key={join.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isMissingDate ? 'bg-amber-50/40' : join.status === 'Joined' ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Candidate */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{join.candidateName}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{join.candidatePhone}</div>
                        <div className="text-[10px] text-slate-400">Recruiter: {join.recruiterName}</div>
                      </td>

                      {/* Client & Role */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{join.clientName}</div>
                        <div className="text-slate-500 text-[11px]">{join.jobTitle}</div>
                      </td>

                      {/* Offered Salary */}
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                        {join.offeredSalary ? `₹${join.offeredSalary.toLocaleString()}/mo` : 'Pending'}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
                          join.status === 'Joined' ? 'bg-emerald-100 text-emerald-800' :
                          join.status === 'Joining Confirmed' ? 'bg-teal-100 text-teal-800' :
                          join.status === 'Offer Pending' ? 'bg-amber-100 text-amber-800' :
                          join.status === 'No Show' || join.status === 'Dropped' ? 'bg-rose-100 text-rose-800' :
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {join.status}
                        </span>
                      </td>

                      {/* Expected Joining Date */}
                      <td className="py-2.5 px-3 font-mono">
                        {join.expectedJoiningDate ? (
                          <span className="font-bold text-slate-900">{join.expectedJoiningDate}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center gap-1 w-max">
                            <AlertTriangle className="w-3 h-3" /> DATE MISSING
                          </span>
                        )}
                        {join.actualJoiningDate && (
                          <div className="text-emerald-700 text-[10px] font-semibold">
                            Joined: {join.actualJoiningDate}
                          </div>
                        )}
                      </td>

                      {/* Confirmation Status */}
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          join.confirmationStatus === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                          join.confirmationStatus === 'At Risk' ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {join.confirmationStatus}
                        </span>
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600" title={join.remarks || ''}>
                        {join.remarks || <span className="text-slate-300 italic">No remarks</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditItem(join);
                              setNewStatus(join.status);
                              setExpectedDate(join.expectedJoiningDate || '');
                              setActualDate(join.actualJoiningDate || '');
                              setOfferedSalary(join.offeredSalary ? String(join.offeredSalary) : '');
                              setConfirmationStatus(join.confirmationStatus || 'Confirmed');
                              setRemarks(join.remarks || '');
                            }}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded text-xs transition-colors"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsApp(join.candidatePhone, `Hi ${join.candidateName}, checking in regarding your joining with ${join.clientName} as ${join.jobTitle}.`)}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded"
                            title="WhatsApp Candidate"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Joining Modal */}
      {editItem && (
        <Modal
          isOpen={!!editItem}
          onClose={() => setEditItem(null)}
          title={`Update Joining Tracker: ${editItem.candidateName}`}
          subtitle={`Company: ${editItem.clientName} • Role: ${editItem.jobTitle}`}
          maxWidth="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Joining Pipeline Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  <option value="Selected">Selected</option>
                  <option value="Documents Pending">Documents Pending</option>
                  <option value="Offer Pending">Offer Pending</option>
                  <option value="Offer Released">Offer Released</option>
                  <option value="Joining Confirmed">Joining Confirmed</option>
                  <option value="Joined">Joined (Placement Success)</option>
                  <option value="Delayed">Delayed</option>
                  <option value="No Show">No Show (Dropped)</option>
                  <option value="Dropped">Candidate Dropped</option>
                  <option value="Client Rejected">Client Rejected</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirmation Status</label>
                <select
                  value={confirmationStatus}
                  onChange={(e) => setConfirmationStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending Confirmation</option>
                  <option value="At Risk">At Risk (Counter Offer / Doubtful)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expected Joining Date</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Offered Salary (₹/month)</label>
                <input
                  type="number"
                  value={offeredSalary}
                  onChange={(e) => setOfferedSalary(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                />
              </div>
            </div>

            {newStatus === 'Joined' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <label className="block font-bold text-emerald-900 mb-1">Actual Joining Reporting Date *</label>
                <input
                  type="date"
                  required
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-md bg-white"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 mb-1 font-medium">Remarks / Verification Notes</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Offer letter signed, reporting manager assigned, resignation proof submitted..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Joining Progress'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
