import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail } from 'lucide-react';
import { OakLogo } from '../components/common/OakLogo';

export const LoginPage: React.FC = () => {
  const { login, demoUsers, switchDemoUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <OakLogo variant="full" showTagline={true} />
          <p className="text-slate-500 text-xs mt-2 font-medium">
            High-Volume Bulk Recruitment CRM for BPO, Sales & Banking Agencies
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="recruiter@oaksphere.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-colors text-xs"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In to Workspace'}
          </button>
        </form>

        {/* Quick Demo Access */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Quick Role Access</span>
            <span className="text-[10px] text-slate-400">Select role to explore</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                const admin = demoUsers.find(u => u.role === 'admin');
                if (admin) switchDemoUser(admin.id);
              }}
              className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 text-center transition-all group"
            >
              <div className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600">Admin</div>
              <div className="text-[10px] text-slate-400">Full System</div>
            </button>
            <button
              type="button"
              onClick={() => {
                const tl = demoUsers.find(u => u.role === 'team_leader');
                if (tl) switchDemoUser(tl.id);
              }}
              className="p-2.5 rounded-lg border border-slate-200 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/50 text-center transition-all group"
            >
              <div className="font-semibold text-xs text-slate-800 group-hover:text-purple-600">Team Lead</div>
              <div className="text-[10px] text-slate-400">Team Targets</div>
            </button>
            <button
              type="button"
              onClick={() => {
                const rec = demoUsers.find(u => u.role === 'recruiter');
                if (rec) switchDemoUser(rec.id);
              }}
              className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 text-center transition-all group"
            >
              <div className="font-semibold text-xs text-slate-800 group-hover:text-blue-600">Recruiter</div>
              <div className="text-[10px] text-slate-400">SIM & Queue</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
