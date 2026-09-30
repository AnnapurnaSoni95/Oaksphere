import React, { useState, useEffect } from 'react';
import { apiRequest, openWhatsApp } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Search,
  Plus,
  Download,
  UserCheck,
  Sparkles,
  Phone,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  Radio,
  Lock,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PriorityBadge, StatusBadge, PhoneVerifyBadge } from '../components/common/Badge';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { NewLeadModal } from '../components/leads/NewLeadModal';
import { BulkAssignModal } from '../components/leads/BulkAssignModal';
import { CallModal } from '../components/leads/CallModal';
import { LeadCard } from '../components/leads/LeadCard';
import { BulkActionBar } from '../components/leads/BulkActionBar';

export const LeadsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTL = user?.role === 'team_leader';

  const [leads, setLeads] = useState<any[]>([]);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Layout mode: dense grid is primary/default
  const [layoutMode, setLayoutMode] = useState<'grid' | 'table'>('grid');

  // Filters & Saved Views
  const [view, setView] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [recruiterFilter, setRecruiterFilter] = useState<string>('');

  const [usersList, setUsersList] = useState<any[]>([]);

  // Selection for bulk actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState<boolean>(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState<boolean>(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [callLead, setCallLead] = useState<any | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (statusFilter) params.set('leadStatus', statusFilter);
      if (recruiterFilter) params.set('assignedRecruiterId', recruiterFilter);

      if (view !== 'all') {
        params.set('view', view);
      }

      const res = await apiRequest(`/api/leads?${params.toString()}`);
      setLeads(res.leads || []);
      setTotalLeads(res.total || 0);
    } catch (e) {
      console.error('Failed to load leads', e);
      showToast('Failed to load candidate leads', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    apiRequest('/api/users').then(res => setUsersList(res.users || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeads();
    setSelectedLeadIds([]);
  }, [user, view, priorityFilter, statusFilter, recruiterFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === leads.length && leads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter(i => i !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  // Direct 1-click status update from individual card
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ leadStatus: newStatus }),
      });
      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, leadStatus: newStatus } : l))
      );
      showToast(`Status updated to "${newStatus}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
      throw err;
    }
  };

  // 1-click SIM Bridge dial
  const handleDialBridge = async (lead: any) => {
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
      showToast(`Bridge dial sent for ${lead.candidateName}`, 'info');
    } catch (e: any) {
      // ignore
    }
    setCallLead(lead);
  };

  // Auto-distribute selected leads across active recruiters
  const handleAutoDistribute = async () => {
    try {
      const res = await apiRequest('/api/leads/auto-distribute', {
        method: 'POST',
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      showToast(res.message || `Auto-distributed ${selectedLeadIds.length} leads successfully`, 'success');
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Auto-distribution failed', 'error');
    }
  };

  // Bulk status update handler
  const handleBulkStatusUpdated = (actionDescription: string, count: number) => {
    showToast(`Updated ${count} candidate(s): ${actionDescription}`, 'success');
    setSelectedLeadIds([]);
    fetchLeads();
  };

  // Export full CSV
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (priorityFilter) params.set('priority', priorityFilter);
      if (statusFilter) params.set('leadStatus', statusFilter);

      const csvData = await apiRequest(`/api/leads/export?${params.toString()}`, {
        headers: { Accept: 'text/csv' },
      });

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `oaksphere_candidates_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Candidate export downloaded', 'success');
    } catch (e) {
      console.error('CSV export failed', e);
      showToast('CSV export failed', 'error');
    }
  };

  // Export selected only CSV
  const handleExportSelectedCSV = async () => {
    if (selectedLeadIds.length === 0) return;
    try {
      const selectedLeadsData = leads.filter(l => selectedLeadIds.includes(l.id));
      const headers = ['Candidate Name', 'Phone', 'Email', 'City', 'Priority', 'Status', 'Recruiter', 'Client', 'Role', 'Source'];
      const rows = selectedLeadsData.map(l => [
        `"${(l.candidateName || '').replace(/"/g, '""')}"`,
        `"${(l.primaryPhone || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.city || '').replace(/"/g, '""')}"`,
        `"${(l.priority || '').replace(/"/g, '""')}"`,
        `"${(l.leadStatus || '').replace(/"/g, '""')}"`,
        `"${(l.assignedRecruiterName || '').replace(/"/g, '""')}"`,
        `"${(l.clientName || '').replace(/"/g, '""')}"`,
        `"${(l.jobTitle || '').replace(/"/g, '""')}"`,
        `"${(l.leadSource || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `selected_candidates_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${selectedLeadIds.length} selected candidates`, 'success');
    } catch (e) {
      showToast('Failed to export selected candidates', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs pb-24">
      {/* Toast Notification Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-indigo-50 text-indigo-900 border-indigo-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Candidate Leads Directory
            </h1>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-full text-[10px]">
              {totalLeads} Total Candidates
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Dense, fast-action recruitment grid with inline status changes, multi-candidate bulk actions, and direct SIM calling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedLeadIds.length > 0 && (isAdmin || isTL) && (
            <button
              type="button"
              onClick={() => setIsBulkAssignModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Bulk Assign ({selectedLeadIds.length})
            </button>
          )}

          {user?.permissions?.canExportData === false ? (
            <button
              type="button"
              disabled
              title="Candidate lead data export is restricted by your administrator"
              className="px-3 py-1.5 border border-slate-200 bg-slate-50 text-slate-400 font-medium rounded-lg flex items-center gap-1.5 cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Export CSV (Restricted)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsNewLeadModalOpen(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Candidate
          </button>
        </div>
      </div>

      {/* Saved Views Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Leads' },
          { id: 'new_leads', label: 'New / Uncontacted' },
          { id: 'never_called', label: 'Never Called' },
          { id: 'today_followups', label: "Today's Follow-ups" },
          { id: 'overdue_followups', label: 'Overdue Follow-ups' },
          { id: 'hot_leads', label: '🔥 Hot Leads' },
          { id: 'action_required', label: '⚠️ Action Required' },
          { id: 'unassigned', label: 'Unassigned Leads' },
        ].map(sv => (
          <button
            key={sv.id}
            type="button"
            onClick={() => setView(sv.id)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              view === sv.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {sv.label}
          </button>
        ))}
      </div>

      {/* Filter, Search & Layout Switcher Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
        {/* Quick select-all checkbox */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
            title={selectedLeadIds.length === leads.length && leads.length > 0 ? 'Deselect all' : 'Select all visible'}
          >
            {selectedLeadIds.length === leads.length && leads.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : selectedLeadIds.length > 0 ? (
              <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center text-white text-[10px] font-bold leading-none">
                -
              </div>
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-[11px]">
              {selectedLeadIds.length > 0 ? `${selectedLeadIds.length} Selected` : 'Select All'}
            </span>
          </button>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, phone, city, job..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
          >
            <option value="">Priority: All</option>
            <option value="Hot">Hot</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Cold">Cold</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
          >
            <option value="">Status: All</option>
            <option value="New">New</option>
            <option value="Calling">Calling</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Interested">Interested</option>
            <option value="Interview Scheduled">Interview Scheduled</option>
            <option value="Interview Attended">Interview Attended</option>
            <option value="Selected">Selected</option>
            <option value="Joining Scheduled">Joining Scheduled</option>
            <option value="Joined">Joined</option>
            <option value="Lost">Lost</option>
          </select>

          {(isAdmin || isTL) && (
            <select
              value={recruiterFilter}
              onChange={(e) => setRecruiterFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium max-w-[150px] truncate"
            >
              <option value="">Recruiter: All</option>
              {usersList.filter(u => u.role === 'recruiter').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}

          {/* View mode toggle: Dense Cards (primary) vs Table */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${
                layoutMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Dense Card Grid View (Fast Navigation)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('table')}
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${
                layoutMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Compact Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchLeads}
            className="p-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
            title="Refresh Leads"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        layoutMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="w-28 h-4 bg-slate-200 rounded"></div>
                  <div className="w-12 h-4 bg-slate-100 rounded-full"></div>
                </div>
                <div className="w-3/4 h-3 bg-slate-100 rounded"></div>
                <div className="w-full h-8 bg-slate-50 rounded-lg"></div>
                <div className="flex items-center justify-between pt-2">
                  <div className="w-20 h-3 bg-slate-100 rounded"></div>
                  <div className="w-16 h-5 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
            Loading candidates...
          </div>
        )
      ) : leads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No candidates found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No leads match your current search and filter settings. Try adjusting your filters or add a new candidate.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setPriorityFilter('');
              setStatusFilter('');
              setRecruiterFilter('');
              setView('all');
            }}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded-lg text-xs transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : layoutMode === 'grid' ? (
        /* DENSE CARD-BASED GRID LAYOUT */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {leads.map((lead: any) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isSelected={selectedLeadIds.includes(lead.id)}
              onToggleSelect={toggleSelectLead}
              onOpenDetail={(id) => setDetailLeadId(id)}
              onOpenCallModal={(l) => setCallLead(l)}
              onDialBridge={handleDialBridge}
              onStatusChange={handleStatusChange}
              isAdminOrTL={isAdmin || isTL}
            />
          ))}
        </div>
      ) : (
        /* Compact Table Layout (Alternative view mode) */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-8">
                    <button type="button" onClick={handleSelectAll} className="text-slate-400 hover:text-slate-700">
                      {selectedLeadIds.length === leads.length && leads.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Candidate</th>
                  <th className="py-2.5 px-3">Phone & Status</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Lead Status</th>
                  <th className="py-2.5 px-3">Recruiter Owner</th>
                  <th className="py-2.5 px-3">Target Client & Job</th>
                  <th className="py-2.5 px-3">Source & Calls</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead: any) => {
                  const isSelected = selectedLeadIds.includes(lead.id);

                  return (
                    <tr key={lead.id} className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                      <td className="py-2.5 px-3">
                        <button type="button" onClick={() => toggleSelectLead(lead.id)} className="text-slate-400 hover:text-slate-700">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Candidate */}
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => setDetailLeadId(lead.id)}
                          className="font-bold text-slate-900 hover:text-indigo-600 text-left flex items-center gap-1"
                        >
                          <span>{lead.candidateName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {lead.city} {lead.experience ? `• ${lead.experience}` : ''}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 font-mono font-medium text-slate-800">
                          <span>{lead.primaryPhone}</span>
                          {lead.isPhoneMasked && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-sans font-semibold" title="Phone number masked for security">
                              Masked
                            </span>
                          )}
                          <PhoneVerifyBadge status={lead.phoneStatus} />
                        </div>
                        {lead.email && <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{lead.email}</div>}
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3">
                        <PriorityBadge priority={lead.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <StatusBadge status={lead.leadStatus} />
                      </td>

                      {/* Recruiter */}
                      <td className="py-2.5 px-3">
                        <span className={`font-semibold ${lead.assignedRecruiterName === 'Unassigned' ? 'text-rose-600' : 'text-slate-800'}`}>
                          {lead.assignedRecruiterName}
                        </span>
                      </td>

                      {/* Target Client & Job */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{lead.clientName || 'Open Market'}</div>
                        <div className="text-[10px] text-slate-500">{lead.jobTitle || 'Role'}</div>
                      </td>

                      {/* Source & Aging */}
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-700">{lead.leadSource}</span>
                        <div className="text-[10px] text-slate-400">
                          Calls: {lead.callAttempts || 0}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDialBridge(lead)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
                            title="Dial via Phone SIM Bridge"
                          >
                            <Radio className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallLead(lead)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"
                            title="Call Candidate"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsApp(lead.primaryPhone, `Hi ${lead.candidateName}, this is regarding your job application with OAKsphere Connect.`)}
                            className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar (when leads are selected via checkboxes) */}
      <BulkActionBar
        selectedCount={selectedLeadIds.length}
        totalCount={leads.length}
        selectedLeadIds={selectedLeadIds}
        usersList={usersList}
        isAdminOrTL={isAdmin || isTL}
        canExport={user?.permissions?.canExportData !== false}
        onClearSelection={() => setSelectedLeadIds([])}
        onSelectAll={handleSelectAll}
        onBulkStatusUpdated={handleBulkStatusUpdated}
        onBulkAssignModalOpen={() => setIsBulkAssignModalOpen(true)}
        onAutoDistribute={handleAutoDistribute}
        onExportSelected={handleExportSelectedCSV}
      />

      {/* Embedded Modals */}
      {detailLeadId && (
        <LeadDetailModal
          isOpen={!!detailLeadId}
          onClose={() => setDetailLeadId(null)}
          leadId={detailLeadId}
          onLeadUpdated={fetchLeads}
        />
      )}

      {callLead && (
        <CallModal
          isOpen={!!callLead}
          onClose={() => setCallLead(null)}
          lead={callLead}
          onCallLogged={fetchLeads}
        />
      )}

      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        onLeadCreated={fetchLeads}
      />

      <BulkAssignModal
        isOpen={isBulkAssignModalOpen}
        onClose={() => setIsBulkAssignModalOpen(false)}
        selectedLeadIds={selectedLeadIds}
        onAssigned={() => {
          setSelectedLeadIds([]);
          fetchLeads();
        }}
      />
    </div>
  );
};
