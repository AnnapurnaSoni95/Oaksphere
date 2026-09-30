import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Upload,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  Download,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { PriorityBadge, PhoneVerifyBadge } from '../components/common/Badge';

export const ImportWizardPage: React.FC = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Raw file / text data
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);

  // Field Mapping: CRM field -> File Header
  const [mapping, setMapping] = useState<Record<string, string>>({
    candidateName: '',
    primaryPhone: '',
    alternatePhone: '',
    email: '',
    city: '',
    experience: '',
    currentSalary: '',
    expectedSalary: '',
    leadSource: '',
    priority: '',
    clientName: '',
    jobTitle: '',
  });

  // Validation Results
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'valid' | 'warning' | 'duplicate' | 'invalid'>('valid');

  // Import options
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  // Sample CSV generator for testing
  const loadSampleCSV = () => {
    const sample = `Candidate Name,Mobile Phone,Email,City,Experience,Current CTC,Expected CTC,Source,Priority
Rakesh Solanki,9820011999,rakesh.s@example.com,Pune,2 Years BPO Voice,24000,30000,Naukri Bulk,Hot
Kavita Patil,9819922888,kavita.p@example.com,Mumbai,1 Year Telesales,20000,26000,Indeed,High
Sameer K. Nair,9820012399,sameer.nair@example.com,Mumbai,2 Years Sales,28000,34000,Naukri Bulk,High
Invalid Candidate,12345,invalid@domain,Pune,Fresher,0,20000,Campus,Low
Duplicate Within File,9820011999,another.rakesh@example.com,Pune,1 Year,18000,22000,Referral,Medium`;
    setCsvText(sample);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
    };
    reader.readAsText(file);
  };

  // Simple CSV parser
  const parseCSV = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    setFileHeaders(headers);

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      // Handle commas inside quotes or simple split
      const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = parts[idx] || '';
      });
      rows.push(rowObj);
    }

    setParsedRows(rows);

    // Auto-guess initial mapping
    const autoMap: Record<string, string> = { ...mapping };
    headers.forEach(h => {
      const low = h.toLowerCase();
      if (low.includes('name')) autoMap.candidateName = h;
      else if (low.includes('phone') || low.includes('mobile') || low.includes('contact')) {
        if (!autoMap.primaryPhone) autoMap.primaryPhone = h;
        else if (!autoMap.alternatePhone) autoMap.alternatePhone = h;
      } else if (low.includes('email')) autoMap.email = h;
      else if (low.includes('city') || low.includes('location')) autoMap.city = h;
      else if (low.includes('exp')) autoMap.experience = h;
      else if (low.includes('curr') || (low.includes('salary') && !autoMap.currentSalary)) autoMap.currentSalary = h;
      else if (low.includes('exp') && low.includes('sal') || low.includes('expected')) autoMap.expectedSalary = h;
      else if (low.includes('source')) autoMap.leadSource = h;
      else if (low.includes('priority')) autoMap.priority = h;
      else if (low.includes('client') || low.includes('company')) autoMap.clientName = h;
      else if (low.includes('job') || low.includes('role') || low.includes('position')) autoMap.jobTitle = h;
    });
    setMapping(autoMap);
    setStep(2);
  };

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const res = await apiRequest('/api/leads/import/validate', {
        method: 'POST',
        body: JSON.stringify({
          rows: parsedRows,
          mapping,
        }),
      });
      setValidationResult(res);
      setStep(3);
    } catch (e: any) {
      alert(e.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const executeCommit = async () => {
    setIsImporting(true);
    try {
      const res = await apiRequest('/api/leads/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          rows: parsedRows,
          mapping,
          skipDuplicates,
        }),
      });
      setImportSummary(res);
      setStep(4);
    } catch (e: any) {
      alert(e.message || 'Import commit failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto text-xs">
      {/* Wizard Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                Enterprise Data Engine
              </span>
              <span className="text-slate-400">• High-volume lead onboarding</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              CSV / Excel Bulk Import Wizard
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Robust 4-stage pipeline: Upload → Map Fields → Duplicate & Phone Validation → Safe Commit.
            </p>
          </div>

          {/* Stepper tracker */}
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { num: 1, label: 'Upload' },
              { num: 2, label: 'Map Fields' },
              { num: 3, label: 'Validate & Preview' },
              { num: 4, label: 'Results' },
            ].map(s => (
              <div key={s.num} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  step === s.num
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`hidden md:inline font-medium text-xs ${step === s.num ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                  {s.label}
                </span>
                {s.num < 4 && <div className="w-4 h-0.5 bg-slate-200 hidden md:block"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STEP 1: Upload or Paste CSV */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Step 1: Choose File or Paste CSV Data</h2>
            <button
              type="button"
              onClick={loadSampleCSV}
              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Load Sample Bulk Data
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition-colors">
            <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <div className="font-medium text-slate-700">Choose CSV file from your computer</div>
            <p className="text-slate-400 text-[11px] mt-0.5">Supports CSV or TSV exports from Naukri, Indeed, LinkedIn, Facebook</p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="mt-3 text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Or Paste CSV Text Directly:</label>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Candidate Name,Mobile Phone,Email,City,Experience..."
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!csvText.trim()}
              onClick={parseCSV}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              Proceed to Field Mapping <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Field Mapping */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Step 2: Map Columns to CRM Lead Fields</h2>
              <p className="text-slate-500 text-xs">Match your uploaded CSV headers to standard CRM candidate properties.</p>
            </div>
            <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 font-bold">
              {parsedRows.length} Rows Detected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'candidateName', label: 'Candidate Full Name *', required: true },
              { key: 'primaryPhone', label: 'Primary Mobile Phone *', required: true },
              { key: 'city', label: 'Candidate City *', required: true },
              { key: 'email', label: 'Email Address' },
              { key: 'alternatePhone', label: 'Alternate Contact' },
              { key: 'experience', label: 'Experience Details' },
              { key: 'currentSalary', label: 'Current Salary (CTC)' },
              { key: 'expectedSalary', label: 'Expected Salary' },
              { key: 'leadSource', label: 'Lead Source' },
              { key: 'priority', label: 'Priority Level' },
              { key: 'clientName', label: 'Target Client Name' },
              { key: 'jobTitle', label: 'Target Job Position' },
            ].map(field => (
              <div key={field.key} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-semibold text-slate-800">
                  {field.label}
                </span>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs min-w-[180px] font-medium"
                >
                  <option value="">-- Do Not Import --</option>
                  {fileHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium"
            >
              Back to Upload
            </button>
            <button
              type="button"
              disabled={!mapping.candidateName || !mapping.primaryPhone || isValidating}
              onClick={runValidation}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              {isValidating ? 'Running Duplicate & Phone Engine...' : 'Run Deep Validation & Preview'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Validate & Preview */}
      {step === 3 && validationResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Step 3: Validation & Duplicate Audit Preview</h2>
              <p className="text-slate-500 text-xs">Verify valid records, duplicate phones, and invalid data before committing to the CRM.</p>
            </div>

            {/* Validation Breakdown Badges */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                ✓ {validationResult.validRows.length} Valid
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold">
                ⚠️ {validationResult.duplicateRows.length} Duplicates
              </span>
              <span className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 font-bold">
                ✕ {validationResult.invalidRows.length} Invalid
              </span>
            </div>
          </div>

          {/* Duplicate handling policy selection */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Duplicate Candidate Policy</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Choose how existing candidate phone matches (both in CRM and within the file) should be handled.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="radio"
                  name="dupPolicy"
                  checked={skipDuplicates}
                  onChange={() => setSkipDuplicates(true)}
                  className="text-indigo-600"
                />
                <span>Skip Duplicates (Safe & Recommended)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="radio"
                  name="dupPolicy"
                  checked={!skipDuplicates}
                  onChange={() => setSkipDuplicates(false)}
                  className="text-indigo-600"
                />
                <span>Allow Duplicates (Force Import)</span>
              </label>
            </div>
          </div>

          {/* Preview Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
            <button
              type="button"
              onClick={() => setActivePreviewTab('valid')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activePreviewTab === 'valid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Valid Rows ({validationResult.validRows.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab('duplicate')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activePreviewTab === 'duplicate' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Duplicate Warnings ({validationResult.duplicateRows.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab('invalid')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activePreviewTab === 'invalid' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Invalid Rows ({validationResult.invalidRows.length})
            </button>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-72">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3">Row #</th>
                  <th className="py-2 px-3">Candidate</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">City</th>
                  <th className="py-2 px-3">Source & Role</th>
                  <th className="py-2 px-3">Status / Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePreviewTab === 'valid' && validationResult.validRows.map((item: any) => (
                  <tr key={item.rowIndex} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono text-slate-400">#{item.rowIndex}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{item.data.candidateName}</td>
                    <td className="py-2 px-3 font-mono">{item.data.primaryPhone}</td>
                    <td className="py-2 px-3">{item.data.city}</td>
                    <td className="py-2 px-3 text-slate-500">{item.data.leadSource}</td>
                    <td className="py-2 px-3 text-emerald-600 font-semibold">✓ Ready to import</td>
                  </tr>
                ))}

                {activePreviewTab === 'duplicate' && validationResult.duplicateRows.map((item: any) => (
                  <tr key={item.rowIndex} className="bg-amber-50/40 hover:bg-amber-50/80">
                    <td className="py-2 px-3 font-mono text-slate-400">#{item.rowIndex}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{item.data.candidateName}</td>
                    <td className="py-2 px-3 font-mono font-bold text-amber-900">{item.data.primaryPhone}</td>
                    <td className="py-2 px-3">{item.data.city}</td>
                    <td className="py-2 px-3 text-slate-500">{item.data.leadSource}</td>
                    <td className="py-2 px-3 text-amber-800 font-medium">
                      ⚠️ {item.duplicateReason} ({skipDuplicates ? 'Will be skipped' : 'Will be force imported'})
                    </td>
                  </tr>
                ))}

                {activePreviewTab === 'invalid' && validationResult.invalidRows.map((item: any) => (
                  <tr key={item.rowIndex} className="bg-rose-50/40 hover:bg-rose-50/80">
                    <td className="py-2 px-3 font-mono text-slate-400">#{item.rowIndex}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{item.data.candidateName || '<Missing Name>'}</td>
                    <td className="py-2 px-3 font-mono font-bold text-rose-700">{item.data.primaryPhone || '<Missing Phone>'}</td>
                    <td className="py-2 px-3">{item.data.city}</td>
                    <td className="py-2 px-3 text-slate-500">{item.data.leadSource}</td>
                    <td className="py-2 px-3 text-rose-700 font-semibold">
                      ✕ Error: {item.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium"
            >
              Back to Mapping
            </button>
            <button
              type="button"
              disabled={isImporting || (validationResult.validRows.length === 0 && (skipDuplicates || validationResult.duplicateRows.length === 0))}
              onClick={executeCommit}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              {isImporting ? 'Importing Leads to CRM...' : 'Confirm & Commit Import to Database'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Results */}
      {step === 4 && importSummary && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5 text-center">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Bulk Import Completed Successfully!</h2>
            <p className="text-slate-500 text-xs mt-1">
              Your candidate leads have been securely committed to OAKsphere Connect CRM.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Total Rows</span>
              <span className="text-xl font-black text-slate-900">{importSummary.totalRows}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-700 block text-[10px] font-semibold uppercase">Imported</span>
              <span className="text-xl font-black text-emerald-800">{importSummary.importedCount}</span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-amber-700 block text-[10px] font-semibold uppercase">Skipped Duplicates</span>
              <span className="text-xl font-black text-amber-800">{importSummary.skippedDuplicates}</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-rose-700 block text-[10px] font-semibold uppercase">Invalid Rows</span>
              <span className="text-xl font-black text-rose-800">{importSummary.invalidCount}</span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCsvText('');
                setImportSummary(null);
              }}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Import Another File
            </button>
            <a
              href="/leads"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              View Leads in CRM <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
