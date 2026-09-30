import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiRequest } from '../../lib/api';
import { User, Phone, Mail, MapPin, Briefcase, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  onLeadCreated,
}) => {
  const [candidateName, setCandidateName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [currentSalary, setCurrentSalary] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('Immediate');
  const [leadSource, setLeadSource] = useState('Naukri Bulk');
  const [priority, setPriority] = useState('Medium');
  const [assignedRecruiterId, setAssignedRecruiterId] = useState('');
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [notes, setNotes] = useState('');

  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setDuplicateWarning(null);
      setAllowDuplicate(false);
      setCandidateName('');
      setPrimaryPhone('');
      setAlternatePhone('');
      setEmail('');
      setCity('');
      setAge('');
      setQualification('');
      setExperience('');
      setCurrentSalary('');
      setExpectedSalary('');
      setNotes('');

      apiRequest('/api/users').then(res => setUsers(res.users || [])).catch(() => {});
      apiRequest('/api/clients').then(res => setClients(res.clients || [])).catch(() => {});
      apiRequest('/api/jobs').then(res => setJobs(res.jobs || [])).catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setDuplicateWarning(null);

    if (!candidateName.trim() || !primaryPhone.trim() || !city.trim()) {
      setErrorMsg('Candidate Name, Primary Phone, and City are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          candidateName,
          primaryPhone,
          alternatePhone: alternatePhone || undefined,
          email: email || undefined,
          city,
          age: age ? Number(age) : undefined,
          gender,
          qualification: qualification || undefined,
          experience: experience || undefined,
          currentSalary: currentSalary ? Number(currentSalary) : undefined,
          expectedSalary: expectedSalary ? Number(expectedSalary) : undefined,
          noticePeriod,
          leadSource,
          priority,
          assignedRecruiterId: assignedRecruiterId || undefined,
          clientId: clientId || undefined,
          jobId: jobId || undefined,
          notes: notes || undefined,
          allowDuplicate,
        }),
      });

      onLeadCreated();
      onClose();
    } catch (err: any) {
      if (err.status === 409 && err.data?.existingLead) {
        setDuplicateWarning(err.data.existingLead);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err.message || 'Failed to create lead');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredJobs = clientId ? jobs.filter(j => j.clientId === clientId) : jobs;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Candidate Lead"
      subtitle="Enter candidate information with automatic duplicate and phone verification"
      maxWidth="4xl"
    >
      {duplicateWarning && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <span>Duplicate Candidate Found in Database!</span>
          </div>
          <p className="text-amber-800">
            A lead with this phone number already exists: <strong>{duplicateWarning.candidateName}</strong> (ID: {duplicateWarning.id}), currently assigned to recruiter <strong>{duplicateWarning.assignedRecruiterName}</strong> with status <strong>{duplicateWarning.leadStatus}</strong>.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 font-semibold text-amber-950 cursor-pointer">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(e) => setAllowDuplicate(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              Force create duplicate record anyway (Admin audit will track this)
            </label>
          </div>
        </div>
      )}

      {errorMsg && !duplicateWarning && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Core Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Candidate Full Name *</label>
            <input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Primary Phone Number *</label>
            <input
              type="tel"
              required
              value={primaryPhone}
              onChange={(e) => setPrimaryPhone(e.target.value)}
              placeholder="10-digit mobile number (e.g. 9820011223)"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Alternate Phone</label>
            <input
              type="tel"
              value={alternatePhone}
              onChange={(e) => setAlternatePhone(e.target.value)}
              placeholder="Secondary contact"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-slate-600 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Current City *</label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Pune, Mumbai"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Age</label>
            <input
              type="number"
              min="18"
              max="65"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 24"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e: any) => setGender(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Experience & Salary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-slate-600 mb-1">Qualification</label>
            <input
              type="text"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="e.g. B.Com / MBA"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Experience</label>
            <input
              type="text"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 2 Years Voice BPO"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Current Salary (₹/month)</label>
            <input
              type="number"
              value={currentSalary}
              onChange={(e) => setCurrentSalary(e.target.value)}
              placeholder="e.g. 22000"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Expected Salary (₹/month)</label>
            <input
              type="number"
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(e.target.value)}
              placeholder="e.g. 28000"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            />
          </div>
        </div>

        {/* CRM Context */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Lead Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
            >
              <option value="Hot">🔥 Hot</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Cold">Cold</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Lead Source</label>
            <select
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="Naukri Bulk">Naukri Bulk</option>
              <option value="Indeed">Indeed</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Referral">Referral</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Facebook Ads">Facebook Ads</option>
              <option value="Consultant">Consultant</option>
              <option value="Campus">Campus</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Notice Period</label>
            <select
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="Immediate">Immediate</option>
              <option value="7 Days">7 Days</option>
              <option value="15 Days">15 Days</option>
              <option value="30 Days">30 Days</option>
              <option value="Serving Notice">Serving Notice</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Assign Recruiter</label>
            <select
              value={assignedRecruiterId}
              onChange={(e) => setAssignedRecruiterId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
            >
              <option value="">-- Leave Unassigned --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Client & Job mapping */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 mb-1">Target Client (Optional)</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="">-- General / No Client Selected --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.companyName} ({c.location})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Target Job (Optional)</label>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="">-- Any Opening --</option>
              {filteredJobs.map(j => (
                <option key={j.id} value={j.id}>{j.positionTitle}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-600 mb-1">Initial Candidate Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any initial remarks or resume highlights..."
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
          />
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : allowDuplicate ? 'Force Create Duplicate' : 'Create Candidate Lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
