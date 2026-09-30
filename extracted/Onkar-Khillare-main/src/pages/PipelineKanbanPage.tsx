import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Lead, Job } from '../lib/types';
import {
  Columns3,
  Search,
  Filter,
  Phone,
  MessageSquare,
  Sparkles,
  Award,
  Calendar,
  Building,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { CallModal } from '../components/leads/CallModal';
import { TemplateDrawerModal } from '../components/leads/TemplateDrawerModal';
import { ScreeningScorecardModal } from '../components/leads/ScreeningScorecardModal';
import { SmartJobMatcherModal } from '../components/leads/SmartJobMatcherModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';

interface KanbanColumn {
  id: string;
  stageKey: string;
  title: string;
  colorBorder: string;
  colorHeader: string;
  colorBadge: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'col_new',
    stageKey: 'New',
    title: 'New Leads',
    colorBorder: 'border-blue-300',
    colorHeader: 'bg-blue-50/70 text-blue-900',
    colorBadge: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'col_screened',
    stageKey: 'Interested',
    title: 'Screened & Qualified',
    colorBorder: 'border-emerald-300',
    colorHeader: 'bg-emerald-50/70 text-emerald-900',
    colorBadge: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'col_interview',
    stageKey: 'Interview Scheduled',
    title: 'Interview Lineup',
    colorBorder: 'border-purple-300',
    colorHeader: 'bg-purple-50/70 text-purple-900',
    colorBadge: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'col_attended',
    stageKey: 'Interview Attended',
    title: 'Interview Attended',
    colorBorder: 'border-indigo-300',
    colorHeader: 'bg-indigo-50/70 text-indigo-900',
    colorBadge: 'bg-indigo-100 text-indigo-800',
  },
  {
    id: 'col_selected',
    stageKey: 'Selected',
    title: 'Selected',
    colorBorder: 'border-amber-300',
    colorHeader: 'bg-amber-50/70 text-amber-900',
    colorBadge: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'col_offer',
    stageKey: 'Joining Scheduled',
    title: 'Offer Released',
    colorBorder: 'border-teal-300',
    colorHeader: 'bg-teal-50/70 text-teal-900',
    colorBadge: 'bg-teal-100 text-teal-800',
  },
  {
    id: 'col_joined',
    stageKey: 'Joined',
    title: 'Joined (Billed)',
    colorBorder: 'border-emerald-500',
    colorHeader: 'bg-emerald-100/70 text-emerald-950 font-bold',
    colorBadge: 'bg-emerald-200 text-emerald-900',
  },
];

