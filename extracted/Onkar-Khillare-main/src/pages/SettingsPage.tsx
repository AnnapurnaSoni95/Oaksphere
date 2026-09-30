import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CRMSettings } from '../lib/types';
import {
  Settings,
  ShieldAlert,
  CheckCircle2,
  Building,
  Globe,
  Share2,
  Search,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  Zap,
  Target,
  RefreshCw,
  ExternalLink,
  Sliders,
  DollarSign,
  Send,
  Upload,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<CRMSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'cms' | 'meta' | 'google' | 'master' | 'quotas'>('cms');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Simulator states
  const [metaSimName, setMetaSimName] = useState('Pooja Deshmukh');
  const [metaSimPhone, setMetaSimPhone] = useState('9820399881');
  const [metaSimCity, setMetaSimCity] = useState('Pune');
  const [metaSimExp, setMetaSimExp] = useState('1.5 Years in BPO Telesales');
  const [metaSimShift, setMetaSimShift] = useState('24/7 Rotational');
  const [metaSimCampaign, setMetaSimCampaign] = useState('Pune BPO Mega Walk-In Drive (FB Feed)');
  const [metaSimLoading, setMetaSimLoading] = useState(false);
  const [metaSimResult, setMetaSimResult] = useState<string | null>(null);

  const [googleSimName, setGoogleSimName] = useState('Aditya Deshpande');
  const [googleSimPhone, setGoogleSimPhone] = useState('9820411229');
  const [googleSimCity, setGoogleSimCity] = useState('Pune');
  const [googleSimCampaign, setGoogleSimCampaign] = useState('Search - BPO Jobs In Pune (Exact Match)');
  const [googleSimLoading, setGoogleSimLoading] = useState(false);
  const [googleSimResult, setGoogleSimResult] = useState<string | null>(null);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // New item inputs
  const [newSource, setNewSource] = useState('');
  const [newShift, setNewShift] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ settings: CRMSettings }>('/api/settings');
      setSettings(res.settings);
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await apiRequest<{ settings: CRMSettings }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSettings(res.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Meta Simulator Trigger
  const handleSimulateMetaLead = async () => {
    setMetaSimLoading(true);
    setMetaSimResult(null);
    try {
      const res = await apiRequest('/api/integrations/meta/simulate-lead', {
        method: 'POST',
        body: JSON.stringify({
          candidateName: metaSimName,
          phone: metaSimPhone,
          city: metaSimCity,
          experience: metaSimExp,
          preferredShift: metaSimShift,
          campaignName: metaSimCampaign,
        }),
      });
      setMetaSimResult(`✅ Success! Lead for "${res.lead.candidateName}" captured & auto-assigned to ${res.lead.assignedRecruiterName}.`);
      fetchSettings();
    } catch (e: any) {
      setMetaSimResult(`❌ Error: ${e.message || 'Simulation failed'}`);
    } finally {
      setMetaSimLoading(false);
    }
  };

  // Google Simulator Trigger
  const handleSimulateGoogleLead = async () => {
    setGoogleSimLoading(true);
    setGoogleSimResult(null);
    try {
      const res = await apiRequest('/api/integrations/google/simulate-lead', {
        method: 'POST',
        body: JSON.stringify({
          candidateName: googleSimName,
          phone: googleSimPhone,
          city: googleSimCity,
          campaignName: googleSimCampaign,
        }),
      });
      setGoogleSimResult(`✅ Success! Google Search Lead with GCLID captured for "${res.lead.candidateName}". Assigned to ${res.lead.assignedRecruiterName}.`);
      fetchSettings();
    } catch (e: any) {
      setGoogleSimResult(`❌ Error: ${e.message || 'Simulation failed'}`);
    } finally {
      setGoogleSimLoading(false);
    }
  };

  // Google Offline Conversions Sync
  const handleSyncGoogleConversions = async () => {
    setSyncingGoogle(true);
    setSyncResult(null);
    try {
      const res = await apiRequest('/api/integrations/google/sync-conversions', {
        method: 'POST',
      });
      setSyncResult(res.message);
    } catch (e: any) {
      setSyncResult(`❌ Sync failed: ${e.message}`);
    } finally {
      setSyncingGoogle(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="font-semibold text-slate-800">Access Restricted</p>
        <p className="mt-1">CRM configuration settings & ad integrations are restricted to Administrators.</p>
      </div>
    );
  }

  if (isLoading || !settings) {
    return <div className="p-8 text-center text-slate-500 text-xs">Loading CRM settings & integrations...</div>;
  }

  const originUrl = window.location.origin;
  const metaWebhookFullUrl = `${originUrl}/api/webhooks/meta-leads`;
  const googleWebhookFullUrl = `${originUrl}/api/webhooks/google-leads`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-xs">
      {/* Page Title & Save Button */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            CRM Central Operations, CMS & Ad Integrations
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage agency brand profile, careers CMS, Meta Lead Ads (FB/IG), Google Ads with offline conversions, and recruiter business rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-semibold rounded-lg flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Settings Saved!
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-colors"
          >
            {isSaving ? 'Saving Changes...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('cms')}
          className={`px-3.5 py-2 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5 ${
            activeTab === 'cms' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Agency Brand & Careers CMS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('meta')}
          className={`px-3.5 py-2 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5 ${
            activeTab === 'meta' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Share2 className="w-4 h-4 text-blue-600" />
          <span>Meta Ads (Facebook & Instagram)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('google')}
          className={`px-3.5 py-2 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5 ${
            activeTab === 'google' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4 text-red-500" />
          <span>Google Ads & Offline Conversions</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('master')}
          className={`px-3.5 py-2 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5 ${
            activeTab === 'master' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4 text-slate-500" />
          <span>Master Channels & Dropdowns</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quotas')}
          className={`px-3.5 py-2 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5 ${
            activeTab === 'quotas' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4 text-amber-500" />
          <span>Quotas & Escalation Timings</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: AGENCY BRAND & CAREERS CMS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cms' && (
        <div className="space-y-6">
          {/* Agency Profile */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              Agency Entity Profile & Legal Registration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Agency Name</label>
                <input
                  type="text"
                  value={settings.agencyCMS.agencyName}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, agencyName: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Brand Tagline</label>
                <input
                  type="text"
                  value={settings.agencyCMS.tagline}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, tagline: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Registration / GSTIN / CIN</label>
                <input
                  type="text"
                  value={settings.agencyCMS.registrationNumber}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, registrationNumber: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Official Support Phone</label>
                <input
                  type="text"
                  value={settings.agencyCMS.officialPhone}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, officialPhone: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Official Candidate Inquiries Email</label>
                <input
                  type="email"
                  value={settings.agencyCMS.officialEmail}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, officialEmail: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Agency Website URL</label>
                <input
                  type="url"
                  value={settings.agencyCMS.websiteUrl}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, websiteUrl: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Headquarters & Walk-In Hub Address</label>
              <input
                type="text"
                value={settings.agencyCMS.headquartersAddress}
                onChange={e =>
                  setSettings({
                    ...settings,
                    agencyCMS: { ...settings.agencyCMS, headquartersAddress: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Careers Portal CMS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              Public Careers & Job Portal Content CMS
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Portal Page Title</label>
                <input
                  type="text"
                  value={settings.agencyCMS.careersPortalTitle}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, careersPortalTitle: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Hero Section Headline</label>
                <input
                  type="text"
                  value={settings.agencyCMS.careersHeroHeadline}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, careersHeroHeadline: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Hero Subheadline & Trust Statement</label>
              <textarea
                rows={2}
                value={settings.agencyCMS.careersHeroSubheadline}
                onChange={e =>
                  setSettings({
                    ...settings,
                    agencyCMS: { ...settings.agencyCMS, careersHeroSubheadline: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            {/* Feature Toggles */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100">
              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={settings.agencyCMS.allowDirectApplication}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, allowDirectApplication: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-800">Allow Direct Web Applications</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={settings.agencyCMS.autoSendWhatsAppAck}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, autoSendWhatsAppAck: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-800">Instant WhatsApp Acknowledgment</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={settings.agencyCMS.requireResumeUpload}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, requireResumeUpload: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-800">Require PDF Resume Upload</span>
              </label>
            </div>
          </div>

          {/* Lead Governance & Auto-Recycle */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Lead Recycling & Auto-Assignment Governance
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Recruiter Assignment Strategy</label>
                <select
                  value={settings.agencyCMS.assignmentStrategy}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      agencyCMS: { ...settings.agencyCMS, assignmentStrategy: e.target.value as any },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="round_robin">Round-Robin (Fair Rotation Among Active Team)</option>
                  <option value="load_balanced">Load-Balanced (Favor Recruiters with Lowest Backlog)</option>
                  <option value="manual">Manual Admin Distribution Only</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Auto-Recycle Stale Untouched Leads (Hours)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={12}
                    max={168}
                    value={settings.agencyCMS.autoRecycleStaleHours}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        agencyCMS: { ...settings.agencyCMS, autoRecycleStaleHours: Number(e.target.value) },
                      })
                    }
                    className="w-28 px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                  <span className="text-slate-500">hours uncalled triggers reallocation to pool</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: META ADS (FACEBOOK & INSTAGRAM) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'meta' && (
        <div className="space-y-6">
          {/* Connection Status & Webhook URL */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  f
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Meta Instant Lead Ads Connection</h2>
                  <p className="text-slate-500 text-xs">Real-time webhook capture from Facebook & Instagram Ad Campaigns.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.metaIntegration.isEnabled}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      metaIntegration: { ...settings.metaIntegration, isEnabled: e.target.checked },
                    })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className={settings.metaIntegration.isEnabled ? 'text-emerald-700' : 'text-slate-500'}>
                  {settings.metaIntegration.isEnabled ? '● Integration Active' : '○ Paused'}
                </span>
              </label>
            </div>

            {/* Webhook Endpoint Box for Meta Developer App */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                Meta App Webhook Callback URL (Paste into Meta App Dashboard):
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-800 p-2.5 rounded-lg border border-slate-700 font-mono text-xs">
                <span className="text-blue-300 truncate">{metaWebhookFullUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy('meta_url', metaWebhookFullUrl)}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'meta_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'meta_url' ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 gap-2">
                <div className="text-slate-400">
                  Verify Token: <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded">{settings.metaIntegration.verifyToken}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('meta_token', settings.metaIntegration.verifyToken)}
                  className="text-blue-400 hover:text-blue-300 text-[11px] underline"
                >
                  Copy Verification Token
                </button>
              </div>
            </div>

            {/* Credentials Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Meta App ID</label>
                <input
                  type="text"
                  value={settings.metaIntegration.appId}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      metaIntegration: { ...settings.metaIntegration, appId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Meta Ad Account ID</label>
                <input
                  type="text"
                  value={settings.metaIntegration.adAccountId}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      metaIntegration: { ...settings.metaIntegration, adAccountId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Meta Page Access Token (Long-Lived)</label>
                <input
                  type="text"
                  value={settings.metaIntegration.pageAccessToken}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      metaIntegration: { ...settings.metaIntegration, pageAccessToken: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Active Meta Ad Campaigns Monitor */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active Meta Ad Campaigns & Cost Per Lead (CPL)</h3>
                <p className="text-slate-500 text-xs">Monitors real-time candidate flow from Facebook Newsfeed & Instagram Reels.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Campaign Name</th>
                    <th className="py-2.5 px-3">Platform</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Leads Ingested</th>
                    <th className="py-2.5 px-3 text-right">Ad Spend (₹)</th>
                    <th className="py-2.5 px-3 text-right">CPL (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.metaIntegration.campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded font-medium text-[10px] ${c.platform === 'Facebook' ? 'bg-blue-50 text-blue-800' : 'bg-pink-50 text-pink-800'}`}>
                          {c.platform}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-emerald-700 font-semibold">{c.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{c.leadsCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">₹{c.spentInr.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">₹{c.cplInr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Meta Webhook Test Simulator Console */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Live Meta Lead Ads Webhook Simulator Console
              </h3>
              <p className="text-blue-800/80 text-xs">
                Simulate an immediate candidate submission from a live Facebook or Instagram Instant Form.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={metaSimName}
                  onChange={e => setMetaSimName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={metaSimPhone}
                  onChange={e => setMetaSimPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={metaSimCity}
                  onChange={e => setMetaSimCity(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Experience</label>
                <input
                  type="text"
                  value={metaSimExp}
                  onChange={e => setMetaSimExp(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Preferred Shift</label>
                <select
                  value={metaSimShift}
                  onChange={e => setMetaSimShift(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="24/7 Rotational">24/7 Rotational</option>
                  <option value="Day Shift Only">Day Shift Only</option>
                  <option value="US Night Shift">US Night Shift</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Ad Campaign</label>
                <select
                  value={metaSimCampaign}
                  onChange={e => setMetaSimCampaign(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  {settings.metaIntegration.campaigns.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={metaSimLoading}
                onClick={handleSimulateMetaLead}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{metaSimLoading ? 'Simulating Ingestion...' : 'Fire Live Meta Lead Ad Webhook'}</span>
              </button>

              {metaSimResult && (
                <span className="font-semibold text-xs text-blue-900">{metaSimResult}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: GOOGLE ADS & OFFLINE CONVERSIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          {/* Connection Status & Webhook URL */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold">
                  G
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Google Ads Search Lead Forms & Offline Conversions (OCT)</h2>
                  <p className="text-slate-500 text-xs">Captures Google Lead Form Extensions & syncs candidate placements back via GCLID.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.googleAdsIntegration.isEnabled}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      googleAdsIntegration: { ...settings.googleAdsIntegration, isEnabled: e.target.checked },
                    })
                  }
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span className={settings.googleAdsIntegration.isEnabled ? 'text-emerald-700' : 'text-slate-500'}>
                  {settings.googleAdsIntegration.isEnabled ? '● Integration Active' : '○ Paused'}
                </span>
              </label>
            </div>

            {/* Google Webhook URL & Secret Key */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                Google Ads Lead Form Webhook URL:
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-800 p-2.5 rounded-lg border border-slate-700 font-mono text-xs">
                <span className="text-red-300 truncate">{googleWebhookFullUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy('google_url', googleWebhookFullUrl)}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'google_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'google_url' ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 gap-2">
                <div className="text-slate-400">
                  Google Key: <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded">{settings.googleAdsIntegration.webhookSecretKey}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('google_key', settings.googleAdsIntegration.webhookSecretKey)}
                  className="text-red-400 hover:text-red-300 text-[11px] underline"
                >
                  Copy Secret Key
                </button>
              </div>
            </div>

            {/* Credentials & Conversion Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Google Ads Customer ID</label>
                <input
                  type="text"
                  value={settings.googleAdsIntegration.customerId}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      googleAdsIntegration: { ...settings.googleAdsIntegration, customerId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  placeholder="782-910-3841"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Lineup Conversion Action ID</label>
                <input
                  type="text"
                  value={settings.googleAdsIntegration.lineupConversionActionId}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      googleAdsIntegration: { ...settings.googleAdsIntegration, lineupConversionActionId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Joined (Placed) Conversion Action ID</label>
                <input
                  type="text"
                  value={settings.googleAdsIntegration.joiningConversionActionId}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      googleAdsIntegration: { ...settings.googleAdsIntegration, joiningConversionActionId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Offline Conversion Tracking (OCT) Sync Station */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  Google Ads Offline Conversion Sync (GCLID)
                </h3>
                <p className="text-emerald-800/80 text-xs">
                  Uploads joined candidates back to Google Ads to train smart bidding models on real joinings instead of clicks.
                </p>
              </div>

              <button
                type="button"
                disabled={syncingGoogle}
                onClick={handleSyncGoogleConversions}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogle ? 'animate-spin' : ''}`} />
                <span>{syncingGoogle ? 'Syncing with Google...' : 'Sync Conversions to Google Ads'}</span>
              </button>
            </div>

            {syncResult && (
              <div className="p-3 bg-white border border-emerald-300 rounded-lg text-emerald-900 font-semibold text-xs">
                {syncResult}
              </div>
            )}
          </div>

          {/* Active Google Search & Display Campaigns Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Active Google Ads Campaigns & Joined Candidates</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Campaign Name</th>
                    <th className="py-2.5 px-3">Network</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Leads</th>
                    <th className="py-2.5 px-3 text-right">Ad Spend (₹)</th>
                    <th className="py-2.5 px-3 text-right">CPL (₹)</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">Confirmed Joinings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.googleAdsIntegration.campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-medium text-[10px]">
                          {c.network}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-emerald-700 font-semibold">{c.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{c.leadsCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">₹{c.spentInr.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">₹{c.cplInr}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{c.joinedCount} Joined</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Google Ads Webhook Simulator */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-500" />
                Google Lead Form Extension Simulator
              </h3>
              <p className="text-slate-500 text-xs">Simulate a candidate clicking a Google Search Ad and submitting a Lead Form with a GCLID token.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={googleSimName}
                  onChange={e => setGoogleSimName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={googleSimPhone}
                  onChange={e => setGoogleSimPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Search Campaign</label>
                <select
                  value={googleSimCampaign}
                  onChange={e => setGoogleSimCampaign(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  {settings.googleAdsIntegration.campaigns.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={googleSimLoading}
                onClick={handleSimulateGoogleLead}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{googleSimLoading ? 'Simulating...' : 'Simulate Google Lead Ingestion'}</span>
              </button>

              {googleSimResult && (
                <span className="font-semibold text-xs text-slate-800">{googleSimResult}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: MASTER CHANNELS & DROPDOWNS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'master' && (
        <div className="space-y-6">
          {/* Lead Sources List */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="font-bold text-slate-900 text-sm">Lead Sources & Candidate Acquisition Channels</h2>
            <p className="text-slate-500 text-xs">Used across manual lead forms, CSV imports, and ad attribution.</p>

            <div className="flex flex-wrap gap-2 pt-1">
              {settings.leadSources.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium">
                  <span>{s}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        leadSources: settings.leadSources.filter(item => item !== s),
                      })
                    }
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 max-w-sm">
              <input
                type="text"
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                placeholder="e.g. Apna / Newspaper Walk-in"
                className="px-3 py-1.5 border border-slate-300 rounded-lg flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newSource.trim() || settings.leadSources.includes(newSource.trim())) return;
                  setSettings({ ...settings, leadSources: [...settings.leadSources, newSource.trim()] });
                  setNewSource('');
                }}
                className="px-3.5 py-1.5 bg-slate-900 text-white font-semibold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Shift Types Master */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="font-bold text-slate-900 text-sm">Shift Types Master</h2>
            <p className="text-slate-500 text-xs">Used during 60-second candidate screening scorecards.</p>

            <div className="flex flex-wrap gap-2 pt-1">
              {(settings.shiftTypes || ['24/7 Rotational', 'Day Shift Only', 'US Night Shift']).map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium">
                  <span>{s}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        shiftTypes: (settings.shiftTypes || []).filter(item => item !== s),
                      })
                    }
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 max-w-sm">
              <input
                type="text"
                value={newShift}
                onChange={e => setNewShift(e.target.value)}
                placeholder="e.g. Australian Early Morning"
                className="px-3 py-1.5 border border-slate-300 rounded-lg flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newShift.trim()) return;
                  setSettings({ ...settings, shiftTypes: [...(settings.shiftTypes || []), newShift.trim()] });
                  setNewShift('');
                }}
                className="px-3.5 py-1.5 bg-slate-900 text-white font-semibold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Job Categories Master */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="font-bold text-slate-900 text-sm">Client Job Categories Master</h2>
            <p className="text-slate-500 text-xs">Classifies client mandates across recruitment business units.</p>

            <div className="flex flex-wrap gap-2 pt-1">
              {(settings.jobCategories || []).map(cat => (
                <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium">
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        jobCategories: (settings.jobCategories || []).filter(item => item !== cat),
                      })
                    }
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 max-w-sm">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="e.g. Logistics & Supply Chain"
                className="px-3 py-1.5 border border-slate-300 rounded-lg flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCategory.trim()) return;
                  setSettings({ ...settings, jobCategories: [...(settings.jobCategories || []), newCategory.trim()] });
                  setNewCategory('');
                }}
                className="px-3.5 py-1.5 bg-slate-900 text-white font-semibold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: QUOTAS & ESCALATIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'quotas' && (
        <div className="space-y-6">
          {/* Default Quotas */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm">Default Daily & Monthly Recruiter Targets</h2>
            <p className="text-slate-500 text-xs">Baseline applied to newly onboarded recruitment team members.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Daily Calls Quota</label>
                <input
                  type="number"
                  value={settings.defaultDailyCallTarget}
                  onChange={e => setSettings({ ...settings, defaultDailyCallTarget: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Daily Connected Calls</label>
                <input
                  type="number"
                  value={settings.defaultDailyConnectedTarget}
                  onChange={e => setSettings({ ...settings, defaultDailyConnectedTarget: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Daily Lineups Target</label>
                <input
                  type="number"
                  value={settings.defaultDailyLineupTarget}
                  onChange={e => setSettings({ ...settings, defaultDailyLineupTarget: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Monthly Joinings Target</label>
                <input
                  type="number"
                  value={settings.defaultMonthlyJoiningTarget}
                  onChange={e => setSettings({ ...settings, defaultMonthlyJoiningTarget: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Escalation Rules */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm">Follow-up Escalation Timings (Hours Overdue)</h2>
            <p className="text-slate-500 text-xs">
              Controls when overdue callbacks auto-escalate from individual Recruiters to Team Leaders and agency Admin.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Escalate to Team Leader (Hours Overdue)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.overdueEscalationHoursTL}
                  onChange={e => setSettings({ ...settings, overdueEscalationHoursTL: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 4 hours overdue</span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Escalate to Admin Exception Desk (Hours Overdue)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.overdueEscalationHoursAdmin}
                  onChange={e => setSettings({ ...settings, overdueEscalationHoursAdmin: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 24 hours overdue</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button Footer */}
      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-colors text-xs"
        >
          {isSaving ? 'Saving Changes...' : 'Save Configuration & Integrations'}
        </button>
      </div>
    </div>
  );
};
