import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Building,
  Briefcase,
  Plus,
  Users,
  Calendar,
  CheckCircle,
  MapPin,
  Mail,
  Phone,
  Filter,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const ClientsJobsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'clients' | 'jobs'>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);

  // New Client Form
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 days from candidate joining');
  const [replacementTerms, setReplacementTerms] = useState('90 days free replacement');

  // New Job Form
  const [selectedClientId, setSelectedClientId] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [experienceRequired, setExperienceRequired] = useState('');
  const [numberOfOpenings, setNumberOfOpenings] = useState('10');
  const [requirements, setRequirements] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cRes, jRes] = await Promise.all([
        apiRequest('/api/clients'),
        apiRequest('/api/jobs'),
      ]);
      setClients(cRes.clients || []);
      setJobs(jRes.jobs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          contactPerson,
          phone: clientPhone,
          email: clientEmail,
          location: clientLocation,
          paymentTerms,
          replacementTerms,
        }),
      });
      setIsClientModalOpen(false);
      setCompanyName('');
      setContactPerson('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          clientId: selectedClientId,
          positionTitle,
          location: jobLocation,
          salaryRange,
          experienceRequired,
          numberOfOpenings: Number(numberOfOpenings),
          requirements,
        }),
      });
      setIsJobModalOpen(false);
      setPositionTitle('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Clients & Hiring Job Openings
            </h1>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px]">
              {clients.length} Clients • {jobs.length} Active Positions
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Client accounts, commercial terms, job criteria, and live candidate funnel statistics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Client
              </button>
              <button
                type="button"
                onClick={() => {
                  if (clients.length > 0) setSelectedClientId(clients[0].id);
                  setIsJobModalOpen(true);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Post Job Opening
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('clients')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'clients' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Building className="w-3.5 h-3.5" /> Client Accounts ({clients.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('jobs')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'jobs' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Hiring Job Openings ({jobs.length})
        </button>
      </div>

      {/* CLIENTS TAB */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c: any) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{c.companyName}</h3>
                  <div className="text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.location}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Active Partner
                </span>
              </div>

              {/* Commercial terms */}
              <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] space-y-1">
                <div>
                  <span className="text-slate-500">Contact: </span>
                  <span className="font-semibold text-slate-800">{c.contactPerson}</span> • {c.phone}
                </div>
                <div>
                  <span className="text-slate-500">Payment: </span>
                  <span className="font-medium text-slate-700">{c.paymentTerms}</span>
                </div>
                <div>
                  <span className="text-slate-500">Replacement Guarantee: </span>
                  <span className="font-medium text-slate-700">{c.replacementTerms}</span>
                </div>
              </div>

              {/* Live Client Recruitment Stats */}
              <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-100 text-center">
                <div className="p-1.5 bg-blue-50/70 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 block">Submitted</span>
                  <span className="font-bold text-blue-900 text-xs">{c.stats?.candidatesSubmitted || 0}</span>
                </div>
                <div className="p-1.5 bg-purple-50/70 rounded border border-purple-100">
                  <span className="text-[10px] text-slate-500 block">Interviews</span>
                  <span className="font-bold text-purple-900 text-xs">{c.stats?.interviews || 0}</span>
                </div>
                <div className="p-1.5 bg-violet-50/70 rounded border border-violet-100">
                  <span className="text-[10px] text-slate-500 block">Attended</span>
                  <span className="font-bold text-violet-900 text-xs">{c.stats?.attended || 0}</span>
                </div>
                <div className="p-1.5 bg-teal-50/70 rounded border border-teal-100">
                  <span className="text-[10px] text-slate-500 block">Selected</span>
                  <span className="font-bold text-teal-900 text-xs">{c.stats?.selected || 0}</span>
                </div>
                <div className="p-1.5 bg-emerald-50/70 rounded border border-emerald-100">
                  <span className="text-[10px] text-emerald-800 block font-semibold">Joined</span>
                  <span className="font-extrabold text-emerald-900 text-xs">{c.stats?.joined || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* JOBS TAB */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((j: any) => (
            <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{j.positionTitle}</h3>
                  <div className="text-indigo-600 font-semibold text-xs mt-0.5">{j.clientName}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {j.numberOfOpenings} Openings
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-slate-400 block text-[10px]">Location</span>
                  <span className="font-medium text-slate-800">{j.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Salary Range</span>
                  <span className="font-semibold text-slate-900">{j.salaryRange}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Experience Required</span>
                  <span className="font-medium text-slate-800">{j.experienceRequired}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Job Status</span>
                  <span className="font-bold text-emerald-700">{j.status}</span>
                </div>
              </div>

              <p className="text-slate-600 text-[11px] line-clamp-2">
                <strong>Requirements:</strong> {j.requirements}
              </p>

              {/* Job Funnel Stats */}
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-center">
                <div className="p-1.5 bg-slate-50 rounded">
                  <span className="text-[10px] text-slate-500 block">Submitted</span>
                  <span className="font-bold text-slate-900">{j.stats?.candidatesSubmitted || 0}</span>
                </div>
                <div className="p-1.5 bg-purple-50 rounded">
                  <span className="text-[10px] text-purple-700 block">Lineups</span>
                  <span className="font-bold text-purple-900">{j.stats?.interviews || 0}</span>
                </div>
                <div className="p-1.5 bg-teal-50 rounded">
                  <span className="text-[10px] text-teal-700 block">Selected</span>
                  <span className="font-bold text-teal-900">{j.stats?.selected || 0}</span>
                </div>
                <div className="p-1.5 bg-emerald-50 rounded">
                  <span className="text-[10px] text-emerald-700 block font-semibold">Joined</span>
                  <span className="font-extrabold text-emerald-900">{j.stats?.joined || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Client Modal */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Add New Client Account"
        subtitle="Configure commercial terms and company details"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company / Client Name *</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Teleperformance Global"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Contact Person *</label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="HR Manager name"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Contact Phone</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Email Address</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Office / Interview Location</label>
              <input
                type="text"
                value={clientLocation}
                onChange={(e) => setClientLocation(e.target.value)}
                placeholder="e.g. Pune - Hinjewadi Phase 3"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Commercial Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Replacement Policy</label>
              <input
                type="text"
                value={replacementTerms}
                onChange={(e) => setReplacementTerms(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsClientModalOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-slate-900 text-white font-semibold rounded-md shadow-xs"
            >
              Save Client
            </button>
          </div>
        </form>
      </Modal>

      {/* New Job Modal */}
      <Modal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        title="Post New Hiring Job Opening"
        subtitle="Define position criteria, salary, and openings"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Client *</label>
            <select
              required
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.companyName} ({c.location})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Position / Job Title *</label>
            <input
              type="text"
              required
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              placeholder="e.g. Customer Care Executive (Voice - UK Shift)"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Location</label>
              <input
                type="text"
                value={jobLocation}
                onChange={(e) => setJobLocation(e.target.value)}
                placeholder="e.g. Pune"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Salary Range</label>
              <input
                type="text"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="e.g. ₹25,000 - ₹32,000"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Openings Count</label>
              <input
                type="number"
                value={numberOfOpenings}
                onChange={(e) => setNumberOfOpenings(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-medium">Experience & Requirements</label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Required experience, night shifts, communication benchmarks..."
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsJobModalOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white font-semibold rounded-md shadow-xs"
            >
              Create Job Opening
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