export const PipelineKanbanPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [usersList, setUsersList] = useState<Array<{ id: string; name: string }>>([]);
  const [clientsList, setClientsList] = useState<Array<{ id: string; companyName: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');

  // Dragging state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  // Modals state
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isScorecardModalOpen, setIsScorecardModalOpen] = useState<boolean>(false);
  const [isJobMatcherOpen, setIsJobMatcherOpen] = useState<boolean>(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ leads: Lead[] }>('/api/leads?limit=150');
      setLeads(res.leads);
    } catch (e) {
      console.error('Failed to load leads for kanban', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    apiRequest('/api/users').then(res => setUsersList(res.users || [])).catch(() => {});
    apiRequest('/api/clients').then(res => setClientsList(res.clients || [])).catch(() => {});
  }, []);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDraggedLeadId(null);
    if (!leadId) return;

    const currentLead = leads.find(l => l.id === leadId);
    if (!currentLead || currentLead.leadStatus === targetStage) return;

    // Optimistic UI update
    setLeads(prev =>
      prev.map(l => (l.id === leadId ? { ...l, leadStatus: targetStage as any } : l))
    );

    try {
      await apiRequest(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({
          newStage: targetStage,
          notes: `Moved candidate to ${targetStage} via Kanban pipeline`,
        }),
      });
    } catch (err) {
      console.error('Failed to update stage on drag drop', err);
      // Revert if error
      fetchLeads();
    }
  };

  // Filtered leads
  const filteredLeads = leads.filter(l => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = l.candidateName.toLowerCase().includes(q);
      const matchPhone = l.primaryPhone.includes(q);
      const matchJob = l.jobTitle?.toLowerCase().includes(q) || false;
      if (!matchName && !matchPhone && !matchJob) return false;
    }
    if (selectedRecruiter !== 'all' && l.assignedRecruiterId !== selectedRecruiter) {
      return false;
    }
    if (selectedClient !== 'all' && l.clientId !== selectedClient) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-indigo-600" />
            Visual Recruitment Pipeline (Interactive Kanban)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag and drop candidate cards across stages to advance hiring workflows instantly.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate / phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 w-48"
            />
          </div>

          <select
            value={selectedRecruiter}
            onChange={e => setSelectedRecruiter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
          >
            <option value="all">All Recruiters</option>
            {usersList.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
          >
            <option value="all">All Clients</option>
            {clientsList.map(c => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>

          <button
            onClick={fetchLeads}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm"
            title="Refresh pipeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 flex gap-3 overflow-x-auto pb-4 items-start select-none">
        {KANBAN_COLUMNS.map(col => {
          const columnLeads = filteredLeads.filter(l => {
            if (col.stageKey === 'New') return l.leadStatus === 'New' || l.leadStatus === 'Calling';
            return l.leadStatus === col.stageKey;
          });

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.stageKey)}
              className={`w-72 shrink-0 bg-slate-100/80 rounded-xl flex flex-col max-h-full border ${col.colorBorder} shadow-xs transition-colors ${
                draggedLeadId ? 'hover:bg-slate-200/50' : ''
              }`}
            >
              {/* Column Header */}
              <div
                className={`p-3 rounded-t-xl flex items-center justify-between border-b border-slate-200 ${col.colorHeader}`}
              >
                <div className="font-semibold text-xs truncate">{col.title}</div>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${col.colorBadge}`}>
                  {columnLeads.length}
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[300px]">
                {columnLeads.length === 0 ? (
                  <div className="py-12 text-center text-[11px] text-slate-400 italic">
                    Drop candidates here
                  </div>
                ) : (
                  columnLeads.map(lead => {
                    const isDragging = draggedLeadId === lead.id;
                    const fitScore = lead.scorecard?.fitScore;

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={e => handleDragStart(e, lead.id)}
                        className={`bg-white rounded-lg p-3 border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 ${
                          isDragging ? 'opacity-40 border-dashed border-indigo-400' : ''
                        }`}
                      >
                        {/* Title & Priority */}
                        <div className="flex items-start justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailLeadId(lead.id)}
                            className="text-left font-semibold text-xs text-slate-900 hover:text-indigo-600 line-clamp-1"
                          >
                            {lead.candidateName}
                          </button>

                          {/* Fit Score Badge */}
                          {fitScore !== undefined ? (
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                fitScore >= 70
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : fitScore >= 50
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                              title={`Fit Score: ${fitScore}%`}
                            >
                              {fitScore}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">Unscreened</span>
                          )}
                        </div>

                        {/* Unboxed Metadata */}
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          <div className="flex items-center gap-1.5 font-mono text-slate-700">
                            <span>+91 {lead.primaryPhone}</span>
                            <span aria-hidden="true">·</span>
                            <span>{lead.city}</span>
                          </div>

                          {lead.jobTitle && (
                            <div className="text-[11px] text-indigo-700 truncate font-medium">
                              {lead.jobTitle}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>{lead.assignedRecruiterName.split(' ')[0]}</span>
                            <span>{lead.leadSource}</span>
                          </div>
                        </div>

                        {/* Card Quick Action Toolbar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveLead(lead);
                                setIsCallModalOpen(true);
                              }}
                              className="p-1.5 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                              title="Log Call"
                            >
                              <Phone className="w-3.5 h-3.5 text-indigo-500" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveLead(lead);
                                setIsTemplateModalOpen(true);
                              }}
                              className="p-1.5 hover:text-emerald-600 hover:bg-slate-100 rounded transition-colors"
                              title="Send WhatsApp Template"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveLead(lead);
                                setIsScorecardModalOpen(true);
                              }}
                              className="p-1.5 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors"
                              title="Evaluate Screening Scorecard"
                            >
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveLead(lead);
                                setIsJobMatcherOpen(true);
                              }}
                              className="p-1.5 hover:text-sky-600 hover:bg-slate-100 rounded transition-colors"
                              title="Match Client Jobs"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setDetailLeadId(lead.id)}
                            className="text-[10px] text-indigo-600 hover:underline font-medium"
                          >
                            Details →
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Modals */}
      {isCallModalOpen && activeLead && (
        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => {
            setIsCallModalOpen(false);
            setActiveLead(null);
          }}
          lead={activeLead}
          onCallLogged={() => {
            setIsCallModalOpen(false);
            fetchLeads();
          }}
        />
      )}

      {isTemplateModalOpen && activeLead && (
        <TemplateDrawerModal
          isOpen={isTemplateModalOpen}
          onClose={() => {
            setIsTemplateModalOpen(false);
            setActiveLead(null);
          }}
          lead={activeLead}
        />
      )}

      {isScorecardModalOpen && activeLead && (
        <ScreeningScorecardModal
          isOpen={isScorecardModalOpen}
          onClose={() => {
            setIsScorecardModalOpen(false);
            setActiveLead(null);
          }}
          lead={activeLead}
          onScorecardSaved={updated => {
            setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)));
          }}
        />
      )}

      {isJobMatcherOpen && activeLead && (
        <SmartJobMatcherModal
          isOpen={isJobMatcherOpen}
          onClose={() => {
            setIsJobMatcherOpen(false);
            setActiveLead(null);
          }}
          lead={activeLead}
          onJobAssigned={() => {
            fetchLeads();
          }}
          onScheduleInterview={job => {
            setActiveLead(prev => (prev ? { ...prev, jobId: job.id, jobTitle: job.positionTitle, clientId: job.clientId, clientName: job.clientName } : null));
            setIsCallModalOpen(true);
          }}
        />
      )}

      {detailLeadId && (
        <LeadDetailModal
          isOpen={!!detailLeadId}
          onClose={() => setDetailLeadId(null)}
          leadId={detailLeadId}
          onLeadUpdated={() => {
            fetchLeads();
          }}
        />
      )}
    </div>
  );
};
