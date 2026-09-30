import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Clock, AlertTriangle, ArrowRight, UserPlus, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNotifs = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/notifications');
      setNotifications(res.notifications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
      fetchNotifs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      fetchNotifs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto text-xs">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            In-App Notifications Hub
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Operational alerts for follow-ups due, interview reminders, lead assignments, and team escalations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg"
        >
          Mark All as Read
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notifications found.</div>
        ) : (
          notifications.map((n: any) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                !n.isRead ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg mt-0.5 ${
                  n.type === 'followup_overdue' || n.type === 'escalation'
                    ? 'bg-rose-100 text-rose-700'
                    : n.type === 'interview_tomorrow' || n.type === 'interview_today'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {n.type === 'followup_overdue' ? <AlertTriangle className="w-4 h-4" /> :
                   n.type === 'interview_tomorrow' ? <Calendar className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{n.title}</span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    )}
                  </div>
                  <p className="text-slate-600 text-xs">{n.message}</p>
                  <div className="text-[10px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.linkTo && (
                  <Link
                    to={n.linkTo}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 font-semibold rounded text-[11px] flex items-center gap-1"
                  >
                    Open <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
