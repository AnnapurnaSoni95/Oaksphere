import React from 'react';

export const PriorityBadge: React.FC<{ priority: string; size?: 'sm' | 'md' }> = ({ priority, size = 'sm' }) => {
  const p = priority || 'Medium';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  switch (p) {
    case 'Hot':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          Hot
        </span>
      );
    case 'High':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200 ${sizeClasses}`}>
          High
        </span>
      );
    case 'Medium':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
          Medium
        </span>
      );
    case 'Low':
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
          Low
        </span>
      );
    case 'Cold':
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}>
          Cold
        </span>
      );
  }
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const s = status || 'New';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  switch (s) {
    case 'Joined':
      return (
        <span className={`inline-flex items-center font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClasses}`}>
          ✓ Joined
        </span>
      );
    case 'Selected':
    case 'Joining Scheduled':
    case 'Joining Confirmed':
      return (
        <span className={`inline-flex items-center font-semibold rounded-md bg-teal-50 text-teal-800 border border-teal-200 ${sizeClasses}`}>
          ★ {s}
        </span>
      );
    case 'Interview Scheduled':
    case 'Today':
    case 'Tomorrow':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses}`}>
          📅 {s}
        </span>
      );
    case 'Interview Attended':
    case 'Attended':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses}`}>
          Attended
        </span>
      );
    case 'Interested':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
          Interested
        </span>
      );
    case 'Follow-up':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          Follow-up
        </span>
      );
    case 'Calling':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-sky-50 text-sky-700 border border-sky-200 ${sizeClasses}`}>
          Calling
        </span>
      );
    case 'New':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
          New Lead
        </span>
      );
    case 'Lost':
    case 'Not Interested':
    case 'Rejected':
    case 'No Show':
    case 'Dropped':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-red-50 text-red-700 border border-red-200 ${sizeClasses}`}>
          {s}
        </span>
      );
    case 'Invalid Number':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-slate-200 text-slate-700 border border-slate-300 line-through ${sizeClasses}`}>
          Invalid No.
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          {s}
        </span>
      );
  }
};

export const PhoneVerifyBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'VERIFIED') {
    return <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-200 font-medium">Verified</span>;
  }
  if (status === 'NEEDS_VERIFY') {
    return <span className="text-[10px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded border border-amber-200 font-medium">Verify</span>;
  }
  if (status === 'INVALID') {
    return <span className="text-[10px] bg-red-50 text-red-700 px-1 py-0.5 rounded border border-red-200 font-medium">Invalid</span>;
  }
  return null;
};
