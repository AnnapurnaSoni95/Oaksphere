import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, openWhatsApp, formatTimeAgo } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Phone,
  MessageSquare,
  Clock,
  Calendar,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Flame,
  AlertCircle,
  Zap,
  Columns3,
  Radio,
} from 'lucide-react';
import { PriorityBadge, StatusBadge, PhoneVerifyBadge } from '../components/common/Badge';
import { CallModal } from '../components/leads/CallModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';

export const CallingQueuePage: React.FC = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const [activeCallLead, setActiveCallLead] = useState<any | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const fetchCallingQueue = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        view: 'calling_queue',
      });
      if (search) queryParams.set('search', search);
      if (priorityFilter) queryParams.set('priority', priorityFilter);

      const res = await apiRequest(`/api/leads?${queryParams.toString()}`);
      setLeads(res.leads || []);
    } catch (e) {
      console.error('Failed to load calling queue', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCallingQueue();
  }, [user, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCallingQueue();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-indigo-600" />
              Recruiter Calling Workspace
            </h1>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px]">
              {leads.length} Leads in Queue
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Intelligently prioritized queue (Overdue follow-ups → Hot leads → Tomorrow lineups → Today callbacks → New uncalled leads).
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate/phone..."
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 focus:w-60 transition-all"
            />
          </form>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
          >
            <option value="">All Priorities</option>
            <option value="Hot">🔥 Hot Only</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <button
            type="button"
            onClick={fetchCallingQueue}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
            title="Refresh Calling Queue"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <Link
            to="/call-bridge"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all"
            title="Desktop Call to Phone SIM Relay"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-200 animate-pulse" />
            <span>Phone SIM Bridge</span>
          </Link>

          <Link
            to="/power-calling"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>Power Calling Mode</span>
          </Link>

          <Link
            to="/pipeline"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs border border-indigo-200 transition-all"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Kanban Pipeline</span>
          </Link>
        </div>
      </div>

      {/* Calling Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Phone & Verification</th>
                <th className="py-2.5 px-3">Priority / Status</th>
                <th className="py-2.5 px-3">Client & Job Target</th>
                <th className="py-2.5 px-3">Call History & Next Task</th>
                <th className="py-2.5 px-3">Notes & Highlights</th>
                <th className="py-2.5 px-3 text-right">Quick Dial Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading calling queue...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    🎉 Calling queue is completely cleared! All scheduled follow-ups and leads have been dialed.
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const isOverdue = lead.nextFollowupAt && new Date(lead.nextFollowupAt) < new Date();

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOverdue ? 'bg-rose-50/30' : lead.priority === 'Hot' ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Candidate */}
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => setDetailLeadId(lead.id)}
                          className="font-bold text-slate-900 hover:text-indigo-600 text-left flex items-center gap-1.5"
                        >
                          <span>{lead.candidateName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {lead.city} • {lead.experience || 'Fresher'}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800">{lead.primaryPhone}</span>
                          <PhoneVerifyBadge status={lead.phoneStatus} />
                        </div>
                        {lead.alternatePhone && (
                          <div className="text-[10px] text-slate-400 font-mono">Alt: {lead.alternatePhone}</div>
                        )}
                      </td>

                      {/* Priority & Status */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <PriorityBadge priority={lead.priority} />
                          <StatusBadge status={lead.leadStatus} />
                        </div>
                      </td>

                      {/* Client & Job */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{lead.clientName || 'General Application'}</div>
                        <div className="text-[11px] text-slate-500">{lead.jobTitle || 'Role'}</div>
                      </td>

                      {/* Call History */}
                      <td className="py-2.5 px-3">
                        <div className="text-slate-700">
                          <strong>{lead.callAttempts || 0}</strong> calls placed
                        </div>
                        {isOverdue && (
                          <div className="text-rose-600 font-bold text-[10px]">
                            ⚠️ Follow-up Overdue ({formatTimeAgo(lead.nextFollowupAt)})
                          </div>
                        )}
                        {!isOverdue && lead.nextFollowupAt && (
                          <div className="text-amber-700 font-medium text-[10px]">
                            Next: {new Date(lead.nextFollowupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {!lead.nextFollowupAt && lead.lastCallAt && (
                          <div className="text-slate-400 text-[10px]">
                            Last: {lead.lastCallOutcome} ({formatTimeAgo(lead.lastCallAt)})
                          </div>
                        )}
                      </td>

                      {/* Notes Summary */}
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600" title={lead.notesSummary || ''}>
                        {lead.notesSummary || <span className="text-slate-300 italic">No notes</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
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
                              } catch (e) {
                                // proceed to open modal
                              }
                              setActiveCallLead(lead);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            title="Dial via Phone SIM Bridge"
                          >
                            <Radio className="w-3.5 h-3.5 text-emerald-200 animate-pulse" /> SIM Call
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCallLead(lead)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            title="Call candidate & log outcome"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsApp(lead.primaryPhone, `Hi ${lead.candidateName}, this is regarding your job application with OAKsphere Connect for the ${lead.jobTitle || 'recruitment'} opportunity.`)}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                            title="Open WhatsApp chat"
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

      {/* Embedded Modals */}
      {activeCallLead && (
        <CallModal
          isOpen={!!activeCallLead}
          onClose={() => setActiveCallLead(null)}
          lead={activeCallLead}
          onCallLogged={fetchCallingQueue}
        />
      )}

      {detailLeadId && (
        <LeadDetailModal
          isOpen={!!detailLeadId}
          onClose={() => setDetailLeadId(null)}
          leadId={detailLeadId}
          onLeadUpdated={fetchCallingQueue}
        />
      )}
    </div>
  );
};
