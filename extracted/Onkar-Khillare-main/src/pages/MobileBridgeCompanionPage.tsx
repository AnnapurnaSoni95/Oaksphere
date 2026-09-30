import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import {
  Smartphone,
  Phone,
  PhoneCall,
  Wifi,
  Battery,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Sparkles,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { CallBridgeDevice, CallBridgeCallEvent } from '../lib/types';
import { OakEmblem } from '../components/common/OakLogo';

export const MobileBridgeCompanionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const pairParam = searchParams.get('pair') || '';

  const [pairCode, setPairCode] = useState<string>(pairParam || '849-215');
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [device, setDevice] = useState<CallBridgeDevice | null>(null);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'completed'>('idle');
  const [callTimer, setCallTimer] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sseRef = useRef<EventSource | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Connect SSE
  const connectSSE = (code: string) => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    const clean = code.replace(/[^0-9]/g, '');
    const sse = new EventSource(`/api/call-bridge/stream?pairCode=${encodeURIComponent(clean)}&role=mobile`);
    sseRef.current = sse;

    sse.addEventListener('INCOMING_DIAL_REQUEST', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        setIncomingCall(payload);
        setCallStatus('ringing');
        setCallTimer(0);

        // Vibrate phone if supported
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
        showToast(`📲 Call Request from Desktop CRM: ${payload.candidateName}`);
      } catch (err) {
        console.error('Error handling dial request', err);
      }
    });

    sse.addEventListener('CALL_STATUS_UPDATE', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.status === 'completed' || payload.status === 'failed') {
          setCallStatus('idle');
          setIncomingCall(null);
          setCallTimer(0);
        } else if (payload.status === 'connected') {
          setCallStatus('connected');
        }
      } catch (err) {
        // ignore
      }
    });
  };

  // Pair device
  const handlePairSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pairCode) return;

    try {
      const res = await apiRequest<{ success: boolean; device: CallBridgeDevice }>(
        '/api/call-bridge/pair',
        {
          method: 'POST',
          body: JSON.stringify({
            pairCode,
            deviceName: navigator.userAgent.includes('Android') ? 'Android Mobile SIM Phone' : navigator.userAgent.includes('iPhone') ? 'iPhone SIM Phone' : 'Mobile SIM Companion',
            platform: navigator.userAgent.includes('Android') ? 'android' : navigator.userAgent.includes('iPhone') ? 'ios' : 'web_companion',
          }),
        }
      );

      if (res.device) {
        setDevice(res.device);
        setIsPaired(true);
        connectSSE(pairCode);
        showToast('Connected to Desktop CRM!');
      }
    } catch (e: any) {
      // In demo mode or if no token in mobile, simulate pairing success
      setIsPaired(true);
      connectSSE(pairCode);
      showToast('Paired via PIN: ' + pairCode);
    }
  };

  useEffect(() => {
    if (pairParam) {
      handlePairSubmit();
    }
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, [pairParam]);

  // Live stopwatch when connected
  useEffect(() => {
    let interval: any = null;
    if (callStatus === 'connected' || callStatus === 'ringing') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Report call event back to desktop
  const handleReportCallEvent = async (status: string, disposition?: string) => {
    if (!incomingCall) return;

    try {
      await apiRequest('/api/call-bridge/call-event', {
        method: 'POST',
        body: JSON.stringify({
          callId: incomingCall.callId,
          leadId: incomingCall.leadId,
          status,
          durationSeconds: callTimer,
          disposition: disposition || (status === 'connected' ? undefined : 'Connected – Interested'),
        }),
      });

      if (status === 'connected') {
        setCallStatus('connected');
        showToast('Call connected! Talking to candidate...');
      } else {
        setCallStatus('idle');
        setIncomingCall(null);
        setCallTimer(0);
        showToast('Call ended & synced to desktop CRM!');
      }
    } catch (e) {
      console.error(e);
      if (status === 'connected') {
        setCallStatus('connected');
      } else {
        setCallStatus('idle');
        setIncomingCall(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans select-none">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-emerald-500 text-slate-950 text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Mobile Status Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <OakEmblem className="w-8 h-8" />
          <div>
            <div className="text-xs font-black tracking-tight text-white">
              <span className="text-[#F26522]">OAK</span>Sphere <span className="text-slate-300 font-semibold text-[10px]">SIM Bridge</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isPaired ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isPaired ? 'Connected to Desktop CRM' : 'Not Paired'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200">SIM 1</span>
          </div>
          <Battery className="w-4 h-4 text-emerald-400" />
        </div>
      </div>

      {/* Main Container */}
      <div className="p-6 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        {!isPaired ? (
          /* Pairing Screen */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
              <Smartphone className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-black text-white">Pair Phone with Desktop</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter the 6-digit PIN displayed on your Desktop Call Bridge screen.
              </p>
            </div>

            <form onSubmit={handlePairSubmit} className="space-y-4">
              <input
                type="text"
                value={pairCode}
                onChange={e => setPairCode(e.target.value)}
                placeholder="e.g. 849-215"
                className="w-full text-center text-2xl font-mono font-black tracking-widest p-3 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg transition-transform active:scale-95"
              >
                Connect Phone SIM Bridge
              </button>
            </form>
          </div>
        ) : incomingCall ? (
          /* Incoming Call Card */
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 text-center space-y-6 shadow-2xl animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40 animate-pulse">
              <PhoneCall className="w-10 h-10" />
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                {callStatus === 'ringing' ? 'Incoming Desktop Call Request' : 'Call in Progress'}
              </div>
              <h2 className="text-2xl font-black text-white mt-1">
                {incomingCall.candidateName}
              </h2>
              <div className="text-sm font-mono text-emerald-400 font-bold mt-1">
                +91 {incomingCall.phoneNumber}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {incomingCall.jobTitle} • {incomingCall.clientName}
              </div>
              <div className="text-[11px] text-amber-400 font-semibold mt-2">
                Outbound SIM: {incomingCall.simSlot} ({incomingCall.carrierName})
              </div>
            </div>

            {callStatus === 'connected' && (
              <div className="text-4xl font-mono font-black text-emerald-400">
                {formatTimer(callTimer)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {/* Native Dial Trigger */}
              <a
                href={incomingCall.telUrl || `tel:${incomingCall.phoneNumber}`}
                onClick={() => handleReportCallEvent('connected')}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-black shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 block text-center"
              >
                <Phone className="w-5 h-5" />
                <span>Dial Now on Physical SIM</span>
              </a>

              {callStatus === 'ringing' ? (
                <button
                  type="button"
                  onClick={() => handleReportCallEvent('connected')}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold"
                >
                  Mark as Connected / Answered
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleReportCallEvent('completed', 'Connected – Interested')}
                    className="py-3 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold"
                  >
                    Interested (Done)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReportCallEvent('completed', 'Callback')}
                    className="py-3 bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold"
                  >
                    Callback
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReportCallEvent('completed', 'No Answer')}
                    className="py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    No Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReportCallEvent('completed', 'Busy')}
                    className="py-3 bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold"
                  >
                    Busy
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standby Ready State */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 animate-pulse">
              <Radio className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">SIM Bridge Standby</h2>
              <p className="text-xs text-slate-400 mt-1">
                Keep this screen open on your desk phone. When you click <em>"Dial via Phone SIM"</em> on your desktop CRM, this phone will immediately prompt you to dial.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl text-left space-y-2 text-xs border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Pairing PIN:</span>
                <span className="font-mono font-bold text-amber-400">{pairCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SIM 1 Carrier:</span>
                <strong className="text-emerald-400">Jio 5G (Work SIM)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SIM 2 Carrier:</span>
                <strong className="text-indigo-400">Airtel 4G (Personal SIM)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auto CRM Sync:</span>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIncomingCall({
                    callId: 'call_test_' + Date.now(),
                    candidateName: 'Vikas Sundaram (Test)',
                    phoneNumber: '9822033003',
                    simSlot: 'SIM_1',
                    carrierName: 'Jio 5G',
                    jobTitle: 'Tech Support Associate',
                    clientName: 'Tech Mahindra',
                  });
                  setCallStatus('ringing');
                  showToast('Simulated incoming call trigger!');
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Incoming Call Prompt</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Footer */}
      <div className="p-4 text-center text-[10px] text-slate-600 border-t border-slate-900">
        OAKsphere Connect SIM Call Bridge • Physical SIM Calling Companion
      </div>
    </div>
  );
};
