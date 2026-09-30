import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Bell,
  Search,
  User,
  LogOut,
  Shield,
  Briefcase,
  ChevronDown,
  Radio,
  Users,
  Settings,
  CalendarCheck,
  Check,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { OakLogo } from '../common/OakLogo';

export const Navbar: React.FC<{ onGlobalSearch?: (q: string) => void }> = ({ onGlobalSearch }) => {
  const { user, demoUsers, switchDemoUser, logout } = useAuth();
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const navigate = useNavigate();

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    try {
      const res = await apiRequest('/api/notifications');
      setNotifications(res.notifications || []);
      setUnreadNotifCount(res.unreadCount || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
      setUnreadNotifCount(0);
      fetchNotifs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUserSwitch = async (userId: string) => {
    setIsUserMenuOpen(false);
    await switchDemoUser(userId);
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  const roleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'team_leader':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* Clean Single-Row Navbar */}
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <OakLogo variant="horizontal" size="md" />
            <span className="hidden lg:inline-block ml-2 text-[10px] uppercase font-semibold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              Bulk Recruitment CRM
            </span>
          </Link>
        </div>

        {/* Global Search */}
        <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, phone, email, client..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </form>

        {/* Right Actions: SIM Bridge, Notifications, Profile Menu */}
        <div className="flex items-center gap-3">
          {/* Phone SIM Call Bridge Indicator */}
          <Link
            to="/call-bridge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors shadow-2xs"
            title="Open Phone SIM Call Bridge"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="hidden sm:inline">SIM Bridge</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </Link>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {isNotifDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800">
                    Notifications ({notifications.length})
                  </span>
                  {unreadNotifCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-indigo-600 hover:underline font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
                  ) : (
                    notifications.slice(0, 6).map(n => (
                      <Link
                        key={n.id}
                        to={n.linkTo || '/notifications'}
                        onClick={() => setIsNotifDropdownOpen(false)}
                        className={`block p-3 hover:bg-slate-50 text-xs transition-colors ${
                          !n.isRead ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{n.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] mt-0.5">{n.message}</p>
                      </Link>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setIsNotifDropdownOpen(false)}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    View All Notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Account Switcher Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                  {user?.name || 'Recruiter'}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {user?.role === 'admin' ? 'Admin' : user?.role === 'team_leader' ? 'Team Lead' : 'Recruiter'}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in-50 duration-150">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {user?.name}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeStyle(user?.role)} uppercase`}>
                      {user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{user?.teamName || 'Agency Operations'}</div>
                </div>

                {/* Clean Account / Role Switcher Select */}
                <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Switch Workspace Role / User
                  </label>
                  <select
                    value={user?.id || ''}
                    onChange={(e) => handleUserSwitch(e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                  >
                    <optgroup label="👑 System Administrators">
                      {demoUsers.filter(u => u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} (Admin)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🛡️ Team Leaders">
                      {demoUsers.filter(u => u.role === 'team_leader').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} (TL - {u.teamName})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🎧 Recruiters">
                      {demoUsers.filter(u => u.role === 'recruiter').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} (Recruiter)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Quick Navigation Links */}
                <div className="py-1 text-xs">
                  <Link
                    to="/my-day"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    <CalendarCheck className="w-4 h-4 text-slate-400" />
                    <span>My Day & Tasks</span>
                  </Link>

                  <Link
                    to="/recruiters"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>Recruiter Targets & Quotas</span>
                  </Link>

                  {user?.role === 'admin' && (
                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>CRM Master Settings</span>
                    </Link>
                  )}
                </div>

                {/* Logout Button */}
                <div className="pt-1 mt-1 border-t border-slate-100 px-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
