import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  CalendarCheck,
  PhoneCall,
  Users,
  Clock,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Building,
  UserCheck,
  FileSpreadsheet,
  Copy,
  BarChart3,
  Bell,
  ScrollText,
  Settings,
  Zap,
  Columns3,
  Trophy,
  MessageSquare,
  Smartphone,
  Activity,
} from 'lucide-react';
import { OakEmblem } from '../common/OakLogo';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTL = user?.role === 'team_leader';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-slate-200 min-h-[calc(100vh-3.5rem)] p-3 flex flex-col justify-between">
      <div className="space-y-5">
        {/* RECRUITER WORKSPACE */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Recruiter Workspace
          </div>
          <nav className="space-y-0.5">
            <NavLink to="/" end className={linkClass}>
              <LayoutDashboard className="w-4 h-4 text-indigo-500" />
              <span>CRM Dashboard</span>
            </NavLink>
            <NavLink to="/my-day" className={linkClass}>
              <CalendarCheck className="w-4 h-4 text-emerald-500" />
              <span>My Day (Tasks)</span>
            </NavLink>
            <NavLink to="/calling-queue" className={linkClass}>
              <PhoneCall className="w-4 h-4 text-sky-500" />
              <span>Calling Queue</span>
            </NavLink>
            <NavLink to="/power-calling" className={linkClass}>
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Power Calling Mode</span>
            </NavLink>
            <NavLink to="/call-bridge" className={linkClass}>
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Phone SIM Bridge</span>
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                LIVE
              </span>
            </NavLink>
            <NavLink to="/telephony" className={linkClass}>
              <Activity className="w-4 h-4 text-sky-500" />
              <span>Telephony Dashboard</span>
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                LIVE
              </span>
            </NavLink>
          </nav>
        </div>

        {/* CANDIDATE FUNNEL */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Candidate Funnel
          </div>
          <nav className="space-y-0.5">
            <NavLink to="/pipeline" className={linkClass}>
              <Columns3 className="w-4 h-4 text-indigo-500" />
              <span>Kanban Pipeline</span>
            </NavLink>
            <NavLink to="/leads" className={linkClass}>
              <Users className="w-4 h-4 text-blue-500" />
              <span>Candidate Leads</span>
            </NavLink>
            <NavLink to="/followups" className={linkClass}>
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Follow-up Engine</span>
            </NavLink>
            <NavLink to="/interviews" className={linkClass}>
              <Calendar className="w-4 h-4 text-purple-500" />
              <span>Interviews</span>
            </NavLink>
            <NavLink to="/joinings" className={linkClass}>
              <CheckCircle className="w-4 h-4 text-teal-500" />
              <span>Joining Tracker</span>
            </NavLink>
            <NavLink to="/action-required" className={linkClass}>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Action Required</span>
            </NavLink>
          </nav>
        </div>

        {/* BUSINESS & TEAMS */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Clients & Performance
          </div>
          <nav className="space-y-0.5">
            <NavLink to="/leaderboard" className={linkClass}>
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Leaderboard & Incentives</span>
            </NavLink>
            <NavLink to="/clients-jobs" className={linkClass}>
              <Building className="w-4 h-4 text-slate-500" />
              <span>Clients & Jobs</span>
            </NavLink>
            <NavLink to="/recruiters" className={linkClass}>
              <UserCheck className="w-4 h-4 text-violet-500" />
              <span>Recruiters & Targets</span>
            </NavLink>
            <NavLink to="/reports" className={linkClass}>
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span>Funnel & Reports</span>
            </NavLink>
          </nav>
        </div>

        {/* OPERATIONS & ADMIN TOOLS */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Tools & Templates
          </div>
          <nav className="space-y-0.5">
            <NavLink to="/templates" className={linkClass}>
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Templates</span>
            </NavLink>
            <NavLink to="/import" className={linkClass}>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>CSV/XLSX Import</span>
            </NavLink>
            {(isAdmin || isTL) && (
              <NavLink to="/duplicates" className={linkClass}>
                <Copy className="w-4 h-4 text-amber-600" />
                <span>Duplicate Merge</span>
              </NavLink>
            )}
            <NavLink to="/notifications" className={linkClass}>
              <Bell className="w-4 h-4 text-slate-500" />
              <span>Notifications</span>
            </NavLink>
            {(isAdmin || isTL) && (
              <NavLink to="/audit-logs" className={linkClass}>
                <ScrollText className="w-4 h-4 text-slate-500" />
                <span>Audit Logs</span>
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/settings" className={linkClass}>
                <Settings className="w-4 h-4 text-slate-500" />
                <span>CRM Settings</span>
              </NavLink>
            )}
          </nav>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
        <OakEmblem className="w-6 h-6 shrink-0" />
        <div className="text-[11px] text-slate-400 leading-tight">
          <div className="font-bold text-slate-700">
            <span className="text-[#0B2240]">OAK</span><span className="text-[#F26522]">Sphere</span> <span className="text-[10px] text-slate-400 font-medium">Connect</span>
          </div>
          <div className="text-[10px] text-slate-400">v2.4 Production CRM</div>
        </div>
      </div>
    </aside>
  );
};
