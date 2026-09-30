import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiRequest, openWhatsApp } from '../../lib/api';
import { MessageTemplate, Lead } from '../../lib/types';
import { MessageSquare, Copy, Check, Send, Sparkles, AlertCircle } from 'lucide-react';

interface TemplateDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: Lead | {
    id: string;
    candidateName: string;
    primaryPhone: string;
    city?: string;
    jobTitle?: string;
    clientName?: string;
    expectedSalary?: number;
  } | null;
}

export const TemplateDrawerModal: React.FC<TemplateDrawerModalProps> = ({
  isOpen,
  onClose,
  lead,
}) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [customText, setCustomText] = useState<string>('');
  const [whatsAppUrl, setWhatsAppUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      apiRequest<{ templates: MessageTemplate[] }>('/api/templates')
        .then(res => {
          setTemplates(res.templates);
          if (res.templates.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(res.templates[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTemplateId) {
      setIsLoading(true);
      apiRequest<{ interpolatedText: string; whatsAppUrl: string }>('/api/templates/preview', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplateId,
          leadId: lead?.id,
        }),
      })
        .then(res => {
          setCustomText(res.interpolatedText);
          setWhatsAppUrl(res.whatsAppUrl);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [selectedTemplateId, lead?.id]);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(t =>
    categoryFilter === 'all' ? true : t.category === categoryFilter
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (lead?.primaryPhone) {
      openWhatsApp(lead.primaryPhone, customText);
    } else if (whatsAppUrl) {
      window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'screening', label: 'Screening Pitch' },
    { id: 'interview', label: 'Interview Letter' },
    { id: 'reminder', label: 'Morning Reminder' },
    { id: 'status', label: 'Interview Status' },
    { id: 'documents', label: 'Doc Checklist' },
    { id: 'joining', label: 'Joining Welcome' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="WhatsApp & SMS Message Dispatcher"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Recipient Header */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="text-slate-500">Candidate:</span>{' '}
            <span className="font-semibold text-slate-800">{lead?.candidateName || 'Quick Preview'}</span>
            {lead?.primaryPhone && (
              <span className="ml-2 font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                +91 {lead.primaryPhone}
              </span>
            )}
          </div>
          <div className="text-slate-500">
            {lead?.jobTitle ? (
              <span>Job: <strong className="text-slate-700">{lead.jobTitle}</strong></span>
            ) : (
              <span>Dynamic auto-fill enabled</span>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates Grid / Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1 space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Select Template</label>
            {filteredTemplates.map(t => {
              const isSelected = t.id === selectedTemplateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/60 font-medium text-indigo-950 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-semibold line-clamp-1">{t.title}</div>
                  <div className="text-[10px] text-slate-500 capitalize mt-0.5 flex items-center justify-between">
                    <span>{t.category}</span>
                    <span className="text-emerald-600 font-mono">WhatsApp</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Preview & Editor */}
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Personalized Preview & Message Body
              </label>
              <span className="text-[10px] text-slate-400">Tokens interpolated</span>
            </div>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                Generating message preview...
              </div>
            ) : (
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={12}
                className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner resize-y leading-relaxed text-slate-800"
                placeholder="Message preview will appear here..."
              />
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-500">
                Char count: <span className="font-semibold text-slate-700">{customText.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={!lead?.primaryPhone}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 flex items-center justify-between">
          <span>Tip: Candidate tokens like name, time, and maps venue link automatically adjust per candidate.</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
