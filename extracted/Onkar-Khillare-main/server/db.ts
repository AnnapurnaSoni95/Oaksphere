import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User,
  Lead,
  CallLog,
  Followup,
  Interview,
  Joining,
  Client,
  Job,
  Notification,
  AuditLog,
  CRMSettings,
  LeadActivity,
  CallDisposition,
  LeadPriority,
  LeadStatus,
  InterviewStage,
  JoiningStatus,
  MessageTemplate,
  ScreeningScorecard,
  CallBridgeDevice,
  CallBridgeCallEvent,
  CallBridgeSettings,
  SimSlot,
  getDefaultPermissions,
} from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'crm_store.json');

export interface DatabaseState {
  users: User[];
  leads: Lead[];
  activities: LeadActivity[];
  calls: CallLog[];
  followups: Followup[];
  interviews: Interview[];
  joinings: Joining[];
  clients: Client[];
  jobs: Job[];
  templates: MessageTemplate[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  settings: CRMSettings;
  callBridgeDevices?: CallBridgeDevice[];
  callBridgeCalls?: CallBridgeCallEvent[];
  callBridgeSettings?: Record<string, CallBridgeSettings>;
}

export function normalizePhoneNumber(phone: string): { normalized: string; isValid: boolean; status: 'VERIFIED' | 'NEEDS_VERIFY' | 'INVALID' } {
  if (!phone) {
    return { normalized: '', isValid: false, status: 'INVALID' };
  }
  // Remove non-numeric characters except leading '+'
  let cleaned = phone.trim().replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Pure digits now
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    return { normalized: digitsOnly, isValid: true, status: 'VERIFIED' };
  } else if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
    return { normalized: digitsOnly, isValid: true, status: 'NEEDS_VERIFY' };
  } else {
    return { normalized: digitsOnly, isValid: false, status: 'INVALID' };
  }
}

