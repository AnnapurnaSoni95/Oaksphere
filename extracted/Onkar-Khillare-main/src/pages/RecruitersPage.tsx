import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { UserPermissions, getDefaultPermissions } from '../lib/types';
import {
  UserCheck,
  Target,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Phone,
  Calendar,
  Sparkles,
  TrendingUp,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Download,
  AlertTriangle,
  AlertOctagon,
  Users,
  Check,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const RecruitersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTL = user?.role === 'team_leader';

  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Target & Permissions Edit Modal
  const [editUser, setEditUser] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<'targets' | 'permissions'>('targets');
  const [dailyCalls, setDailyCalls] = useState('60');
  const [dailyConnected, setDailyConnected] = useState('30');
  const [dailyLineups, setDailyLineups] = useState('5');
  const [monthlyJoinings, setMonthlyJoinings] = useState('8');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions>(getDefaultPermissions('recruiter'));

  // Delete Recruiter Modal
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [reassignToUserId, setReassignToUserId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // New User Modal
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('recruiter123');
  const [newRole, setNewRole] = useState('recruiter');
  const [newTeamName, setNewTeamName] = useState('Tech & BPO');
  const [newPhone, setNewPhone] = useState('');
  const [newPermissions, setNewPermissions] = useState<UserPermissions>(getDefaultPermissions('recruiter'));

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [uRes, dRes, lRes] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/dashboard/stats'),
        apiRequest('/api/leads'),
      ]);
      setUsers(uRes.users || []);
      setStats(dRes.recruiters || []);
      setLeads(lRes.leads || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleOpenEdit = (u: any) => {
    setEditUser(u);
    setModalTab('targets');
    setDailyCalls(String(u.dailyCallTarget || 60));
    setDailyConnected(String(u.dailyConnectedTarget || 30));
    setDailyLineups(String(u.dailyLineupTarget || 5));
    setMonthlyJoinings(String(u.monthlyJoiningTarget || 8));
    setIsActive(u.isActive);
    setPermissions(u.permissions || getDefaultPermissions(u.role));
  };

  const handleUpdateTargetsAndPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      await apiRequest(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          dailyCallTarget: Number(dailyCalls),
          dailyConnectedTarget: Number(dailyConnected),
          dailyLineupTarget: Number(dailyLineups),
          monthlyJoiningTarget: Number(monthlyJoinings),
          isActive,
          permissions,
        }),
      });
      setEditUser(null);
      setFeedbackMsg(`Updated targets and access limitations for ${editUser.name}.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          teamName: newTeamName,
          phone: newPhone,
          dailyCallTarget: Number(dailyCalls),
          dailyConnectedTarget: Number(dailyConnected),
          dailyLineupTarget: Number(dailyLineups),
          monthlyJoiningTarget: Number(monthlyJoinings),
          permissions: newPermissions,
        }),
      });
      setIsNewUserModalOpen(false);
      setNewName('');
      setNewEmail('');
      setFeedbackMsg(`Created new team member ${newName} with configured access limits.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await apiRequest(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reassignToUserId: reassignToUserId || undefined }),
      });
      setUserToDelete(null);
      setFeedbackMsg(res.message || `Recruiter deleted successfully.`);
      setTimeout(() => setFeedbackMsg(null), 5000);
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete recruiter.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getAssignedLeadsCount = (userId: string) => {
    return leads.filter(l => l.assignedRecruiterId === userId).length;
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Recruiter Productivity & Access Management
            </h1>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px]">
              {users.length} Team Members
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage recruiter targets, access limitations (data export, phone masking, database scope), and account deletion with lead reassignment.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setNewRole('recruiter');
              setNewPermissions(getDefaultPermissions('recruiter'));
              setIsNewUserModalOpen(true);
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add Team Member
          </button>
        )}
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Recruiter Performance & Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u: any) => {
          const recStat = stats.find(s => s.id === u.id);
          const actCalls = recStat?.actualDailyCalls || 0;
          const tgtCalls = u.dailyCallTarget || 60;
          const actConn = recStat?.actualDailyConnected || 0;
          const tgtConn = u.dailyConnectedTarget || 30;
          const actLineups = recStat?.actualDailyLineups || 0;
          const tgtLineups = u.dailyLineupTarget || 5;
          const actJoin = recStat?.actualMonthlyJoinings || 0;
          const tgtJoin = u.monthlyJoiningTarget || 8;
          const assignedCount = getAssignedLeadsCount(u.id);

          const callPercent = Math.min(100, Math.round((actCalls / tgtCalls) * 100));
          const perms: UserPermissions = u.permissions || getDefaultPermissions(u.role);
          const isCurrentUser = user?.id === u.id;

          return (
            <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{u.name}</span>
                      {isCurrentUser && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          You
                        </span>
                      )}
                    </h3>
                    <div className="text-[11px] text-slate-500">
                      {u.role.toUpperCase()} • {u.teamName || 'General Team'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600 line-through'
                  }`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>

                  {isAdmin && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-md transition-colors"
                        title="Configure Targets & Access Limitations"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isCurrentUser}
                        onClick={() => {
                          setUserToDelete(u);
                          // Default reassign to another active recruiter or admin
                          const other = users.find(o => o.id !== u.id && o.isActive);
                          setReassignToUserId(other ? other.id : '');
                          setDeleteError(null);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          isCurrentUser
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                        }`}
                        title={isCurrentUser ? 'Cannot delete your own active session' : 'Delete Recruiter & Reassign Leads'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Access Limitations Badge Strip */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-slate-400" /> Security & Access Limits
                  </span>
                  <span className="font-semibold text-slate-500">{assignedCount} Leads In Pipeline</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                  <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                    perms.canExportData
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {perms.canExportData ? 'Export Allowed' : 'Export Blocked'}
                  </span>

                  <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                    perms.canViewCandidatePhone
                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {perms.canViewCandidatePhone ? 'Phone Full' : 'Phone Masked'}
                  </span>

                  <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                    perms.canViewAllLeads
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {perms.canViewAllLeads ? 'Scope: All Leads' : 'Scope: Assigned Only'}
                  </span>
                </div>
              </div>

              {/* Daily Call Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500">Daily Calling Target</span>
                  <span className="font-bold text-slate-900">{actCalls} / {tgtCalls} ({callPercent}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      callPercent >= 80 ? 'bg-emerald-500' : callPercent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${callPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Target Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                <div className="p-2 bg-indigo-50/70 rounded border border-indigo-100">
                  <span className="text-[10px] text-slate-500 block">Connected</span>
                  <span className="font-bold text-indigo-900 text-xs font-mono">{actConn} / {tgtConn}</span>
                </div>
                <div className="p-2 bg-purple-50/70 rounded border border-purple-100">
                  <span className="text-[10px] text-slate-500 block">Lineups</span>
                  <span className="font-bold text-purple-900 text-xs font-mono">{actLineups} / {tgtLineups}</span>
                </div>
                <div className="p-2 bg-emerald-50/70 rounded border border-emerald-100">
                  <span className="text-[10px] text-emerald-800 block font-semibold">Joinings</span>
                  <span className="font-bold text-emerald-950 text-xs font-mono">{actJoin} / {tgtJoin}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Targets & Access Limitations Modal */}
      {editUser && (
        <Modal
          isOpen={!!editUser}
          onClose={() => setEditUser(null)}
          title={`Configure User: ${editUser.name}`}
          subtitle={`Role: ${editUser.role.toUpperCase()} • Team: ${editUser.teamName || 'General'}`}
          maxWidth="lg"
        >
          {/* Modal Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-2 mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setModalTab('targets')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                modalTab === 'targets'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Operational KPI Targets
            </button>
            <button
              type="button"
              onClick={() => setModalTab('permissions')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                modalTab === 'permissions'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Access Limitations & Permissions
            </button>
          </div>

          <form onSubmit={handleUpdateTargetsAndPermissions} className="space-y-4 text-xs">
            {modalTab === 'targets' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Daily Calls Quota</label>
                    <input
                      type="number"
                      value={dailyCalls}
                      onChange={(e) => setDailyCalls(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Daily Connected Target</label>
                    <input
                      type="number"
                      value={dailyConnected}
                      onChange={(e) => setDailyConnected(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Daily Lineups Target</label>
                    <input
                      type="number"
                      value={dailyLineups}
                      onChange={(e) => setDailyLineups(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Monthly Joinings Target</label>
                    <input
                      type="number"
                      value={monthlyJoinings}
                      onChange={(e) => setMonthlyJoinings(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Active for Lead Distribution</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Inactive recruiters will never receive leads via auto-distribution or assignment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px]">
                  Configure role-based access limitations for <strong>{editUser.name}</strong> to safeguard candidate databases against data leaks and offline poaching.
                </div>

                <div className="space-y-2">
                  {/* Export Data Permission */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={permissions.canExportData}
                      onChange={(e) => setPermissions({ ...permissions, canExportData: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                        Allow Candidate CSV / Excel Data Export
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        When disabled, the recruiter cannot export candidate spreadsheets, protecting client and agency data against leakage.
                      </p>
                    </div>
                  </label>

                  {/* Phone Number Masking */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={permissions.canViewCandidatePhone}
                      onChange={(e) => setPermissions({ ...permissions, canViewCandidatePhone: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        Reveal Full Candidate Telephone Numbers
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        When disabled (recommended for high-volume recruiters), phone numbers are masked (e.g. 98203 ••••••) in lists to stop offline poaching. Recruiters can still trigger 1-click calls and SIM Bridge calls directly.
                      </p>
                    </div>
                  </label>

                  {/* Scope of Leads */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={permissions.canViewAllLeads}
                      onChange={(e) => setPermissions({ ...permissions, canViewAllLeads: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        Allow Viewing All Agency Leads
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        When disabled, the recruiter can only see and access candidate leads assigned directly to them.
                      </p>
                    </div>
                  </label>

                  {/* Delete Leads Permission */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={permissions.canDeleteLeads}
                      onChange={(e) => setPermissions({ ...permissions, canDeleteLeads: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        Allow Permanently Deleting Candidate Leads
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Prevents accidental or malicious deletion of valuable applicant profiles.
                      </p>
                    </div>
                  </label>

                  {/* Bulk Reassign Permission */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={permissions.canBulkReassign}
                      onChange={(e) => setPermissions({ ...permissions, canBulkReassign: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                        Allow Reassigning Candidate Leads to Others
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Controls whether this agent can reassign leads across team members.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-xs transition-colors"
              >
                Save Settings & Permissions
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Recruiter Modal with Lead Reassignment */}
      {userToDelete && (
        <Modal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          title={`Delete Recruiter: ${userToDelete.name}`}
          subtitle="Safely decommission account & reassign active candidate pipeline"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                {deleteError}
              </div>
            )}

            {/* Warning Box */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs">Permanent Account Deletion Warning</div>
                <div className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                  You are about to delete <strong>{userToDelete.name}</strong> ({userToDelete.email}). This agent has{' '}
                  <strong className="font-bold text-rose-950 underline">
                    {getAssignedLeadsCount(userToDelete.id)} candidate leads
                  </strong>{' '}
                  currently in progress in the CRM pipeline.
                </div>
              </div>
            </div>

            {/* Lead Reassignment Selector */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block font-bold text-slate-900">
                Transfer Candidate Leads To:
              </label>
              <select
                value={reassignToUserId}
                onChange={(e) => setReassignToUserId(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Leave Unassigned (Move to Open Market)</option>
                <optgroup label="Active Team Members">
                  {users
                    .filter((u: any) => u.id !== userToDelete.id && u.isActive)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toUpperCase()} — {u.teamName || 'General'})
                      </option>
                    ))}
                </optgroup>
              </select>
              <p className="text-[11px] text-slate-500">
                All scheduled calls, follow-ups, and interview candidates will be transferred to the selected agent automatically without losing history.
              </p>
            </div>

            {/* Confirmation Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting & Reassigning...' : 'Delete Recruiter & Transfer Leads'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New User Modal with Access Limitations */}
      {isNewUserModalOpen && (
        <Modal
          isOpen={isNewUserModalOpen}
          onClose={() => setIsNewUserModalOpen(false)}
          title="Create New Team Member"
          subtitle="Provision recruiter or team leader account with access limits"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Anand Kulkarni"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="anand@oaksphere.com"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value;
                    setNewRole(r);
                    setNewPermissions(getDefaultPermissions(r as any));
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  <option value="recruiter">Recruiter (Limited Access)</option>
                  <option value="team_leader">Team Leader (Team Access)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>

            {/* Access Limitations Configuration */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Default Access Limitations & Security Preset
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermissions.canExportData}
                    onChange={(e) => setNewPermissions({ ...newPermissions, canExportData: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Allow Lead Data Export (CSV)</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermissions.canViewCandidatePhone}
                    onChange={(e) => setNewPermissions({ ...newPermissions, canViewCandidatePhone: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Show Full Candidate Phone Numbers</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermissions.canViewAllLeads}
                    onChange={(e) => setNewPermissions({ ...newPermissions, canViewAllLeads: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>View All Agency Leads (Beyond Assigned)</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermissions.canDeleteLeads}
                    onChange={(e) => setNewPermissions({ ...newPermissions, canDeleteLeads: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Allow Deleting Candidate Leads</span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 text-white font-semibold rounded-md shadow-xs"
              >
                Create Account with Permissions
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

