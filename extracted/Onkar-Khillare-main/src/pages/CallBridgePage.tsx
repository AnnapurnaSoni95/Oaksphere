import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Smartphone,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Radio,
  Wifi,
  Battery,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Activity,
  Square,
  Settings,
  History,
  Send,
  ExternalLink,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Search,
  User,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { CallBridgeDevice, CallBridgeCallEvent, CallBridgeSettings, SimSlot, Lead } from '../lib/types';

export const CallBridgePage: React.FC = () => {
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<'console' | 'history' | 'devices' | 'settings' | 'simulator'>('console');
  const [device, setDevice] = useState<CallBridgeDevice | null>(null);
  const [allDevices, setAllDevices] = useState<CallBridgeDevice[]>([]);
  const [settings, setSettings] = useState<CallBridgeSettings>({
    defaultSim: 'SIM_1',
    sim1Carrier: 'Jio 5G (Work SIM)',
    sim1Number: '+91 98201 12345',
    sim2Carrier: 'Airtel 4G (Alternate SIM)',
    sim2Number: '+91 98201 54321',
    gatewayMode: 'companion_relay',
    autoLogDisposition: true,
    soundAlerts: true,
    autoStartTimer: true,
  });
  const [activeCall, setActiveCall] = useState<CallBridgeCallEvent | null>(null);
  const [callLogs, setCallLogs] = useState<CallBridgeCallEvent[]>([]);
  const [stats, setStats] = useState({
    totalToday: 0,
    totalDurationSeconds: 0,
    sim1Count: 0,
    sim2Count: 0,
    connectedCount: 0,
    connectRate: 0,
  });

  // Dialer inputs
  const [dialNumber, setDialNumber] = useState<string>('');
  const [candidateName, setCandidateName] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedSim, setSelectedSim] = useState<SimSlot>('SIM_1');
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [leadSearchQuery, setLeadSearchQuery] = useState<string>('');
  const [isSearchingLeads, setIsSearchingLeads] = useState<boolean>(false);

  // Live in-call timer
  const [callTimer, setCallTimer] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isDialing, setIsDialing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [quickDisposition, setQuickDisposition] = useState<string>('Connected – Interested');

  const sseRef = useRef<EventSource | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Fetch initial status and devices
  const fetchStatus = async () => {
    try {
      const res = await apiRequest<{
        device: CallBridgeDevice | null;
        allDevices: CallBridgeDevice[];
        settings: CallBridgeSettings;
        activeCall: CallBridgeCallEvent | null;
        stats: any;
      }>('/api/call-bridge/status');

      if (res.device) {
        setDevice(res.device);
        setSelectedSim(res.device.defaultSim || 'SIM_1');
      }
      setAllDevices(res.allDevices || []);
      if (res.settings) {
        setSettings(res.settings);
      }
      if (res.activeCall) {
        setActiveCall(res.activeCall);
        setCallTimer(res.activeCall.durationSeconds || 0);
      }
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (e) {
      console.error('Failed to load call bridge status', e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await apiRequest<{ calls: CallBridgeCallEvent[] }>('/api/call-bridge/logs');
      setCallLogs(res.calls || []);
    } catch (e) {
      console.error('Failed to load call bridge logs', e);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await apiRequest<{ leads: Lead[] }>('/api/leads?limit=25');
      setLeadsList(res.leads || []);
    } catch (e) {
      console.error('Failed to load leads for dialer', e);
    }
  };

  // Setup Server-Sent Events (SSE) for real-time mobile sync
  useEffect(() => {
    fetchStatus();
    fetchLogs();
    fetchLeads();

    const token = localStorage.getItem('oak_token');
    const sseUrl = `/api/call-bridge/stream?token=${encodeURIComponent(token || '')}&role=desktop`;
    const sse = new EventSource(sseUrl);
    sseRef.current = sse;

    sse.addEventListener('INCOMING_DIAL_REQUEST', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        showToast(`📲 Call broadcasted: Calling ${payload.candidateName} on ${payload.simSlot}`);
      } catch (err) {
        // ignore
      }
    });

    sse.addEventListener('CALL_STATUS_UPDATE', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.status === 'completed' || payload.status === 'failed') {
          setActiveCall(null);
          setCallTimer(0);
          showToast(`Call ended: ${payload.disposition || payload.status} (${payload.durationSeconds}s)`);
          fetchStatus();
          fetchLogs();
        } else if (payload.status === 'connected') {
          setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
          showToast('✅ Mobile phone connected to candidate! Conversation in progress.');
        }
      } catch (err) {
        // ignore
      }
    });

    sse.addEventListener('DEVICE_CONNECTED', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        setDevice(payload.device);
        showToast(payload.message || 'Phone paired successfully!');
        fetchStatus();
      } catch (err) {
        // ignore
      }
    });

    return () => {
      sse.close();
    };
  }, [user]);

  // Live call stopwatch timer
  useEffect(() => {
    let interval: any = null;
    if (activeCall && (activeCall.status === 'connected' || activeCall.status === 'ringing')) {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Generate new pair code
  const handleGenerateNewPairCode = async () => {
    try {
      const res = await apiRequest<{ success: boolean; pairCode: string; device: CallBridgeDevice }>(
        '/api/call-bridge/pair',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'generate_code',
            deviceName: 'Recruiter Work Mobile',
            platform: 'android',
            sim1Carrier: settings.sim1Carrier,
            sim2Carrier: settings.sim2Carrier,
            defaultSim: selectedSim,
          }),
        }
      );
      if (res.device) {
        setDevice(res.device);
        showToast(`New pairing PIN generated: ${res.pairCode}`);
      }
    } catch (e) {
      console.error('Failed to generate pair code', e);
    }
  };

  // Trigger Dial via Phone SIM
  const handleTriggerDial = async () => {
    if (!dialNumber) {
      showToast('Please enter a valid phone number or choose a candidate.');
      return;
    }

    setIsDialing(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        call: CallBridgeCallEvent;
        message: string;
      }>('/api/call-bridge/dial', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLeadId || undefined,
          candidateName: candidateName || 'Direct Dial Candidate',
          phoneNumber: dialNumber,
          simSlot: selectedSim,
        }),
      });

      if (res.call) {
        setActiveCall(res.call);
        setCallTimer(0);
        showToast(res.message || 'Call command sent to your smartphone!');
      }
    } catch (e: any) {
      showToast(`Dial error: ${e.message || 'Could not initiate bridge call'}`);
    } finally {
      setIsDialing(false);
    }
  };

  // End active bridged call
  const handleEndCall = async (dispositionToSave?: string) => {
    if (!activeCall) return;

    try {
      await apiRequest('/api/call-bridge/call-event', {
        method: 'POST',
        body: JSON.stringify({
          callId: activeCall.id,
          leadId: activeCall.leadId,
          status: 'completed',
          durationSeconds: callTimer,
          disposition: dispositionToSave || quickDisposition,
          notes: `Call ended from desktop console. Duration: ${callTimer}s. SIM: ${activeCall.simUsed} (${activeCall.carrierName})`,
        }),
      });

      setActiveCall(null);
      setCallTimer(0);
      showToast(`Call logged as "${dispositionToSave || quickDisposition}" (${callTimer}s)`);
      fetchStatus();
      fetchLogs();
    } catch (e) {
      console.error('Failed to end call', e);
    }
  };

  // Select candidate from leads
  const handleSelectLead = (l: Lead) => {
    setSelectedLeadId(l.id);
    setCandidateName(l.candidateName);
    setDialNumber(l.primaryPhone);
    setIsSearchingLeads(false);
    showToast(`Loaded candidate: ${l.candidateName} (${l.primaryPhone})`);
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; settings: CallBridgeSettings }>(
        '/api/call-bridge/settings',
        {
          method: 'POST',
          body: JSON.stringify(settings),
        }
      );
      if (res.settings) {
        setSettings(res.settings);
        showToast('SIM Bridge settings updated successfully!');
      }
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  // Simulate phone action (for simulator tab or test buttons)
  const handleSimulateAction = async (simulatedAction: string) => {
    if (!activeCall) {
      showToast('No active call to simulate. Click "Dial via Phone SIM" first!');
      return;
    }
    try {
      await apiRequest('/api/call-bridge/simulate-phone-event', {
        method: 'POST',
        body: JSON.stringify({
          callId: activeCall.id,
          simulatedAction,
        }),
      });
      showToast(`Simulated phone event: ${simulatedAction}`);
      fetchStatus();
      fetchLogs();
    } catch (e) {
      console.error('Simulation error', e);
    }
  };

  // Copy mobile companion URL
  const mobileCompanionUrl = `${window.location.origin}/bridge/mobile${device?.pairCode ? `?pair=${encodeURIComponent(device.pairCode)}` : ''}`;
  const copyMobileLink = () => {
    navigator.clipboard.writeText(mobileCompanionUrl);
    setCopiedLink(true);
    showToast('Mobile Companion Link copied! Open this on your mobile phone browser.');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-slideUp">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Desktop Call to Phone SIM Relay • Zero VoIP Cost</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Phone SIM Call Bridge
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Dial candidates directly from your desktop CRM browser using your smartphone’s physical SIM card and unlimited cellular plan. Zero setup cost, 100% genuine local mobile Caller-ID, with automated call duration sync and instant CRM disposition logging.
          </p>
          <div className="pt-2">
            <Link
              to="/telephony"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 rounded-lg text-xs font-bold transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>View Telephony Dashboard & Analytics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Quick Connection Status Badge */}
        <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700 rounded-xl p-4 shrink-0 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              device?.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Paired Mobile Device
              </div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{device?.deviceName || 'Ready to Pair Phone'}</span>
                <span className={`w-2 h-2 rounded-full ${device?.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              </div>
              <div className="text-[10px] text-slate-300 flex items-center gap-2 mt-0.5">
                <span className="text-emerald-400 font-semibold">{device?.sim1Carrier || 'Jio 5G'}</span>
                {device?.batteryLevel && (
                  <span className="flex items-center gap-0.5 text-slate-400">
                    <Battery className="w-3 h-3 text-slate-400" /> {device.batteryLevel}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-slate-700 pt-3 sm:pt-0 sm:pl-4 flex flex-col items-center sm:items-start">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Pairing PIN</div>
            <div className="text-sm font-mono font-black text-amber-400 tracking-wider">
              {device?.pairCode || '849-215'}
            </div>
            <button
              onClick={handleGenerateNewPairCode}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Refresh PIN
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            Today's SIM Calls Placed
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
            <span>{stats.totalToday}</span>
            <span className="text-xs font-semibold text-slate-500">calls</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            SIM 1: <strong className="text-slate-800">{stats.sim1Count}</strong> • SIM 2: <strong className="text-slate-800">{stats.sim2Count}</strong>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            Total Talk Time Today
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {Math.floor(stats.totalDurationSeconds / 60)}m {stats.totalDurationSeconds % 60}s
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Zero VoIP SIP charges
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            SIM Connect Rate
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1 flex items-baseline gap-1">
            <span>{stats.connectRate}%</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats.connectedCount} connected conversations
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            Active Outbound SIM
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{selectedSim === 'SIM_1' ? (device?.sim1Carrier || settings.sim1Carrier) : (device?.sim2Carrier || settings.sim2Carrier)}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {selectedSim === 'SIM_1' ? settings.sim1Number : settings.sim2Number}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === 'console'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Desktop SIM Console & Dialer</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>SIM Call Logs ({callLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === 'devices'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Phone Pairing & QR Code</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === 'simulator'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Mobile Phone Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>SIM Gateway Settings</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DESKTOP SIM CONSOLE & DIALER                      */}
      {/* ======================================================== */}
      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Dialer & Candidate Search */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Call Live Control Card (when in call) */}
            {activeCall ? (
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-6 border-2 border-emerald-500 shadow-xl space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>
                      {activeCall.status === 'ringing'
                        ? 'Broadcasting to Mobile SIM... Ringing Phone'
                        : 'Live In-Call Conversation'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    SIM Slot: <strong className="text-white">{activeCall.simUsed}</strong> ({activeCall.carrierName})
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-y border-slate-800">
                  <div>
                    <h3 className="text-xl font-black text-white">{activeCall.candidateName}</h3>
                    <div className="text-sm font-mono text-emerald-400 font-semibold mt-0.5">
                      +91 {activeCall.phoneNumber}
                    </div>
                  </div>

                  {/* Stopwatch */}
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Call Duration</div>
                    <div className="text-3xl font-mono font-black text-emerald-400">
                      {formatTimer(callTimer)}
                    </div>
                  </div>
                </div>

                {/* Quick Disposition Selectors */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Select Call Disposition (Will Auto-Log to CRM upon Hangup):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      'Connected – Interested',
                      'Callback',
                      'Interview Scheduled',
                      'No Answer',
                      'Busy',
                      'Salary Issue',
                      'Job Mismatch',
                      'Switched Off',
                    ].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setQuickDisposition(d)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left border transition-all ${
                          quickDisposition === d
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Call Control Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isMuted
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-400" />}
                      <span>{isMuted ? 'Muted' : 'Mute Audio'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateAction('answer')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Simulate Candidate Answered
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEndCall()}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 transition-all transform active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Hang Up & Log Call</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Candidate Search / Select or Direct Dial Keypad */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Desktop Call Trigger
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select a candidate lead or type a phone number to place call via your phone SIM card.
                  </p>
                </div>

                {/* SIM 1 / SIM 2 Quick Selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedSim('SIM_1')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedSim === 'SIM_1'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    SIM 1 ({device?.sim1Carrier || settings.sim1Carrier || 'Jio'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSim('SIM_2')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedSim === 'SIM_2'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    SIM 2 ({device?.sim2Carrier || settings.sim2Carrier || 'Airtel'})
                  </button>
                </div>
              </div>

              {/* Candidate Quick Selector Dropdown / Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Candidate Name & Profile:</span>
                  {selectedLeadId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadId('');
                        setCandidateName('');
                        setDialNumber('');
                      }}
                      className="text-indigo-600 hover:underline text-[11px]"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={candidateName}
                      onChange={e => setCandidateName(e.target.value)}
                      onFocus={() => setIsSearchingLeads(true)}
                      placeholder="Type candidate name or select from queue..."
                      className="flex-1 text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setIsSearchingLeads(!isSearchingLeads)}
                      className="px-3 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Browse ({leadsList.length})</span>
                    </button>
                  </div>

                  {/* Leads Popup List */}
                  {isSearchingLeads && (
                    <div className="absolute left-0 right-0 top-12 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                      <div className="p-2 sticky top-0 bg-slate-50 border-b border-slate-200">
                        <input
                          type="text"
                          value={leadSearchQuery}
                          onChange={e => setLeadSearchQuery(e.target.value)}
                          placeholder="Filter candidates..."
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                      {leadsList
                        .filter(l =>
                          l.candidateName.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
                          l.primaryPhone.includes(leadSearchQuery) ||
                          (l.jobTitle && l.jobTitle.toLowerCase().includes(leadSearchQuery.toLowerCase()))
                        )
                        .map(l => (
                          <div
                            key={l.id}
                            onClick={() => handleSelectLead(l)}
                            className="p-3 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{l.candidateName}</div>
                              <div className="text-[11px] text-slate-500">
                                {l.jobTitle || 'Role'} • {l.clientName || 'General'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-semibold text-indigo-700">+91 {l.primaryPhone}</div>
                              <span className="text-[10px] text-slate-400">{l.leadStatus}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone Number Input & Big Call Button */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Target Candidate Mobile Phone Number:
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <span className="absolute left-3.5 top-3 text-xs font-bold text-slate-400 font-mono">
                      +91
                    </span>
                    <input
                      type="text"
                      value={dialNumber}
                      onChange={e => setDialNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="98XXXXXXXX"
                      className="w-full text-base font-mono font-bold pl-12 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 shadow-inner tracking-wider"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isDialing || !dialNumber}
                    onClick={handleTriggerDial}
                    className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95"
                  >
                    <Radio className="w-4 h-4 text-emerald-200 animate-pulse" />
                    <span>
                      {isDialing ? 'Triggering Phone...' : `Dial via ${selectedSim} (${selectedSim === 'SIM_1' ? (device?.sim1Carrier || settings.sim1Carrier) : (device?.sim2Carrier || settings.sim2Carrier)})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Number Keypad for rapid dialing */}
              <div className="pt-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Rapid Numeric Keypad</div>
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => setDialNumber(prev => prev + digit)}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm active:bg-indigo-100 transition-colors shadow-2xs"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Backspace
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Device Connection & Quick How-It-Works */}
          <div className="space-y-6">
            {/* Phone Companion Connection Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>Paired Mobile Device</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  device?.status === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {device?.status === 'connected' ? 'Active & Ready' : 'Standby'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Device Name:</span>
                  <strong className="text-slate-900">{device?.deviceName || 'OnePlus 12 5G'}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">SIM 1 Carrier:</span>
                  <span className="font-semibold text-emerald-700">{device?.sim1Carrier || settings.sim1Carrier}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">SIM 2 Carrier:</span>
                  <span className="font-semibold text-indigo-700">{device?.sim2Carrier || settings.sim2Carrier}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Battery Level:</span>
                  <span className="font-semibold text-slate-800">{device?.batteryLevel || 92}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Cellular Signal:</span>
                  <span className="font-semibold text-emerald-600">Strong 5G / VoLTE</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">6-Digit Pair PIN:</span>
                  <span className="font-mono font-bold text-amber-600">{device?.pairCode || '849-215'}</span>
                </div>
              </div>

              {/* Open Mobile Companion Link Button */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={copyMobileLink}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Mobile Companion Link'}</span>
                </button>

                <a
                  href={`/bridge/mobile?pair=${encodeURIComponent(device?.pairCode || '849-215')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch Mobile Companion View</span>
                </a>
              </div>
            </div>

            {/* How It Works Diagram */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>How Call Bridge Works</span>
              </h4>
              <ol className="space-y-2 text-slate-600 list-decimal pl-4 leading-relaxed">
                <li>
                  <strong>Scan QR / Open Mobile Companion:</strong> Keep your mobile phone companion open on your desk or pocket.
                </li>
                <li>
                  <strong>Click Dial on Desktop:</strong> Choose any candidate in Leads, Queue, or Power Calling and click <em>"Dial via Phone SIM"</em>.
                </li>
                <li>
                  <strong>Phone Rings Native Dialer:</strong> The phone receives an instant push signal and launches your native SIM dialer (SIM 1 or SIM 2).
                </li>
                <li>
                  <strong>Auto CRM Sync:</strong> Call duration and outcome synchronize back to your desktop CRM automatically!
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CALL LOGS & SIM ANALYTICS                         */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Desktop-to-SIM Call History</h3>
              <p className="text-xs text-slate-500">
                All phone calls initiated through your smartphone SIM cards.
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">Candidate</th>
                  <th className="py-2.5 px-3 font-semibold">Phone Number</th>
                  <th className="py-2.5 px-3 font-semibold">SIM Used</th>
                  <th className="py-2.5 px-3 font-semibold">Duration</th>
                  <th className="py-2.5 px-3 font-semibold">Disposition</th>
                  <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No SIM bridge calls placed yet today.
                    </td>
                  </tr>
                ) : (
                  callLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {log.candidateName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        +91 {log.phoneNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.simUsed === 'SIM_1' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {log.simUsed} • {log.carrierName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {formatTimer(log.durationSeconds)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">
                          {log.disposition || log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(log.initiatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.initiatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDialNumber(log.phoneNumber);
                            setCandidateName(log.candidateName);
                            setSelectedLeadId(log.leadId || '');
                            setActiveTab('console');
                            showToast(`Loaded ${log.candidateName} for redial.`);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px]"
                        >
                          Re-dial
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PHONE PAIRING & QR CODE                           */}
      {/* ======================================================== */}
      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pair Mobile Smartphone</h3>
              <p className="text-xs text-slate-500">
                Scan the QR code with your mobile camera or type the 6-digit PIN into the Mobile Companion Web App.
              </p>
            </div>

            {/* Visual QR Code Display */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200">
                {/* SVG QR Code Simulation */}
                <svg className="w-48 h-48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" fill="white" />
                  {/* Position detection markers */}
                  <rect x="5" y="5" width="25" height="25" fill="#0f172a" />
                  <rect x="9" y="9" width="17" height="17" fill="white" />
                  <rect x="13" y="13" width="9" height="9" fill="#4f46e5" />

                  <rect x="70" y="5" width="25" height="25" fill="#0f172a" />
                  <rect x="74" y="9" width="17" height="17" fill="white" />
                  <rect x="78" y="13" width="9" height="9" fill="#4f46e5" />

                  <rect x="5" y="70" width="25" height="25" fill="#0f172a" />
                  <rect x="9" y="74" width="17" height="17" fill="white" />
                  <rect x="13" y="78" width="9" height="9" fill="#4f46e5" />

                  {/* QR Data Grid Pattern */}
                  <rect x="35" y="8" width="5" height="5" fill="#0f172a" />
                  <rect x="45" y="8" width="5" height="5" fill="#0f172a" />
                  <rect x="55" y="8" width="5" height="5" fill="#0f172a" />
                  <rect x="35" y="18" width="5" height="5" fill="#0f172a" />
                  <rect x="50" y="18" width="5" height="5" fill="#4f46e5" />
                  <rect x="60" y="18" width="5" height="5" fill="#0f172a" />
                  <rect x="8" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="18" y="35" width="5" height="5" fill="#4f46e5" />
                  <rect x="28" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="38" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="48" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="58" y="35" width="5" height="5" fill="#4f46e5" />
                  <rect x="68" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="78" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="88" y="35" width="5" height="5" fill="#0f172a" />
                  <rect x="12" y="45" width="5" height="5" fill="#0f172a" />
                  <rect x="22" y="45" width="5" height="5" fill="#0f172a" />
                  <rect x="32" y="45" width="5" height="5" fill="#4f46e5" />
                  <rect x="42" y="45" width="5" height="5" fill="#0f172a" />
                  <rect x="52" y="45" width="5" height="5" fill="#0f172a" />
                  <rect x="62" y="45" width="5" height="5" fill="#0f172a" />
                  <rect x="72" y="45" width="5" height="5" fill="#4f46e5" />
                  <rect x="82" y="45" width="5" height="5" fill="#0f172a" />
                  <rect x="35" y="55" width="5" height="5" fill="#0f172a" />
                  <rect x="45" y="55" width="5" height="5" fill="#4f46e5" />
                  <rect x="55" y="55" width="5" height="5" fill="#0f172a" />
                  <rect x="65" y="55" width="5" height="5" fill="#0f172a" />
                  <rect x="35" y="65" width="5" height="5" fill="#0f172a" />
                  <rect x="45" y="65" width="5" height="5" fill="#0f172a" />
                  <rect x="55" y="65" width="5" height="5" fill="#4f46e5" />
                  <rect x="65" y="65" width="5" height="5" fill="#0f172a" />
                  <rect x="35" y="75" width="5" height="5" fill="#0f172a" />
                  <rect x="45" y="75" width="5" height="5" fill="#0f172a" />
                  <rect x="75" y="75" width="5" height="5" fill="#0f172a" />
                  <rect x="85" y="75" width="5" height="5" fill="#4f46e5" />
                </svg>
              </div>

              <div className="text-center space-y-1">
                <div className="text-xs font-semibold text-slate-700">Pairing PIN Code:</div>
                <div className="text-2xl font-mono font-black text-indigo-600 tracking-widest bg-indigo-50 px-4 py-1 rounded-lg border border-indigo-100">
                  {device?.pairCode || '849-215'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGenerateNewPairCode}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Generate Fresh Pairing PIN
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registered Devices</h3>
              <p className="text-xs text-slate-500">
                Devices associated with your recruiter workspace account.
              </p>
            </div>

            <div className="space-y-3">
              {allDevices.map(d => (
                <div
                  key={d.id}
                  className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-all space-y-2 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      <span>{d.deviceName}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>SIM 1: <strong>{d.sim1Carrier}</strong></div>
                    <div>SIM 2: <strong>{d.sim2Carrier || 'None'}</strong></div>
                    <div>Default Outbound: <strong>{d.defaultSim}</strong></div>
                    <div>PIN: <strong className="font-mono">{d.pairCode}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: MOBILE PHONE SIMULATOR (LIVE EMBEDDED PREVIEW)    */}
      {/* ======================================================== */}
      {activeTab === 'simulator' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Interactive Mobile Phone Companion Simulator
              </h3>
              <p className="text-xs text-slate-500">
                Preview how incoming calls and SIM dialing look on your smartphone screen in real-time.
              </p>
            </div>
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              ● Live Real-Time Web Companion Mode
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
            {/* Phone Bezel Container */}
            <div className="w-80 h-[560px] bg-slate-950 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 relative flex flex-col justify-between overflow-hidden">
              {/* Phone Speaker Notch */}
              <div className="w-28 h-4 bg-slate-900 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
                <div className="w-8 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Phone Screen Canvas */}
              <div className="flex-1 bg-slate-900 text-white rounded-[28px] p-4 flex flex-col justify-between overflow-hidden relative border border-slate-800">
                {/* Mobile Top Bar */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>10:42 AM</span>
                  <div className="flex items-center gap-1.5">
                    <span>5G</span>
                    <Wifi className="w-3 h-3 text-slate-300" />
                    <Battery className="w-3 h-3 text-emerald-400" />
                  </div>
                </div>

                {/* Main Screen Content */}
                {activeCall ? (
                  <div className="space-y-4 text-center my-auto animate-fadeIn">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 animate-pulse">
                      <PhoneCall className="w-8 h-8" />
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">
                        {activeCall.status === 'connected' ? 'Call in Progress' : 'Incoming Dial Request'}
                      </div>
                      <h4 className="text-base font-black text-white mt-1">
                        {activeCall.candidateName}
                      </h4>
                      <div className="text-xs font-mono text-slate-300">
                        +91 {activeCall.phoneNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Dialing via {activeCall.simUsed} ({activeCall.carrierName})
                      </div>
                    </div>

                    <div className="text-2xl font-mono font-bold text-emerald-400">
                      {formatTimer(callTimer)}
                    </div>

                    <div className="space-y-2 pt-2">
                      {activeCall.status === 'ringing' ? (
                        <button
                          type="button"
                          onClick={() => handleSimulateAction('answer')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
                        >
                          📞 Tap to Answer / Connect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSimulateAction('hangup_interested')}
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md"
                        >
                          🔴 End Call & Sync
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 my-auto">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Phone SIM Bridge Companion</div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                        ● Connected to Desktop CRM
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Device: {device?.deviceName || 'OnePlus 12 5G'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-800/80 rounded-xl text-left space-y-1 text-[10px] text-slate-300">
                      <div>Active SIM 1: <strong className="text-emerald-400">{device?.sim1Carrier || settings.sim1Carrier}</strong></div>
                      <div>Active SIM 2: <strong className="text-indigo-400">{device?.sim2Carrier || settings.sim2Carrier}</strong></div>
                      <div>Standby Status: <strong>Ready for Calls</strong></div>
                    </div>

                    <p className="text-[10px] text-slate-400 italic">
                      When you click "Dial" on Desktop, this phone screen immediately rings with native SIM call details.
                    </p>
                  </div>
                )}

                {/* Bottom Gesture Bar */}
                <div className="w-24 h-1 bg-slate-600 rounded-full mx-auto shrink-0" />
              </div>
            </div>

            {/* Test Simulation Controls */}
            <div className="max-w-md space-y-4">
              <h4 className="font-bold text-sm text-slate-900">Simulation Triggers:</h4>
              <p className="text-xs text-slate-500">
                You can test every state of the Phone SIM bridge right here without needing a secondary physical mobile phone in your hand.
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setDialNumber('9820011001');
                    setCandidateName('Rohan Sharma');
                    handleTriggerDial();
                  }}
                  className="w-full p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
                >
                  <span>1. Simulate Outbound Desktop Trigger</span>
                  <Play className="w-4 h-4 text-indigo-600" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateAction('answer')}
                  className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
                >
                  <span>2. Simulate Phone Connected / Answered</span>
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateAction('hangup_interested')}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
                >
                  <span>3. Simulate Call Finished (Interested)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateAction('busy')}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
                >
                  <span>4. Simulate Candidate Busy / Rejected</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: GATEWAY & PREFERENCE SETTINGS                     */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 max-w-3xl">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-900">SIM Gateway & Carrier Settings</h3>
            <p className="text-xs text-slate-500">
              Configure SIM slot labels, carrier preferences, and automated CRM logging behaviors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* SIM 1 Config */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>SIM 1 Configuration</span>
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Carrier Name / Label:</label>
                <input
                  type="text"
                  value={settings.sim1Carrier}
                  onChange={e => setSettings({ ...settings, sim1Carrier: e.target.value })}
                  placeholder="e.g. Jio 5G (Work SIM)"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">SIM 1 Mobile Number:</label>
                <input
                  type="text"
                  value={settings.sim1Number}
                  onChange={e => setSettings({ ...settings, sim1Number: e.target.value })}
                  placeholder="+91 98201 12345"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* SIM 2 Config */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>SIM 2 Configuration</span>
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Carrier Name / Label:</label>
                <input
                  type="text"
                  value={settings.sim2Carrier}
                  onChange={e => setSettings({ ...settings, sim2Carrier: e.target.value })}
                  placeholder="e.g. Airtel 4G (Alternate SIM)"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">SIM 2 Mobile Number:</label>
                <input
                  type="text"
                  value={settings.sim2Number}
                  onChange={e => setSettings({ ...settings, sim2Number: e.target.value })}
                  placeholder="+91 98201 54321"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Preferences Toggles */}
          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-800">Default Outbound SIM Slot</div>
                <div className="text-[11px] text-slate-500">Preferred SIM to use when initiating bulk power calling</div>
              </div>
              <select
                value={settings.defaultSim}
                onChange={e => setSettings({ ...settings, defaultSim: e.target.value as SimSlot })}
                className="text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="SIM_1">SIM 1 ({settings.sim1Carrier})</option>
                <option value="SIM_2">SIM 2 ({settings.sim2Carrier})</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-800">Auto-Log Disposition to CRM</div>
                <div className="text-[11px] text-slate-500">Automatically save call log & duration to candidate record when call ends</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoLogDisposition}
                onChange={e => setSettings({ ...settings, autoLogDisposition: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-800">Sound Audio Chimes on Desktop</div>
                <div className="text-[11px] text-slate-500">Play notification sound when phone connects or call finishes</div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundAlerts}
                onChange={e => setSettings({ ...settings, soundAlerts: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Save SIM Bridge Settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