export const defaultSettings: CRMSettings = {
  leadSources: ['Naukri Bulk', 'Indeed', 'LinkedIn', 'Referral', 'Walk-in', 'Facebook Ads', 'Campus', 'Consultant'],
  priorities: ['Hot', 'High', 'Medium', 'Low', 'Cold'],
  callDispositions: [
    'Connected – Interested',
    'Not Interested',
    'Callback',
    'Interview Scheduled',
    'Already Working',
    'Salary Issue',
    'Location Issue',
    'Job Mismatch',
    'No Answer',
    'Busy',
    'Switched Off',
    'Unreachable',
    'Invalid Number',
    'WhatsApp Only',
    'Call Back Later',
  ],
  interviewStages: [
    'Pending',
    'Scheduled',
    'Tomorrow',
    'Today',
    'Attended',
    'Not Attended',
    'Rescheduled',
    'Selected',
    'Rejected',
    'Dropped',
  ],
  joiningStatuses: [
    'Selected',
    'Documents Pending',
    'Offer Pending',
    'Offer Released',
    'Joining Confirmed',
    'Joined',
    'Delayed',
    'No Show',
    'Dropped',
    'Client Rejected',
  ],
  shiftTypes: ['24/7 Rotational', 'Day Shift Only', 'US Night Shift', 'UK Shift', 'Rotational Day/Night'],
  jobCategories: ['BPO & Customer Operations', 'Banking & Financial Services', 'Field & Telesales', 'IT Support & Technical', 'Retail & Back Office'],
  overdueEscalationHoursTL: 4,
  overdueEscalationHoursAdmin: 24,
  defaultDailyCallTarget: 60,
  defaultDailyConnectedTarget: 30,
  defaultDailyLineupTarget: 5,
  defaultMonthlyJoiningTarget: 8,
  
  agencyCMS: {
    agencyName: 'OAKsphere Connect Recruitment Solutions',
    tagline: 'Enterprise Bulk Staffing & Recruitment Operations Engine',
    registrationNumber: 'GSTIN27AABCO1234F1Z8',
    officialEmail: 'careers@oaksphere.com',
    officialPhone: '+91 98200 11223',
    headquartersAddress: 'Cyber City, Phase 2, Viman Nagar, Pune, Maharashtra 411014',
    websiteUrl: 'https://oaksphere.com',
    defaultCurrency: 'INR (₹)',
    timezone: 'Asia/Kolkata (IST)',
    careersPortalTitle: 'OAKsphere Careers Portal - Bulk Hiring Drives',
    careersHeroHeadline: "Land Your Next Career Role in India's Leading Enterprises",
    careersHeroSubheadline: 'Verified openings across Teleperformance, Tech Mahindra, HDFC, WNS, and 20+ top partners.',
    allowDirectApplication: true,
    requireResumeUpload: false,
    autoSendWhatsAppAck: true,
    autoRecycleStaleHours: 48,
    enableAutoRecycle: true,
    assignmentStrategy: 'round_robin',
  },

  metaIntegration: {
    isEnabled: true,
    appId: '109283746592014',
    appSecret: '••••••••••••••••••••••••••••••••',
    pageAccessToken: 'EAABwzL9...[Meta Page Access Token Active]',
    adAccountId: 'act_2910482019482',
    verifyToken: 'oak_meta_verify_token_2026',
    webhookUrl: '/api/webhooks/meta-leads',
    formMapping: {
      nameField: 'full_name',
      phoneField: 'phone_number',
      emailField: 'email',
      cityField: 'city',
      expField: 'years_of_experience',
      shiftField: 'preferred_shift',
    },
    campaigns: [
      {
        id: 'meta_camp_1',
        name: 'Pune BPO Mega Walk-In Drive (FB Feed)',
        status: 'ACTIVE',
        platform: 'Facebook',
        leadsCount: 142,
        spentInr: 12400,
        cplInr: 87.3,
        lastLeadAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'meta_camp_2',
        name: 'Mumbai Telesales Hiring (IG Reels & Stories)',
        status: 'ACTIVE',
        platform: 'Instagram',
        leadsCount: 89,
        spentInr: 9800,
        cplInr: 110.1,
        lastLeadAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'meta_camp_3',
        name: 'Bangalore Banking Associates (FB Lead Form)',
        status: 'PAUSED',
        platform: 'Facebook',
        leadsCount: 64,
        spentInr: 7500,
        cplInr: 117.2,
        lastLeadAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  },

  googleAdsIntegration: {
    isEnabled: true,
    customerId: '782-910-3841',
    webhookSecretKey: 'oak_google_ads_key_9921',
    webhookUrl: '/api/webhooks/google-leads',
    lineupConversionActionId: 'conv_int_lineup_9921',
    joiningConversionActionId: 'conv_cand_joined_9922',
    enableOfflineConversions: true,
    campaigns: [
      {
        id: 'g_camp_1',
        name: 'Search - BPO Jobs In Pune (Exact Match)',
        status: 'ACTIVE',
        network: 'Search',
        leadsCount: 98,
        spentInr: 14200,
        cplInr: 144.9,
        joinedCount: 9,
        lastLeadAt: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'g_camp_2',
        name: 'Search - Telesales Job Openings (Pune & Mumbai)',
        status: 'ACTIVE',
        network: 'Search',
        leadsCount: 62,
        spentInr: 8900,
        cplInr: 143.5,
        joinedCount: 5,
        lastLeadAt: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        id: 'g_camp_3',
        name: 'Display - Walk-in Drives Remarketing',
        status: 'ACTIVE',
        network: 'Display',
        leadsCount: 41,
        spentInr: 3900,
        cplInr: 95.1,
        joinedCount: 3,
        lastLeadAt: new Date(Date.now() - 28800000).toISOString(),
      },
    ],
  },
};

export const defaultTemplates: MessageTemplate[] = [
  {
    id: 'tmpl_screening',
    title: '1. Screening & Initial Job Pitch',
    category: 'screening',
    channel: 'whatsapp',
    isSystem: true,
    variables: ['candidate_name', 'job_title', 'client_name', 'salary_range', 'recruiter_name', 'recruiter_phone'],
    body: 'Hi {{candidate_name}}, this is {{recruiter_name}} from OAKsphere Connect regarding your application for the *{{job_title}}* role at *{{client_name}}* (Salary: {{salary_range}}). We are currently shortlisting candidates for upcoming interview rounds. Are you available for a quick 2-minute discussion today?',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_interview_call',
    title: '2. Interview Call Letter & Venue / Maps Link',
    category: 'interview',
    channel: 'whatsapp',
    isSystem: true,
    variables: ['candidate_name', 'job_title', 'client_name', 'interview_date', 'interview_time', 'interview_venue', 'google_maps_link', 'contact_person', 'recruiter_name', 'recruiter_phone'],
    body: 'Dear {{candidate_name}},\n\nCongratulations! Your interview for *{{job_title}}* at *{{client_name}}* is confirmed.\n\n📅 Date: {{interview_date}}\n⏰ Time: {{interview_time}}\n📍 Venue: {{interview_venue}}\n🗺️ Google Maps: {{google_maps_link}}\n👤 Contact Person: {{contact_person}}\n\n*Important Instructions:*\n- Carry 2 hard copies of your updated resume.\n- Dress Code: Formal or Smart Business Casual.\n- Please arrive at the venue 15 minutes before your time slot.\n\nBest of luck,\n{{recruiter_name}} | OAKsphere Connect\n📞 {{recruiter_phone}}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_morning_confirm',
    title: '3. Morning-of-Interview Attendance Confirmation',
    category: 'reminder',
    channel: 'whatsapp',
    isSystem: true,
    variables: ['candidate_name', 'job_title', 'client_name', 'interview_time', 'recruiter_phone'],
    body: 'Good morning {{candidate_name}}! ☀️ Quick reminder for your scheduled interview today for *{{job_title}}* at *{{client_name}}* at {{interview_time}}.\n\nPlease reply with *"CONFIRMED"* so the client HR panel reserves your spot. If you face any commute delays, call me immediately on {{recruiter_phone}} so we can adjust your slot.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_post_interview',
    title: '4. Post-Interview Status & Follow-up',
    category: 'status',
    channel: 'whatsapp',
    isSystem: true,
    variables: ['candidate_name', 'job_title', 'client_name', 'recruiter_phone'],
    body: 'Hi {{candidate_name}}, how was your interview with {{client_name}} for {{job_title}} today? Please share your experience and the rounds completed so we can coordinate feedback with the HR manager. You can reply here or call me on {{recruiter_phone}}.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_doc_checklist',
    title: '5. Document Checklist for Joining',
    category: 'documents',
    channel: 'whatsapp',
    isSystem: true,
    variables: ['candidate_name', 'job_title', 'client_name', 'recruiter_name'],
    body: 'Congratulations {{candidate_name}} on clearing the interview for *{{job_title}}* at *{{client_name}}*! 🎊\n\nTo release your official Offer Letter and initiate onboarding, please share scanned copies/photos of:\n1. Aadhaar Card (both sides)\n2. PAN Card\n3. Highest Educational Degree/Marksheet\n4. Last 3 Months Salary Slips (if experienced)\n5. Relieving / Experience Letter\n6. Bank Passbook or Cancelled Cheque\n\nPlease send these over WhatsApp or email by 5:00 PM today.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_joining_welcome',
    title: '6. Day 1 Joining Welcome & Onboarding Guide',
    category: 'joining',
    channel: 'whatsapp',
    isSystem: true,
    variables: ['candidate_name', 'job_title', 'client_name', 'interview_time', 'interview_venue', 'contact_person', 'recruiter_name'],
    body: 'Heartiest Congratulations {{candidate_name}} on joining {{client_name}} as {{job_title}} today! 🚀\n\n⏰ Reporting Time: {{interview_time}}\n🏢 Office Location: {{interview_venue}}\n👤 Contact Person / Reception: {{contact_person}}\n\nWishing you an outstanding career ahead. Please drop a quick WhatsApp message after your orientation session today! Best wishes,\n{{recruiter_name}} | OAKsphere Connect',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const defaultCallBridgeSettings: CallBridgeSettings = {
  defaultSim: 'SIM_1',
  sim1Carrier: 'Jio 5G (Work SIM)',
  sim1Number: '+91 98201 12345',
  sim2Carrier: 'Airtel 4G (Alternate SIM)',
  sim2Number: '+91 98201 54321',
  gatewayMode: 'companion_relay',
  autoLogDisposition: true,
  soundAlerts: true,
  autoStartTimer: true,
};

export const defaultCallBridgeDevices: CallBridgeDevice[] = [
  {
    id: 'dev_oneplus_12',
    userId: 'usr_admin',
    deviceName: 'OnePlus 12 5G (Recruiter Desk Phone)',
    platform: 'android',
    sim1Carrier: 'Jio 5G (Work SIM)',
    sim1Number: '+91 98201 12345',
    sim2Carrier: 'Airtel (Alternate SIM)',
    sim2Number: '+91 98201 54321',
    defaultSim: 'SIM_1',
    batteryLevel: 92,
    networkSignal: 'strong',
    status: 'connected',
    pairCode: '849-215',
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'dev_galaxy_s24',
    userId: 'usr_rec_1',
    deviceName: 'Samsung Galaxy S24 (Priya Work Mobile)',
    platform: 'android',
    sim1Carrier: 'Airtel 5G (Unlimited Work Plan)',
    sim1Number: '+91 98765 43210',
    sim2Carrier: 'Jio 4G',
    defaultSim: 'SIM_1',
    batteryLevel: 84,
    networkSignal: 'strong',
    status: 'connected',
    pairCode: '612-904',
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'dev_iphone_15',
    userId: 'usr_rec_2',
    deviceName: 'iPhone 15 Pro (Amit Desk Companion)',
    platform: 'ios',
    sim1Carrier: 'Jio True 5G',
    sim1Number: '+91 98980 11223',
    defaultSim: 'SIM_1',
    batteryLevel: 78,
    networkSignal: 'strong',
    status: 'connected',
    pairCode: '391-744',
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// Helper function to build realistic telephony seed data
function generateSeedCallBridgeCalls(): CallBridgeCallEvent[] {
  const now = Date.now();
  const calls: CallBridgeCallEvent[] = [
    // Live active call in progress right now
    {
      id: 'call_live_1',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      leadId: 'lead_102',
      candidateName: 'Pooja Bhatt',
      phoneNumber: '9819922002',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'connected',
      durationSeconds: 78,
      notes: 'Active live screening call in progress with candidate for Tech Mahindra BPO.',
      initiatedAt: new Date(now - 78000).toISOString(),
      connectedAt: new Date(now - 65000).toISOString(),
    },
    // Today's completed calls across different working hours
    {
      id: 'call_brg_101',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      leadId: 'lead_101',
      candidateName: 'Rohan Sharma',
      phoneNumber: '9820011001',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 148,
      disposition: 'Connected – Interested',
      notes: 'Candidate agreed for Tech Mahindra customer support role. Walk-in scheduled.',
      initiatedAt: new Date(now - 45 * 60000).toISOString(),
      connectedAt: new Date(now - 45 * 60000 + 12000).toISOString(),
      endedAt: new Date(now - 45 * 60000 + 160000).toISOString(),
    },
    {
      id: 'call_brg_102',
      userId: 'usr_rec_2',
      deviceId: 'dev_oneplus_12',
      leadId: 'lead_103',
      candidateName: 'Vikas Sundaram',
      phoneNumber: '9820033003',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 215,
      disposition: 'Interview Scheduled',
      notes: 'Confirmed interview attendance tomorrow at Tech Mahindra Hinjewadi.',
      initiatedAt: new Date(now - 80 * 60000).toISOString(),
      connectedAt: new Date(now - 80 * 60000 + 10000).toISOString(),
      endedAt: new Date(now - 80 * 60000 + 225000).toISOString(),
    },
    {
      id: 'call_brg_103',
      userId: 'usr_rec_3',
      deviceId: 'dev_pixel_8',
      leadId: 'lead_106',
      candidateName: 'Sanjay Rawat',
      phoneNumber: '9820066006',
      simUsed: 'SIM_2',
      carrierName: 'Airtel 4G',
      status: 'completed',
      durationSeconds: 165,
      disposition: 'Connected – Interested',
      notes: 'Discussed field sales position at Square Yards. Candidate sent resume.',
      initiatedAt: new Date(now - 110 * 60000).toISOString(),
      connectedAt: new Date(now - 110 * 60000 + 15000).toISOString(),
      endedAt: new Date(now - 110 * 60000 + 180000).toISOString(),
    },
    {
      id: 'call_brg_104',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      leadId: 'lead_104',
      candidateName: 'Neha Deshmukh',
      phoneNumber: '9833044004',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 195,
      disposition: 'Interview Scheduled',
      notes: 'Lineup confirmed for HDFC Bank Personal Loans.',
      initiatedAt: new Date(now - 140 * 60000).toISOString(),
      connectedAt: new Date(now - 140 * 60000 + 8000).toISOString(),
      endedAt: new Date(now - 140 * 60000 + 203000).toISOString(),
    },
    {
      id: 'call_brg_105',
      userId: 'usr_rec_2',
      deviceId: 'dev_oneplus_12',
      candidateName: 'Kunal Deshmukh',
      phoneNumber: '9820088112',
      simUsed: 'SIM_2',
      carrierName: 'Airtel 4G',
      status: 'completed',
      durationSeconds: 38,
      disposition: 'Callback',
      notes: 'Candidate in college lecture, call back after 4 PM.',
      initiatedAt: new Date(now - 170 * 60000).toISOString(),
      connectedAt: new Date(now - 170 * 60000 + 6000).toISOString(),
      endedAt: new Date(now - 170 * 60000 + 44000).toISOString(),
    },
    {
      id: 'call_brg_106',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      candidateName: 'Akash Gupta',
      phoneNumber: '9819933441',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 0,
      disposition: 'Busy',
      notes: 'Line was continuously engaged.',
      initiatedAt: new Date(now - 200 * 60000).toISOString(),
      endedAt: new Date(now - 200 * 60000 + 15000).toISOString(),
    },
    {
      id: 'call_brg_107',
      userId: 'usr_rec_3',
      deviceId: 'dev_pixel_8',
      leadId: 'lead_113',
      candidateName: 'Divya Iyer',
      phoneNumber: '9880034567',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 185,
      disposition: 'Connected – Interested',
      notes: 'Excellent communication. Shared WhatsApp pitch.',
      initiatedAt: new Date(now - 230 * 60000).toISOString(),
      connectedAt: new Date(now - 230 * 60000 + 12000).toISOString(),
      endedAt: new Date(now - 230 * 60000 + 197000).toISOString(),
    },
    {
      id: 'call_brg_108',
      userId: 'usr_rec_2',
      deviceId: 'dev_oneplus_12',
      candidateName: 'Manish Tiwari',
      phoneNumber: '9820044991',
      simUsed: 'SIM_2',
      carrierName: 'Airtel 4G',
      status: 'completed',
      durationSeconds: 0,
      disposition: 'No Answer',
      notes: 'Rang out for 45s without answer.',
      initiatedAt: new Date(now - 260 * 60000).toISOString(),
      endedAt: new Date(now - 260 * 60000 + 45000).toISOString(),
    },
    {
      id: 'call_brg_109',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      candidateName: 'Ravi Verma',
      phoneNumber: '9890011223',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 0,
      disposition: 'Switched Off',
      notes: 'Number is currently switched off or out of coverage.',
      initiatedAt: new Date(now - 290 * 60000).toISOString(),
      endedAt: new Date(now - 290 * 60000 + 10000).toISOString(),
    },
    {
      id: 'call_brg_110',
      userId: 'usr_admin',
      deviceId: 'dev_oneplus_12',
      candidateName: 'Deepak Patil',
      phoneNumber: '9820055443',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 52,
      disposition: 'Not Interested',
      notes: 'Candidate already joined another company yesterday.',
      initiatedAt: new Date(now - 320 * 60000).toISOString(),
      connectedAt: new Date(now - 320 * 60000 + 9000).toISOString(),
      endedAt: new Date(now - 320 * 60000 + 61000).toISOString(),
    },
    {
      id: 'call_brg_111',
      userId: 'usr_rec_3',
      deviceId: 'dev_pixel_8',
      leadId: 'lead_114',
      candidateName: 'Gaurav Kulkarni',
      phoneNumber: '982001',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 0,
      disposition: 'Invalid Number',
      notes: 'Automated carrier message: The number you have dialed is incomplete.',
      initiatedAt: new Date(now - 350 * 60000).toISOString(),
      endedAt: new Date(now - 350 * 60000 + 8000).toISOString(),
    },
    {
      id: 'call_brg_112',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      candidateName: 'Aditi Rao',
      phoneNumber: '9820077881',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 124,
      disposition: 'Connected – Interested',
      notes: 'Inbound return call from Meta Ad lead. Scheduled phone screening.',
      initiatedAt: new Date(now - 380 * 60000).toISOString(),
      connectedAt: new Date(now - 380 * 60000 + 5000).toISOString(),
      endedAt: new Date(now - 380 * 60000 + 129000).toISOString(),
    },
    {
      id: 'call_brg_113',
      userId: 'usr_rec_2',
      deviceId: 'dev_oneplus_12',
      candidateName: 'Sameer Sheikh',
      phoneNumber: '9821033445',
      simUsed: 'SIM_2',
      carrierName: 'Airtel 4G',
      status: 'completed',
      durationSeconds: 175,
      disposition: 'Interview Scheduled',
      notes: 'Confirmed for Teleperformance International Customer Support.',
      initiatedAt: new Date(now - 410 * 60000).toISOString(),
      connectedAt: new Date(now - 410 * 60000 + 11000).toISOString(),
      endedAt: new Date(now - 410 * 60000 + 186000).toISOString(),
    },
    {
      id: 'call_brg_114',
      userId: 'usr_rec_3',
      deviceId: 'dev_pixel_8',
      candidateName: 'Priya Mahajan',
      phoneNumber: '9821044556',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 0,
      disposition: 'Busy',
      notes: 'Engaged tone received.',
      initiatedAt: new Date(now - 440 * 60000).toISOString(),
      endedAt: new Date(now - 440 * 60000 + 12000).toISOString(),
    },
    {
      id: 'call_brg_115',
      userId: 'usr_rec_1',
      deviceId: 'dev_galaxy_s24',
      candidateName: 'Harsh Vardhan',
      phoneNumber: '9821055667',
      simUsed: 'SIM_1',
      carrierName: 'Jio 5G',
      status: 'completed',
      durationSeconds: 95,
      disposition: 'Callback',
      notes: 'Asked to call back post lunch.',
      initiatedAt: new Date(now - 470 * 60000).toISOString(),
      connectedAt: new Date(now - 470 * 60000 + 14000).toISOString(),
      endedAt: new Date(now - 470 * 60000 + 109000).toISOString(),
    },
  ];

  // Add ~25 Yesterday calls for accurate comparison metrics
  const yesterdayMillis = 24 * 3600000;
  const sampleDispositions: CallDisposition[] = [
    'Connected – Interested', 'Interview Scheduled', 'Callback', 'Busy', 
    'No Answer', 'Switched Off', 'Not Interested', 'Connected – Interested'
  ];
  const sampleRecruiters = ['usr_rec_1', 'usr_rec_2', 'usr_rec_3', 'usr_tl_1'];
  const sampleNames = [
    'Rahul Sen', 'Anita Kadam', 'Chetan Bhagat', 'Meera Nair', 'Suresh Raina',
    'Kavita Pillai', 'Nitin Gadkari', 'Swati Maliwal', 'Alok Verma', 'Pooja Hegde',
    'Mohit Sharma', 'Varun Dhawan', 'Shraddha Kapoor', 'Karthik Aryan', 'Kiara Advani'
  ];

  for (let i = 0; i < 22; i++) {
    const rIdx = i % sampleRecruiters.length;
    const dIdx = i % sampleDispositions.length;
    const disp = sampleDispositions[dIdx];
    const isConn = disp.includes('Connected') || disp.includes('Interview') || disp.includes('Callback');
    const dur = isConn ? (45 + (i * 23) % 180) : 0;
    const callTime = new Date(now - yesterdayMillis - (i * 25 * 60000));

    calls.push({
      id: `call_yst_${i + 1}`,
      userId: sampleRecruiters[rIdx],
      candidateName: sampleNames[i % sampleNames.length] + ` (Yest)`,
      phoneNumber: '98200' + (10000 + i),
      simUsed: i % 2 === 0 ? 'SIM_1' : 'SIM_2',
      carrierName: i % 2 === 0 ? 'Jio 5G' : 'Airtel 4G',
      status: 'completed',
      durationSeconds: dur,
      disposition: disp,
      notes: `Telephony call record: ${disp}`,
      initiatedAt: callTime.toISOString(),
      connectedAt: isConn ? new Date(callTime.getTime() + 10000).toISOString() : undefined,
      endedAt: new Date(callTime.getTime() + (dur * 1000) + 12000).toISOString(),
    });
  }

  // Add ~40 Earlier This Week calls (days 2 to 6 ago)
  for (let day = 2; day <= 5; day++) {
    for (let c = 0; c < 10; c++) {
      const disp = sampleDispositions[(day + c) % sampleDispositions.length];
      const isConn = disp.includes('Connected') || disp.includes('Interview') || disp.includes('Callback');
      const dur = isConn ? (55 + (c * 27) % 200) : 0;
      const callTime = new Date(now - (day * 86400000) - (c * 35 * 60000));

      calls.push({
        id: `call_wk_${day}_${c + 1}`,
        userId: sampleRecruiters[(c + day) % sampleRecruiters.length],
        candidateName: sampleNames[(c + day) % sampleNames.length] + ` (D-${day})`,
        phoneNumber: '98300' + (20000 + day * 100 + c),
        simUsed: c % 2 === 0 ? 'SIM_1' : 'SIM_2',
        carrierName: c % 2 === 0 ? 'Jio 5G' : 'Airtel 4G',
        status: 'completed',
        durationSeconds: dur,
        disposition: disp,
        notes: `Weekly trend archive: ${disp}`,
        initiatedAt: callTime.toISOString(),
        connectedAt: isConn ? new Date(callTime.getTime() + 11000).toISOString() : undefined,
        endedAt: new Date(callTime.getTime() + (dur * 1000) + 14000).toISOString(),
      });
    }
  }

  return calls;
}

export const defaultCallBridgeCalls: CallBridgeCallEvent[] = generateSeedCallBridgeCalls();

export function calculateScreeningScorecard(data: {
  communicationLevel: 'Basic' | 'Average' | 'Good' | 'Excellent';
  shiftAvailability: 'Day Only' | '24/7 Rotational' | 'Night Shift' | 'US Shift';
  commuteDistance: 'Within 10km' | '10-25km' | '25km+' | 'Transport Needed' | 'Relocation Ready';
  typingSpeedWpm?: number;
  skills?: string[];
  noticePeriodDays: number;
  expectedCtcMonthly?: number;
  offeredCtcMonthly?: number;
  jobRequiredShift?: string;
  jobMinExperience?: string;
}): {
  fitScore: number;
  dealbreakers: string[];
  overallVerdict: 'Strong Fit' | 'Borderline Fit' | 'High Risk' | 'Not Qualified';
} {
  let score = 0;
  const dealbreakers: string[] = [];

  // 1. Communication (Max 25 pts)
  if (data.communicationLevel === 'Excellent') score += 25;
  else if (data.communicationLevel === 'Good') score += 20;
  else if (data.communicationLevel === 'Average') score += 14;
  else {
    score += 6;
    dealbreakers.push('Basic communication: may disqualify for voice/client processes');
  }

  // 2. Shift Availability (Max 20 pts)
  if (data.shiftAvailability === '24/7 Rotational' || data.shiftAvailability === 'US Shift') {
    score += 20;
  } else if (data.shiftAvailability === 'Night Shift') {
    score += 18;
  } else {
    // Day only
    if (data.jobRequiredShift && data.jobRequiredShift.toLowerCase().includes('rotational')) {
      score += 5;
      dealbreakers.push('Day-only constraint conflicts with 24/7 rotational requirement');
    } else {
      score += 16;
    }
  }

  // 3. Commute & Proximity (Max 20 pts)
  if (data.commuteDistance === 'Within 10km') {
    score += 20;
  } else if (data.commuteDistance === '10-25km') {
    score += 15;
  } else if (data.commuteDistance === 'Transport Needed') {
    score += 12;
  } else if (data.commuteDistance === 'Relocation Ready') {
    score += 14;
  } else {
    score += 8;
    dealbreakers.push('Candidate located 25km+ away with no company transport');
  }

  // 4. Notice Period (Max 15 pts)
  if (data.noticePeriodDays === 0) {
    score += 15; // Immediate joiner
  } else if (data.noticePeriodDays <= 7) {
    score += 13;
  } else if (data.noticePeriodDays <= 15) {
    score += 10;
  } else if (data.noticePeriodDays <= 30) {
    score += 6;
  } else {
    score += 2;
    dealbreakers.push('Notice period exceeds 30 days');
  }

  // 5. Salary Budget Fit (Max 10 pts)
  if (data.expectedCtcMonthly && data.offeredCtcMonthly) {
    if (data.expectedCtcMonthly <= data.offeredCtcMonthly) {
      score += 10;
    } else if (data.expectedCtcMonthly <= data.offeredCtcMonthly * 1.15) {
      score += 6;
    } else {
      dealbreakers.push(`Salary expectation (₹${data.expectedCtcMonthly.toLocaleString('en-IN')}) exceeds budget (₹${data.offeredCtcMonthly.toLocaleString('en-IN')})`);
      score += 2;
    }
  } else {
    score += 8;
  }

  // 6. Skills & Typing (Max 10 pts)
  if (data.typingSpeedWpm && data.typingSpeedWpm >= 30) {
    score += 5;
  } else if (data.typingSpeedWpm && data.typingSpeedWpm >= 20) {
    score += 3;
  }
  if (data.skills && data.skills.length >= 2) {
    score += 5;
  } else if (data.skills && data.skills.length === 1) {
    score += 3;
  }

  const fitScore = Math.min(100, Math.max(0, score));
  let overallVerdict: 'Strong Fit' | 'Borderline Fit' | 'High Risk' | 'Not Qualified' = 'Strong Fit';
  if (dealbreakers.length > 0 || fitScore < 50) {
    overallVerdict = dealbreakers.length > 1 || fitScore < 45 ? 'Not Qualified' : 'High Risk';
  } else if (fitScore < 70) {
    overallVerdict = 'Borderline Fit';
  } else {
    overallVerdict = 'Strong Fit';
  }

  return { fitScore, dealbreakers, overallVerdict };
}

export function matchJobsForLead(lead: Lead, jobs: Job[]): Array<{
  job: Job;
  matchScore: number;
  reasons: string[];
  dealbreakers: string[];
  isTopMatch: boolean;
}> {
  const activeJobs = jobs.filter(j => j.status === 'Active');
  
  return activeJobs.map(job => {
    let score = 30; // base score
    const reasons: string[] = [];
    const dealbreakers: string[] = [];

    // City match
    if (lead.city && job.location) {
      if (job.location.toLowerCase().includes(lead.city.toLowerCase()) || lead.city.toLowerCase().includes(job.location.toLowerCase())) {
        score += 25;
        reasons.push(`Location matched: ${job.location}`);
      } else {
        dealbreakers.push(`Location mismatch: candidate is in ${lead.city}, job is in ${job.location}`);
      }
    }

    // Salary match
    if (lead.expectedSalary && job.salaryRange) {
      const numbers = job.salaryRange.replace(/[^0-9-]/g, '').split('-').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      const maxBudget = numbers.length >= 2 ? Math.max(...numbers) : (numbers[0] || 0);
      if (maxBudget > 0) {
        if (lead.expectedSalary <= maxBudget) {
          score += 25;
          reasons.push(`Salary in budget: Expected ₹${lead.expectedSalary.toLocaleString('en-IN')} ≤ Max ₹${maxBudget.toLocaleString('en-IN')}`);
        } else if (lead.expectedSalary <= maxBudget * 1.15) {
          score += 15;
          reasons.push(`Salary close to budget: Expected ₹${lead.expectedSalary.toLocaleString('en-IN')}`);
        } else {
          score -= 10;
          dealbreakers.push(`Salary expected ₹${lead.expectedSalary.toLocaleString('en-IN')} exceeds max budget ₹${maxBudget.toLocaleString('en-IN')}`);
        }
      }
    } else {
      score += 15;
    }

    // Qualification / Experience match
    if (lead.experience) {
      score += 15;
      reasons.push(`Experience background: ${lead.experience}`);
    }

    // Scorecard fit match if available
    if (lead.scorecard) {
      if (lead.scorecard.overallVerdict === 'Strong Fit') {
        score += 10;
        reasons.push(`Screened strong fit (${lead.scorecard.fitScore}%)`);
      } else if (lead.scorecard.overallVerdict === 'High Risk' || lead.scorecard.overallVerdict === 'Not Qualified') {
        score -= 15;
      }
    }

    const matchScore = Math.max(10, Math.min(99, score));
    return {
      job,
      matchScore,
      reasons,
      dealbreakers,
      isTopMatch: matchScore >= 70 && dealbreakers.length === 0,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

function getSeedData(): DatabaseState {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Date helpers
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
  const hoursAhead = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const daysAhead = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  const users: User[] = [
    {
      id: 'usr_admin',
      name: 'Ashwin Verma',
      email: 'admin@oaksphere.com',
      passwordHash: 'admin123',
      role: 'admin',
      phone: '9820011223',
      isActive: true,
      dailyCallTarget: 40,
      dailyConnectedTarget: 20,
      dailyLineupTarget: 4,
      monthlyJoiningTarget: 10,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
    },
    {
      id: 'usr_tl_1',
      name: 'Rahul Sharma',
      email: 'tl.rahul@oaksphere.com',
      passwordHash: 'tl123',
      role: 'team_leader',
      teamId: 'team_tech_bpo',
      teamName: 'Tech & BPO',
      phone: '9820022334',
      isActive: true,
      dailyCallTarget: 50,
      dailyConnectedTarget: 25,
      dailyLineupTarget: 5,
      monthlyJoiningTarget: 12,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(45),
    },
    {
      id: 'usr_rec_1',
      name: 'Priya Nair',
      email: 'recruiter.priya@oaksphere.com',
      passwordHash: 'recruiter123',
      role: 'recruiter',
      teamId: 'team_tech_bpo',
      teamName: 'Tech & BPO',
      phone: '9820033445',
      isActive: true,
      dailyCallTarget: 60,
      dailyConnectedTarget: 30,
      dailyLineupTarget: 6,
      monthlyJoiningTarget: 8,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    },
    {
      id: 'usr_rec_2',
      name: 'Amit Patel',
      email: 'recruiter.amit@oaksphere.com',
      passwordHash: 'recruiter123',
      role: 'recruiter',
      teamId: 'team_tech_bpo',
      teamName: 'Tech & BPO',
      phone: '9820044556',
      isActive: true,
      dailyCallTarget: 60,
      dailyConnectedTarget: 30,
      dailyLineupTarget: 5,
      monthlyJoiningTarget: 8,
      createdAt: daysAgo(35),
      updatedAt: daysAgo(35),
    },
    {
      id: 'usr_rec_3',
      name: 'Sneha Rao',
      email: 'recruiter.sneha@oaksphere.com',
      passwordHash: 'recruiter123',
      role: 'recruiter',
      teamId: 'team_sales_banking',
      teamName: 'Sales & Banking',
      phone: '9820055667',
      isActive: true,
      dailyCallTarget: 65,
      dailyConnectedTarget: 35,
      dailyLineupTarget: 6,
      monthlyJoiningTarget: 9,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: 'usr_rec_4',
      name: 'Vikram Joshi',
      email: 'recruiter.vikram@oaksphere.com',
      passwordHash: 'recruiter123',
      role: 'recruiter',
      teamId: 'team_sales_banking',
      teamName: 'Sales & Banking',
      phone: '9820066778',
      isActive: false, // inactive recruiter
      dailyCallTarget: 50,
      dailyConnectedTarget: 25,
      dailyLineupTarget: 4,
      monthlyJoiningTarget: 6,
      createdAt: daysAgo(50),
      updatedAt: daysAgo(10),
    }
  ];

  const clients: Client[] = [
    {
      id: 'cli_techm',
      companyName: 'Tech Mahindra BPO',
      contactPerson: 'Karan Mehra (HR Head)',
      phone: '9892012345',
      email: 'karan.m@techmahindra.example.com',
      location: 'Pune - Hinjewadi Phase 3',
      paymentTerms: '45 days from candidate joining',
      replacementTerms: '90 days free replacement guarantee',
      isActive: true,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(45),
    },
    {
      id: 'cli_hdfc',
      companyName: 'HDFC Bank Retail Assets',
      contactPerson: 'Sunita Deshmukh',
      phone: '9819098765',
      email: 'sunita.d@hdfcbank.example.com',
      location: 'Mumbai - Kanjurmarg West',
      paymentTerms: '30 days upon invoice verification',
      replacementTerms: '60 days replacement',
      isActive: true,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    },
    {
      id: 'cli_tp',
      companyName: 'Teleperformance Global',
      contactPerson: 'Rohan Ahuja',
      phone: '9871023456',
      email: 'rohan.ahuja@teleperformance.example.com',
      location: 'Gurgaon - Cyber City',
      paymentTerms: '30 days standard',
      replacementTerms: '90 days replacement',
      isActive: true,
      createdAt: daysAgo(35),
      updatedAt: daysAgo(35),
    },
    {
      id: 'cli_sqyards',
      companyName: 'Square Yards Real Estate',
      contactPerson: 'Megha Kapoor',
      phone: '9880011223',
      email: 'megha.k@squareyards.example.com',
      location: 'Bangalore - Indiranagar',
      paymentTerms: '15 days post joining',
      replacementTerms: '45 days replacement',
      isActive: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: 'cli_bajaj',
      companyName: 'Bajaj Finserv Consumer Lending',
      contactPerson: 'Vikas Kulkarni',
      phone: '9822033445',
      email: 'vikas.k@bajajfinserv.example.com',
      location: 'Pune - Viman Nagar',
      paymentTerms: '30 days',
      replacementTerms: '60 days replacement',
      isActive: true,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(25),
    },
  ];

  const jobs: Job[] = [
    {
      id: 'job_bpo_exec',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      positionTitle: 'Customer Care Executive (Voice - UK Shift)',
      location: 'Pune',
      salaryRange: '₹22,000 - ₹28,000 / month + Incentives',
      experienceRequired: '0 - 2 Years',
      numberOfOpenings: 50,
      requirements: 'Fluent English communication, rotational night shifts, 5 days working with cab facility.',
      status: 'Active',
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    },
    {
      id: 'job_hdfc_sales',
      clientId: 'cli_hdfc',
      clientName: 'HDFC Bank Retail Assets',
      positionTitle: 'Personal Loan Sales Officer',
      location: 'Mumbai',
      salaryRange: '₹25,000 - ₹35,000 / month + High Incentives',
      experienceRequired: '1 - 3 Years in Banking/NBFC Sales',
      numberOfOpenings: 30,
      requirements: 'Field sales, DSA/Open market lead conversion, graduate preferred.',
      status: 'Active',
      createdAt: daysAgo(38),
      updatedAt: daysAgo(38),
    },
    {
      id: 'job_tp_chat',
      clientId: 'cli_tp',
      clientName: 'Teleperformance Global',
      positionTitle: 'International Blended Chat Specialist',
      location: 'Gurgaon',
      salaryRange: '₹30,000 - ₹38,000 / month',
      experienceRequired: '1 - 4 Years',
      numberOfOpenings: 40,
      requirements: 'Excellent typing speed (35+ WPM), superior grammar, e-commerce support experience.',
      status: 'Active',
      createdAt: daysAgo(32),
      updatedAt: daysAgo(32),
    },
    {
      id: 'job_sq_sales',
      clientId: 'cli_sqyards',
      clientName: 'Square Yards Real Estate',
      positionTitle: 'Associate Relationship Manager - Real Estate',
      location: 'Bangalore',
      salaryRange: '₹35,000 - ₹50,000 / month + Lucrative Commissions',
      experienceRequired: '2 - 5 Years in Direct Sales',
      numberOfOpenings: 20,
      requirements: 'High energy, direct client meetings, site visits, bike/car mandatory.',
      status: 'Active',
      createdAt: daysAgo(28),
      updatedAt: daysAgo(28),
    },
    {
      id: 'job_bajaj_coll',
      clientId: 'cli_bajaj',
      clientName: 'Bajaj Finserv Consumer Lending',
      positionTitle: 'Tele-Collections Representative',
      location: 'Pune',
      salaryRange: '₹20,000 - ₹26,000 / month + Recovery bonus',
      experienceRequired: '0 - 2 Years',
      numberOfOpenings: 25,
      requirements: 'Hindi/Marathi speaking skills, persuasion ability, early bucket collections.',
      status: 'Active',
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
    },
  ];

  // Generate realistic leads
  const leads: Lead[] = [
    // 1. Hot candidate with overdue follow-up (Overdue by 3h) - Priya Nair
    {
      id: 'lead_101',
      candidateName: 'Rohan K. Joshi',
      primaryPhone: '9820199001',
      normalizedPhone: '9820199001',
      phoneStatus: 'VERIFIED',
      email: 'rohan.joshi@example.com',
      city: 'Pune',
      age: 24,
      gender: 'Male',
      qualification: 'B.Com Graduate',
      experience: '1.5 Years in BPO Voice',
      currentSalary: 22000,
      expectedSalary: 28000,
      noticePeriod: 'Immediate',
      leadSource: 'Naukri Bulk',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      priority: 'Hot',
      leadStatus: 'Follow-up',
      callAttempts: 2,
      lastCallAt: hoursAgo(6),
      lastCallOutcome: 'Callback',
      nextFollowupAt: hoursAgo(3), // 3 hours overdue
      nextFollowupReason: 'Candidate requested call after 2 PM to confirm interview slot',
      notesSummary: 'Good English, willing for night shift. Needs confirmation from parents.',
      assignmentHistory: [
        {
          id: 'asg_1',
          assignedToId: 'usr_rec_1',
          assignedToName: 'Priya Nair',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(2),
          reason: 'Initial assignment from bulk upload',
        },
      ],
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(6),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 2. Overdue follow-up by 2 days (Escalated to TL) - Priya Nair
    {
      id: 'lead_102',
      candidateName: 'Pooja Bhatt',
      primaryPhone: '9819922002',
      normalizedPhone: '9819922002',
      phoneStatus: 'VERIFIED',
      email: 'pooja.bhatt@example.com',
      city: 'Pune',
      age: 23,
      gender: 'Female',
      qualification: 'B.A.',
      experience: 'Fresher',
      currentSalary: 0,
      expectedSalary: 22000,
      noticePeriod: 'Immediate',
      leadSource: 'Indeed',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      priority: 'High',
      leadStatus: 'Follow-up',
      callAttempts: 3,
      lastCallAt: daysAgo(3),
      lastCallOutcome: 'Callback',
      nextFollowupAt: daysAgo(2), // 2 days overdue!
      nextFollowupReason: 'Need to collect graduation marksheets',
      notesSummary: 'Fresher with strong spoken English. Follow-up delayed.',
      assignmentHistory: [
        {
          id: 'asg_2',
          assignedToId: 'usr_rec_1',
          assignedToName: 'Priya Nair',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(4),
        },
      ],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 3. Interview Tomorrow (Needs Confirmation!) - Amit Patel
    {
      id: 'lead_103',
      candidateName: 'Vikas Sundaram',
      primaryPhone: '9820033003',
      normalizedPhone: '9820033003',
      phoneStatus: 'VERIFIED',
      email: 'vikas.s@example.com',
      city: 'Pune',
      age: 26,
      gender: 'Male',
      qualification: 'B.Sc IT',
      experience: '2 Years Teleperformance',
      currentSalary: 24000,
      expectedSalary: 28000,
      noticePeriod: '15 Days',
      leadSource: 'LinkedIn',
      assignedRecruiterId: 'usr_rec_2',
      assignedRecruiterName: 'Amit Patel',
      originalRecruiterId: 'usr_rec_2',
      originalRecruiterName: 'Amit Patel',
      teamId: 'team_tech_bpo',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      priority: 'Hot',
      leadStatus: 'Interview Scheduled',
      interviewStatus: 'Tomorrow',
      callAttempts: 2,
      lastCallAt: daysAgo(1),
      lastCallOutcome: 'Interview Scheduled',
      notesSummary: 'Lineup booked for tomorrow 11:30 AM at Hinjewadi office.',
      assignmentHistory: [
        {
          id: 'asg_3',
          assignedToId: 'usr_rec_2',
          assignedToName: 'Amit Patel',
          assignedById: 'usr_tl_1',
          assignedByName: 'Rahul Sharma',
          assignedAt: daysAgo(3),
        },
      ],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      updatedById: 'usr_rec_2',
      updatedByName: 'Amit Patel',
    },

    // 4. Interview Today (Pending Attendance Update) - Priya Nair
    {
      id: 'lead_104',
      candidateName: 'Neha Deshmukh',
      primaryPhone: '9833044004',
      normalizedPhone: '9833044004',
      phoneStatus: 'VERIFIED',
      email: 'neha.deshmukh@example.com',
      city: 'Mumbai',
      age: 27,
      gender: 'Female',
      qualification: 'MBA Marketing',
      experience: '3 Years Sales',
      currentSalary: 30000,
      expectedSalary: 38000,
      noticePeriod: 'Serving Notice',
      leadSource: 'Walk-in',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      clientId: 'cli_hdfc',
      clientName: 'HDFC Bank Retail Assets',
      jobId: 'job_hdfc_sales',
      jobTitle: 'Personal Loan Sales Officer',
      priority: 'High',
      leadStatus: 'Interview Scheduled',
      interviewStatus: 'Today',
      callAttempts: 3,
      lastCallAt: hoursAgo(18),
      lastCallOutcome: 'Interview Scheduled',
      notesSummary: 'F2F interview at HDFC Kanjurmarg at 2:00 PM today. Candidate confirmed attendance on morning call.',
      assignmentHistory: [
        {
          id: 'asg_4',
          assignedToId: 'usr_rec_1',
          assignedToName: 'Priya Nair',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(5),
        },
      ],
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(18),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 5. Selected Candidate Missing Joining Date (ACTION REQUIRED!) - Amit Patel
    {
      id: 'lead_105',
      candidateName: 'Sanjay Rawat',
      primaryPhone: '9811055005',
      normalizedPhone: '9811055005',
      phoneStatus: 'VERIFIED',
      email: 'sanjay.rawat@example.com',
      city: 'Gurgaon',
      age: 28,
      gender: 'Male',
      qualification: 'B.Tech',
      experience: '3 Years Chat Support',
      currentSalary: 32000,
      expectedSalary: 36000,
      offeredSalary: 35000,
      noticePeriod: '30 Days',
      leadSource: 'Naukri Bulk',
      assignedRecruiterId: 'usr_rec_2',
      assignedRecruiterName: 'Amit Patel',
      originalRecruiterId: 'usr_rec_2',
      originalRecruiterName: 'Amit Patel',
      teamId: 'team_tech_bpo',
      clientId: 'cli_tp',
      clientName: 'Teleperformance Global',
      jobId: 'job_tp_chat',
      jobTitle: 'International Blended Chat Specialist',
      priority: 'Hot',
      leadStatus: 'Selected',
      interviewStatus: 'Selected',
      joiningStatus: 'Offer Pending',
      // Missing expectedJoiningDate!
      callAttempts: 4,
      lastCallAt: daysAgo(1),
      lastCallOutcome: 'Connected – Interested',
      notesSummary: 'Cleared Round 2 client evaluation! Offered ₹35k. Awaiting final resignation acceptance from previous company to fix joining date.',
      assignmentHistory: [
        {
          id: 'asg_5',
          assignedToId: 'usr_rec_2',
          assignedToName: 'Amit Patel',
          assignedById: 'usr_tl_1',
          assignedByName: 'Rahul Sharma',
          assignedAt: daysAgo(8),
        },
      ],
      createdAt: daysAgo(8),
      updatedAt: daysAgo(1),
      updatedById: 'usr_rec_2',
      updatedByName: 'Amit Patel',
    },

    // 6. Joining Confirmed (Upcoming Joining in 2 days) - Sneha Rao
    {
      id: 'lead_106',
      candidateName: 'Aditya Sen',
      primaryPhone: '9845066006',
      normalizedPhone: '9845066006',
      phoneStatus: 'VERIFIED',
      email: 'aditya.sen@example.com',
      city: 'Bangalore',
      age: 29,
      gender: 'Male',
      qualification: 'BBA',
      experience: '4 Years Property Sales',
      currentSalary: 40000,
      expectedSalary: 48000,
      offeredSalary: 45000,
      noticePeriod: 'Immediate',
      leadSource: 'Referral',
      assignedRecruiterId: 'usr_rec_3',
      assignedRecruiterName: 'Sneha Rao',
      originalRecruiterId: 'usr_rec_3',
      originalRecruiterName: 'Sneha Rao',
      teamId: 'team_sales_banking',
      clientId: 'cli_sqyards',
      clientName: 'Square Yards Real Estate',
      jobId: 'job_sq_sales',
      jobTitle: 'Associate Relationship Manager - Real Estate',
      priority: 'Hot',
      leadStatus: 'Joining Scheduled',
      interviewStatus: 'Selected',
      joiningStatus: 'Joining Confirmed',
      expectedJoiningDate: daysAhead(2).split('T')[0],
      callAttempts: 5,
      lastCallAt: hoursAgo(10),
      lastCallOutcome: 'Connected – Interested',
      notesSummary: 'Offer letter signed. All documents verified. Candidate reporting to Bangalore Indiranagar branch on Monday.',
      assignmentHistory: [
        {
          id: 'asg_6',
          assignedToId: 'usr_rec_3',
          assignedToName: 'Sneha Rao',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(12),
        },
      ],
      createdAt: daysAgo(12),
      updatedAt: hoursAgo(10),
      updatedById: 'usr_rec_3',
      updatedByName: 'Sneha Rao',
    },

    // 7. Successfully Joined candidate - Priya Nair
    {
      id: 'lead_107',
      candidateName: 'Deepak Choudhary',
      primaryPhone: '9820077007',
      normalizedPhone: '9820077007',
      phoneStatus: 'VERIFIED',
      email: 'deepak.c@example.com',
      city: 'Pune',
      age: 25,
      gender: 'Male',
      qualification: 'Graduate',
      experience: '1 Year BPO',
      currentSalary: 21000,
      expectedSalary: 26000,
      offeredSalary: 26000,
      noticePeriod: 'Immediate',
      leadSource: 'Naukri Bulk',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      priority: 'High',
      leadStatus: 'Joined',
      interviewStatus: 'Selected',
      joiningStatus: 'Joined',
      expectedJoiningDate: daysAgo(3).split('T')[0],
      actualJoiningDate: daysAgo(3).split('T')[0],
      callAttempts: 6,
      lastCallAt: daysAgo(3),
      lastCallOutcome: 'Connected – Interested',
      notesSummary: 'Joined Tech Mahindra successfully. ID badge and induction completed.',
      assignmentHistory: [
        {
          id: 'asg_7',
          assignedToId: 'usr_rec_1',
          assignedToName: 'Priya Nair',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(18),
        },
      ],
      createdAt: daysAgo(18),
      updatedAt: daysAgo(3),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 8. Never Called Lead (Untouched 8 days) - ACTION REQUIRED! - Amit Patel
    {
      id: 'lead_108',
      candidateName: 'Anita Menon',
      primaryPhone: '9833088008',
      normalizedPhone: '9833088008',
      phoneStatus: 'VERIFIED',
      email: 'anita.menon@example.com',
      city: 'Pune',
      age: 22,
      gender: 'Female',
      qualification: 'B.Sc Computer Science',
      experience: 'Fresher',
      currentSalary: 0,
      expectedSalary: 24000,
      noticePeriod: 'Immediate',
      leadSource: 'Facebook Ads',
      assignedRecruiterId: 'usr_rec_2',
      assignedRecruiterName: 'Amit Patel',
      originalRecruiterId: 'usr_rec_2',
      originalRecruiterName: 'Amit Patel',
      teamId: 'team_tech_bpo',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      priority: 'High',
      leadStatus: 'New',
      callAttempts: 0, // NEVER CALLED!
      notesSummary: 'Bulk Facebook campaign lead. Not yet dialed.',
      assignmentHistory: [
        {
          id: 'asg_8',
          assignedToId: 'usr_rec_2',
          assignedToName: 'Amit Patel',
          assignedById: 'usr_tl_1',
          assignedByName: 'Rahul Sharma',
          assignedAt: daysAgo(8),
        },
      ],
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
      updatedById: 'usr_tl_1',
      updatedByName: 'Rahul Sharma',
    },

    // 9. Unassigned New Lead (ACTION REQUIRED!)
    {
      id: 'lead_109',
      candidateName: 'Rajesh Gokhale',
      primaryPhone: '9892099009',
      normalizedPhone: '9892099009',
      phoneStatus: 'VERIFIED',
      email: 'rajesh.g@example.com',
      city: 'Pune',
      age: 25,
      gender: 'Male',
      qualification: 'B.Com',
      experience: '2 Years Collections',
      currentSalary: 20000,
      expectedSalary: 25000,
      noticePeriod: 'Immediate',
      leadSource: 'Naukri Bulk',
      assignedRecruiterId: '',
      assignedRecruiterName: 'Unassigned',
      originalRecruiterId: '',
      originalRecruiterName: 'Unassigned',
      priority: 'Hot',
      leadStatus: 'New',
      callAttempts: 0,
      notesSummary: 'Lead imported via API/CSV, pending assignment.',
      assignmentHistory: [],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      updatedById: 'usr_admin',
      updatedByName: 'Ashwin Verma',
    },

    // 10. Potential Duplicate Candidate 1 (Matches phone with candidate 11)
    {
      id: 'lead_110',
      candidateName: 'Sameer K. Nair',
      primaryPhone: '9820012399',
      normalizedPhone: '9820012399',
      phoneStatus: 'VERIFIED',
      email: 'sameer.nair@example.com',
      city: 'Mumbai',
      age: 26,
      gender: 'Male',
      qualification: 'Graduate',
      experience: '2 Years Sales',
      currentSalary: 28000,
      expectedSalary: 34000,
      noticePeriod: '15 Days',
      leadSource: 'Naukri Bulk',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      clientId: 'cli_hdfc',
      clientName: 'HDFC Bank Retail Assets',
      jobId: 'job_hdfc_sales',
      jobTitle: 'Personal Loan Sales Officer',
      priority: 'High',
      leadStatus: 'Calling',
      callAttempts: 1,
      lastCallAt: daysAgo(4),
      lastCallOutcome: 'Busy',
      notesSummary: 'Applied via Naukri portal on 15th.',
      assignmentHistory: [
        {
          id: 'asg_10',
          assignedToId: 'usr_rec_1',
          assignedToName: 'Priya Nair',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(4),
        },
      ],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 11. Potential Duplicate Candidate 2 (Matches phone with candidate 10)
    {
      id: 'lead_111',
      candidateName: 'Samir Nair',
      primaryPhone: '+91 98200 12399',
      normalizedPhone: '9820012399', // DUPLICATE DETECTED!
      phoneStatus: 'VERIFIED',
      alternatePhone: '9819900011',
      email: 'samir.sales@example.com',
      city: 'Navi Mumbai',
      age: 26,
      gender: 'Male',
      qualification: 'B.Com Sales',
      experience: '2.5 Years Loan DSA',
      currentSalary: 30000,
      expectedSalary: 35000,
      noticePeriod: 'Immediate',
      leadSource: 'Referral',
      assignedRecruiterId: 'usr_rec_3',
      assignedRecruiterName: 'Sneha Rao',
      originalRecruiterId: 'usr_rec_3',
      originalRecruiterName: 'Sneha Rao',
      teamId: 'team_sales_banking',
      priority: 'Medium',
      leadStatus: 'New',
      callAttempts: 0,
      notesSummary: 'Referred by branch manager as hot lead for sales role.',
      assignmentHistory: [
        {
          id: 'asg_11',
          assignedToId: 'usr_rec_3',
          assignedToName: 'Sneha Rao',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(1),
        },
      ],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      updatedById: 'usr_admin',
      updatedByName: 'Ashwin Verma',
    },

    // 12. Candidate in Calling Queue (Reattempt - Switched Off)
    {
      id: 'lead_112',
      candidateName: 'Manoj Tiwari',
      primaryPhone: '9820023456',
      normalizedPhone: '9820023456',
      phoneStatus: 'VERIFIED',
      email: 'manoj.tiwari@example.com',
      city: 'Pune',
      age: 24,
      gender: 'Male',
      qualification: 'HSC Passed',
      experience: '6 Months Telecalling',
      currentSalary: 16000,
      expectedSalary: 20000,
      noticePeriod: 'Immediate',
      leadSource: 'Facebook Ads',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      clientId: 'cli_bajaj',
      clientName: 'Bajaj Finserv Consumer Lending',
      jobId: 'job_bajaj_coll',
      jobTitle: 'Tele-Collections Representative',
      priority: 'Medium',
      leadStatus: 'Calling',
      callAttempts: 2,
      lastCallAt: hoursAgo(2),
      lastCallOutcome: 'Switched Off',
      notesSummary: 'Tried calling at 10 AM, phone switched off. Reattempt in afternoon.',
      assignmentHistory: [
        {
          id: 'asg_12',
          assignedToId: 'usr_rec_1',
          assignedToName: 'Priya Nair',
          assignedById: 'usr_tl_1',
          assignedByName: 'Rahul Sharma',
          assignedAt: daysAgo(2),
        },
      ],
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(2),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 13. Interested candidate for Sneha Rao
    {
      id: 'lead_113',
      candidateName: 'Divya Iyer',
      primaryPhone: '9880034567',
      normalizedPhone: '9880034567',
      phoneStatus: 'VERIFIED',
      email: 'divya.iyer@example.com',
      city: 'Bangalore',
      age: 25,
      gender: 'Female',
      qualification: 'BBA',
      experience: '2 Years Real Estate Telesales',
      currentSalary: 28000,
      expectedSalary: 35000,
      noticePeriod: '7 Days',
      leadSource: 'LinkedIn',
      assignedRecruiterId: 'usr_rec_3',
      assignedRecruiterName: 'Sneha Rao',
      originalRecruiterId: 'usr_rec_3',
      originalRecruiterName: 'Sneha Rao',
      teamId: 'team_sales_banking',
      clientId: 'cli_sqyards',
      clientName: 'Square Yards Real Estate',
      jobId: 'job_sq_sales',
      jobTitle: 'Associate Relationship Manager - Real Estate',
      priority: 'Hot',
      leadStatus: 'Interested',
      callAttempts: 1,
      lastCallAt: hoursAgo(4),
      lastCallOutcome: 'Connected – Interested',
      notesSummary: 'Very impressive profile, interested in Square Yards Bangalore. Resume requested on WhatsApp.',
      assignmentHistory: [
        {
          id: 'asg_13',
          assignedToId: 'usr_rec_3',
          assignedToName: 'Sneha Rao',
          assignedById: 'usr_admin',
          assignedByName: 'Ashwin Verma',
          assignedAt: daysAgo(3),
        },
      ],
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(4),
      updatedById: 'usr_rec_3',
      updatedByName: 'Sneha Rao',
    },

    // 14. Lead with invalid phone number
    {
      id: 'lead_114',
      candidateName: 'Harish Verma',
      primaryPhone: '123456',
      normalizedPhone: '123456',
      phoneStatus: 'INVALID',
      email: 'harish.v@example.com',
      city: 'Pune',
      age: 23,
      gender: 'Male',
      qualification: 'BA',
      experience: 'Fresher',
      leadSource: 'Walk-in',
      assignedRecruiterId: 'usr_rec_1',
      assignedRecruiterName: 'Priya Nair',
      originalRecruiterId: 'usr_rec_1',
      originalRecruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      priority: 'Low',
      leadStatus: 'Invalid Number',
      callAttempts: 1,
      lastCallAt: daysAgo(5),
      lastCallOutcome: 'Invalid Number',
      notesSummary: 'Candidate provided 6-digit incomplete number.',
      assignmentHistory: [],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
      updatedById: 'usr_rec_1',
      updatedByName: 'Priya Nair',
    },

    // 15. Stale lead untouched for 18 days
    {
      id: 'lead_115',
      candidateName: 'Kunal Saxena',
      primaryPhone: '9820098711',
      normalizedPhone: '9820098711',
      phoneStatus: 'VERIFIED',
      email: 'kunal.s@example.com',
      city: 'Pune',
      age: 27,
      experience: '3 Years Sales',
      leadSource: 'Naukri Bulk',
      assignedRecruiterId: 'usr_rec_2',
      assignedRecruiterName: 'Amit Patel',
      originalRecruiterId: 'usr_rec_2',
      originalRecruiterName: 'Amit Patel',
      teamId: 'team_tech_bpo',
      priority: 'Cold',
      leadStatus: 'New',
      callAttempts: 0,
      notesSummary: 'Uploaded 18 days ago, untouched.',
      assignmentHistory: [],
      createdAt: daysAgo(18),
      updatedAt: daysAgo(18),
      updatedById: 'usr_admin',
      updatedByName: 'Ashwin Verma',
    }
  ];

  const activities: LeadActivity[] = [
    {
      id: 'act_1',
      leadId: 'lead_101',
      type: 'call',
      title: 'Call Placed - Callback Requested',
      description: 'Connected with Rohan. Candidate is interested in Tech Mahindra UK Shift. Asked to call back at 2:00 PM.',
      performedBy: { id: 'usr_rec_1', name: 'Priya Nair', role: 'recruiter' },
      createdAt: hoursAgo(6),
    },
    {
      id: 'act_2',
      leadId: 'lead_103',
      type: 'interview',
      title: 'Interview Scheduled with Tech Mahindra',
      description: 'Scheduled F2F interview for Vikas Sundaram tomorrow at 11:30 AM at Hinjewadi campus.',
      performedBy: { id: 'usr_rec_2', name: 'Amit Patel', role: 'recruiter' },
      createdAt: daysAgo(1),
    },
    {
      id: 'act_3',
      leadId: 'lead_104',
      type: 'call',
      title: 'Attendance Confirmation Call',
      description: 'Called Neha to confirm attendance for today 2:00 PM interview at HDFC Kanjurmarg.',
      performedBy: { id: 'usr_rec_1', name: 'Priya Nair', role: 'recruiter' },
      createdAt: hoursAgo(18),
    },
    {
      id: 'act_4',
      leadId: 'lead_105',
      type: 'status_change',
      title: 'Status Updated: Selected',
      description: 'Candidate selected for International Blended Chat Specialist. Awaiting joining date confirmation.',
      performedBy: { id: 'usr_rec_2', name: 'Amit Patel', role: 'recruiter' },
      createdAt: daysAgo(1),
    },
    {
      id: 'act_5',
      leadId: 'lead_106',
      type: 'joining',
      title: 'Joining Confirmed',
      description: 'Joining confirmed for Square Yards Real Estate on ' + daysAhead(2).split('T')[0] + '.',
      performedBy: { id: 'usr_rec_3', name: 'Sneha Rao', role: 'recruiter' },
      createdAt: hoursAgo(10),
    },
    {
      id: 'act_6',
      leadId: 'lead_107',
      type: 'joining',
      title: 'Candidate Successfully Joined',
      description: 'Deepak Choudhary reported to Tech Mahindra and completed induction.',
      performedBy: { id: 'usr_rec_1', name: 'Priya Nair', role: 'recruiter' },
      createdAt: daysAgo(3),
    }
  ];

  const calls: CallLog[] = [
    {
      id: 'call_1',
      leadId: 'lead_101',
      recruiterId: 'usr_rec_1',
      recruiterName: 'Priya Nair',
      candidateName: 'Rohan K. Joshi',
      phone: '9820199001',
      disposition: 'Callback',
      durationSeconds: 145,
      notes: 'Interested in UK shift. Call back after 2 PM.',
      followupDate: todayStr,
      followupTime: '14:00',
      followupReason: 'Candidate requested call after 2 PM to confirm interview slot',
      createdAt: hoursAgo(6),
    },
    {
      id: 'call_2',
      leadId: 'lead_103',
      recruiterId: 'usr_rec_2',
      recruiterName: 'Amit Patel',
      candidateName: 'Vikas Sundaram',
      phone: '9820033003',
      disposition: 'Interview Scheduled',
      durationSeconds: 230,
      notes: 'Client screening passed. Interview scheduled for tomorrow.',
      interviewDate: daysAhead(1).split('T')[0],
      interviewTime: '11:30',
      clientId: 'cli_techm',
      jobId: 'job_bpo_exec',
      interviewType: 'Face-to-face',
      createdAt: daysAgo(1),
    },
    {
      id: 'call_3',
      leadId: 'lead_113',
      recruiterId: 'usr_rec_3',
      recruiterName: 'Sneha Rao',
      candidateName: 'Divya Iyer',
      phone: '9880034567',
      disposition: 'Connected – Interested',
      durationSeconds: 180,
      notes: 'Enthusiastic candidate with 2 years sales experience.',
      createdAt: hoursAgo(4),
    }
  ];

  const followups: Followup[] = [
    {
      id: 'flw_1',
      leadId: 'lead_101',
      candidateName: 'Rohan K. Joshi',
      candidatePhone: '9820199001',
      recruiterId: 'usr_rec_1',
      recruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      scheduledAt: hoursAgo(3), // 3 hours overdue
      reason: 'Candidate requested call after 2 PM to confirm interview slot',
      priority: 'Hot',
      status: 'PENDING',
      createdAt: hoursAgo(6),
      escalatedToTL: false,
    },
    {
      id: 'flw_2',
      leadId: 'lead_102',
      candidateName: 'Pooja Bhatt',
      candidatePhone: '9819922002',
      recruiterId: 'usr_rec_1',
      recruiterName: 'Priya Nair',
      teamId: 'team_tech_bpo',
      scheduledAt: daysAgo(2), // 2 days overdue
      reason: 'Need to collect graduation marksheets',
      priority: 'High',
      status: 'PENDING',
      createdAt: daysAgo(3),
      escalatedToTL: true, // escalated to TL Rahul Sharma
    },
    {
      id: 'flw_3',
      leadId: 'lead_113',
      candidateName: 'Divya Iyer',
      candidatePhone: '9880034567',
      recruiterId: 'usr_rec_3',
      recruiterName: 'Sneha Rao',
      teamId: 'team_sales_banking',
      scheduledAt: hoursAhead(2), // Today upcoming
      reason: 'Check if resume received on WhatsApp and confirm client interview slot',
      priority: 'Hot',
      status: 'PENDING',
      createdAt: hoursAgo(4),
      escalatedToTL: false,
    }
  ];

  const interviews: Interview[] = [
    {
      id: 'int_1',
      leadId: 'lead_103',
      candidateName: 'Vikas Sundaram',
      candidatePhone: '9820033003',
      recruiterId: 'usr_rec_2',
      recruiterName: 'Amit Patel',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      date: daysAhead(1).split('T')[0],
      time: '11:30',
      scheduledAt: daysAhead(1).split('T')[0] + 'T11:30:00.000Z',
      location: 'Tech Mahindra Hinjewadi Phase 3, Gate 2',
      interviewType: 'Face-to-face',
      stage: 'Tomorrow',
      confirmationStatus: 'Pending', // Awaiting confirmation!
      contactPerson: 'Karan Mehra (HR)',
      notes: 'Carrying updated CV and original Aadhar card.',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'int_2',
      leadId: 'lead_104',
      candidateName: 'Neha Deshmukh',
      candidatePhone: '9833044004',
      recruiterId: 'usr_rec_1',
      recruiterName: 'Priya Nair',
      clientId: 'cli_hdfc',
      clientName: 'HDFC Bank Retail Assets',
      jobId: 'job_hdfc_sales',
      jobTitle: 'Personal Loan Sales Officer',
      date: todayStr,
      time: '14:00',
      scheduledAt: todayStr + 'T14:00:00.000Z',
      location: 'HDFC Bank, Kanjurmarg West, 4th Floor',
      interviewType: 'Face-to-face',
      stage: 'Today',
      confirmationStatus: 'Confirmed',
      contactPerson: 'Sunita Deshmukh',
      notes: 'Candidate confirmed she will reach 15 minutes before time.',
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(18),
    }
  ];

  const joinings: Joining[] = [
    {
      id: 'join_1',
      leadId: 'lead_105',
      candidateName: 'Sanjay Rawat',
      candidatePhone: '9811055005',
      recruiterId: 'usr_rec_2',
      recruiterName: 'Amit Patel',
      clientId: 'cli_tp',
      clientName: 'Teleperformance Global',
      jobId: 'job_tp_chat',
      jobTitle: 'International Blended Chat Specialist',
      status: 'Offer Pending',
      selectionDate: daysAgo(1).split('T')[0],
      // Expected joining date missing! Action required!
      offeredSalary: 35000,
      confirmationStatus: 'Pending',
      remarks: 'Need to follow up on resignation letter copy.',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'join_2',
      leadId: 'lead_106',
      candidateName: 'Aditya Sen',
      candidatePhone: '9845066006',
      recruiterId: 'usr_rec_3',
      recruiterName: 'Sneha Rao',
      clientId: 'cli_sqyards',
      clientName: 'Square Yards Real Estate',
      jobId: 'job_sq_sales',
      jobTitle: 'Associate Relationship Manager - Real Estate',
      status: 'Joining Confirmed',
      selectionDate: daysAgo(5).split('T')[0],
      expectedJoiningDate: daysAhead(2).split('T')[0],
      offeredSalary: 45000,
      confirmationStatus: 'Confirmed',
      remarks: 'Branch visit done, reporting manager assigned.',
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(10),
    },
    {
      id: 'join_3',
      leadId: 'lead_107',
      candidateName: 'Deepak Choudhary',
      candidatePhone: '9820077007',
      recruiterId: 'usr_rec_1',
      recruiterName: 'Priya Nair',
      clientId: 'cli_techm',
      clientName: 'Tech Mahindra BPO',
      jobId: 'job_bpo_exec',
      jobTitle: 'Customer Care Executive (Voice - UK Shift)',
      status: 'Joined',
      selectionDate: daysAgo(10).split('T')[0],
      expectedJoiningDate: daysAgo(3).split('T')[0],
      actualJoiningDate: daysAgo(3).split('T')[0],
      offeredSalary: 26000,
      confirmationStatus: 'Confirmed',
      remarks: 'Joined on schedule.',
      createdAt: daysAgo(10),
      updatedAt: daysAgo(3),
    }
  ];

  const notifications: Notification[] = [
    {
      id: 'notif_1',
      userId: 'usr_rec_1',
      title: 'Overdue Follow-up Alert',
      message: 'Follow-up with Rohan K. Joshi is overdue by 3 hours.',
      type: 'followup_overdue',
      linkTo: '/followups',
      isRead: false,
      createdAt: hoursAgo(2),
    },
    {
      id: 'notif_2',
      userId: 'usr_tl_1',
      title: 'Escalated Follow-up',
      message: 'Pooja Bhatt follow-up assigned to Priya Nair is overdue by 2 days and escalated to your team desk.',
      type: 'escalation',
      linkTo: '/action-required',
      isRead: false,
      createdAt: daysAgo(1),
    },
    {
      id: 'notif_3',
      userId: 'usr_rec_2',
      title: 'Interview Confirmation Required',
      message: 'Vikas Sundaram has an interview scheduled for tomorrow at Tech Mahindra. Confirmation pending.',
      type: 'interview_tomorrow',
      linkTo: '/interviews',
      isRead: false,
      createdAt: hoursAgo(4),
    },
    {
      id: 'notif_4',
      userId: 'usr_admin',
      title: 'Unassigned Leads in CRM',
      message: '1 new candidate lead is unassigned and waiting for recruiter distribution.',
      type: 'lead_assigned',
      linkTo: '/leads',
      isRead: false,
      createdAt: daysAgo(1),
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      userId: 'usr_admin',
      userName: 'Ashwin Verma',
      userRole: 'admin',
      action: 'SYSTEM_SEED',
      entity: 'System',
      entityId: 'sys_init',
      details: 'Initialized OAKsphere Connect CRM database with recruitment workflows.',
      createdAt: daysAgo(30),
    },
    {
      id: 'aud_2',
      userId: 'usr_rec_1',
      userName: 'Priya Nair',
      userRole: 'recruiter',
      action: 'CALL_DISPOSITION',
      entity: 'Lead',
      entityId: 'lead_101',
      newValue: { disposition: 'Callback', followupAt: hoursAgo(3) },
      details: 'Logged call with candidate Rohan K. Joshi: Callback requested.',
      createdAt: hoursAgo(6),
    },
    {
      id: 'aud_3',
      userId: 'usr_rec_2',
      userName: 'Amit Patel',
      userRole: 'recruiter',
      action: 'SCHEDULE_INTERVIEW',
      entity: 'Interview',
      entityId: 'int_1',
      newValue: { candidate: 'Vikas Sundaram', client: 'Tech Mahindra BPO', date: daysAhead(1).split('T')[0] },
      details: 'Scheduled interview for Vikas Sundaram with Tech Mahindra BPO.',
      createdAt: daysAgo(1),
    }
  ];

  return {
    users,
    leads,
    activities,
    calls,
    followups,
    interviews,
    joinings,
    clients,
    jobs,
    templates: defaultTemplates,
    callBridgeDevices: defaultCallBridgeDevices,
    callBridgeCalls: defaultCallBridgeCalls,
    callBridgeSettings: {
      usr_admin: { ...defaultCallBridgeSettings },
      usr_rec_1: { ...defaultCallBridgeSettings, defaultSim: 'SIM_1', sim1Carrier: 'Airtel 5G' },
    },
    notifications,
    auditLogs,
    settings: defaultSettings,
  };
}

class Database {
  private state: DatabaseState;
  private initialized = false;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure default settings and templates exist if schema upgraded
        if (!parsed.settings) {
          parsed.settings = defaultSettings;
        } else {
          parsed.settings = {
            ...defaultSettings,
            ...parsed.settings,
            agencyCMS: {
              ...defaultSettings.agencyCMS,
              ...(parsed.settings.agencyCMS || {}),
            },
            metaIntegration: {
              ...defaultSettings.metaIntegration,
              ...(parsed.settings.metaIntegration || {}),
            },
            googleAdsIntegration: {
              ...defaultSettings.googleAdsIntegration,
              ...(parsed.settings.googleAdsIntegration || {}),
            },
          };
        }
        if (!parsed.templates || !Array.isArray(parsed.templates) || parsed.templates.length === 0) {
          parsed.templates = defaultTemplates;
        }
        if (!parsed.callBridgeDevices || !Array.isArray(parsed.callBridgeDevices)) {
          parsed.callBridgeDevices = defaultCallBridgeDevices;
        }
        if (!parsed.callBridgeCalls || !Array.isArray(parsed.callBridgeCalls) || parsed.callBridgeCalls.length < 10) {
          parsed.callBridgeCalls = defaultCallBridgeCalls;
        }
        if (!parsed.callBridgeSettings) {
          parsed.callBridgeSettings = {
            usr_admin: { ...defaultCallBridgeSettings },
          };
        }
        if (parsed.users && Array.isArray(parsed.users)) {
          if (parsed.users.length < 5) {
            const seed = getSeedData();
            const existingIds = new Set(parsed.users.map((u: User) => u.id));
            seed.users.forEach((su: User) => {
              if (!existingIds.has(su.id)) {
                parsed.users.push(su);
              }
            });
          }
          parsed.users = parsed.users.map((u: User) => ({
            ...u,
            permissions: u.permissions || getDefaultPermissions(u.role),
          }));
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading CRM database file, resetting to seed data:', e);
    }
    const seed = getSeedData();
    this.saveDirect(seed);
    return seed;
  }

  private saveDirect(state: DatabaseState) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving database to file:', e);
    }
  }

  public save() {
    this.saveDirect(this.state);
  }

  public getState(): DatabaseState {
    return this.state;
  }

  // --- Users ---
  public getUsers(): User[] {
    return this.state.users;
  }

  public getUserById(id: string): User | undefined {
    return this.state.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const newUser: User = {
      ...user,
      id: 'usr_' + crypto.randomUUID().substring(0, 8),
      permissions: user.permissions || getDefaultPermissions(user.role),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.users.push(newUser);
    this.save();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.state.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.state.users[idx] = {
      ...this.state.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.users[idx];
  }

  public deleteUser(id: string, reassignToUserId?: string): { success: boolean; reassignedLeadsCount: number } {
    const idx = this.state.users.findIndex(u => u.id === id);
    if (idx === -1) return { success: false, reassignedLeadsCount: 0 };

    let reassignedLeadsCount = 0;
    if (reassignToUserId && reassignToUserId !== id) {
      const targetUser = this.getUserById(reassignToUserId);
      if (targetUser) {
        this.state.leads.forEach(l => {
          if (l.assignedRecruiterId === id) {
            l.assignedRecruiterId = targetUser.id;
            l.assignedRecruiterName = targetUser.name;
            l.teamId = targetUser.teamId || l.teamId;
            l.updatedAt = new Date().toISOString();
            reassignedLeadsCount++;
          }
        });
      }
    } else {
      this.state.leads.forEach(l => {
        if (l.assignedRecruiterId === id) {
          l.assignedRecruiterId = '';
          l.assignedRecruiterName = 'Unassigned';
          l.updatedAt = new Date().toISOString();
          reassignedLeadsCount++;
        }
      });
    }

    this.state.users.splice(idx, 1);
    this.save();
    return { success: true, reassignedLeadsCount };
  }

  // --- Leads ---
  public getLeads(): Lead[] {
    return this.state.leads;
  }

  public getLeadById(id: string): Lead | undefined {
    return this.state.leads.find(l => l.id === id);
  }

  public findLeadByPhone(phone: string): Lead | undefined {
    const { normalized } = normalizePhoneNumber(phone);
    if (!normalized) return undefined;
    return this.state.leads.find(l => l.normalizedPhone === normalized || l.normalizedAltPhone === normalized);
  }

  public createLead(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
    const newLead: Lead = {
      ...leadData,
      id: 'lead_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.leads.push(newLead);
    this.save();
    return newLead;
  }

  public updateLead(id: string, updates: Partial<Lead>): Lead | null {
    const idx = this.state.leads.findIndex(l => l.id === id);
    if (idx === -1) return null;
    this.state.leads[idx] = {
      ...this.state.leads[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.leads[idx];
  }

  // --- Activities ---
  public logActivity(activity: Omit<LeadActivity, 'id' | 'createdAt'>): LeadActivity {
    const newActivity: LeadActivity = {
      ...activity,
      id: 'act_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.state.activities.unshift(newActivity);
    this.save();
    return newActivity;
  }

  public getActivitiesForLead(leadId: string): LeadActivity[] {
    return this.state.activities.filter(a => a.leadId === leadId);
  }

  // --- Calls ---
  public createCallLog(call: Omit<CallLog, 'id' | 'createdAt'>): CallLog {
    const newCall: CallLog = {
      ...call,
      id: 'call_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.state.calls.unshift(newCall);
    this.save();
    return newCall;
  }

  public getCalls(): CallLog[] {
    return this.state.calls;
  }

  // --- Followups ---
  public getFollowups(): Followup[] {
    return this.state.followups;
  }

  public createFollowup(data: Omit<Followup, 'id' | 'createdAt'>): Followup {
    const newFollowup: Followup = {
      ...data,
      id: 'flw_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.state.followups.push(newFollowup);
    this.save();
    return newFollowup;
  }

  public updateFollowup(id: string, updates: Partial<Followup>): Followup | null {
    const idx = this.state.followups.findIndex(f => f.id === id);
    if (idx === -1) return null;
    this.state.followups[idx] = {
      ...this.state.followups[idx],
      ...updates,
    };
    this.save();
    return this.state.followups[idx];
  }

  // --- Interviews ---
  public getInterviews(): Interview[] {
    return this.state.interviews;
  }

  public createInterview(data: Omit<Interview, 'id' | 'createdAt' | 'updatedAt'>): Interview {
    const newInterview: Interview = {
      ...data,
      id: 'int_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.interviews.push(newInterview);
    this.save();
    return newInterview;
  }

  public updateInterview(id: string, updates: Partial<Interview>): Interview | null {
    const idx = this.state.interviews.findIndex(i => i.id === id);
    if (idx === -1) return null;
    this.state.interviews[idx] = {
      ...this.state.interviews[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.interviews[idx];
  }

  // --- Joinings ---
  public getJoinings(): Joining[] {
    return this.state.joinings;
  }

  public createJoining(data: Omit<Joining, 'id' | 'createdAt' | 'updatedAt'>): Joining {
    const newJoining: Joining = {
      ...data,
      id: 'join_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.joinings.push(newJoining);
    this.save();
    return newJoining;
  }

  public updateJoining(id: string, updates: Partial<Joining>): Joining | null {
    const idx = this.state.joinings.findIndex(j => j.id === id);
    if (idx === -1) return null;
    this.state.joinings[idx] = {
      ...this.state.joinings[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.joinings[idx];
  }

  // --- Clients & Jobs ---
  public getClients(): Client[] {
    return this.state.clients;
  }

  public createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client {
    const newClient: Client = {
      ...client,
      id: 'cli_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.clients.push(newClient);
    this.save();
    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>): Client | null {
    const idx = this.state.clients.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.state.clients[idx] = { ...this.state.clients[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.state.clients[idx];
  }

  public getJobs(): Job[] {
    return this.state.jobs;
  }

  public createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Job {
    const newJob: Job = {
      ...job,
      id: 'job_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.jobs.push(newJob);
    this.save();
    return newJob;
  }

  public updateJob(id: string, updates: Partial<Job>): Job | null {
    const idx = this.state.jobs.findIndex(j => j.id === id);
    if (idx === -1) return null;
    this.state.jobs[idx] = { ...this.state.jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.state.jobs[idx];
  }

  // --- Notifications ---
  public getNotifications(): Notification[] {
    return this.state.notifications;
  }

  public addNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Notification {
    const newNotif: Notification = {
      ...notification,
      id: 'notif_' + crypto.randomUUID().substring(0, 8),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(newNotif);
    this.save();
    return newNotif;
  }

  public markNotificationRead(id: string, userId: string): boolean {
    const n = this.state.notifications.find(item => item.id === id && (item.userId === userId || userId === 'usr_admin'));
    if (n) {
      n.isRead = true;
      this.save();
      return true;
    }
    return false;
  }

  public markAllNotificationsRead(userId: string): number {
    let count = 0;
    for (const n of this.state.notifications) {
      if ((n.userId === userId || userId === 'usr_admin') && !n.isRead) {
        n.isRead = true;
        count++;
      }
    }
    if (count > 0) this.save();
    return count;
  }

  // --- Audit Logs ---
  public logAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const newLog: AuditLog = {
      ...log,
      id: 'aud_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(newLog);
    // Keep last 1000 logs
    if (this.state.auditLogs.length > 1000) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 1000);
    }
    this.save();
    return newLog;
  }

  public getAuditLogs(): AuditLog[] {
    return this.state.auditLogs;
  }

  // --- Templates ---
  public getTemplates(): MessageTemplate[] {
    return this.state.templates || defaultTemplates;
  }

  public getTemplateById(id: string): MessageTemplate | undefined {
    return (this.state.templates || defaultTemplates).find(t => t.id === id);
  }

  public createTemplate(data: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): MessageTemplate {
    const newTemplate: MessageTemplate = {
      ...data,
      id: 'tmpl_' + crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!this.state.templates) this.state.templates = [...defaultTemplates];
    this.state.templates.push(newTemplate);
    this.save();
    return newTemplate;
  }

  public updateTemplate(id: string, updates: Partial<MessageTemplate>): MessageTemplate | null {
    if (!this.state.templates) this.state.templates = [...defaultTemplates];
    const idx = this.state.templates.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.state.templates[idx] = {
      ...this.state.templates[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.templates[idx];
  }

  public deleteTemplate(id: string): boolean {
    if (!this.state.templates) this.state.templates = [...defaultTemplates];
    const idx = this.state.templates.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.state.templates.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Call Bridge (Desktop Call to Phone SIM Call) ---
  public getCallBridgeDevices(userId: string): CallBridgeDevice[] {
    const all = this.state.callBridgeDevices || defaultCallBridgeDevices;
    return all.filter(d => d.userId === userId || userId === 'usr_admin');
  }

  public getCallBridgeDevice(deviceId: string): CallBridgeDevice | undefined {
    const all = this.state.callBridgeDevices || defaultCallBridgeDevices;
    return all.find(d => d.id === deviceId);
  }

  public getCallBridgeDeviceByPairCode(pairCode: string): CallBridgeDevice | undefined {
    const clean = pairCode.replace(/[^0-9]/g, '');
    const all = this.state.callBridgeDevices || defaultCallBridgeDevices;
    return all.find(d => d.pairCode.replace(/[^0-9]/g, '') === clean);
  }

  public createOrUpdateDevice(device: CallBridgeDevice): CallBridgeDevice {
    if (!this.state.callBridgeDevices) this.state.callBridgeDevices = [...defaultCallBridgeDevices];
    const idx = this.state.callBridgeDevices.findIndex(d => d.id === device.id || d.pairCode === device.pairCode);
    if (idx >= 0) {
      this.state.callBridgeDevices[idx] = {
        ...this.state.callBridgeDevices[idx],
        ...device,
        lastSeenAt: new Date().toISOString(),
      };
      this.save();
      return this.state.callBridgeDevices[idx];
    } else {
      this.state.callBridgeDevices.push(device);
      this.save();
      return device;
    }
  }

  public updateDeviceStatus(deviceId: string, status: 'connected' | 'disconnected' | 'in_call'): boolean {
    if (!this.state.callBridgeDevices) this.state.callBridgeDevices = [...defaultCallBridgeDevices];
    const dev = this.state.callBridgeDevices.find(d => d.id === deviceId);
    if (dev) {
      dev.status = status;
      dev.lastSeenAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }

  public getCallBridgeCalls(userId: string): CallBridgeCallEvent[] {
    const all = this.state.callBridgeCalls || defaultCallBridgeCalls;
    return all
      .filter(c => c.userId === userId || userId === 'usr_admin')
      .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
  }

  public getAllCallBridgeCalls(): CallBridgeCallEvent[] {
    const all = this.state.callBridgeCalls || defaultCallBridgeCalls;
    return all.slice().sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
  }

  public createCallBridgeCall(data: Omit<CallBridgeCallEvent, 'id' | 'initiatedAt'>): CallBridgeCallEvent {
    const newCall: CallBridgeCallEvent = {
      ...data,
      id: 'call_brg_' + crypto.randomUUID().substring(0, 8),
      initiatedAt: new Date().toISOString(),
    };
    if (!this.state.callBridgeCalls) this.state.callBridgeCalls = [...defaultCallBridgeCalls];
    this.state.callBridgeCalls.unshift(newCall);
    if (this.state.callBridgeCalls.length > 500) {
      this.state.callBridgeCalls = this.state.callBridgeCalls.slice(0, 500);
    }
    this.save();
    return newCall;
  }

  public updateCallBridgeCall(id: string, updates: Partial<CallBridgeCallEvent>): CallBridgeCallEvent | null {
    if (!this.state.callBridgeCalls) this.state.callBridgeCalls = [...defaultCallBridgeCalls];
    const idx = this.state.callBridgeCalls.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.state.callBridgeCalls[idx] = {
      ...this.state.callBridgeCalls[idx],
      ...updates,
    };
    this.save();
    return this.state.callBridgeCalls[idx];
  }

  public getCallBridgeSettings(userId: string): CallBridgeSettings {
    if (!this.state.callBridgeSettings) {
      this.state.callBridgeSettings = { usr_admin: { ...defaultCallBridgeSettings } };
    }
    return this.state.callBridgeSettings[userId] || { ...defaultCallBridgeSettings };
  }

  public updateCallBridgeSettings(userId: string, updates: Partial<CallBridgeSettings>): CallBridgeSettings {
    if (!this.state.callBridgeSettings) {
      this.state.callBridgeSettings = {};
    }
    const current = this.state.callBridgeSettings[userId] || { ...defaultCallBridgeSettings };
    this.state.callBridgeSettings[userId] = {
      ...current,
      ...updates,
    };
    this.save();
    return this.state.callBridgeSettings[userId];
  }

  // --- Settings ---
  public getSettings(): CRMSettings {
    return this.state.settings;
  }

  public updateSettings(settings: Partial<CRMSettings>): CRMSettings {
    this.state.settings = {
      ...this.state.settings,
      ...settings,
    };
    this.save();
    return this.state.settings;
  }
}

export const db = new Database();
