export type UserRole = 'admin' | 'team_leader' | 'recruiter';

export interface UserPermissions {
  canExportData: boolean;          // Can download CSV / Excel of candidate records
  canDeleteLeads: boolean;         // Can delete candidate leads
  canViewAllLeads: boolean;        // If false, restricted strictly to assigned leads
  canViewCandidatePhone: boolean;  // If false, candidate phone number is masked: e.g. +91 98203•••••
  canBulkReassign: boolean;        // Can transfer leads to another recruiter
  canManageTemplates: boolean;     // Can edit WhatsApp message templates
}

export function getDefaultPermissions(role: UserRole): UserPermissions {
  if (role === 'admin') {
    return {
      canExportData: true,
      canDeleteLeads: true,
      canViewAllLeads: true,
      canViewCandidatePhone: true,
      canBulkReassign: true,
      canManageTemplates: true,
    };
  }
  if (role === 'team_leader') {
    return {
      canExportData: true,
      canDeleteLeads: false,
      canViewAllLeads: false,
      canViewCandidatePhone: true,
      canBulkReassign: true,
      canManageTemplates: true,
    };
  }
  // Recruiter: strictly limited by default
  return {
    canExportData: false,
    canDeleteLeads: false,
    canViewAllLeads: false,
    canViewCandidatePhone: false,
    canBulkReassign: false,
    canManageTemplates: false,
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  teamId?: string;
  teamName?: string;
  phone?: string;
  isActive: boolean;
  dailyCallTarget: number;
  dailyConnectedTarget: number;
  dailyLineupTarget: number;
  monthlyJoiningTarget: number;
  permissions?: UserPermissions;
  createdAt: string;
  updatedAt: string;
}

export type LeadPriority = 'Hot' | 'High' | 'Medium' | 'Low' | 'Cold';

export type LeadStatus =
  | 'New'
  | 'Calling'
  | 'Follow-up'
  | 'Interested'
  | 'Interview Scheduled'
  | 'Interview Attended'
  | 'Selected'
  | 'Joining Scheduled'
  | 'Joined'
  | 'Not Interested'
  | 'Lost'
  | 'Unreachable'
  | 'Invalid Number';

export type CallDisposition =
  | 'Connected – Interested'
  | 'Not Interested'
  | 'Callback'
  | 'Interview Scheduled'
  | 'Already Working'
  | 'Salary Issue'
  | 'Location Issue'
  | 'Job Mismatch'
  | 'No Answer'
  | 'Busy'
  | 'Switched Off'
  | 'Unreachable'
  | 'Invalid Number'
  | 'WhatsApp Only'
  | 'Call Back Later';

export type InterviewStage =
  | 'Pending'
  | 'Scheduled'
  | 'Tomorrow'
  | 'Today'
  | 'Attended'
  | 'Not Attended'
  | 'Rescheduled'
  | 'Selected'
  | 'Rejected'
  | 'Dropped';

export type InterviewType = 'Walk-in' | 'Telephonic' | 'Virtual' | 'Face-to-face';
export type InterviewConfirmation = 'Pending' | 'Confirmed' | 'Not Confirmed' | 'Reschedule Requested';

export type JoiningStatus =
  | 'Selected'
  | 'Documents Pending'
  | 'Offer Pending'
  | 'Offer Released'
  | 'Joining Confirmed'
  | 'Joined'
  | 'Delayed'
  | 'No Show'
  | 'Dropped'
  | 'Client Rejected';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'call' | 'status_change' | 'followup' | 'interview' | 'joining' | 'note' | 'assignment' | 'merge';
  title: string;
  description: string;
  performedBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AssignmentHistory {
  id: string;
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  assignedByName: string;
  assignedAt: string;
  reason?: string;
}

export interface ScreeningScorecard {
  communicationLevel: 'Basic' | 'Average' | 'Good' | 'Excellent';
  shiftAvailability: 'Day Only' | '24/7 Rotational' | 'Night Shift' | 'US Shift';
  commuteDistance: 'Within 10km' | '10-25km' | '25km+' | 'Transport Needed' | 'Relocation Ready';
  typingSpeedWpm?: number;
  skills: string[];
  noticePeriodDays: number;
  expectedCtcMonthly?: number;
  currentCtcMonthly?: number;
  evaluatedAt: string;
  evaluatedByRecruiterId: string;
  evaluatedByRecruiterName: string;
  fitScore: number; // 0 - 100
  dealbreakers: string[];
  overallVerdict: 'Strong Fit' | 'Borderline Fit' | 'High Risk' | 'Not Qualified';
  recruiterRemarks?: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  category: 'screening' | 'interview' | 'reminder' | 'status' | 'documents' | 'joining' | 'custom';
  channel: 'whatsapp' | 'sms' | 'email';
  body: string;
  variables: string[];
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  candidateName: string;
  primaryPhone: string;
  normalizedPhone: string;
  alternatePhone?: string;
  normalizedAltPhone?: string;
  phoneStatus: 'VERIFIED' | 'NEEDS_VERIFY' | 'INVALID';
  email?: string;
  city: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  qualification?: string;
  experience?: string;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriod?: string;
  skills?: string[];
  preferredShift?: string;
  leadSource: string;
  scorecard?: ScreeningScorecard;
  
  assignedRecruiterId: string;
  assignedRecruiterName: string;
  originalRecruiterId: string;
  originalRecruiterName: string;
  teamId?: string;

  clientId?: string;
  clientName?: string;
  jobId?: string;
  jobTitle?: string;

  priority: LeadPriority;
  leadStatus: LeadStatus;
  interviewStatus?: InterviewStage;
  joiningStatus?: JoiningStatus;

  callAttempts: number;
  lastCallAt?: string;
  lastCallOutcome?: CallDisposition;
  nextFollowupAt?: string;
  nextFollowupReason?: string;
  
  notesSummary?: string;
  expectedJoiningDate?: string;
  actualJoiningDate?: string;
  offeredSalary?: number;
  lostReason?: string;

  assignmentHistory: AssignmentHistory[];
  isPhoneMasked?: boolean;
  
  // Ad Campaigns & Attribution
  gclid?: string;
  metaLeadId?: string;
  adCampaignName?: string;
  adSetName?: string;

  createdAt: string;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
}

export interface CallLog {
  id: string;
  leadId: string;
  recruiterId: string;
  recruiterName: string;
  candidateName: string;
  phone: string;
  disposition: CallDisposition;
  durationSeconds?: number;
  notes?: string;
  followupDate?: string;
  followupTime?: string;
  followupReason?: string;
  interviewDate?: string;
  interviewTime?: string;
  clientId?: string;
  jobId?: string;
  interviewType?: InterviewType;
  expectedJoiningDate?: string;
  lostReason?: string;
  createdAt: string;
}

export interface Followup {
  id: string;
  leadId: string;
  candidateName: string;
  candidatePhone: string;
  recruiterId: string;
  recruiterName: string;
  teamId?: string;
  scheduledAt: string;
  reason: string;
  priority: LeadPriority;
  status: 'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
  completedAt?: string;
  notes?: string;
  createdAt: string;
  escalatedToTL?: boolean;
}

export interface Interview {
  id: string;
  leadId: string;
  candidateName: string;
  candidatePhone: string;
  recruiterId: string;
  recruiterName: string;
  clientId: string;
  clientName: string;
  jobId: string;
  jobTitle: string;
  date: string;
  time: string;
  scheduledAt: string;
  location: string;
  interviewType: InterviewType;
  stage: InterviewStage;
  confirmationStatus: InterviewConfirmation;
  contactPerson?: string;
  notes?: string;
  attendanceMarkedAt?: string;
  resultNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Joining {
  id: string;
  leadId: string;
  candidateName: string;
  candidatePhone: string;
  recruiterId: string;
  recruiterName: string;
  clientId: string;
  clientName: string;
  jobId: string;
  jobTitle: string;
  status: JoiningStatus;
  selectionDate: string;
  expectedJoiningDate?: string;
  actualJoiningDate?: string;
  offeredSalary?: number;
  confirmationStatus: 'Pending' | 'Confirmed' | 'At Risk';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  location: string;
  paymentTerms: string;
  replacementTerms: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  clientId: string;
  clientName: string;
  positionTitle: string;
  location: string;
  salaryRange: string;
  experienceRequired: string;
  numberOfOpenings: number;
  requirements: string;
  status: 'Active' | 'On Hold' | 'Closed';
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'lead_assigned' | 'followup_due' | 'followup_overdue' | 'interview_tomorrow' | 'interview_today' | 'joining_alert' | 'escalation' | 'target_alert';
  linkTo?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entity: string;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface AgencyCMSConfig {
  agencyName: string;
  tagline: string;
  registrationNumber: string; // GSTIN / CIN
  officialEmail: string;
  officialPhone: string;
  headquartersAddress: string;
  websiteUrl: string;
  defaultCurrency: string;
  timezone: string;
  
  // Public Careers & Job Portal CMS
  careersPortalTitle: string;
  careersHeroHeadline: string;
  careersHeroSubheadline: string;
  allowDirectApplication: boolean;
  requireResumeUpload: boolean;
  autoSendWhatsAppAck: boolean;

  // Automation & Lead Governance
  autoRecycleStaleHours: number;
  enableAutoRecycle: boolean;
  assignmentStrategy: 'round_robin' | 'load_balanced' | 'manual';
}

export interface MetaIntegrationConfig {
  isEnabled: boolean;
  appId: string;
  appSecret: string;
  pageAccessToken: string;
  adAccountId: string;
  verifyToken: string;
  webhookUrl: string;
  formMapping: {
    nameField: string;
    phoneField: string;
    emailField: string;
    cityField: string;
    expField: string;
    shiftField: string;
  };
  campaigns: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'PAUSED';
    platform: 'Facebook' | 'Instagram';
    leadsCount: number;
    spentInr: number;
    cplInr: number;
    lastLeadAt?: string;
  }>;
}

export interface GoogleAdsIntegrationConfig {
  isEnabled: boolean;
  customerId: string;
  webhookSecretKey: string;
  webhookUrl: string;
  lineupConversionActionId: string;
  joiningConversionActionId: string;
  enableOfflineConversions: boolean;
  campaigns: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'PAUSED';
    network: 'Search' | 'Display' | 'YouTube';
    leadsCount: number;
    spentInr: number;
    cplInr: number;
    joinedCount: number;
    lastLeadAt?: string;
  }>;
}

export interface CRMSettings {
  leadSources: string[];
  priorities: LeadPriority[];
  callDispositions: CallDisposition[];
  interviewStages: InterviewStage[];
  joiningStatuses: JoiningStatus[];
  shiftTypes: string[];
  jobCategories: string[];
  overdueEscalationHoursTL: number;
  overdueEscalationHoursAdmin: number;
  defaultDailyCallTarget: number;
  defaultDailyConnectedTarget: number;
  defaultDailyLineupTarget: number;
  defaultMonthlyJoiningTarget: number;
  
  agencyCMS: AgencyCMSConfig;
  metaIntegration: MetaIntegrationConfig;
  googleAdsIntegration: GoogleAdsIntegrationConfig;
}

// --- CALL BRIDGE: DESKTOP CALL TO PHONE SIM CALL ---
export type SimSlot = 'SIM_1' | 'SIM_2';

export interface CallBridgeDevice {
  id: string;
  userId: string;
  deviceName: string;
  platform: 'android' | 'ios' | 'web_companion';
  sim1Carrier: string;
  sim1Number?: string;
  sim2Carrier?: string;
  sim2Number?: string;
  defaultSim: SimSlot;
  batteryLevel?: number;
  networkSignal?: 'strong' | 'good' | 'fair';
  status: 'connected' | 'disconnected' | 'in_call';
  pairCode: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface CallBridgeCallEvent {
  id: string;
  userId: string;
  deviceId?: string;
  leadId?: string;
  candidateName: string;
  phoneNumber: string;
  simUsed: SimSlot;
  carrierName: string;
  status: 'pending' | 'ringing' | 'connected' | 'completed' | 'missed' | 'rejected' | 'failed';
  durationSeconds: number;
  disposition?: CallDisposition;
  notes?: string;
  initiatedAt: string;
  connectedAt?: string;
  endedAt?: string;
}

export interface CallBridgeSettings {
  defaultSim: SimSlot;
  sim1Carrier: string;
  sim1Number: string;
  sim2Carrier: string;
  sim2Number: string;
  gatewayMode: 'companion_relay' | 'tel_protocol' | 'webhook_gateway';
  customWebhookUrl?: string;
  autoLogDisposition: boolean;
  soundAlerts: boolean;
  autoStartTimer: boolean;
}

// --- TELEPHONY DASHBOARD & CALL ANALYTICS ---
export interface TelephonyKpiItem {
  value: number;
  vsYesterdayPercent?: number;
  trend?: 'up' | 'down';
  target?: number;
  achievementPercent?: number;
  connectRate?: number;
  targetRate?: number;
  totalSeconds?: number;
  totalFormatted?: string;
  avgSeconds?: number;
  avgFormatted?: string;
  conversionRate?: number;
}

export interface TelephonySummaryCard {
  count: number;
  percent: number;
  avgDuration?: string;
  label: string;
}

export interface TelephonyHourlySlot {
  hour: string;
  hourLabel: string;
  calls: number;
  connected: number;
  targetCalls: number;
  gap: number;
  connectRate: number;
  isPeakHour: boolean;
}

export interface TelephonyRecruiterPerf {
  id: string;
  name: string;
  role: string;
  teamName: string;
  outboundCalls: number;
  targetCalls: number;
  gap: number;
  achievementRate: number;
  connectedCalls: number;
  connectRate: number;
  totalTalkSeconds: number;
  totalTalkFormatted: string;
  avgTalkSeconds: number;
  avgTalkFormatted: string;
  interestedCount: number;
  interviewsScheduled: number;
  paceStatus: 'Ahead' | 'On Track' | 'Needs Attention';
}

export interface TelephonyDashboardData {
  period: 'today' | 'yesterday' | 'week' | 'month' | 'all';
  periodLabel: string;
  lastUpdated: string;
  kpis: {
    totalCalls: TelephonyKpiItem;
    connectedCalls: TelephonyKpiItem;
    talkTime: TelephonyKpiItem;
    productiveOutcomes: TelephonyKpiItem;
  };
  gapAnalysis: {
    dailyTarget: number;
    dailyActual: number;
    dailyGap: number;
    dailyPercent: number;
    weeklyTarget: number;
    weeklyActual: number;
    weeklyGap: number;
    weeklyPercent: number;
    monthlyTarget: number;
    monthlyActual: number;
    monthlyGap: number;
    monthlyPercent: number;
    connectedTarget: number;
    connectedActual: number;
    connectedGap: number;
    connectedPercent: number;
    hourlyDistribution: TelephonyHourlySlot[];
    speedToCall: {
      under15m: { count: number; percent: number };
      m15to60: { count: number; percent: number };
      h1to4: { count: number; percent: number };
      over4h: { count: number; percent: number };
    };
  };
  callSummary: {
    connected: TelephonySummaryCard;
    busy: TelephonySummaryCard;
    noAnswer: TelephonySummaryCard;
    switchedOff: TelephonySummaryCard;
    declined: TelephonySummaryCard;
    invalidNumber: TelephonySummaryCard;
    inbound: TelephonySummaryCard;
    followup: TelephonySummaryCard;
  };
  activeCalls: Array<CallBridgeCallEvent & {
    recruiterName: string;
    recruiterRole: string;
    teamName: string;
    liveDurationSeconds: number;
    isPhoneMasked: boolean;
  }>;
  recruiterPresence: Array<{
    id: string;
    name: string;
    role: string;
    teamName: string;
    phone?: string;
    status: 'in_call' | 'available' | 'wrap_up' | 'offline';
    activeCall?: {
      candidateName: string;
      carrierName: string;
      simSlot: SimSlot;
      durationSeconds: number;
    } | null;
    todayCalls: number;
    todayConnected: number;
    todayTalkSeconds: number;
    todayTalkFormatted: string;
  }>;
  recruiterPerformance: TelephonyRecruiterPerf[];
  callLogs: Array<CallBridgeCallEvent & {
    recruiterName: string;
    recruiterRole: string;
    durationFormatted: string;
    isPhoneMasked: boolean;
  }>;
}

