import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { MessageTemplate } from '../lib/types';
import {
  MessageSquare,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  Info,
  Send,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New template form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('custom');
  const [formBody, setFormBody] = useState('');

  const fetchTemplates = async () => {
    try {
      const res = await apiRequest<{ templates: MessageTemplate[] }>('/api/templates');
      setTemplates(res.templates);
    } catch (e) {
      console.error('Failed to load templates', e);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCopyBody = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formBody) return;
    try {
      await apiRequest('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          title: formTitle,
          category: formCategory,
          channel: 'whatsapp',
          body: formBody,
        }),
      });
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormBody('');
      fetchTemplates();
    } catch (e) {
      console.error('Failed to create template', e);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await apiRequest(`/api/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {
      console.error('Failed to delete template', e);
    }
  };

  const handleTestPreview = async (tmpl: MessageTemplate) => {
    setSelectedTemplate(tmpl);
    try {
      const res = await apiRequest<{ interpolatedText: string }>('/api/templates/preview', {
        method: 'POST',
        body: JSON.stringify({
          templateId: tmpl.id,
        }),
      });
      setTestOutput(res.interpolatedText);
      setIsTestModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'screening', label: 'Screening Pitch' },
    { id: 'interview', label: 'Interview Letter' },
    { id: 'reminder', label: 'Morning Confirmation' },
    { id: 'status', label: 'Interview Feedback' },
    { id: 'documents', label: 'Document Checklist' },
    { id: 'joining', label: 'Day 1 Joining' },
    { id: 'custom', label: 'Custom Agency' },
  ];

  const filteredTemplates = templates.filter(t =>
    activeCategory === 'all' ? true : t.category === activeCategory
  );

  const tokens = [
    '{{candidate_name}}',
    '{{job_title}}',
    '{{client_name}}',
    '{{salary_range}}',
    '{{interview_date}}',
    '{{interview_time}}',
    '{{interview_venue}}',
    '{{google_maps_link}}',
    '{{contact_person}}',
    '{{recruiter_name}}',
    '{{recruiter_phone}}',
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            WhatsApp & SMS Omnichannel Template Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pre-built agency templates with dynamic candidate token interpolation & 1-click WhatsApp messaging.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Template</span>
        </button>
      </div>

      {/* Available Tokens Banner */}
      <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-sm text-xs">
        <div className="flex items-center gap-2 font-semibold text-indigo-300 mb-1.5">
          <Sparkles className="w-4 h-4" />
          <span>Dynamic Interpolation Tokens (Click token to insert into custom template):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tokens.map(token => (
            <button
              key={token}
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(token);
                setFormBody(prev => prev + ' ' + token);
              }}
              className="font-mono text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-200 px-2 py-0.5 rounded transition-colors"
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(tmpl => {
          const isCopied = copiedId === tmpl.id;
          return (
            <div
              key={tmpl.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{tmpl.title}</h3>
                    <div className="text-[11px] text-slate-400 capitalize mt-0.5 flex items-center gap-2">
                      <span>{tmpl.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-600 font-medium">WhatsApp / SMS</span>
                      {tmpl.isSystem && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">Default</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 font-mono whitespace-pre-wrap line-clamp-6 leading-relaxed">
                  {tmpl.body}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => handleTestPreview(tmpl)}
                  className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Test Sample</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyBody(tmpl.id, tmpl.body)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                    title="Copy template body"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {!tmpl.isSystem && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Test Sample Modal */}
      {isTestModalOpen && selectedTemplate && (
        <Modal
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          title={`Preview: ${selectedTemplate.title}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              Live sample rendered with realistic candidate and recruiter tokens:
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
              {testOutput}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(testOutput);
                  alert('Sample message copied to clipboard!');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
              >
                Copy Sample
              </button>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Custom Template Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Custom Message Template"
          maxWidth="xl"
        >
          <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Template Title</label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g., Weekend Drive Invitation"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="screening">Screening Pitch</option>
                <option value="interview">Interview Call</option>
                <option value="reminder">Reminder</option>
                <option value="status">Status Feedback</option>
                <option value="documents">Documents</option>
                <option value="joining">Day 1 Joining</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-700">Message Text</label>
                <span className="text-[10px] text-slate-400">Supports standard tokens</span>
              </div>
              <textarea
                required
                rows={8}
                value={formBody}
                onChange={e => setFormBody(e.target.value)}
                placeholder="Hello {{candidate_name}}, we invite you to an exclusive walk-in drive for {{job_title}} at {{client_name}}..."
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Save Template
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
