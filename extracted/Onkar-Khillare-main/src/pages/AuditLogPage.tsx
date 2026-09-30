import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ScrollText, ShieldAlert, Search, RefreshCw, User, Calendar } from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTL = user?.role === 'team_leader';

  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterAction, setFilterAction] = useState<string>('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/audit-logs');
      setLogs(res.auditLogs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  if (!isAdmin && !isTL) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="font-semibold text-slate-800">Access Restricted</p>
        <p className="mt-1">Audit logs are restricted to Administrators and Team Leaders.</p>
      </div>
    );
  }

  const filteredLogs = filterAction ? logs.filter(l => l.action.toLowerCase().includes(filterAction.toLowerCase())) : logs;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-indigo-600" />
              System Audit & Mutation Trail
            </h1>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px]">
              {logs.length} Immutable Event Records
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Cryptographically timestamped audit records for all candidate modifications, status shifts, merges, and lead assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="Filter by action (e.g. ASSIGN, MERGE)..."
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          />
          <button
            type="button"
            onClick={fetchLogs}
            className="p-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Actor / User</th>
                <th className="py-2.5 px-3">Action Event</th>
                <th className="py-2.5 px-3">Entity & ID</th>
                <th className="py-2.5 px-3">Mutation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">Loading audit records...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">No audit records found.</td>
                </tr>
              ) : (
                filteredLogs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      <div>{l.userName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">{l.userRole}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{l.entity}</div>
                      <div className="font-mono text-[10px] text-slate-400">{l.entityId}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-md">
                      <div>{l.details}</div>
                      {l.newValue && typeof l.newValue === 'object' && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {JSON.stringify(l.newValue)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
