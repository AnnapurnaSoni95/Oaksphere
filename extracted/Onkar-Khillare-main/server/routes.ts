import express, { Response } from 'express';
import { db, normalizePhoneNumber, calculateScreeningScorecard, matchJobsForLead } from './db.js';
import {
  generateToken,
  authenticateToken,
  requireRole,
  canAccessLead,
  AuthenticatedRequest,
} from './auth.js';
import {
  CallDisposition,
  LeadPriority,
  LeadStatus,
  InterviewStage,
  InterviewType,
  JoiningStatus,
  Lead,
  LeadActivity,
  Interview,
  Joining,
  MessageTemplate,
  ScreeningScorecard,
  User,
  CallBridgeDevice,
  CallBridgeCallEvent,
  CallBridgeSettings,
  SimSlot,
} from './types.js';

export const apiRouter = express.Router();

// -------------------------------------------------------------
// 1. AUTHENTICATION & DEMO SWITCHING
// -------------------------------------------------------------

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db.getUserByEmail(email);
  if (!user || user.passwordHash !== password) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Your account is deactivated. Contact an administrator.' });
    return;
  }

  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      teamName: user.teamName,
      phone: user.phone,
      dailyCallTarget: user.dailyCallTarget,
      dailyConnectedTarget: user.dailyConnectedTarget,
      dailyLineupTarget: user.dailyLineupTarget,
      monthlyJoiningTarget: user.monthlyJoiningTarget,
    },
  });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = db.getUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user });
});

// Quick switcher for seamless 1-click testing of all 3 roles (Admin, TL, Recruiter)
apiRouter.post('/auth/switch-demo', (req, res) => {
  const { userId } = req.body;
  const user = db.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'Demo user not found.' });
    return;
  }
  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      teamName: user.teamName,
      phone: user.phone,
      dailyCallTarget: user.dailyCallTarget,
      dailyConnectedTarget: user.dailyConnectedTarget,
      dailyLineupTarget: user.dailyLineupTarget,
      monthlyJoiningTarget: user.monthlyJoiningTarget,
    },
  });
});

apiRouter.get('/auth/demo-users', (req, res) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    teamName: u.teamName,
    isActive: u.isActive,
  }));
  res.json({ users });
});

// -------------------------------------------------------------
// 2. USERS MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/users', authenticateToken, (req: AuthenticatedRequest, res) => {
  const users = db.getUsers().map(u => {
    const { passwordHash, ...safe } = u;
    return safe;
  });

  // Team leader only sees team members and themselves
  if (req.user!.role === 'team_leader') {
    const teamMembers = users.filter(u => u.teamId === req.user!.teamId || u.id === req.user!.id);
    res.json({ users: teamMembers });
    return;
  }

  // Recruiters only see themselves and TL
  if (req.user!.role === 'recruiter') {
    const myTeam = users.filter(u => u.id === req.user!.id || (u.teamId === req.user!.teamId && u.role === 'team_leader'));
    res.json({ users: myTeam });
    return;
  }

  // Admin gets all users
  res.json({ users });
});

apiRouter.post('/users', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { name, email, password, role, teamId, teamName, phone, dailyCallTarget, dailyConnectedTarget, dailyLineupTarget, monthlyJoiningTarget, permissions } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'Name, email, password, and role are required.' });
    return;
  }

  if (db.getUserByEmail(email)) {
    res.status(400).json({ error: 'A user with this email address already exists.' });
    return;
  }

  const newUser = db.createUser({
    name,
    email,
    passwordHash: password,
    role,
    teamId,
    teamName,
    phone,
    isActive: true,
    dailyCallTarget: Number(dailyCallTarget) || 60,
    dailyConnectedTarget: Number(dailyConnectedTarget) || 30,
    dailyLineupTarget: Number(dailyLineupTarget) || 5,
    monthlyJoiningTarget: Number(monthlyJoiningTarget) || 8,
    permissions,
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'CREATE_USER',
    entity: 'User',
    entityId: newUser.id,
    newValue: { name, email, role, teamName, permissions: newUser.permissions },
    details: `Admin created user '${name}' with role '${role}'.`,
  });

  const { passwordHash, ...safe } = newUser;
  res.status(201).json({ user: safe });
});

apiRouter.patch('/users/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const existing = db.getUserById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const updated = db.updateUser(req.params.id, req.body);
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'UPDATE_USER',
    entity: 'User',
    entityId: req.params.id,
    previousValue: existing,
    newValue: updated,
    details: `Admin updated user '${existing.name}' and access permissions.`,
  });

  const { passwordHash, ...safe } = updated!;
  res.json({ user: safe });
});

apiRouter.delete('/users/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const userId = req.params.id;
  const existing = db.getUserById(userId);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (userId === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    return;
  }

  const reassignToUserId = req.body?.reassignToUserId || (req.query?.reassignToUserId as string);
  let targetUserName = 'Unassigned';
  if (reassignToUserId) {
    const target = db.getUserById(reassignToUserId);
    if (target) targetUserName = target.name;
  }

  const result = db.deleteUser(userId, reassignToUserId);

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'DELETE_USER',
    entity: 'User',
    entityId: userId,
    previousValue: existing,
    details: `Admin deleted user '${existing.name}' (${existing.email}). ${result.reassignedLeadsCount} leads transferred to ${targetUserName}.`,
  });

  res.json({
    success: true,
    message: `Recruiter '${existing.name}' was permanently deleted. ${result.reassignedLeadsCount} candidate leads were reassigned to ${targetUserName}.`,
    reassignedLeadsCount: result.reassignedLeadsCount,
  });
});

// -------------------------------------------------------------
// 3. LEADS MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/leads', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();

  // Role & Permission filtering
  const canViewAll = req.user!.role === 'admin' || req.user!.permissions?.canViewAllLeads === true;
  if (!canViewAll) {
    if (req.user!.role === 'recruiter') {
      leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
    } else if (req.user!.role === 'team_leader') {
      leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
    }
  }

  // Filters
  const {
    search,
    priority,
    leadStatus,
    interviewStatus,
    joiningStatus,
    assignedRecruiterId,
    clientId,
    jobId,
    view,
  } = req.query as Record<string, string>;

  if (search) {
    const q = search.toLowerCase().trim();
    leads = leads.filter(l =>
      l.candidateName.toLowerCase().includes(q) ||
      l.primaryPhone.includes(q) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      l.city.toLowerCase().includes(q) ||
      (l.clientName && l.clientName.toLowerCase().includes(q)) ||
      (l.jobTitle && l.jobTitle.toLowerCase().includes(q))
    );
  }

  if (priority) {
    leads = leads.filter(l => l.priority === priority);
  }

  if (leadStatus) {
    leads = leads.filter(l => l.leadStatus === leadStatus);
  }

  if (interviewStatus) {
    leads = leads.filter(l => l.interviewStatus === interviewStatus);
  }

  if (joiningStatus) {
    leads = leads.filter(l => l.joiningStatus === joiningStatus);
  }

  if (assignedRecruiterId) {
    leads = leads.filter(l => l.assignedRecruiterId === assignedRecruiterId);
  }

  if (clientId) {
    leads = leads.filter(l => l.clientId === clientId);
  }

  if (jobId) {
    leads = leads.filter(l => l.jobId === jobId);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Pre-configured saved views
  if (view === 'today_followups') {
    leads = leads.filter(l => l.nextFollowupAt && l.nextFollowupAt.startsWith(todayStr));
  } else if (view === 'overdue_followups') {
    leads = leads.filter(l => l.nextFollowupAt && new Date(l.nextFollowupAt) < now && l.leadStatus !== 'Joined' && l.leadStatus !== 'Lost');
  } else if (view === 'hot_leads') {
    leads = leads.filter(l => l.priority === 'Hot');
  } else if (view === 'never_called') {
    leads = leads.filter(l => l.callAttempts === 0);
  } else if (view === 'unassigned') {
    leads = leads.filter(l => !l.assignedRecruiterId || l.assignedRecruiterName === 'Unassigned');
  } else if (view === 'action_required') {
    leads = leads.filter(l =>
      (!l.assignedRecruiterId) ||
      (l.callAttempts === 0) ||
      (l.nextFollowupAt && new Date(l.nextFollowupAt) < now) ||
      (l.leadStatus === 'Selected' && !l.expectedJoiningDate)
    );
  } else if (view === 'calling_queue') {
    // Calling queue prioritization:
    // 1. Overdue follow-ups
    // 2. Hot candidates
    // 3. Interviews tomorrow
    // 4. Today's follow-ups
    // 5. New high-priority leads
    // 6. New leads
    // 7. Reattempt candidates
    // 8. Older untouched leads
    // Exclude Joined, Lost, Invalid Number
    leads = leads.filter(l => !['Joined', 'Lost', 'Invalid Number'].includes(l.leadStatus));

    leads.sort((a, b) => {
      const aIsOverdue = a.nextFollowupAt && new Date(a.nextFollowupAt) < now ? 1 : 0;
      const bIsOverdue = b.nextFollowupAt && new Date(b.nextFollowupAt) < now ? 1 : 0;
      if (aIsOverdue !== bIsOverdue) return bIsOverdue - aIsOverdue;

      const priorityWeight: Record<LeadPriority, number> = { Hot: 5, High: 4, Medium: 3, Low: 2, Cold: 1 };
      const aP = priorityWeight[a.priority] || 1;
      const bP = priorityWeight[b.priority] || 1;
      if (aP !== bP) return bP - aP;

      const aIsTodayFollowup = a.nextFollowupAt && a.nextFollowupAt.startsWith(todayStr) ? 1 : 0;
      const bIsTodayFollowup = b.nextFollowupAt && b.nextFollowupAt.startsWith(todayStr) ? 1 : 0;
      if (aIsTodayFollowup !== bIsTodayFollowup) return bIsTodayFollowup - aIsTodayFollowup;

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  // Phone number masking for privacy/anti-theft
  const maskPhone = req.user!.role === 'recruiter' && req.user!.permissions?.canViewCandidatePhone === false;
  const returnedLeads = maskPhone
    ? leads.map(l => ({
        ...l,
        primaryPhone: l.primaryPhone ? l.primaryPhone.slice(0, 4) + ' ••••••' : '',
        alternatePhone: l.alternatePhone ? l.alternatePhone.slice(0, 4) + ' ••••••' : undefined,
        isPhoneMasked: true,
      }))
    : leads;

  res.json({
    total: returnedLeads.length,
    leads: returnedLeads,
  });
});

apiRouter.get('/leads/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const existingLead = db.getLeadById(req.params.id);
  if (!existingLead) {
    res.status(404).json({ error: 'Candidate lead not found.' });
    return;
  }

  if (!canAccessLead(req.user!, existingLead)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to view this lead.' });
    return;
  }

  const maskPhone = req.user!.role === 'recruiter' && req.user!.permissions?.canViewCandidatePhone === false;
  const lead: Lead = maskPhone
    ? {
        ...existingLead,
        primaryPhone: existingLead.primaryPhone ? existingLead.primaryPhone.slice(0, 4) + ' ••••••' : '',
        alternatePhone: existingLead.alternatePhone ? existingLead.alternatePhone.slice(0, 4) + ' ••••••' : undefined,
        isPhoneMasked: true,
      }
    : existingLead;

  const activities = db.getActivitiesForLead(lead.id);
  const calls = db.getCalls().filter(c => c.leadId === lead.id);
  const interviews = db.getInterviews().filter(i => i.leadId === lead.id);
  const followups = db.getFollowups().filter(f => f.leadId === lead.id);
  const joinings = db.getJoinings().filter(j => j.leadId === lead.id);

  res.json({
    lead,
    activities,
    calls,
    interviews,
    followups,
    joinings,
  });
});

apiRouter.post('/leads', authenticateToken, (req: AuthenticatedRequest, res) => {
  const {
    candidateName,
    primaryPhone,
    alternatePhone,
    email,
    city,
    age,
    gender,
    qualification,
    experience,
    currentSalary,
    expectedSalary,
    noticePeriod,
    leadSource,
    priority,
    clientId,
    jobId,
    assignedRecruiterId,
    notes,
    allowDuplicate,
  } = req.body;

  if (!candidateName || !primaryPhone || !city) {
    res.status(400).json({ error: 'Candidate Name, Primary Phone, and City are required fields.' });
    return;
  }

  const phoneNorm = normalizePhoneNumber(primaryPhone);
  if (!phoneNorm.isValid && phoneNorm.status === 'INVALID') {
    res.status(400).json({
      error: `Invalid primary phone number '${primaryPhone}'. Please enter a valid 10-digit mobile number.`,
    });
    return;
  }

  // Duplicate Check
  const existingByPhone = db.findLeadByPhone(primaryPhone);
  if (existingByPhone && !allowDuplicate) {
    res.status(409).json({
      error: `Duplicate phone number detected! Existing candidate: '${existingByPhone.candidateName}' (ID: ${existingByPhone.id}) is already assigned to recruiter '${existingByPhone.assignedRecruiterName}'.`,
      existingLead: existingByPhone,
      canForceDuplicate: true,
    });
    return;
  }

  let assignedRecruiterName = 'Unassigned';
  let originalRecruiterId = '';
  let originalRecruiterName = 'Unassigned';
  let teamId: string | undefined = undefined;

  let targetRecruiterId = assignedRecruiterId;
  // If user is recruiter creating lead, assign to self
  if (req.user!.role === 'recruiter') {
    targetRecruiterId = req.user!.id;
  }

  if (targetRecruiterId) {
    const recruiterUser = db.getUserById(targetRecruiterId);
    if (recruiterUser) {
      assignedRecruiterName = recruiterUser.name;
      originalRecruiterId = recruiterUser.id;
      originalRecruiterName = recruiterUser.name;
      teamId = recruiterUser.teamId;
    }
  }

  let clientName: string | undefined = undefined;
  if (clientId) {
    const cl = db.getClients().find(c => c.id === clientId);
    if (cl) clientName = cl.companyName;
  }

  let jobTitle: string | undefined = undefined;
  if (jobId) {
    const jb = db.getJobs().find(j => j.id === jobId);
    if (jb) jobTitle = jb.positionTitle;
  }

  const altNorm = alternatePhone ? normalizePhoneNumber(alternatePhone) : undefined;

  const newLead = db.createLead({
    candidateName,
    primaryPhone,
    normalizedPhone: phoneNorm.normalized,
    alternatePhone,
    normalizedAltPhone: altNorm?.normalized,
    phoneStatus: phoneNorm.status,
    email,
    city,
    age: age ? Number(age) : undefined,
    gender,
    qualification,
    experience,
    currentSalary: currentSalary ? Number(currentSalary) : undefined,
    expectedSalary: expectedSalary ? Number(expectedSalary) : undefined,
    noticePeriod,
    leadSource: leadSource || 'Manual Entry',
    assignedRecruiterId: targetRecruiterId || '',
    assignedRecruiterName,
    originalRecruiterId,
    originalRecruiterName,
    teamId,
    clientId,
    clientName,
    jobId,
    jobTitle,
    priority: (priority as LeadPriority) || 'Medium',
    leadStatus: 'New',
    callAttempts: 0,
    notesSummary: notes || '',
    assignmentHistory: targetRecruiterId
      ? [
          {
            id: 'asg_' + Math.random().toString(36).substring(2, 8),
            assignedToId: targetRecruiterId,
            assignedToName: assignedRecruiterName,
            assignedById: req.user!.id,
            assignedByName: req.user!.name,
            assignedAt: new Date().toISOString(),
            reason: 'Initial assignment upon lead creation',
          },
        ]
      : [],
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  db.logActivity({
    leadId: newLead.id,
    type: 'status_change',
    title: 'Lead Created',
    description: `Candidate lead created from source '${newLead.leadSource}'.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'CREATE_LEAD',
    entity: 'Lead',
    entityId: newLead.id,
    newValue: { name: newLead.candidateName, phone: newLead.primaryPhone, assigned: newLead.assignedRecruiterName },
    details: `Created new candidate lead '${newLead.candidateName}'.`,
  });

  res.status(201).json({ lead: newLead });
});

apiRouter.patch('/leads/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const lead = db.getLeadById(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Candidate lead not found.' });
    return;
  }

  if (!canAccessLead(req.user!, lead)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to update this lead.' });
    return;
  }

  const {
    candidateName,
    primaryPhone,
    alternatePhone,
    email,
    city,
    age,
    gender,
    qualification,
    experience,
    currentSalary,
    expectedSalary,
    noticePeriod,
    leadSource,
    priority,
    leadStatus,
    clientId,
    jobId,
    notesSummary,
    expectedJoiningDate,
    actualJoiningDate,
    lostReason,
  } = req.body;

  const updates: Partial<Lead> = {
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  };

  if (candidateName !== undefined) updates.candidateName = candidateName;
  if (primaryPhone !== undefined) {
    const norm = normalizePhoneNumber(primaryPhone);
    updates.primaryPhone = primaryPhone;
    updates.normalizedPhone = norm.normalized;
    updates.phoneStatus = norm.status;
  }
  if (alternatePhone !== undefined) {
    updates.alternatePhone = alternatePhone;
    updates.normalizedAltPhone = normalizePhoneNumber(alternatePhone).normalized;
  }
  if (email !== undefined) updates.email = email;
  if (city !== undefined) updates.city = city;
  if (age !== undefined) updates.age = Number(age);
  if (gender !== undefined) updates.gender = gender;
  if (qualification !== undefined) updates.qualification = qualification;
  if (experience !== undefined) updates.experience = experience;
  if (currentSalary !== undefined) updates.currentSalary = Number(currentSalary);
  if (expectedSalary !== undefined) updates.expectedSalary = Number(expectedSalary);
  if (noticePeriod !== undefined) updates.noticePeriod = noticePeriod;
  if (leadSource !== undefined) updates.leadSource = leadSource;
  if (priority !== undefined) updates.priority = priority;
  if (leadStatus !== undefined) updates.leadStatus = leadStatus;
  if (notesSummary !== undefined) updates.notesSummary = notesSummary;
  if (expectedJoiningDate !== undefined) updates.expectedJoiningDate = expectedJoiningDate;
  if (actualJoiningDate !== undefined) updates.actualJoiningDate = actualJoiningDate;
  if (lostReason !== undefined) updates.lostReason = lostReason;

  if (clientId !== undefined) {
    updates.clientId = clientId;
    const cl = db.getClients().find(c => c.id === clientId);
    updates.clientName = cl ? cl.companyName : undefined;
  }

  if (jobId !== undefined) {
    updates.jobId = jobId;
    const jb = db.getJobs().find(j => j.id === jobId);
    updates.jobTitle = jb ? jb.positionTitle : undefined;
  }

  const updatedLead = db.updateLead(lead.id, updates);

  // If status changed or note added, log activity
  if (leadStatus && leadStatus !== lead.leadStatus) {
    db.logActivity({
      leadId: lead.id,
      type: 'status_change',
      title: `Lead Status Changed: ${leadStatus}`,
      description: `Status changed from '${lead.leadStatus}' to '${leadStatus}'.`,
      performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    });
  }

  if (priority && priority !== lead.priority) {
    db.logActivity({
      leadId: lead.id,
      type: 'status_change',
      title: `Priority Updated: ${priority}`,
      description: `Priority shifted from '${lead.priority}' to '${priority}'.`,
      performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    });
  }

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'UPDATE_LEAD',
    entity: 'Lead',
    entityId: lead.id,
    previousValue: lead,
    newValue: updatedLead,
    details: `Updated details for candidate '${lead.candidateName}'.`,
  });

  res.json({ lead: updatedLead });
});

// Bulk Lead Assignment (Admin and TL only)
apiRouter.post('/leads/bulk-assign', authenticateToken, requireRole('admin', 'team_leader'), (req: AuthenticatedRequest, res) => {
  const { leadIds, targetRecruiterId, reason } = req.body;
  if (!Array.isArray(leadIds) || leadIds.length === 0 || !targetRecruiterId) {
    res.status(400).json({ error: 'leadIds array and targetRecruiterId are required.' });
    return;
  }

  const targetRecruiter = db.getUserById(targetRecruiterId);
  if (!targetRecruiter) {
    res.status(404).json({ error: 'Target recruiter not found.' });
    return;
  }

  if (!targetRecruiter.isActive) {
    res.status(400).json({ error: 'Cannot assign leads to an inactive recruiter.' });
    return;
  }

  // TL check: target recruiter must be in TL's team
  if (req.user!.role === 'team_leader' && targetRecruiter.teamId !== req.user!.teamId) {
    res.status(403).json({ error: 'Team Leaders can only assign leads to recruiters within their own team.' });
    return;
  }

  let assignedCount = 0;
  for (const leadId of leadIds) {
    const lead = db.getLeadById(leadId);
    if (!lead) continue;

    // Check TL permission on each lead
    if (req.user!.role === 'team_leader' && lead.teamId && lead.teamId !== req.user!.teamId) {
      continue;
    }

    const prevRecruiter = lead.assignedRecruiterName;
    const historyEntry = {
      id: 'asg_' + Math.random().toString(36).substring(2, 8),
      assignedToId: targetRecruiter.id,
      assignedToName: targetRecruiter.name,
      assignedById: req.user!.id,
      assignedByName: req.user!.name,
      assignedAt: new Date().toISOString(),
      reason: reason || 'Bulk assignment via CRM',
    };

    db.updateLead(lead.id, {
      assignedRecruiterId: targetRecruiter.id,
      assignedRecruiterName: targetRecruiter.name,
      teamId: targetRecruiter.teamId,
      assignmentHistory: [historyEntry, ...(lead.assignmentHistory || [])],
      updatedById: req.user!.id,
      updatedByName: req.user!.name,
    });

    db.logActivity({
      leadId: lead.id,
      type: 'assignment',
      title: 'Lead Reassigned',
      description: `Reassigned from '${prevRecruiter}' to '${targetRecruiter.name}' by ${req.user!.name}.`,
      performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    });

    assignedCount++;
  }

  // Send notification to target recruiter
  db.addNotification({
    userId: targetRecruiter.id,
    title: 'New Leads Assigned',
    message: `${assignedCount} leads have been assigned to you by ${req.user!.name}.`,
    type: 'lead_assigned',
    linkTo: '/leads',
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'BULK_ASSIGN_LEADS',
    entity: 'Lead',
    entityId: 'multiple',
    newValue: { count: assignedCount, assignedTo: targetRecruiter.name },
    details: `Assigned ${assignedCount} leads to ${targetRecruiter.name}.`,
  });

  res.json({
    message: `Successfully assigned ${assignedCount} leads to ${targetRecruiter.name}.`,
    assignedCount,
  });
});

// Auto-distribute leads across active recruiters with intelligent workload balancing
apiRouter.post('/leads/auto-distribute', authenticateToken, requireRole('admin', 'team_leader'), (req: AuthenticatedRequest, res) => {
  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json({ error: 'leadIds array is required.' });
    return;
  }

  let recruiters = db.getUsers().filter(u => u.role === 'recruiter' && u.isActive);
  if (req.user!.role === 'team_leader') {
    recruiters = recruiters.filter(u => u.teamId === req.user!.teamId);
  }

  if (recruiters.length === 0) {
    res.status(400).json({ error: 'No active recruiters available for auto-distribution.' });
    return;
  }

  // Workload balance algorithm:
  // Count current open leads (not Joined, not Lost) for each recruiter
  const openLeadsCount: Record<string, number> = {};
  recruiters.forEach(r => (openLeadsCount[r.id] = 0));

  db.getLeads().forEach(l => {
    if (openLeadsCount[l.assignedRecruiterId] !== undefined && !['Joined', 'Lost'].includes(l.leadStatus)) {
      openLeadsCount[l.assignedRecruiterId]++;
    }
  });

  // Sort lead IDs: hot/high priority first so they get evenly distributed
  const leadsToAssign = leadIds
    .map(id => db.getLeadById(id))
    .filter((l): l is Lead => !!l)
    .sort((a, b) => {
      const priorityWeight: Record<LeadPriority, number> = { Hot: 5, High: 4, Medium: 3, Low: 2, Cold: 1 };
      return (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
    });

  let assignedCount = 0;
  const distributionSummary: Record<string, number> = {};
  recruiters.forEach(r => (distributionSummary[r.name] = 0));

  for (const lead of leadsToAssign) {
    // Pick active recruiter with the lowest current workload
    let lowestRecruiter = recruiters[0];
    let minLoad = openLeadsCount[lowestRecruiter.id];

    for (const r of recruiters) {
      if (openLeadsCount[r.id] < minLoad) {
        minLoad = openLeadsCount[r.id];
        lowestRecruiter = r;
      }
    }

    const prevName = lead.assignedRecruiterName;
    const historyEntry = {
      id: 'asg_' + Math.random().toString(36).substring(2, 8),
      assignedToId: lowestRecruiter.id,
      assignedToName: lowestRecruiter.name,
      assignedById: req.user!.id,
      assignedByName: req.user!.name,
      assignedAt: new Date().toISOString(),
      reason: 'Intelligent Workload Auto-Distribution',
    };

    db.updateLead(lead.id, {
      assignedRecruiterId: lowestRecruiter.id,
      assignedRecruiterName: lowestRecruiter.name,
      teamId: lowestRecruiter.teamId,
      assignmentHistory: [historyEntry, ...(lead.assignmentHistory || [])],
      updatedById: req.user!.id,
      updatedByName: req.user!.name,
    });

    db.logActivity({
      leadId: lead.id,
      type: 'assignment',
      title: 'Auto Distributed',
      description: `Workload-balanced from '${prevName}' to '${lowestRecruiter.name}'.`,
      performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    });

    openLeadsCount[lowestRecruiter.id]++;
    distributionSummary[lowestRecruiter.name]++;
    assignedCount++;
  }

  // Notify affected recruiters
  for (const r of recruiters) {
    const count = distributionSummary[r.name];
    if (count > 0) {
      db.addNotification({
        userId: r.id,
        title: 'Auto-Distributed Leads',
        message: `${count} leads have been allocated to you via automated workload balancing.`,
        type: 'lead_assigned',
        linkTo: '/leads',
      });
    }
  }

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'AUTO_DISTRIBUTE_LEADS',
    entity: 'Lead',
    entityId: 'multiple',
    newValue: distributionSummary,
    details: `Auto-distributed ${assignedCount} leads across ${recruiters.length} active recruiters.`,
  });

  res.json({
    message: `Successfully auto-distributed ${assignedCount} leads.`,
    distribution: distributionSummary,
  });
});

// Bulk Lead Status Update
apiRouter.post('/leads/bulk-status', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { leadIds, leadStatus, lostReason } = req.body;
  if (!Array.isArray(leadIds) || leadIds.length === 0 || !leadStatus) {
    res.status(400).json({ error: 'leadIds array and leadStatus are required.' });
    return;
  }

  let updatedCount = 0;
  for (const leadId of leadIds) {
    const lead = db.getLeadById(leadId);
    if (!lead) continue;

    if (!canAccessLead(req.user!, lead)) {
      continue;
    }

    const prevStatus = lead.leadStatus;
    const updates: Partial<Lead> = {
      leadStatus,
      updatedById: req.user!.id,
      updatedByName: req.user!.name,
    };
    if (leadStatus === 'Lost') {
      if (lostReason) updates.lostReason = lostReason;
    } else {
      updates.lostReason = undefined;
    }

    db.updateLead(lead.id, updates);

    if (prevStatus !== leadStatus) {
      db.logActivity({
        leadId: lead.id,
        type: 'status_change',
        title: `Bulk Status Changed: ${leadStatus}`,
        description: `Status changed from '${prevStatus}' to '${leadStatus}' by ${req.user!.name}.`,
        performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
      });
    }

    updatedCount++;
  }

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'BULK_STATUS_UPDATE',
    entity: 'Lead',
    entityId: 'multiple',
    newValue: { status: leadStatus, count: updatedCount },
    details: `Bulk updated status of ${updatedCount} leads to '${leadStatus}'.`,
  });

  res.json({
    message: `Successfully updated status for ${updatedCount} leads to '${leadStatus}'.`,
    updatedCount,
  });
});

// -------------------------------------------------------------
// 4. CALLING WORKSPACE & CALL DISPOSITIONS WITH CONDITIONAL VALIDATION
// -------------------------------------------------------------

apiRouter.post('/calls', authenticateToken, (req: AuthenticatedRequest, res) => {
  const {
    leadId,
    disposition,
    durationSeconds,
    notes,
    followupDate,
    followupTime,
    followupReason,
    interviewDate,
    interviewTime,
    clientId,
    jobId,
    interviewType,
    interviewLocation,
    expectedJoiningDate,
    lostReason,
  } = req.body;

  if (!leadId || !disposition) {
    res.status(400).json({ error: 'leadId and disposition are required.' });
    return;
  }

  const lead = db.getLeadById(leadId);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found.' });
    return;
  }

  if (!canAccessLead(req.user!, lead)) {
    res.status(403).json({ error: 'Forbidden: You do not have access to call this lead.' });
    return;
  }

  // --- Strict Conditional Validation (Server-side enforced!) ---
  const disp = disposition as CallDisposition;

  // 1. Callback / Call Back Later requires follow-up date, time, and reason
  if (disp === 'Callback' || disp === 'Call Back Later') {
    if (!followupDate || !followupTime || !followupReason) {
      res.status(400).json({
        error: `Conditional Validation Error: Disposition '${disp}' requires Follow-up Date, Follow-up Time, and Follow-up Reason.`,
      });
      return;
    }
  }

  // 2. Interview Scheduled requires interview date, interview time, client, and job
  if (disp === 'Interview Scheduled') {
    if (!interviewDate || !interviewTime || !clientId || !jobId) {
      res.status(400).json({
        error: `Conditional Validation Error: Disposition 'Interview Scheduled' requires Interview Date, Time, Client, and Job.`,
      });
      return;
    }
  }

  // 3. Not Interested / Job Mismatch / Location Issue requires lostReason or notes
  if (['Not Interested', 'Salary Issue', 'Location Issue', 'Job Mismatch'].includes(disp)) {
    if (!lostReason && !notes) {
      res.status(400).json({
        error: `Conditional Validation Error: Disposition '${disp}' requires a specific Reason/Remarks to prevent candidate drop-off.`,
      });
      return;
    }
  }

  const now = new Date();

  // Create Call Log
  const callLog = db.createCallLog({
    leadId: lead.id,
    recruiterId: req.user!.id,
    recruiterName: req.user!.name,
    candidateName: lead.candidateName,
    phone: lead.primaryPhone,
    disposition: disp,
    durationSeconds: Number(durationSeconds) || 0,
    notes: notes || '',
    followupDate,
    followupTime,
    followupReason,
    interviewDate,
    interviewTime,
    clientId,
    jobId,
    interviewType,
    expectedJoiningDate,
    lostReason: lostReason || notes,
  });

  // Calculate Lead Status update according to recruitment funnel
  let newLeadStatus: LeadStatus = lead.leadStatus;
  let newPriority: LeadPriority = lead.priority;
  let nextFollowupAt: string | undefined = lead.nextFollowupAt;
  let nextFollowupReason: string | undefined = lead.nextFollowupReason;

  if (disp === 'Connected – Interested') {
    newLeadStatus = 'Interested';
    newPriority = 'Hot';
  } else if (disp === 'Callback' || disp === 'Call Back Later') {
    newLeadStatus = 'Follow-up';
    nextFollowupAt = `${followupDate}T${followupTime}:00.000Z`;
    nextFollowupReason = followupReason;

    // Create Followup entity
    db.createFollowup({
      leadId: lead.id,
      candidateName: lead.candidateName,
      candidatePhone: lead.primaryPhone,
      recruiterId: req.user!.id,
      recruiterName: req.user!.name,
      teamId: req.user!.teamId,
      scheduledAt: nextFollowupAt,
      reason: followupReason,
      priority: lead.priority,
      status: 'PENDING',
    });
  } else if (disp === 'Interview Scheduled') {
    newLeadStatus = 'Interview Scheduled';
    newPriority = 'Hot';

    const client = db.getClients().find(c => c.id === clientId);
    const job = db.getJobs().find(j => j.id === jobId);

    // Create Interview entity
    const schedDate = interviewDate;
    const schedTime = interviewTime;
    const schedDateTime = `${schedDate}T${schedTime}:00.000Z`;
    
    // Check if tomorrow or today
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    let stage: InterviewStage = 'Scheduled';
    if (schedDate === todayStr) stage = 'Today';
    else if (schedDate === tomorrowStr) stage = 'Tomorrow';

    db.createInterview({
      leadId: lead.id,
      candidateName: lead.candidateName,
      candidatePhone: lead.primaryPhone,
      recruiterId: req.user!.id,
      recruiterName: req.user!.name,
      clientId: clientId || lead.clientId || '',
      clientName: client ? client.companyName : lead.clientName || 'Direct Client',
      jobId: jobId || lead.jobId || '',
      jobTitle: job ? job.positionTitle : lead.jobTitle || 'Role',
      date: schedDate,
      time: schedTime,
      scheduledAt: schedDateTime,
      location: interviewLocation || client?.location || 'Office / Virtual Link',
      interviewType: interviewType || 'Face-to-face',
      stage,
      confirmationStatus: 'Pending',
      notes: notes || '',
    });

    db.addNotification({
      userId: req.user!.id,
      title: 'Interview Scheduled',
      message: `Interview scheduled for ${lead.candidateName} with ${client?.companyName || 'Client'} on ${schedDate} at ${schedTime}.`,
      type: 'interview_tomorrow',
      linkTo: '/interviews',
    });
  } else if (['Not Interested', 'Salary Issue', 'Location Issue', 'Job Mismatch', 'Already Working'].includes(disp)) {
    newLeadStatus = 'Lost';
    newPriority = 'Cold';
  } else if (disp === 'Invalid Number') {
    newLeadStatus = 'Invalid Number';
    newPriority = 'Cold';
  } else if (['No Answer', 'Busy', 'Switched Off', 'Unreachable'].includes(disp)) {
    newLeadStatus = 'Calling';
  }

  // Update lead
  const updatedLead = db.updateLead(lead.id, {
    callAttempts: (lead.callAttempts || 0) + 1,
    lastCallAt: now.toISOString(),
    lastCallOutcome: disp,
    leadStatus: newLeadStatus,
    priority: newPriority,
    nextFollowupAt,
    nextFollowupReason,
    notesSummary: notes ? `${notes} (Call: ${disp})` : lead.notesSummary,
    lostReason: lostReason || (newLeadStatus === 'Lost' ? disp : undefined),
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  // Log activity
  db.logActivity({
    leadId: lead.id,
    type: 'call',
    title: `Call Disposition: ${disp}`,
    description: notes ? `${disp} - Notes: ${notes}` : `Call recorded with outcome: ${disp}`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    metadata: { disposition: disp, durationSeconds, callLogId: callLog.id },
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'LOG_CALL',
    entity: 'CallLog',
    entityId: callLog.id,
    newValue: { lead: lead.candidateName, disposition: disp },
    details: `Recruiter logged call with ${lead.candidateName} (${disp}).`,
  });

  res.json({
    callLog,
    lead: updatedLead,
  });
});

apiRouter.get('/calls', authenticateToken, (req: AuthenticatedRequest, res) => {
  let calls = db.getCalls();
  if (req.user!.role === 'recruiter') {
    calls = calls.filter(c => c.recruiterId === req.user!.id);
  }
  res.json({ calls });
});

// -------------------------------------------------------------
// 5. FOLLOW-UP ENGINE & ESCALATIONS
// -------------------------------------------------------------

apiRouter.get('/followups', authenticateToken, (req: AuthenticatedRequest, res) => {
  let followups = db.getFollowups();

  if (req.user!.role === 'recruiter') {
    followups = followups.filter(f => f.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    followups = followups.filter(f => f.teamId === req.user!.teamId || f.recruiterId === req.user!.id);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Map with computed aging
  const enriched = followups.map(f => {
    const sched = new Date(f.scheduledAt);
    const diffMs = now.getTime() - sched.getTime();
    const isOverdue = diffMs > 0 && f.status === 'PENDING';
    
    let overdueLabel = '';
    if (isOverdue) {
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays >= 1) {
        overdueLabel = `OVERDUE BY ${diffDays}d`;
      } else {
        overdueLabel = `OVERDUE BY ${Math.max(1, diffHours)}h`;
      }
    }

    return {
      ...f,
      isOverdue,
      overdueLabel,
      isToday: f.scheduledAt.startsWith(todayStr),
    };
  });

  res.json({ followups: enriched });
});

apiRouter.patch('/followups/:id/complete', authenticateToken, (req: AuthenticatedRequest, res) => {
  const existing = db.getFollowups().find(f => f.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Follow-up not found.' });
    return;
  }

  const { notes } = req.body;
  const updated = db.updateFollowup(existing.id, {
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    notes: notes || 'Follow-up marked completed.',
  });

  db.logActivity({
    leadId: existing.leadId,
    type: 'followup',
    title: 'Follow-up Completed',
    description: `Follow-up completed by ${req.user!.name}. Notes: ${notes || 'Completed'}`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  res.json({ followup: updated });
});

apiRouter.patch('/followups/:id/reschedule', authenticateToken, (req: AuthenticatedRequest, res) => {
  const existing = db.getFollowups().find(f => f.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Follow-up not found.' });
    return;
  }

  const { newDate, newTime, reason } = req.body;
  if (!newDate || !newTime) {
    res.status(400).json({ error: 'New follow-up date and time are required.' });
    return;
  }

  const newDateTime = `${newDate}T${newTime}:00.000Z`;
  const updated = db.updateFollowup(existing.id, {
    scheduledAt: newDateTime,
    reason: reason || existing.reason,
    status: 'PENDING',
  });

  // Update lead
  db.updateLead(existing.leadId, {
    nextFollowupAt: newDateTime,
    nextFollowupReason: reason || existing.reason,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  db.logActivity({
    leadId: existing.leadId,
    type: 'followup',
    title: 'Follow-up Rescheduled',
    description: `Rescheduled to ${newDate} at ${newTime}. Reason: ${reason || 'Recruiter follow-up call'}.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  res.json({ followup: updated });
});

// -------------------------------------------------------------
// 6. INTERVIEW MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/interviews', authenticateToken, (req: AuthenticatedRequest, res) => {
  let interviews = db.getInterviews();

  if (req.user!.role === 'recruiter') {
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  // Update stage labels dynamically for scheduled interviews
  interviews = interviews.map(i => {
    let stage = i.stage;
    if (stage === 'Scheduled' || stage === 'Today' || stage === 'Tomorrow') {
      if (i.date === todayStr) stage = 'Today';
      else if (i.date === tomorrowStr) stage = 'Tomorrow';
    }
    return { ...i, stage };
  });

  res.json({ interviews });
});

apiRouter.post('/interviews', authenticateToken, (req: AuthenticatedRequest, res) => {
  const {
    leadId,
    clientId,
    jobId,
    date,
    time,
    location,
    interviewType,
    contactPerson,
    notes,
  } = req.body;

  if (!leadId || !clientId || !jobId || !date || !time) {
    res.status(400).json({ error: 'leadId, clientId, jobId, date, and time are required.' });
    return;
  }

  const lead = db.getLeadById(leadId);
  if (!lead) {
    res.status(404).json({ error: 'Candidate lead not found.' });
    return;
  }

  const client = db.getClients().find(c => c.id === clientId);
  const job = db.getJobs().find(j => j.id === jobId);

  const schedDateTime = `${date}T${time}:00.000Z`;
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  let stage: InterviewStage = 'Scheduled';
  if (date === todayStr) stage = 'Today';
  else if (date === tomorrowStr) stage = 'Tomorrow';

  const newInterview = db.createInterview({
    leadId: lead.id,
    candidateName: lead.candidateName,
    candidatePhone: lead.primaryPhone,
    recruiterId: req.user!.id,
    recruiterName: req.user!.name,
    clientId,
    clientName: client ? client.companyName : lead.clientName || 'Client',
    jobId,
    jobTitle: job ? job.positionTitle : lead.jobTitle || 'Position',
    date,
    time,
    scheduledAt: schedDateTime,
    location: location || client?.location || 'Office / Virtual',
    interviewType: (interviewType as InterviewType) || 'Face-to-face',
    stage,
    confirmationStatus: 'Pending',
    contactPerson: contactPerson || client?.contactPerson,
    notes: notes || '',
  });

  // Update lead
  db.updateLead(lead.id, {
    leadStatus: 'Interview Scheduled',
    interviewStatus: stage,
    priority: 'Hot',
    clientId,
    clientName: client ? client.companyName : undefined,
    jobId,
    jobTitle: job ? job.positionTitle : undefined,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  db.logActivity({
    leadId: lead.id,
    type: 'interview',
    title: 'Interview Scheduled',
    description: `Interview booked with ${client?.companyName} on ${date} at ${time} (${interviewType || 'Face-to-face'}).`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  res.status(201).json({ interview: newInterview });
});

// Update interview stage (Attended, Selected, Rejected, Not Attended, Rescheduled)
apiRouter.patch('/interviews/:id/stage', authenticateToken, (req: AuthenticatedRequest, res) => {
  const existing = db.getInterviews().find(i => i.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Interview record not found.' });
    return;
  }

  const { stage, resultNotes, expectedJoiningDate, offeredSalary } = req.body;
  if (!stage) {
    res.status(400).json({ error: 'New interview stage is required.' });
    return;
  }

  const updatedInterview = db.updateInterview(existing.id, {
    stage: stage as InterviewStage,
    resultNotes: resultNotes || existing.resultNotes,
    attendanceMarkedAt: new Date().toISOString(),
  });

  // Cascade to candidate lead & joining funnel!
  const leadUpdates: Partial<Lead> = {
    interviewStatus: stage as InterviewStage,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  };

  if (stage === 'Attended') {
    leadUpdates.leadStatus = 'Interview Attended';
  } else if (stage === 'Selected') {
    leadUpdates.leadStatus = 'Selected';
    leadUpdates.joiningStatus = 'Offer Pending';
    if (expectedJoiningDate) leadUpdates.expectedJoiningDate = expectedJoiningDate;
    if (offeredSalary) leadUpdates.offeredSalary = Number(offeredSalary);

    // Create Joining Entity
    const existingJoining = db.getJoinings().find(j => j.leadId === existing.leadId);
    if (!existingJoining) {
      db.createJoining({
        leadId: existing.leadId,
        candidateName: existing.candidateName,
        candidatePhone: existing.candidatePhone,
        recruiterId: existing.recruiterId,
        recruiterName: existing.recruiterName,
        clientId: existing.clientId,
        clientName: existing.clientName,
        jobId: existing.jobId,
        jobTitle: existing.jobTitle,
        status: 'Selected',
        selectionDate: new Date().toISOString().split('T')[0],
        expectedJoiningDate,
        offeredSalary: offeredSalary ? Number(offeredSalary) : undefined,
        confirmationStatus: 'Pending',
        remarks: resultNotes || 'Candidate cleared client interview rounds.',
      });
    }
  } else if (stage === 'Rejected') {
    leadUpdates.leadStatus = 'Lost';
    leadUpdates.lostReason = `Rejected in interview: ${resultNotes || 'Client feedback'}`;
  } else if (stage === 'Not Attended') {
    leadUpdates.leadStatus = 'Calling'; // back to calling queue for reattempt
  }

  db.updateLead(existing.leadId, leadUpdates);

  db.logActivity({
    leadId: existing.leadId,
    type: 'interview',
    title: `Interview Result: ${stage}`,
    description: `Interview status marked as '${stage}'. Remarks: ${resultNotes || 'Updated by recruiter'}.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  res.json({ interview: updatedInterview });
});

apiRouter.patch('/interviews/:id/confirmation', authenticateToken, (req: AuthenticatedRequest, res) => {
  const existing = db.getInterviews().find(i => i.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Interview not found.' });
    return;
  }

  const { confirmationStatus } = req.body;
  const updated = db.updateInterview(existing.id, {
    confirmationStatus,
  });

  db.logActivity({
    leadId: existing.leadId,
    type: 'interview',
    title: `Interview Attendance Confirmation: ${confirmationStatus}`,
    description: `Candidate interview attendance confirmation marked as '${confirmationStatus}'.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  res.json({ interview: updated });
});

// -------------------------------------------------------------
// 7. JOINING MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/joinings', authenticateToken, (req: AuthenticatedRequest, res) => {
  let joinings = db.getJoinings();
  if (req.user!.role === 'recruiter') {
    joinings = joinings.filter(j => j.recruiterId === req.user!.id);
  }
  res.json({ joinings });
});

apiRouter.patch('/joinings/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const existing = db.getJoinings().find(j => j.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Joining record not found.' });
    return;
  }

  const {
    status,
    expectedJoiningDate,
    actualJoiningDate,
    offeredSalary,
    confirmationStatus,
    remarks,
  } = req.body;

  const updatedJoining = db.updateJoining(existing.id, {
    status: (status as JoiningStatus) || existing.status,
    expectedJoiningDate: expectedJoiningDate !== undefined ? expectedJoiningDate : existing.expectedJoiningDate,
    actualJoiningDate: actualJoiningDate !== undefined ? actualJoiningDate : existing.actualJoiningDate,
    offeredSalary: offeredSalary ? Number(offeredSalary) : existing.offeredSalary,
    confirmationStatus: confirmationStatus || existing.confirmationStatus,
    remarks: remarks || existing.remarks,
  });

  // Cascade to Lead status
  const leadUpdates: Partial<Lead> = {
    joiningStatus: updatedJoining!.status,
    expectedJoiningDate: updatedJoining!.expectedJoiningDate,
    actualJoiningDate: updatedJoining!.actualJoiningDate,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  };

  if (updatedJoining!.status === 'Joined') {
    leadUpdates.leadStatus = 'Joined';
    leadUpdates.actualJoiningDate = updatedJoining!.actualJoiningDate || new Date().toISOString().split('T')[0];
  } else if (updatedJoining!.status === 'Joining Confirmed') {
    leadUpdates.leadStatus = 'Joining Scheduled';
  } else if (['No Show', 'Dropped', 'Client Rejected'].includes(updatedJoining!.status)) {
    leadUpdates.leadStatus = 'Lost';
    leadUpdates.lostReason = `Joining drop: ${updatedJoining!.status} - ${remarks || ''}`;
  }

  db.updateLead(existing.leadId, leadUpdates);

  db.logActivity({
    leadId: existing.leadId,
    type: 'joining',
    title: `Joining Status: ${updatedJoining!.status}`,
    description: `Joining tracker updated to '${updatedJoining!.status}'. Expected Joining: ${updatedJoining!.expectedJoiningDate || 'Not set'}. ${remarks ? 'Remarks: ' + remarks : ''}`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'UPDATE_JOINING',
    entity: 'Joining',
    entityId: existing.id,
    newValue: updatedJoining,
    details: `Updated joining status for candidate '${existing.candidateName}' to '${updatedJoining!.status}'.`,
  });

  res.json({ joining: updatedJoining });
});

// -------------------------------------------------------------
// 8. CLIENTS & JOBS
// -------------------------------------------------------------

apiRouter.get('/clients', authenticateToken, (req, res) => {
  const clients = db.getClients();
  const leads = db.getLeads();
  const jobs = db.getJobs();

  // Compute live client-level recruitment statistics
  const enriched = clients.map(client => {
    const clientLeads = leads.filter(l => l.clientId === client.id);
    const interviews = clientLeads.filter(l => l.interviewStatus && l.interviewStatus !== 'Pending').length;
    const attended = clientLeads.filter(l => ['Attended', 'Selected', 'Rejected'].includes(l.interviewStatus || '')).length;
    const selected = clientLeads.filter(l => l.interviewStatus === 'Selected' || l.leadStatus === 'Selected' || l.leadStatus === 'Joined').length;
    const joined = clientLeads.filter(l => l.leadStatus === 'Joined' || l.joiningStatus === 'Joined').length;
    const activeJobs = jobs.filter(j => j.clientId === client.id && j.status === 'Active').length;

    return {
      ...client,
      stats: {
        candidatesSubmitted: clientLeads.length,
        interviews,
        attended,
        selected,
        joined,
        activeJobs,
      },
    };
  });

  res.json({ clients: enriched });
});

apiRouter.post('/clients', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { companyName, contactPerson, phone, email, location, paymentTerms, replacementTerms } = req.body;
  if (!companyName || !contactPerson) {
    res.status(400).json({ error: 'Company Name and Contact Person are required.' });
    return;
  }

  const newClient = db.createClient({
    companyName,
    contactPerson,
    phone: phone || '',
    email: email || '',
    location: location || '',
    paymentTerms: paymentTerms || '30 days',
    replacementTerms: replacementTerms || '90 days free replacement',
    isActive: true,
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'CREATE_CLIENT',
    entity: 'Client',
    entityId: newClient.id,
    newValue: newClient,
    details: `Added new corporate hiring client '${companyName}'.`,
  });

  res.status(201).json({ client: newClient });
});

apiRouter.patch('/clients/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const existing = db.getClients().find(c => c.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  const updated = db.updateClient(existing.id, req.body);
  res.json({ client: updated });
});

apiRouter.get('/jobs', authenticateToken, (req, res) => {
  const jobs = db.getJobs();
  const leads = db.getLeads();

  // Compute live job-level recruitment funnel statistics
  const enriched = jobs.map(job => {
    const jobLeads = leads.filter(l => l.jobId === job.id);
    const interviewed = jobLeads.filter(l => l.interviewStatus && l.interviewStatus !== 'Pending').length;
    const selected = jobLeads.filter(l => l.interviewStatus === 'Selected' || l.leadStatus === 'Selected' || l.leadStatus === 'Joined').length;
    const joined = jobLeads.filter(l => l.leadStatus === 'Joined').length;

    return {
      ...job,
      stats: {
        totalLeads: jobLeads.length,
        interviewed,
        selected,
        joined,
      },
    };
  });

  res.json({ jobs: enriched });
});

apiRouter.post('/jobs', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { clientId, positionTitle, location, salaryRange, experienceRequired, numberOfOpenings, requirements } = req.body;
  if (!clientId || !positionTitle) {
    res.status(400).json({ error: 'Client and Position Title are required.' });
    return;
  }

  const client = db.getClients().find(c => c.id === clientId);
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  const newJob = db.createJob({
    clientId,
    clientName: client.companyName,
    positionTitle,
    location: location || client.location,
    salaryRange: salaryRange || 'Negotiable',
    experienceRequired: experienceRequired || 'Any',
    numberOfOpenings: Number(numberOfOpenings) || 10,
    requirements: requirements || '',
    status: 'Active',
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'CREATE_JOB',
    entity: 'Job',
    entityId: newJob.id,
    newValue: newJob,
    details: `Created job opening '${positionTitle}' for '${client.companyName}'.`,
  });

  res.status(201).json({ job: newJob });
});

apiRouter.patch('/jobs/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const existing = db.getJobs().find(j => j.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  const updated = db.updateJob(existing.id, req.body);
  res.json({ job: updated });
});

// -------------------------------------------------------------
// 9. ANALYTICS, FUNNEL & ACTION REQUIRED
// -------------------------------------------------------------

apiRouter.get('/analytics/dashboard', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();
  let calls = db.getCalls();
  let interviews = db.getInterviews();
  let followups = db.getFollowups();
  let joinings = db.getJoinings();

  // Role filtering
  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
    calls = calls.filter(c => c.recruiterId === req.user!.id);
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
    followups = followups.filter(f => f.recruiterId === req.user!.id);
    joinings = joinings.filter(j => j.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
    // filter calls, interviews by team users
    const teamUserIds = db.getUsers().filter(u => u.teamId === req.user!.teamId || u.id === req.user!.id).map(u => u.id);
    calls = calls.filter(c => teamUserIds.includes(c.recruiterId));
    interviews = interviews.filter(i => teamUserIds.includes(i.recruiterId));
    followups = followups.filter(f => teamUserIds.includes(f.recruiterId));
    joinings = joinings.filter(j => teamUserIds.includes(j.recruiterId));
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const thisMonthPrefix = todayStr.substring(0, 7);

  // Today calculations
  const todayCalls = calls.filter(c => c.createdAt.startsWith(todayStr));
  const todayConnected = todayCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition));
  const todayInterested = todayCalls.filter(c => c.disposition === 'Connected – Interested');
  
  const todayFollowupsDue = followups.filter(f => f.scheduledAt.startsWith(todayStr) && f.status === 'PENDING').length;
  const todayFollowupsOverdue = followups.filter(f => new Date(f.scheduledAt) < now && f.status === 'PENDING').length;

  const todayInterviews = interviews.filter(i => i.date === todayStr);
  const todayAttendance = todayInterviews.filter(i => ['Attended', 'Selected', 'Rejected'].includes(i.stage)).length;
  const todaySelected = leads.filter(l => (l.leadStatus === 'Selected' || l.interviewStatus === 'Selected') && l.updatedAt.startsWith(todayStr)).length;
  const todayJoined = leads.filter(l => l.leadStatus === 'Joined' && l.actualJoiningDate === todayStr).length;

  // Monthly calculations
  const monthLeads = leads.filter(l => l.createdAt.startsWith(thisMonthPrefix)).length;
  const monthCalls = calls.filter(c => c.createdAt.startsWith(thisMonthPrefix));
  const monthConnected = monthCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition)).length;
  const monthInterested = monthCalls.filter(c => c.disposition === 'Connected – Interested').length;
  const monthInterviews = interviews.filter(i => i.date.startsWith(thisMonthPrefix)).length;
  const monthAttendance = interviews.filter(i => i.date.startsWith(thisMonthPrefix) && ['Attended', 'Selected', 'Rejected'].includes(i.stage)).length;
  const monthSelected = leads.filter(l => (l.leadStatus === 'Selected' || l.interviewStatus === 'Selected') && l.updatedAt.startsWith(thisMonthPrefix)).length;
  const monthJoined = leads.filter(l => l.leadStatus === 'Joined' && l.actualJoiningDate && l.actualJoiningDate.startsWith(thisMonthPrefix)).length;

  res.json({
    today: {
      calls: todayCalls.length,
      connected: todayConnected.length,
      interested: todayInterested.length,
      followupsDue: todayFollowupsDue,
      followupsOverdue: todayFollowupsOverdue,
      interviews: todayInterviews.length,
      attendance: todayAttendance,
      selected: todaySelected,
      joined: todayJoined,
    },
    monthly: {
      leads: monthLeads,
      calls: monthCalls.length,
      connected: monthConnected,
      interested: monthInterested,
      interviews: monthInterviews,
      attendance: monthAttendance,
      selected: monthSelected,
      joined: monthJoined,
    },
    userTargets: {
      dailyCallTarget: req.user!.role === 'recruiter' ? db.getUserById(req.user!.id)?.dailyCallTarget || 60 : 60,
      dailyConnectedTarget: req.user!.role === 'recruiter' ? db.getUserById(req.user!.id)?.dailyConnectedTarget || 30 : 30,
      dailyLineupTarget: req.user!.role === 'recruiter' ? db.getUserById(req.user!.id)?.dailyLineupTarget || 5 : 5,
      monthlyJoiningTarget: req.user!.role === 'recruiter' ? db.getUserById(req.user!.id)?.monthlyJoiningTarget || 8 : 8,
    }
  });
});

// Recruitment Funnel: Leads → Called → Connected → Interested → Interview → Attended → Selected → Joined
apiRouter.get('/analytics/funnel', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();

  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
  }

  const { recruiterId, clientId, jobId, source } = req.query as Record<string, string>;
  if (recruiterId) leads = leads.filter(l => l.assignedRecruiterId === recruiterId);
  if (clientId) leads = leads.filter(l => l.clientId === clientId);
  if (jobId) leads = leads.filter(l => l.jobId === jobId);
  if (source) leads = leads.filter(l => l.leadSource === source);

  const totalLeads = leads.length;
  const called = leads.filter(l => l.callAttempts > 0).length;
  const connected = leads.filter(l => l.lastCallOutcome && !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(l.lastCallOutcome)).length;
  const interested = leads.filter(l => ['Interested', 'Interview Scheduled', 'Interview Attended', 'Selected', 'Joining Scheduled', 'Joined'].includes(l.leadStatus)).length;
  const interview = leads.filter(l => !!l.interviewStatus || ['Interview Scheduled', 'Interview Attended', 'Selected', 'Joining Scheduled', 'Joined'].includes(l.leadStatus)).length;
  const attended = leads.filter(l => ['Attended', 'Selected', 'Rejected'].includes(l.interviewStatus || '') || ['Interview Attended', 'Selected', 'Joining Scheduled', 'Joined'].includes(l.leadStatus)).length;
  const selected = leads.filter(l => l.interviewStatus === 'Selected' || ['Selected', 'Joining Scheduled', 'Joined'].includes(l.leadStatus)).length;
  const joined = leads.filter(l => l.leadStatus === 'Joined' || l.joiningStatus === 'Joined').length;

  res.json({
    funnel: [
      { stage: 'Leads', count: totalLeads, percentage: 100 },
      { stage: 'Called', count: called, percentage: totalLeads ? Math.round((called / totalLeads) * 100) : 0 },
      { stage: 'Connected', count: connected, percentage: totalLeads ? Math.round((connected / totalLeads) * 100) : 0 },
      { stage: 'Interested', count: interested, percentage: totalLeads ? Math.round((interested / totalLeads) * 100) : 0 },
      { stage: 'Interview', count: interview, percentage: totalLeads ? Math.round((interview / totalLeads) * 100) : 0 },
      { stage: 'Attended', count: attended, percentage: totalLeads ? Math.round((attended / totalLeads) * 100) : 0 },
      { stage: 'Selected', count: selected, percentage: totalLeads ? Math.round((selected / totalLeads) * 100) : 0 },
      { stage: 'Joined', count: joined, percentage: totalLeads ? Math.round((joined / totalLeads) * 100) : 0 },
    ],
  });
});

// Recruiter Comparison & Target Tracking
apiRouter.get('/analytics/recruiter-performance', authenticateToken, requireRole('admin', 'team_leader'), (req: AuthenticatedRequest, res) => {
  let recruiters = db.getUsers().filter(u => u.role === 'recruiter');
  if (req.user!.role === 'team_leader') {
    recruiters = recruiters.filter(u => u.teamId === req.user!.teamId);
  }

  const calls = db.getCalls();
  const leads = db.getLeads();
  const interviews = db.getInterviews();
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthPrefix = todayStr.substring(0, 7);

  const performance = recruiters.map(r => {
    const todayCalls = calls.filter(c => c.recruiterId === r.id && c.createdAt.startsWith(todayStr));
    const todayConnected = todayCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition)).length;
    const todayLineups = interviews.filter(i => i.recruiterId === r.id && i.createdAt.startsWith(todayStr)).length;
    const monthJoined = leads.filter(l => l.assignedRecruiterId === r.id && l.leadStatus === 'Joined' && l.actualJoiningDate && l.actualJoiningDate.startsWith(thisMonthPrefix)).length;

    const callProgress = Math.min(100, Math.round((todayCalls.length / (r.dailyCallTarget || 1)) * 100));
    const connectedProgress = Math.min(100, Math.round((todayConnected / (r.dailyConnectedTarget || 1)) * 100));
    const lineupProgress = Math.min(100, Math.round((todayLineups / (r.dailyLineupTarget || 1)) * 100));
    const joiningProgress = Math.min(100, Math.round((monthJoined / (r.monthlyJoiningTarget || 1)) * 100));

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      teamName: r.teamName,
      isActive: r.isActive,
      todayCalls: { actual: todayCalls.length, target: r.dailyCallTarget, progress: callProgress },
      todayConnected: { actual: todayConnected, target: r.dailyConnectedTarget, progress: connectedProgress },
      todayLineups: { actual: todayLineups, target: r.dailyLineupTarget, progress: lineupProgress },
      monthJoinings: { actual: monthJoined, target: r.monthlyJoiningTarget, progress: joiningProgress },
    };
  });

  res.json({ performance });
});

// Operational Exception Dashboard: ACTION REQUIRED
apiRouter.get('/analytics/action-required', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();
  let followups = db.getFollowups();
  let interviews = db.getInterviews();
  let joinings = db.getJoinings();

  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
    followups = followups.filter(f => f.recruiterId === req.user!.id);
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
    joinings = joinings.filter(j => j.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
    followups = followups.filter(f => f.teamId === req.user!.teamId || f.recruiterId === req.user!.id);
  }

  const now = new Date();
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  // 1. Overdue followups
  const overdueFollowups = followups
    .filter(f => new Date(f.scheduledAt) < now && f.status === 'PENDING')
    .map(f => {
      const diffHours = Math.floor((now.getTime() - new Date(f.scheduledAt).getTime()) / 3600000);
      return {
        ...f,
        delayLabel: diffHours >= 24 ? `${Math.floor(diffHours / 24)}d overdue` : `${Math.max(1, diffHours)}h overdue`,
      };
    });

  // 2. Never called leads
  const neverCalledLeads = leads.filter(l => l.callAttempts === 0 && !['Joined', 'Lost'].includes(l.leadStatus));

  // 3. Tomorrow interviews awaiting confirmation
  const unconfirmedTomorrowInterviews = interviews.filter(i => i.date === tomorrowStr && i.confirmationStatus !== 'Confirmed');

  // 4. Selected candidates without expected joining date
  const selectedMissingJoiningDate = leads.filter(l =>
    (l.leadStatus === 'Selected' || l.interviewStatus === 'Selected') &&
    !l.expectedJoiningDate &&
    l.leadStatus !== 'Joined'
  );

  // 5. Unassigned leads (Admin / TL)
  const unassignedLeads = leads.filter(l => !l.assignedRecruiterId || l.assignedRecruiterName === 'Unassigned');

  // 6. Stale leads (Untouched > 7 days)
  const staleLeads = leads.filter(l => {
    if (['Joined', 'Lost', 'Invalid Number'].includes(l.leadStatus)) return false;
    const diffDays = Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / 86400000);
    return diffDays >= 7;
  });

  res.json({
    summary: {
      overdueFollowupsCount: overdueFollowups.length,
      neverCalledCount: neverCalledLeads.length,
      unconfirmedInterviewsCount: unconfirmedTomorrowInterviews.length,
      selectedMissingJoiningDateCount: selectedMissingJoiningDate.length,
      unassignedLeadsCount: unassignedLeads.length,
      staleLeadsCount: staleLeads.length,
    },
    overdueFollowups,
    neverCalledLeads,
    unconfirmedTomorrowInterviews,
    selectedMissingJoiningDate,
    unassignedLeads,
    staleLeads,
    staleUntouchedLeads: staleLeads,
    underperformingRecruiters: [],
  });
});

apiRouter.get('/action-required', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();
  let followups = db.getFollowups();
  let interviews = db.getInterviews();
  let joinings = db.getJoinings();

  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
    followups = followups.filter(f => f.recruiterId === req.user!.id);
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
    joinings = joinings.filter(j => j.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
    followups = followups.filter(f => f.teamId === req.user!.teamId || f.recruiterId === req.user!.id);
  }

  const now = new Date();
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  const overdueFollowups = followups
    .filter(f => new Date(f.scheduledAt) < now && f.status === 'PENDING')
    .map(f => {
      const diffHours = Math.floor((now.getTime() - new Date(f.scheduledAt).getTime()) / 3600000);
      return {
        ...f,
        delayLabel: diffHours >= 24 ? `${Math.floor(diffHours / 24)}d overdue` : `${Math.max(1, diffHours)}h overdue`,
        overdueLabel: diffHours >= 24 ? `${Math.floor(diffHours / 24)}d overdue` : `${Math.max(1, diffHours)}h overdue`,
      };
    });

  const neverCalledLeads = leads.filter(l => l.callAttempts === 0 && !['Joined', 'Lost'].includes(l.leadStatus));
  const unconfirmedTomorrowInterviews = interviews.filter(i => i.date === tomorrowStr && i.confirmationStatus !== 'Confirmed');
  const selectedWithoutJoiningDate = leads.filter(l =>
    (l.leadStatus === 'Selected' || l.interviewStatus === 'Selected') &&
    !l.expectedJoiningDate &&
    l.leadStatus !== 'Joined'
  );
  const unassignedLeads = leads.filter(l => !l.assignedRecruiterId || l.assignedRecruiterName === 'Unassigned');
  const staleLeads = leads.filter(l => {
    if (['Joined', 'Lost', 'Invalid Number'].includes(l.leadStatus)) return false;
    const diffDays = Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / 86400000);
    return diffDays >= 7;
  });

  const recruiters = db.getUsers().filter(u => u.role === 'recruiter' && u.isActive);
  const calls = db.getCalls();
  const todayStr = now.toISOString().split('T')[0];
  const underperformingRecruiters = recruiters
    .map(r => {
      const actualCalls = calls.filter(c => c.recruiterId === r.id && c.createdAt.startsWith(todayStr)).length;
      return {
        id: r.id,
        name: r.name,
        teamName: r.teamName,
        actualCalls,
        targetCalls: r.dailyCallTarget || 60,
      };
    })
    .filter(r => r.actualCalls < Math.floor(r.targetCalls * 0.5));

  res.json({
    summary: {
      overdueFollowupsCount: overdueFollowups.length,
      neverCalledCount: neverCalledLeads.length,
      unconfirmedInterviewsCount: unconfirmedTomorrowInterviews.length,
      selectedMissingJoiningDateCount: selectedWithoutJoiningDate.length,
      unassignedLeadsCount: unassignedLeads.length,
      staleLeadsCount: staleLeads.length,
    },
    overdueFollowups,
    neverCalledLeads,
    unconfirmedTomorrowInterviews,
    selectedWithoutJoiningDate,
    unassignedLeads,
    staleUntouchedLeads: staleLeads,
    staleLeads,
    underperformingRecruiters,
  });
});

// Comprehensive Dashboard Stats API for DashboardPage
apiRouter.get('/dashboard/stats', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();
  let calls = db.getCalls();
  let interviews = db.getInterviews();
  let followups = db.getFollowups();
  let joinings = db.getJoinings();

  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
    calls = calls.filter(c => c.recruiterId === req.user!.id);
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
    followups = followups.filter(f => f.recruiterId === req.user!.id);
    joinings = joinings.filter(j => j.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
    const teamUserIds = db.getUsers().filter(u => u.teamId === req.user!.teamId || u.id === req.user!.id).map(u => u.id);
    calls = calls.filter(c => teamUserIds.includes(c.recruiterId));
    interviews = interviews.filter(i => teamUserIds.includes(i.recruiterId));
    followups = followups.filter(f => teamUserIds.includes(f.recruiterId));
    joinings = joinings.filter(j => teamUserIds.includes(j.recruiterId));
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const thisMonthPrefix = todayStr.substring(0, 7);

  const todayCalls = calls.filter(c => c.createdAt.startsWith(todayStr));
  const todayConnected = todayCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition));
  const todayInterested = todayCalls.filter(c => c.disposition === 'Connected – Interested');
  const todayFollowupsDue = followups.filter(f => f.scheduledAt.startsWith(todayStr) && f.status === 'PENDING').length;
  const todayFollowupsOverdue = followups.filter(f => new Date(f.scheduledAt) < now && f.status === 'PENDING').length;
  const todayInterviews = interviews.filter(i => i.date === todayStr);
  const todayAttendance = todayInterviews.filter(i => ['Attended', 'Selected', 'Rejected'].includes(i.stage)).length;
  const todaySelected = leads.filter(l => (l.leadStatus === 'Selected' || l.interviewStatus === 'Selected') && l.updatedAt.startsWith(todayStr)).length;
  const todayJoined = leads.filter(l => l.leadStatus === 'Joined' && l.actualJoiningDate === todayStr).length;

  const monthLeads = leads.filter(l => l.createdAt.startsWith(thisMonthPrefix)).length;
  const monthCalls = calls.filter(c => c.createdAt.startsWith(thisMonthPrefix));
  const monthConnected = monthCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition)).length;
  const monthInterested = monthCalls.filter(c => c.disposition === 'Connected – Interested').length;
  const monthInterviews = interviews.filter(i => i.date.startsWith(thisMonthPrefix)).length;
  const monthAttendance = interviews.filter(i => i.date.startsWith(thisMonthPrefix) && ['Attended', 'Selected', 'Rejected'].includes(i.stage)).length;
  const monthSelected = leads.filter(l => (l.leadStatus === 'Selected' || l.interviewStatus === 'Selected') && l.updatedAt.startsWith(thisMonthPrefix)).length;
  const monthJoined = leads.filter(l => l.leadStatus === 'Joined' && l.actualJoiningDate && l.actualJoiningDate.startsWith(thisMonthPrefix)).length;

  const activeRecruiters = db.getUsers().filter(u => u.role === 'recruiter');
  const recruiterStats = activeRecruiters.map(r => {
    const rCalls = db.getCalls().filter(c => c.recruiterId === r.id && c.createdAt.startsWith(todayStr));
    const rConn = rCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition)).length;
    const rLineups = db.getInterviews().filter(i => i.recruiterId === r.id && i.createdAt.startsWith(todayStr)).length;
    const rJoinings = db.getLeads().filter(l => l.assignedRecruiterId === r.id && l.leadStatus === 'Joined' && l.actualJoiningDate && l.actualJoiningDate.startsWith(thisMonthPrefix)).length;

    return {
      id: r.id,
      name: r.name,
      teamName: r.teamName,
      actualDailyCalls: rCalls.length,
      dailyCallTarget: r.dailyCallTarget || 60,
      actualDailyConnected: rConn,
      dailyConnectedTarget: r.dailyConnectedTarget || 30,
      actualDailyLineups: rLineups,
      dailyLineupTarget: r.dailyLineupTarget || 5,
      actualMonthlyJoinings: rJoinings,
      monthlyJoiningTarget: r.monthlyJoiningTarget || 8,
    };
  });

  res.json({
    today: {
      calls: todayCalls.length,
      connected: todayConnected.length,
      interested: todayInterested.length,
      followupsDue: todayFollowupsDue,
      followupsOverdue: todayFollowupsOverdue,
      interviews: todayInterviews.length,
      attendance: todayAttendance,
      selected: todaySelected,
      joined: todayJoined,
    },
    monthly: {
      leads: leads.length,
      called: leads.filter(l => l.callAttempts > 0).length,
      connected: monthConnected,
      interested: monthInterested,
      interviews: monthInterviews,
      attendance: monthAttendance,
      selected: monthSelected,
      joined: monthJoined,
    },
    recruiters: recruiterStats,
    exceptions: {
      overdueFollowups: todayFollowupsOverdue,
      neverCalledLeads: leads.filter(l => l.callAttempts === 0 && !['Joined', 'Lost'].includes(l.leadStatus)).length,
      selectedWithoutJoiningDate: leads.filter(l => l.leadStatus === 'Selected' && !l.expectedJoiningDate).length,
      unassignedLeads: leads.filter(l => !l.assignedRecruiterId || l.assignedRecruiterName === 'Unassigned').length,
    }
  });
});

// Dedicated My Day Endpoint
apiRouter.get('/my-day', authenticateToken, (req: AuthenticatedRequest, res) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  let followups = db.getFollowups();
  let interviews = db.getInterviews();
  let joinings = db.getJoinings();

  if (req.user!.role === 'recruiter') {
    followups = followups.filter(f => f.recruiterId === req.user!.id);
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
    joinings = joinings.filter(j => j.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    followups = followups.filter(f => f.teamId === req.user!.teamId || f.recruiterId === req.user!.id);
  }

  const overdueFollowups = followups
    .filter(f => new Date(f.scheduledAt) < now && f.status === 'PENDING')
    .map(f => {
      const diffHours = Math.floor((now.getTime() - new Date(f.scheduledAt).getTime()) / 3600000);
      return {
        ...f,
        overdueLabel: diffHours >= 24 ? `OVERDUE BY ${Math.floor(diffHours / 24)}d` : `OVERDUE BY ${Math.max(1, diffHours)}h`,
      };
    });

  const todayFollowups = followups.filter(f => f.scheduledAt.startsWith(todayStr) && new Date(f.scheduledAt) >= now && f.status === 'PENDING');
  const interviewsNeedingConfirmation = interviews.filter(i => (i.date === todayStr || i.date === tomorrowStr) && i.confirmationStatus !== 'Confirmed');
  const pendingAttendance = interviews.filter(i => i.date === todayStr && !['Attended', 'Not Attended', 'Selected', 'Rejected'].includes(i.stage));
  const upcomingJoinings = joinings.filter(j => j.expectedJoiningDate && j.expectedJoiningDate >= todayStr && j.status !== 'Joined');

  const total = overdueFollowups.length + todayFollowups.length + interviewsNeedingConfirmation.length + upcomingJoinings.length;
  const completed = followups.filter(f => f.status === 'COMPLETED' && f.completedAt && f.completedAt.startsWith(todayStr)).length;
  const percentage = total + completed > 0 ? Math.round((completed / (total + completed)) * 100) : 100;

  res.json({
    overdueFollowups,
    todayFollowups,
    interviewsNeedingConfirmation,
    pendingAttendance,
    upcomingJoinings,
    progress: {
      total: total + completed,
      completed,
      percentage,
    },
  });
});

// Reports Funnel API
apiRouter.get('/reports/funnel', authenticateToken, (req: AuthenticatedRequest, res) => {
  let leads = db.getLeads();
  let calls = db.getCalls();
  let interviews = db.getInterviews();
  let followups = db.getFollowups();

  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
    calls = calls.filter(c => c.recruiterId === req.user!.id);
    interviews = interviews.filter(i => i.recruiterId === req.user!.id);
    followups = followups.filter(f => f.recruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
  }

  const now = new Date();
  const totalLeads = leads.length;
  const called = leads.filter(l => l.callAttempts > 0).length;
  const connected = calls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition)).length;
  const interested = leads.filter(l => ['Interested', 'Interview Scheduled', 'Interview Attended', 'Selected', 'Joining Scheduled', 'Joined'].includes(l.leadStatus)).length;
  const interviewCount = interviews.length;
  const attended = interviews.filter(i => ['Attended', 'Selected', 'Rejected'].includes(i.stage)).length;
  const selected = leads.filter(l => l.leadStatus === 'Selected' || l.interviewStatus === 'Selected' || l.leadStatus === 'Joined').length;
  const joined = leads.filter(l => l.leadStatus === 'Joined' || l.joiningStatus === 'Joined').length;

  // Aging calculation
  let under1Day = 0;
  let days1to3 = 0;
  let days4to7 = 0;
  let days15Plus = 0;

  leads.forEach(l => {
    const diffDays = Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 86400000);
    if (diffDays < 1) under1Day++;
    else if (diffDays <= 3) days1to3++;
    else if (diffDays <= 7) days4to7++;
    else days15Plus++;
  });

  const missedFollowups = followups
    .filter(f => new Date(f.scheduledAt) < now && f.status === 'PENDING')
    .map(f => {
      const diffHours = Math.floor((now.getTime() - new Date(f.scheduledAt).getTime()) / 3600000);
      return {
        id: f.id,
        recruiter: f.recruiterName,
        candidate: f.candidateName,
        phone: f.candidatePhone,
        scheduledAt: f.scheduledAt,
        delay: diffHours >= 24 ? `${Math.floor(diffHours / 24)}d delay` : `${Math.max(1, diffHours)}h delay`,
        priority: f.priority,
        reason: f.reason,
      };
    });

  const todayStr = now.toISOString().split('T')[0];
  const thisMonthPrefix = todayStr.substring(0, 7);
  const activeRecruiters = db.getUsers().filter(u => u.role === 'recruiter');
  const recruiterStats = activeRecruiters.map(r => {
    const rCalls = db.getCalls().filter(c => c.recruiterId === r.id && c.createdAt.startsWith(todayStr));
    const rConn = rCalls.filter(c => !['No Answer', 'Busy', 'Switched Off', 'Unreachable', 'Invalid Number'].includes(c.disposition)).length;
    const rLineups = db.getInterviews().filter(i => i.recruiterId === r.id && i.createdAt.startsWith(todayStr)).length;
    const rJoinings = db.getLeads().filter(l => l.assignedRecruiterId === r.id && l.leadStatus === 'Joined' && l.actualJoiningDate && l.actualJoiningDate.startsWith(thisMonthPrefix)).length;

    return {
      id: r.id,
      name: r.name,
      actualDailyCalls: rCalls.length,
      dailyCallTarget: r.dailyCallTarget || 60,
      actualDailyConnected: rConn,
      dailyConnectedTarget: r.dailyConnectedTarget || 30,
      actualDailyLineups: rLineups,
      actualMonthlyJoinings: rJoinings,
    };
  });

  res.json({
    funnel: {
      totalLeads,
      called,
      connected,
      interested,
      interviews: interviewCount,
      attended,
      selected,
      joined,
    },
    aging: {
      under1Day,
      days1to3,
      days4to7,
      days15Plus,
    },
    missedFollowups,
    recruiters: recruiterStats,
  });
});

// Duplicates List
apiRouter.get('/duplicates', authenticateToken, requireRole('admin'), (req, res) => {
  const leads = db.getLeads();
  const phoneMap = new Map<string, Lead[]>();

  leads.forEach(l => {
    if (l.normalizedPhone) {
      const list = phoneMap.get(l.normalizedPhone) || [];
      list.push(l);
      phoneMap.set(l.normalizedPhone, list);
    }
  });

  const duplicateSets: any[] = [];
  phoneMap.forEach((leadList, phone) => {
    if (leadList.length > 1) {
      duplicateSets.push({
        normalizedPhone: phone,
        leads: leadList,
      });
    }
  });

  res.json({ duplicateSets });
});

// Import Wizard endpoints
apiRouter.post('/leads/import/validate', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { rows, mapping } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No rows provided' });
    return;
  }

  const validRows: any[] = [];
  const duplicateRows: any[] = [];
  const invalidRows: any[] = [];
  const seenPhones = new Set<string>();

  rows.forEach((r, idx) => {
    const candidateName = r[mapping.candidateName] || '';
    const rawPhone = r[mapping.primaryPhone] || '';
    const email = r[mapping.email] || '';
    const city = r[mapping.city] || 'Pune';
    const experience = r[mapping.experience] || '';
    const currentSalary = r[mapping.currentSalary] ? Number(r[mapping.currentSalary]) : undefined;
    const expectedSalary = r[mapping.expectedSalary] ? Number(r[mapping.expectedSalary]) : undefined;
    const leadSource = r[mapping.leadSource] || 'Bulk Upload';
    const priority = (r[mapping.priority] as LeadPriority) || 'Medium';

    if (!candidateName.trim()) {
      invalidRows.push({ rowIndex: idx + 1, data: r, error: 'Candidate name is required' });
      return;
    }

    const norm = normalizePhoneNumber(rawPhone);
    if (!norm.isValid || norm.status === 'INVALID') {
      invalidRows.push({ rowIndex: idx + 1, data: { ...r, candidateName, primaryPhone: rawPhone, city, leadSource }, error: `Invalid phone number '${rawPhone}'` });
      return;
    }

    // Check duplicate in file
    if (seenPhones.has(norm.normalized)) {
      duplicateRows.push({
        rowIndex: idx + 1,
        data: { candidateName, primaryPhone: rawPhone, city, leadSource },
        duplicateReason: 'Duplicate phone within the same import file',
      });
      return;
    }
    seenPhones.add(norm.normalized);

    // Check duplicate in CRM
    const existing = db.findLeadByPhone(norm.normalized);
    if (existing) {
      duplicateRows.push({
        rowIndex: idx + 1,
        data: { candidateName, primaryPhone: rawPhone, city, leadSource },
        duplicateReason: `Matches existing candidate '${existing.candidateName}' in CRM`,
      });
      return;
    }

    validRows.push({
      rowIndex: idx + 1,
      data: {
        candidateName,
        primaryPhone: rawPhone,
        normalizedPhone: norm.normalized,
        phoneStatus: norm.status,
        email,
        city,
        experience,
        currentSalary,
        expectedSalary,
        leadSource,
        priority,
      },
    });
  });

  res.json({
    validRows,
    duplicateRows,
    invalidRows,
  });
});

apiRouter.post('/leads/import/commit', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { rows, mapping, skipDuplicates } = req.body;
  if (!Array.isArray(rows)) {
    res.status(400).json({ error: 'Rows array required' });
    return;
  }

  let importedCount = 0;
  let skippedDuplicates = 0;
  let invalidCount = 0;
  const seenPhones = new Set<string>();

  rows.forEach(r => {
    const candidateName = r[mapping.candidateName] || '';
    const rawPhone = r[mapping.primaryPhone] || '';
    const city = r[mapping.city] || 'Pune';

    if (!candidateName.trim() || !rawPhone.trim()) {
      invalidCount++;
      return;
    }

    const norm = normalizePhoneNumber(rawPhone);
    if (!norm.isValid) {
      invalidCount++;
      return;
    }

    const isDup = seenPhones.has(norm.normalized) || !!db.findLeadByPhone(norm.normalized);
    if (isDup) {
      if (skipDuplicates) {
        skippedDuplicates++;
        return;
      }
    }
    seenPhones.add(norm.normalized);

    db.createLead({
      candidateName,
      primaryPhone: rawPhone,
      normalizedPhone: norm.normalized,
      phoneStatus: norm.status,
      email: r[mapping.email] || undefined,
      city,
      experience: r[mapping.experience] || undefined,
      currentSalary: r[mapping.currentSalary] ? Number(r[mapping.currentSalary]) : undefined,
      expectedSalary: r[mapping.expectedSalary] ? Number(r[mapping.expectedSalary]) : undefined,
      leadSource: r[mapping.leadSource] || 'Bulk Upload',
      assignedRecruiterId: req.user!.role === 'recruiter' ? req.user!.id : '',
      assignedRecruiterName: req.user!.role === 'recruiter' ? req.user!.name : 'Unassigned',
      originalRecruiterId: req.user!.role === 'recruiter' ? req.user!.id : '',
      originalRecruiterName: req.user!.role === 'recruiter' ? req.user!.name : 'Unassigned',
      priority: (r[mapping.priority] as LeadPriority) || 'Medium',
      leadStatus: 'New',
      callAttempts: 0,
      notesSummary: 'Imported via CSV Wizard',
      assignmentHistory: [],
      updatedById: req.user!.id,
      updatedByName: req.user!.name,
    });

    importedCount++;
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'BULK_IMPORT',
    entity: 'Lead',
    entityId: 'multiple',
    newValue: { importedCount, skippedDuplicates, invalidCount },
    details: `Imported ${importedCount} candidates via CSV Import Wizard.`,
  });

  res.json({
    totalRows: rows.length,
    importedCount,
    skippedDuplicates,
    invalidCount,
  });
});

apiRouter.get('/leads/export', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'recruiter' && req.user!.permissions?.canExportData === false) {
    res.status(403).json({ error: 'Access Denied: Candidate data export is restricted by your administrator.' });
    return;
  }

  let leads = db.getLeads();

  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
  }

  const { priority, leadStatus } = req.query as Record<string, string>;
  if (priority) leads = leads.filter(l => l.priority === priority);
  if (leadStatus) leads = leads.filter(l => l.leadStatus === leadStatus);

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = ['ID', 'Candidate Name', 'Phone', 'City', 'Source', 'Priority', 'Status', 'Recruiter', 'Created Date'];
  const rows = leads.map(l => [
    escapeCsv(l.id),
    escapeCsv(l.candidateName),
    escapeCsv(l.primaryPhone),
    escapeCsv(l.city),
    escapeCsv(l.leadSource),
    escapeCsv(l.priority),
    escapeCsv(l.leadStatus),
    escapeCsv(l.assignedRecruiterName),
    escapeCsv(l.createdAt),
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads_export.csv"');
  res.send(csvContent);
});

apiRouter.post('/notifications/mark-all-read', authenticateToken, (req: AuthenticatedRequest, res) => {
  const count = db.markAllNotificationsRead(req.user!.id);
  res.json({ markedRead: count });
});

// -------------------------------------------------------------
// 10. CSV / XLSX IMPORT WIZARD & DUPLICATE DETECTION
// -------------------------------------------------------------

apiRouter.post('/import/validate', authenticateToken, requireRole('admin', 'team_leader'), (req: AuthenticatedRequest, res) => {
  const { rawData, mapping } = req.body;
  // rawData: Array of objects representing rows parsed from CSV
  // mapping: { candidateNameCol, phoneCol, altPhoneCol, emailCol, cityCol, experienceCol, salaryCol, clientCol, jobCol, sourceCol }

  if (!Array.isArray(rawData) || rawData.length === 0) {
    res.status(400).json({ error: 'No data rows provided for validation.' });
    return;
  }

  const nameKey = mapping?.candidateNameCol || 'Name';
  const phoneKey = mapping?.phoneCol || 'Phone';
  const altPhoneKey = mapping?.altPhoneCol || 'AltPhone';
  const emailKey = mapping?.emailCol || 'Email';
  const cityKey = mapping?.cityCol || 'City';
  const expKey = mapping?.experienceCol || 'Experience';
  const salaryKey = mapping?.salaryCol || 'Salary';
  const clientKey = mapping?.clientCol || 'Client';
  const jobKey = mapping?.jobCol || 'Job';
  const sourceKey = mapping?.sourceCol || 'Source';

  const validRows: any[] = [];
  const warningRows: any[] = [];
  const duplicateRows: any[] = [];
  const invalidRows: any[] = [];

  const seenInFile = new Set<string>();

  rawData.forEach((row: Record<string, any>, idx: number) => {
    const rawName = String(row[nameKey] || '').trim();
    const rawPhone = String(row[phoneKey] || '').trim();
    const rawAltPhone = String(row[altPhoneKey] || '').trim();
    const rawEmail = String(row[emailKey] || '').trim();
    const rawCity = String(row[cityKey] || '').trim();
    const rawExp = String(row[expKey] || '').trim();
    const rawSalary = String(row[salaryKey] || '').trim();
    const rawClient = String(row[clientKey] || '').trim();
    const rawJob = String(row[jobKey] || '').trim();
    const rawSource = String(row[sourceKey] || 'Bulk Upload').trim();

    const rowNum = idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rawName) {
      errors.push('Candidate name is missing');
    }

    if (!rawPhone) {
      errors.push('Primary phone number is missing');
    }

    const phoneNorm = normalizePhoneNumber(rawPhone);
    if (rawPhone && !phoneNorm.isValid && phoneNorm.status === 'INVALID') {
      errors.push(`Invalid phone format: '${rawPhone}'`);
    }

    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      warnings.push(`Suspicious email format: '${rawEmail}'`);
    }

    if (!rawCity) {
      warnings.push('City is missing (will default to Pune)');
    }

    // Check duplicate in current file
    let isInternalDup = false;
    if (phoneNorm.normalized) {
      if (seenInFile.has(phoneNorm.normalized)) {
        isInternalDup = true;
        warnings.push('Duplicate phone inside this file');
      } else {
        seenInFile.add(phoneNorm.normalized);
      }
    }

    // Check duplicate in CRM
    const crmDup = phoneNorm.normalized ? db.findLeadByPhone(phoneNorm.normalized) : undefined;
    if (crmDup) {
      warnings.push(`Existing candidate in CRM: '${crmDup.candidateName}' (assigned to ${crmDup.assignedRecruiterName})`);
    }

    const processedRow = {
      rowIndex: rowNum,
      candidateName: rawName || 'Unknown',
      primaryPhone: rawPhone,
      normalizedPhone: phoneNorm.normalized,
      phoneStatus: phoneNorm.status,
      alternatePhone: rawAltPhone,
      email: rawEmail,
      city: rawCity || 'Pune',
      experience: rawExp,
      currentSalary: Number(rawSalary) || undefined,
      clientName: rawClient,
      jobTitle: rawJob,
      leadSource: rawSource || 'CSV Import',
      errors,
      warnings,
      isCrmDuplicate: !!crmDup,
      existingLeadId: crmDup?.id,
      existingRecruiter: crmDup?.assignedRecruiterName,
    };

    if (errors.length > 0) {
      invalidRows.push(processedRow);
    } else if (crmDup || isInternalDup) {
      duplicateRows.push(processedRow);
    } else if (warnings.length > 0) {
      warningRows.push(processedRow);
    } else {
      validRows.push(processedRow);
    }
  });

  res.json({
    summary: {
      totalRows: rawData.length,
      validCount: validRows.length,
      warningCount: warningRows.length,
      duplicateCount: duplicateRows.length,
      invalidCount: invalidRows.length,
    },
    validRows: validRows.slice(0, 50),
    warningRows: warningRows.slice(0, 50),
    duplicateRows: duplicateRows.slice(0, 50),
    invalidRows: invalidRows.slice(0, 50),
  });
});

apiRouter.post('/import/commit', authenticateToken, requireRole('admin', 'team_leader'), (req: AuthenticatedRequest, res) => {
  const { rows, handleDuplicates, assignedRecruiterId } = req.body;
  // handleDuplicates: 'SKIP' | 'IMPORT_ANYWAY' | 'FLAG_FOR_REVIEW'

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No validated rows provided to import.' });
    return;
  }

  let recruiterName = 'Unassigned';
  let targetRecruiter = assignedRecruiterId ? db.getUserById(assignedRecruiterId) : undefined;
  if (targetRecruiter) {
    recruiterName = targetRecruiter.name;
  }

  let imported = 0;
  let skipped = 0;
  let duplicatesHandled = 0;
  let failed = 0;

  for (const row of rows) {
    if (row.errors && row.errors.length > 0) {
      failed++;
      continue;
    }

    if (row.isCrmDuplicate) {
      if (handleDuplicates === 'SKIP') {
        skipped++;
        continue;
      }
      duplicatesHandled++;
    }

    try {
      const newLead = db.createLead({
        candidateName: row.candidateName,
        primaryPhone: row.primaryPhone,
        normalizedPhone: row.normalizedPhone,
        alternatePhone: row.alternatePhone,
        phoneStatus: row.phoneStatus || 'VERIFIED',
        email: row.email,
        city: row.city || 'Pune',
        experience: row.experience,
        currentSalary: row.currentSalary,
        leadSource: row.leadSource || 'Bulk Import',
        assignedRecruiterId: targetRecruiter?.id || '',
        assignedRecruiterName: recruiterName,
        originalRecruiterId: targetRecruiter?.id || '',
        originalRecruiterName: recruiterName,
        teamId: targetRecruiter?.teamId,
        priority: row.isCrmDuplicate ? 'Cold' : 'Medium',
        leadStatus: 'New',
        callAttempts: 0,
        notesSummary: row.isCrmDuplicate ? `Duplicate flag: Phone matches existing lead ${row.existingLeadId}` : '',
        assignmentHistory: targetRecruiter
          ? [
              {
                id: 'asg_' + Math.random().toString(36).substring(2, 8),
                assignedToId: targetRecruiter.id,
                assignedToName: targetRecruiter.name,
                assignedById: req.user!.id,
                assignedByName: req.user!.name,
                assignedAt: new Date().toISOString(),
                reason: 'Imported via CSV Wizard',
              },
            ]
          : [],
        updatedById: req.user!.id,
        updatedByName: req.user!.name,
      });

      db.logActivity({
        leadId: newLead.id,
        type: 'status_change',
        title: 'Lead Imported',
        description: `Imported via bulk CSV wizard by ${req.user!.name}.`,
        performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
      });

      imported++;
    } catch (e) {
      failed++;
    }
  }

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'BULK_IMPORT_LEADS',
    entity: 'Lead',
    entityId: 'multiple',
    newValue: { imported, skipped, duplicatesHandled, failed },
    details: `Imported ${imported} candidates via CSV wizard.`,
  });

  res.json({
    totalRows: rows.length,
    imported,
    skipped,
    duplicatesHandled,
    failed,
    message: `Import complete: ${imported} candidates successfully created.`,
  });
});

// -------------------------------------------------------------
// 11. DUPLICATE DETECTION & ADMIN MERGE
// -------------------------------------------------------------

apiRouter.get('/duplicates/candidates', authenticateToken, requireRole('admin'), (req, res) => {
  const leads = db.getLeads();
  const phoneMap = new Map<string, Lead[]>();

  leads.forEach(l => {
    if (l.normalizedPhone) {
      const existing = phoneMap.get(l.normalizedPhone) || [];
      existing.push(l);
      phoneMap.set(l.normalizedPhone, existing);
    }
  });

  const duplicateGroups: { phone: string; count: number; leads: Lead[] }[] = [];
  phoneMap.forEach((leadList, phone) => {
    if (leadList.length > 1) {
      duplicateGroups.push({
        phone,
        count: leadList.length,
        leads: leadList,
      });
    }
  });

  res.json({
    totalDuplicateGroups: duplicateGroups.length,
    groups: duplicateGroups,
  });
});

// Side-by-side master lead merge preserving all activities, notes, calls, interviews, follow-ups
apiRouter.post('/duplicates/merge', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { masterLeadId, duplicateLeadId, masterFields } = req.body;
  // masterFields allows Admin to selectively choose field values from either lead!

  if (!masterLeadId || !duplicateLeadId) {
    res.status(400).json({ error: 'masterLeadId and duplicateLeadId are required.' });
    return;
  }

  const masterLead = db.getLeadById(masterLeadId);
  const dupLead = db.getLeadById(duplicateLeadId);

  if (!masterLead || !dupLead) {
    res.status(404).json({ error: 'One or both leads not found.' });
    return;
  }

  // 1. Merge Activities
  const dupActivities = db.getActivitiesForLead(dupLead.id);
  dupActivities.forEach(a => {
    a.leadId = masterLead.id;
    a.description = `[From Merged Lead ${dupLead.id}]: ${a.description}`;
  });

  // 2. Merge Call logs
  const dupCalls = db.getCalls().filter(c => c.leadId === dupLead.id);
  dupCalls.forEach(c => {
    c.leadId = masterLead.id;
  });

  // 3. Merge Follow-ups
  const dupFollowups = db.getFollowups().filter(f => f.leadId === dupLead.id);
  dupFollowups.forEach(f => {
    f.leadId = masterLead.id;
  });

  // 4. Merge Interviews
  const dupInterviews = db.getInterviews().filter(i => i.leadId === dupLead.id);
  dupInterviews.forEach(i => {
    i.leadId = masterLead.id;
  });

  // 5. Merge Joinings
  const dupJoinings = db.getJoinings().filter(j => j.leadId === dupLead.id);
  dupJoinings.forEach(j => {
    j.leadId = masterLead.id;
  });

  // 6. Merge Assignment History
  const combinedHistory = [
    ...(masterLead.assignmentHistory || []),
    ...(dupLead.assignmentHistory || []).map(h => ({
      ...h,
      reason: `[Merged from ${dupLead.id}] ${h.reason || ''}`,
    })),
  ];

  // Apply chosen master fields
  const updatedMaster = db.updateLead(masterLead.id, {
    candidateName: masterFields?.candidateName || masterLead.candidateName,
    primaryPhone: masterFields?.primaryPhone || masterLead.primaryPhone,
    alternatePhone: masterFields?.alternatePhone || masterLead.alternatePhone || dupLead.alternatePhone,
    email: masterFields?.email || masterLead.email || dupLead.email,
    city: masterFields?.city || masterLead.city,
    qualification: masterFields?.qualification || masterLead.qualification || dupLead.qualification,
    experience: masterFields?.experience || masterLead.experience || dupLead.experience,
    currentSalary: masterFields?.currentSalary || masterLead.currentSalary || dupLead.currentSalary,
    expectedSalary: masterFields?.expectedSalary || masterLead.expectedSalary || dupLead.expectedSalary,
    notesSummary: `${masterLead.notesSummary || ''}\n[Merged Record Notes]: ${dupLead.notesSummary || ''}`.trim(),
    callAttempts: (masterLead.callAttempts || 0) + (dupLead.callAttempts || 0),
    assignmentHistory: combinedHistory,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  // Mark duplicate lead as Merged / Lost
  db.updateLead(dupLead.id, {
    leadStatus: 'Lost',
    lostReason: `Merged into Master Lead ${masterLead.id} by Admin ${req.user!.name}`,
    priority: 'Cold',
    notesSummary: `MERGED DUPLICATE. Master Lead is ${masterLead.id}.`,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  // Log activity on Master Lead
  db.logActivity({
    leadId: masterLead.id,
    type: 'merge',
    title: 'Duplicate Record Merged',
    description: `Merged with candidate record '${dupLead.candidateName}' (ID: ${dupLead.id}). Preserved all call logs, activities, and follow-up history.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'MERGE_DUPLICATES',
    entity: 'Lead',
    entityId: masterLead.id,
    newValue: { masterId: masterLead.id, mergedId: dupLead.id },
    details: `Admin merged duplicate lead '${dupLead.candidateName}' (${dupLead.id}) into '${masterLead.candidateName}' (${masterLead.id}).`,
  });

  res.json({
    message: 'Duplicate candidate successfully merged. All activities and history preserved.',
    masterLead: updatedMaster,
  });
});

// -------------------------------------------------------------
// 12. NOTIFICATIONS
// -------------------------------------------------------------

apiRouter.get('/notifications', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userNotifs = db.getNotifications().filter(n => n.userId === req.user!.id || req.user!.role === 'admin');
  const unreadCount = userNotifs.filter(n => !n.isRead).length;
  res.json({ notifications: userNotifs, unreadCount });
});

apiRouter.patch('/notifications/:id/read', authenticateToken, (req: AuthenticatedRequest, res) => {
  const success = db.markNotificationRead(req.params.id, req.user!.id);
  res.json({ success });
});

apiRouter.post('/notifications/read-all', authenticateToken, (req: AuthenticatedRequest, res) => {
  const count = db.markAllNotificationsRead(req.user!.id);
  res.json({ markedRead: count });
});

// -------------------------------------------------------------
// 13. AUDIT LOGS
// -------------------------------------------------------------

apiRouter.get('/audit-logs', authenticateToken, requireRole('admin'), (req, res) => {
  const logs = db.getAuditLogs();
  res.json({ auditLogs: logs });
});

// -------------------------------------------------------------
// 14. SETTINGS
// -------------------------------------------------------------

apiRouter.get('/settings', authenticateToken, (req, res) => {
  res.json({ settings: db.getSettings() });
});

apiRouter.put('/settings', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const current = db.getSettings();
  const merged = {
    ...current,
    ...req.body,
    agencyCMS: {
      ...current.agencyCMS,
      ...(req.body.agencyCMS || {}),
    },
    metaIntegration: {
      ...current.metaIntegration,
      ...(req.body.metaIntegration || {}),
    },
    googleAdsIntegration: {
      ...current.googleAdsIntegration,
      ...(req.body.googleAdsIntegration || {}),
    },
  };
  const updated = db.updateSettings(merged);
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'UPDATE_SETTINGS',
    entity: 'Settings',
    entityId: 'crm_settings',
    newValue: updated,
    details: 'Admin updated CRM configuration, CMS profile, and Ad integrations.',
  });
  res.json({ settings: updated });
});

apiRouter.patch('/settings', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const current = db.getSettings();
  const merged = {
    ...current,
    ...req.body,
    agencyCMS: {
      ...current.agencyCMS,
      ...(req.body.agencyCMS || {}),
    },
    metaIntegration: {
      ...current.metaIntegration,
      ...(req.body.metaIntegration || {}),
    },
    googleAdsIntegration: {
      ...current.googleAdsIntegration,
      ...(req.body.googleAdsIntegration || {}),
    },
  };
  const updated = db.updateSettings(merged);
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'UPDATE_SETTINGS',
    entity: 'Settings',
    entityId: 'crm_settings',
    newValue: updated,
    details: 'Admin patched CRM configuration, CMS profile, and Ad integrations.',
  });
  res.json({ settings: updated });
});

// -------------------------------------------------------------
// 15. CSV EXPORT
// -------------------------------------------------------------

apiRouter.get('/export/leads', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'recruiter' && req.user!.permissions?.canExportData === false) {
    res.status(403).json({ error: 'Access Denied: Candidate data export is restricted by your administrator.' });
    return;
  }

  let leads = db.getLeads();

  // Role visibility restriction
  if (req.user!.role === 'recruiter') {
    leads = leads.filter(l => l.assignedRecruiterId === req.user!.id);
  } else if (req.user!.role === 'team_leader') {
    leads = leads.filter(l => l.teamId === req.user!.teamId || l.assignedRecruiterId === req.user!.id);
  }

  // Filter parameters
  const { priority, leadStatus, clientId, jobId } = req.query as Record<string, string>;
  if (priority) leads = leads.filter(l => l.priority === priority);
  if (leadStatus) leads = leads.filter(l => l.leadStatus === leadStatus);
  if (clientId) leads = leads.filter(l => l.clientId === clientId);
  if (jobId) leads = leads.filter(l => l.jobId === jobId);

  // Generate CSV safely
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'ID',
    'Candidate Name',
    'Primary Phone',
    'Alternate Phone',
    'Email',
    'City',
    'Experience',
    'Current Salary',
    'Expected Salary',
    'Lead Source',
    'Priority',
    'Lead Status',
    'Assigned Recruiter',
    'Client',
    'Job',
    'Call Attempts',
    'Last Call Date',
    'Last Call Outcome',
    'Next Follow-up',
    'Created Date',
  ];

  const rows = leads.map(l => [
    escapeCsv(l.id),
    escapeCsv(l.candidateName),
    escapeCsv(l.primaryPhone),
    escapeCsv(l.alternatePhone || ''),
    escapeCsv(l.email || ''),
    escapeCsv(l.city),
    escapeCsv(l.experience || ''),
    escapeCsv(l.currentSalary || ''),
    escapeCsv(l.expectedSalary || ''),
    escapeCsv(l.leadSource),
    escapeCsv(l.priority),
    escapeCsv(l.leadStatus),
    escapeCsv(l.assignedRecruiterName),
    escapeCsv(l.clientName || ''),
    escapeCsv(l.jobTitle || ''),
    escapeCsv(l.callAttempts),
    escapeCsv(l.lastCallAt || ''),
    escapeCsv(l.lastCallOutcome || ''),
    escapeCsv(l.nextFollowupAt || ''),
    escapeCsv(l.createdAt),
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="oaksphere_leads_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csvContent);
});

// -------------------------------------------------------------
// 16. MESSAGE TEMPLATES & WHATSAPP HUB
// -------------------------------------------------------------

apiRouter.get('/templates', authenticateToken, (req, res) => {
  res.json({ templates: db.getTemplates() });
});

apiRouter.post('/templates', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { title, category, channel, body, variables } = req.body;
  if (!title || !body) {
    res.status(400).json({ error: 'Title and body are required' });
    return;
  }
  const created = db.createTemplate({
    title,
    category: category || 'custom',
    channel: channel || 'whatsapp',
    body,
    variables: variables || ['candidate_name', 'recruiter_name', 'recruiter_phone'],
    isSystem: false,
  });
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'CREATE_TEMPLATE',
    entity: 'Template',
    entityId: created.id,
    details: `Created custom message template: "${created.title}"`,
  });
  res.status(201).json({ template: created });
});

apiRouter.put('/templates/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const updated = db.updateTemplate(id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json({ template: updated });
});

apiRouter.delete('/templates/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const tmpl = db.getTemplateById(id);
  if (!tmpl) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  if (tmpl.isSystem) {
    res.status(400).json({ error: 'System templates cannot be deleted.' });
    return;
  }
  db.deleteTemplate(id);
  res.json({ success: true });
});

apiRouter.post('/templates/preview', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { templateId, leadId, customVars } = req.body;
  const template = db.getTemplateById(templateId);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const lead = leadId ? db.getLeadById(leadId) : null;
  const user = req.user!;
  
  // Find associated client/job/interview if exists
  const client = lead?.clientId ? db.getState().clients.find(c => c.id === lead.clientId) : null;
  const job = lead?.jobId ? db.getState().jobs.find(j => j.id === lead.jobId) : null;
  const interview = lead ? db.getInterviews().find(i => i.leadId === lead.id) : null;

  const vars: Record<string, string> = {
    candidate_name: lead?.candidateName || 'Candidate',
    recruiter_name: user.name || 'Recruiter',
    recruiter_phone: db.getUserById(user.id)?.phone || '9820011223',
    job_title: job?.positionTitle || lead?.jobTitle || 'Customer Support Associate',
    client_name: client?.companyName || lead?.clientName || 'Partner Client',
    salary_range: job?.salaryRange || (lead?.expectedSalary ? `₹${lead.expectedSalary.toLocaleString('en-IN')}` : '₹20,000 - ₹28,000 / month'),
    interview_date: interview?.date || new Date().toISOString().split('T')[0],
    interview_time: interview?.time || '11:00 AM',
    interview_venue: interview?.location || client?.location || 'Cyber City, Phase 2, Pune',
    google_maps_link: client?.location ? `https://maps.google.com/?q=${encodeURIComponent(client.location)}` : 'https://maps.google.com/?q=Pune+IT+Park',
    contact_person: interview?.contactPerson || client?.contactPerson || 'HR Desk',
    ...(customVars || {}),
  };

  let interpolatedText = template.body;
  Object.keys(vars).forEach(k => {
    const regex = new RegExp(`{{${k}}}`, 'g');
    interpolatedText = interpolatedText.replace(regex, vars[k]);
  });

  const phone = lead?.primaryPhone || '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = encodeURIComponent(interpolatedText);
  const whatsAppUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`;

  res.json({
    template,
    interpolatedText,
    whatsAppUrl,
    variables: vars,
  });
});

// -------------------------------------------------------------
// 17. CANDIDATE SCREENING SCORECARD & FIT EVALUATION
// -------------------------------------------------------------

apiRouter.post('/leads/:id/scorecard', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const lead = db.getLeadById(id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const {
    communicationLevel,
    shiftAvailability,
    commuteDistance,
    typingSpeedWpm,
    skills,
    noticePeriodDays,
    expectedCtcMonthly,
    offeredCtcMonthly,
    recruiterRemarks,
  } = req.body;

  if (!communicationLevel || !shiftAvailability || !commuteDistance) {
    res.status(400).json({ error: 'Communication, Shift, and Commute Distance are required for screening.' });
    return;
  }

  // Get job required shift if tagged
  const job = lead.jobId ? db.getState().jobs.find(j => j.id === lead.jobId) : null;

  const scoreResult = calculateScreeningScorecard({
    communicationLevel,
    shiftAvailability,
    commuteDistance,
    typingSpeedWpm: Number(typingSpeedWpm) || 0,
    skills: Array.isArray(skills) ? skills : [],
    noticePeriodDays: Number(noticePeriodDays) || 0,
    expectedCtcMonthly: expectedCtcMonthly ? Number(expectedCtcMonthly) : lead.expectedSalary,
    offeredCtcMonthly: offeredCtcMonthly ? Number(offeredCtcMonthly) : (job ? 24000 : undefined),
    jobRequiredShift: job ? job.positionTitle : undefined,
  });

  const scorecard: ScreeningScorecard = {
    communicationLevel,
    shiftAvailability,
    commuteDistance,
    typingSpeedWpm: Number(typingSpeedWpm) || 0,
    skills: Array.isArray(skills) ? skills : [],
    noticePeriodDays: Number(noticePeriodDays) || 0,
    expectedCtcMonthly: expectedCtcMonthly ? Number(expectedCtcMonthly) : lead.expectedSalary,
    currentCtcMonthly: req.body.currentCtcMonthly ? Number(req.body.currentCtcMonthly) : lead.currentSalary,
    evaluatedAt: new Date().toISOString(),
    evaluatedByRecruiterId: req.user!.id,
    evaluatedByRecruiterName: req.user!.name,
    fitScore: scoreResult.fitScore,
    dealbreakers: scoreResult.dealbreakers,
    overallVerdict: scoreResult.overallVerdict,
    recruiterRemarks: recruiterRemarks || '',
  };

  const updatedLead = db.updateLead(id, {
    scorecard,
    preferredShift: shiftAvailability,
    skills: Array.isArray(skills) ? skills : lead.skills,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  db.logActivity({
    leadId: id,
    type: 'status_change',
    title: `Screening Scorecard Evaluated: ${scoreResult.fitScore}%`,
    description: `Fit: ${scoreResult.overallVerdict} (Comm: ${communicationLevel}, Shift: ${shiftAvailability}, Commute: ${commuteDistance}). ${scoreResult.dealbreakers.length > 0 ? `Dealbreakers: ${scoreResult.dealbreakers.join('; ')}` : 'No dealbreakers found.'}`,
    performedBy: {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    },
    metadata: scorecard,
  });

  res.json({ lead: updatedLead, scorecard });
});

// -------------------------------------------------------------
// 18. SMART JOB MATCHING ENGINE
// -------------------------------------------------------------

apiRouter.get('/leads/:id/matching-jobs', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const lead = db.getLeadById(id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const jobs = db.getState().jobs;
  const matches = matchJobsForLead(lead, jobs);

  res.json({ matches, lead });
});

// -------------------------------------------------------------
// 19. KANBAN PIPELINE STAGE ADVANCE
// -------------------------------------------------------------

apiRouter.patch('/leads/:id/stage', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { newStage, notes } = req.body;
  const lead = db.getLeadById(id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const oldStage = lead.leadStatus;
  const validStages: LeadStatus[] = [
    'New',
    'Calling',
    'Follow-up',
    'Interested',
    'Interview Scheduled',
    'Interview Attended',
    'Selected',
    'Joining Scheduled',
    'Joined',
    'Not Interested',
    'Lost',
  ];

  if (!validStages.includes(newStage)) {
    res.status(400).json({ error: `Invalid stage: ${newStage}` });
    return;
  }

  const updates: Partial<Lead> = {
    leadStatus: newStage,
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  };

  if (newStage === 'Selected') {
    updates.interviewStatus = 'Selected';
    updates.joiningStatus = 'Selected';
  } else if (newStage === 'Joining Scheduled') {
    updates.joiningStatus = 'Offer Released';
  } else if (newStage === 'Joined') {
    updates.joiningStatus = 'Joined';
    updates.actualJoiningDate = new Date().toISOString().split('T')[0];
  } else if (newStage === 'Interview Scheduled') {
    updates.interviewStatus = 'Scheduled';
  } else if (newStage === 'Interview Attended') {
    updates.interviewStatus = 'Attended';
  }

  const updatedLead = db.updateLead(id, updates);

  db.logActivity({
    leadId: id,
    type: 'status_change',
    title: `Stage Changed to ${newStage}`,
    description: `Pipeline stage moved from "${oldStage}" to "${newStage}". ${notes ? `Note: ${notes}` : ''}`,
    performedBy: {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    },
  });

  res.json({ lead: updatedLead });
});

// -------------------------------------------------------------
// 20. RECRUITER LIVE LEADERBOARD & INCENTIVES
// -------------------------------------------------------------

apiRouter.get('/analytics/leaderboard', authenticateToken, (req: AuthenticatedRequest, res) => {
  const users = db.getUsers().filter(u => u.isActive && (u.role === 'recruiter' || u.role === 'team_leader'));
  const calls = db.getCalls();
  const interviews = db.getInterviews();
  const joinings = db.getJoinings();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const leaderboard = users.map(user => {
    const userCallsToday = calls.filter(c => c.recruiterId === user.id && c.createdAt.startsWith(todayStr));
    const connectedToday = userCallsToday.filter(c => c.disposition.startsWith('Connected') || c.disposition === 'Interview Scheduled');

    const userCallsMonth = calls.filter(c => c.recruiterId === user.id && c.createdAt.startsWith(currentMonthStr));
    const connectedMonth = userCallsMonth.filter(c => c.disposition.startsWith('Connected') || c.disposition === 'Interview Scheduled');

    const userInterviewsMonth = interviews.filter(i => i.recruiterId === user.id && i.scheduledAt.startsWith(currentMonthStr));
    const attendedMonth = userInterviewsMonth.filter(i => i.stage === 'Attended' || i.stage === 'Selected');
    const selectedMonth = userInterviewsMonth.filter(i => i.stage === 'Selected');

    const userJoiningsMonth = joinings.filter(j => j.recruiterId === user.id && (j.actualJoiningDate?.startsWith(currentMonthStr) || j.selectionDate.startsWith(currentMonthStr)) && j.status === 'Joined');

    const totalCallsToday = userCallsToday.length;
    const totalCallsMonth = userCallsMonth.length;
    const totalConnectedMonth = connectedMonth.length;
    const totalInterviewsMonth = userInterviewsMonth.length;
    const totalAttendedMonth = attendedMonth.length;
    const totalSelectedMonth = selectedMonth.length;
    const totalJoinedMonth = userJoiningsMonth.length;

    const callTargetPct = user.dailyCallTarget > 0 ? Math.min(100, Math.round((totalCallsToday / user.dailyCallTarget) * 100)) : 100;
    const joiningTargetPct = user.monthlyJoiningTarget > 0 ? Math.min(100, Math.round((totalJoinedMonth / user.monthlyJoiningTarget) * 100)) : 100;

    const connectionRatePct = totalCallsMonth > 0 ? Math.round((totalConnectedMonth / totalCallsMonth) * 100) : 0;
    const turnoutRatePct = totalInterviewsMonth > 0 ? Math.round((totalAttendedMonth / totalInterviewsMonth) * 100) : 0;

    const basePerJoining = 4000;
    let multiplier = 1.0;
    if (totalJoinedMonth >= 8) multiplier = 1.4;
    else if (totalJoinedMonth >= 5) multiplier = 1.2;

    const earnedIncentive = Math.round(totalJoinedMonth * basePerJoining * multiplier);
    const potentialNextIncentive = Math.round((totalJoinedMonth + 1) * basePerJoining * (totalJoinedMonth + 1 >= 5 ? 1.2 : 1.0));

    const streakDays = Math.max(1, (totalJoinedMonth * 2 + Math.floor(totalCallsToday / 15)));

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamName: user.teamName || 'Recruitment Operations',
      phone: user.phone || '9820011223',
      today: {
        calls: totalCallsToday,
        connected: connectedToday.length,
        targetCalls: user.dailyCallTarget,
        targetAchievedPct: callTargetPct,
      },
      month: {
        calls: totalCallsMonth,
        connected: totalConnectedMonth,
        interviews: totalInterviewsMonth,
        attended: totalAttendedMonth,
        selected: totalSelectedMonth,
        joined: totalJoinedMonth,
        joiningTarget: user.monthlyJoiningTarget,
        joiningTargetPct,
      },
      rates: {
        connectionRatePct,
        turnoutRatePct,
      },
      incentive: {
        baseRate: basePerJoining,
        multiplier,
        earnedTotal: earnedIncentive,
        nextTierGain: potentialNextIncentive - earnedIncentive,
      },
      streakDays,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.month.joined !== a.month.joined) return b.month.joined - a.month.joined;
    if (b.month.interviews !== a.month.interviews) return b.month.interviews - a.month.interviews;
    return b.month.calls - a.month.calls;
  });

  const ranked = leaderboard.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  res.json({ leaderboard: ranked });
});

// -------------------------------------------------------------
// 21. AUTO-ASSIGN HELPER
// -------------------------------------------------------------

function autoAssignLead(recruiters: User[]): User {
  const activeRecruiters = recruiters.filter(r => r.isActive && r.role === 'recruiter');
  if (activeRecruiters.length === 0) {
    const admin = recruiters.find(u => u.role === 'admin');
    return admin || recruiters[0];
  }
  const randomIndex = Math.floor(Math.random() * activeRecruiters.length);
  return activeRecruiters[randomIndex];
}

// -------------------------------------------------------------
// 22. META (FACEBOOK & INSTAGRAM) LEAD ADS WEBHOOKS & SIMULATOR
// -------------------------------------------------------------

apiRouter.get('/webhooks/meta-leads', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = db.getSettings().metaIntegration.verifyToken || 'oak_meta_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden: Verification token mismatch');
  }
});

apiRouter.post('/webhooks/meta-leads', (req, res) => {
  const body = req.body;
  const settings = db.getSettings();
  const metaConfig = settings.metaIntegration;

  let leadName = 'Meta Candidate';
  let phone = '';
  let email = '';
  let city = 'Pune';
  let exp = '1 Year in Customer Service';
  let shift = '24/7 Rotational';
  let campaignName = 'Pune BPO Mega Walk-In Drive (FB Feed)';
  let metaLeadId = 'leadgen_' + Date.now();

  if (body.candidateName || body.full_name) {
    leadName = body.candidateName || body.full_name;
    phone = body.phone || body.phone_number || '';
    email = body.email || '';
    city = body.city || 'Pune';
    exp = body.experience || body.years_of_experience || '1 Year in Customer Service';
    shift = body.preferredShift || body.preferred_shift || '24/7 Rotational';
    campaignName = body.campaignName || campaignName;
  } else if (body.entry && Array.isArray(body.entry)) {
    const entry = body.entry[0];
    const change = entry?.changes?.[0];
    metaLeadId = change?.value?.leadgen_id || metaLeadId;
    campaignName = change?.value?.campaign_name || campaignName;
  }

  if (!phone) {
    phone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  }

  const { normalized, isValid } = normalizePhoneNumber(phone);
  
  const existingLead = db.findLeadByPhone(normalized);
  if (existingLead) {
    db.updateLead(existingLead.id, {
      callAttempts: (existingLead.callAttempts || 0) + 1,
      notesSummary: `Re-engaged via Meta Ad Campaign "${campaignName}" on ${new Date().toLocaleDateString()}`,
    });
    db.logActivity({
      leadId: existingLead.id,
      type: 'note',
      title: 'Meta Ad Repeat Submission',
      description: `Candidate submitted lead form on Meta Ads: "${campaignName}" (Meta ID: ${metaLeadId})`,
      performedBy: { id: 'sys_meta', name: 'Meta Lead Ads Webhook', role: 'admin' },
    });
    res.json({ status: 'success', duplicate: true, leadId: existingLead.id });
    return;
  }

  const users = db.getUsers();
  const recruiter = autoAssignLead(users);

  const jobs = db.getState().jobs.filter(j => j.status === 'Active');
  const matchedJob = jobs.find(j => j.location.toLowerCase().includes(city.toLowerCase())) || jobs[0];

  const newLead = db.createLead({
    candidateName: leadName,
    primaryPhone: phone,
    normalizedPhone: normalized,
    phoneStatus: isValid ? 'VERIFIED' : 'NEEDS_VERIFY',
    email: email || undefined,
    city: city || 'Pune',
    experience: exp,
    preferredShift: shift,
    leadSource: 'Facebook Ads',
    priority: 'Hot',
    leadStatus: 'New',
    callAttempts: 0,
    assignedRecruiterId: recruiter.id,
    assignedRecruiterName: recruiter.name,
    originalRecruiterId: recruiter.id,
    originalRecruiterName: recruiter.name,
    teamId: recruiter.teamId,
    clientId: matchedJob?.clientId,
    clientName: matchedJob?.clientName,
    jobId: matchedJob?.id,
    jobTitle: matchedJob?.positionTitle,
    expectedSalary: 22000,
    metaLeadId,
    adCampaignName: campaignName,
    notesSummary: `Auto-captured via Meta Lead Ads: "${campaignName}"`,
    assignmentHistory: [
      {
        id: 'asg_' + Date.now(),
        assignedToId: recruiter.id,
        assignedToName: recruiter.name,
        assignedById: 'sys_meta',
        assignedByName: 'Meta Ads Auto-Router',
        assignedAt: new Date().toISOString(),
        reason: 'Automated round-robin Meta Ads assignment',
      },
    ],
    updatedById: recruiter.id,
    updatedByName: recruiter.name,
  });

  db.logActivity({
    leadId: newLead.id,
    type: 'assignment',
    title: 'Meta Lead Captured & Auto-Assigned',
    description: `Real-time capture from Meta Ads ("${campaignName}"). Auto-assigned to recruiter ${recruiter.name}.`,
    performedBy: { id: 'sys_meta', name: 'Meta Lead Ads Webhook', role: 'admin' },
  });

  db.addNotification({
    userId: recruiter.id,
    title: '🔥 New Meta Lead Ad Received',
    message: `${leadName} (+91 ${phone}) just applied via Facebook/Instagram for ${matchedJob?.positionTitle || 'openings'}. Call immediately!`,
    type: 'lead_assigned',
    linkTo: '/calling-queue',
  });

  const campIdx = metaConfig.campaigns.findIndex(c => c.name.toLowerCase() === campaignName.toLowerCase());
  if (campIdx !== -1) {
    metaConfig.campaigns[campIdx].leadsCount += 1;
    metaConfig.campaigns[campIdx].lastLeadAt = new Date().toISOString();
    db.save();
  }

  res.status(201).json({ status: 'success', lead: newLead });
});

apiRouter.post('/integrations/meta/simulate-lead', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { candidateName, phone, city, experience, preferredShift, campaignName } = req.body;
  const mockPayload = {
    full_name: candidateName || 'Pooja Deshmukh',
    phone_number: phone || ('98203' + Math.floor(10000 + Math.random() * 90000)),
    city: city || 'Pune',
    years_of_experience: experience || '1.5 Years in BPO Telesales',
    preferred_shift: preferredShift || '24/7 Rotational',
    campaignName: campaignName || 'Pune BPO Mega Walk-In Drive (FB Feed)',
  };

  const users = db.getUsers();
  const recruiter = autoAssignLead(users);
  const { normalized, isValid } = normalizePhoneNumber(mockPayload.phone_number);
  const jobs = db.getState().jobs.filter(j => j.status === 'Active');
  const matchedJob = jobs.find(j => j.location.toLowerCase().includes(mockPayload.city.toLowerCase())) || jobs[0];

  const createdLead = db.createLead({
    candidateName: mockPayload.full_name,
    primaryPhone: mockPayload.phone_number,
    normalizedPhone: normalized,
    phoneStatus: isValid ? 'VERIFIED' : 'NEEDS_VERIFY',
    city: mockPayload.city,
    experience: mockPayload.years_of_experience,
    preferredShift: mockPayload.preferred_shift,
    leadSource: 'Facebook Ads',
    priority: 'Hot',
    leadStatus: 'New',
    callAttempts: 0,
    assignedRecruiterId: recruiter.id,
    assignedRecruiterName: recruiter.name,
    originalRecruiterId: recruiter.id,
    originalRecruiterName: recruiter.name,
    teamId: recruiter.teamId,
    clientId: matchedJob?.clientId,
    clientName: matchedJob?.clientName,
    jobId: matchedJob?.id,
    jobTitle: matchedJob?.positionTitle,
    expectedSalary: 24000,
    metaLeadId: 'sim_meta_' + Date.now(),
    adCampaignName: mockPayload.campaignName,
    notesSummary: `Simulated live Meta Ad lead: "${mockPayload.campaignName}"`,
    assignmentHistory: [
      {
        id: 'asg_' + Date.now(),
        assignedToId: recruiter.id,
        assignedToName: recruiter.name,
        assignedById: req.user!.id,
        assignedByName: req.user!.name,
        assignedAt: new Date().toISOString(),
        reason: 'Live Meta Webhook Simulator Ingestion',
      },
    ],
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  db.logActivity({
    leadId: createdLead.id,
    type: 'assignment',
    title: 'Meta Lead Captured (Simulator)',
    description: `Simulated live lead from Meta Ads Campaign: "${mockPayload.campaignName}". Assigned to ${recruiter.name}.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  db.addNotification({
    userId: recruiter.id,
    title: '🔥 New Meta Lead Ad Received (Simulator)',
    message: `${createdLead.candidateName} (+91 ${createdLead.primaryPhone}) applied via Facebook Ads. Immediate call recommended!`,
    type: 'lead_assigned',
    linkTo: '/calling-queue',
  });

  res.json({ success: true, lead: createdLead });
});

// -------------------------------------------------------------
// 23. GOOGLE ADS LEAD FORMS & OFFLINE CONVERSIONS
// -------------------------------------------------------------

apiRouter.post('/webhooks/google-leads', (req, res) => {
  const body = req.body;
  const settings = db.getSettings();
  const googleConfig = settings.googleAdsIntegration;

  const key = req.headers['google-key'] || req.query['key'] || body.google_key;
  if (key && key !== googleConfig.webhookSecretKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid Google Key' });
    return;
  }

  let leadName = 'Google Candidate';
  let phone = '';
  let email = '';
  let city = 'Pune';
  const gclid = body.gclid || 'CjwKCAjw_' + Math.random().toString(36).substring(2, 15);
  const campaignName = body.campaign_name || 'Search - BPO Jobs In Pune (Exact Match)';

  if (body.user_column_data && Array.isArray(body.user_column_data)) {
    for (const col of body.user_column_data) {
      if (col.column_id === 'FULL_NAME' || col.column_name?.includes('Name')) leadName = col.string_value;
      if (col.column_id === 'PHONE_NUMBER' || col.column_name?.includes('Phone')) phone = col.string_value;
      if (col.column_id === 'EMAIL' || col.column_name?.includes('Email')) email = col.string_value;
      if (col.column_id === 'CITY' || col.column_name?.includes('City')) city = col.string_value;
    }
  } else {
    leadName = body.candidateName || body.name || leadName;
    phone = body.phone || body.phone_number || '';
    email = body.email || email;
    city = body.city || city;
  }

  if (!phone) {
    phone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  }

  const { normalized, isValid } = normalizePhoneNumber(phone);
  const users = db.getUsers();
  const recruiter = autoAssignLead(users);

  const jobs = db.getState().jobs.filter(j => j.status === 'Active');
  const matchedJob = jobs.find(j => j.location.toLowerCase().includes(city.toLowerCase())) || jobs[0];

  const newLead = db.createLead({
    candidateName: leadName,
    primaryPhone: phone,
    normalizedPhone: normalized,
    phoneStatus: isValid ? 'VERIFIED' : 'NEEDS_VERIFY',
    email: email || undefined,
    city: city || 'Pune',
    experience: 'Fresher / Graduate',
    leadSource: 'Google Ads',
    priority: 'Hot',
    leadStatus: 'New',
    callAttempts: 0,
    assignedRecruiterId: recruiter.id,
    assignedRecruiterName: recruiter.name,
    originalRecruiterId: recruiter.id,
    originalRecruiterName: recruiter.name,
    teamId: recruiter.teamId,
    clientId: matchedJob?.clientId,
    clientName: matchedJob?.clientName,
    jobId: matchedJob?.id,
    jobTitle: matchedJob?.positionTitle,
    expectedSalary: 21000,
    gclid,
    adCampaignName: campaignName,
    notesSummary: `Auto-captured via Google Lead Form Extension (GCLID: ${gclid})`,
    assignmentHistory: [
      {
        id: 'asg_' + Date.now(),
        assignedToId: recruiter.id,
        assignedToName: recruiter.name,
        assignedById: 'sys_google',
        assignedByName: 'Google Ads Router',
        assignedAt: new Date().toISOString(),
        reason: 'Automated Google Ads Lead Ingestion',
      },
    ],
    updatedById: recruiter.id,
    updatedByName: recruiter.name,
  });

  db.logActivity({
    leadId: newLead.id,
    type: 'assignment',
    title: 'Google Lead Captured with GCLID',
    description: `Captured from Google Ads Campaign "${campaignName}" with GCLID for offline conversion tracking. Assigned to ${recruiter.name}.`,
    performedBy: { id: 'sys_google', name: 'Google Ads Webhook', role: 'admin' },
  });

  db.addNotification({
    userId: recruiter.id,
    title: '⚡ New Google Ads Lead Form Ingested',
    message: `${leadName} (+91 ${phone}) searched for jobs on Google and submitted a lead form. Call now!`,
    type: 'lead_assigned',
    linkTo: '/calling-queue',
  });

  res.status(201).json({ status: 'success', lead: newLead });
});

apiRouter.post('/integrations/google/simulate-lead', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { candidateName, phone, city, campaignName } = req.body;
  const gclid = 'CjwKCAjw_' + Math.random().toString(36).substring(2, 15);
  const sampleName = candidateName || 'Aditya Deshpande';
  const samplePhone = phone || ('98204' + Math.floor(10000 + Math.random() * 90000));
  const sampleCity = city || 'Pune';
  const sampleCamp = campaignName || 'Search - BPO Jobs In Pune (Exact Match)';

  const { normalized, isValid } = normalizePhoneNumber(samplePhone);
  const users = db.getUsers();
  const recruiter = autoAssignLead(users);
  const jobs = db.getState().jobs.filter(j => j.status === 'Active');
  const matchedJob = jobs.find(j => j.location.toLowerCase().includes(sampleCity.toLowerCase())) || jobs[0];

  const created = db.createLead({
    candidateName: sampleName,
    primaryPhone: samplePhone,
    normalizedPhone: normalized,
    phoneStatus: isValid ? 'VERIFIED' : 'NEEDS_VERIFY',
    city: sampleCity,
    experience: 'Graduate with Good English',
    leadSource: 'Google Ads',
    priority: 'Hot',
    leadStatus: 'New',
    callAttempts: 0,
    assignedRecruiterId: recruiter.id,
    assignedRecruiterName: recruiter.name,
    originalRecruiterId: recruiter.id,
    originalRecruiterName: recruiter.name,
    teamId: recruiter.teamId,
    clientId: matchedJob?.clientId,
    clientName: matchedJob?.clientName,
    jobId: matchedJob?.id,
    jobTitle: matchedJob?.positionTitle,
    expectedSalary: 23000,
    gclid,
    adCampaignName: sampleCamp,
    notesSummary: `Simulated Google Lead Form Extension with GCLID: ${gclid}`,
    assignmentHistory: [
      {
        id: 'asg_' + Date.now(),
        assignedToId: recruiter.id,
        assignedToName: recruiter.name,
        assignedById: req.user!.id,
        assignedByName: req.user!.name,
        assignedAt: new Date().toISOString(),
        reason: 'Google Ads Simulator Ingestion',
      },
    ],
    updatedById: req.user!.id,
    updatedByName: req.user!.name,
  });

  db.logActivity({
    leadId: created.id,
    type: 'assignment',
    title: 'Google Ads Lead Form Simulation',
    description: `Simulated Google Ads Lead Form submission with GCLID "${gclid}". Assigned to ${recruiter.name}.`,
    performedBy: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
  });

  db.addNotification({
    userId: recruiter.id,
    title: '⚡ New Google Ads Lead Received (Simulator)',
    message: `${created.candidateName} (+91 ${created.primaryPhone}) applied via Google Ads search campaign.`,
    type: 'lead_assigned',
    linkTo: '/calling-queue',
  });

  res.json({ success: true, lead: created });
});

apiRouter.post('/integrations/google/sync-conversions', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const leads = db.getLeads().filter(l => l.gclid && (l.leadStatus === 'Interview Scheduled' || l.leadStatus === 'Joined'));
  
  const conversions = leads.map(l => ({
    gclid: l.gclid,
    conversionAction: l.leadStatus === 'Joined' ? 'Candidate Joined' : 'Interview Lineup',
    conversionTime: l.updatedAt || new Date().toISOString(),
    conversionValueInr: l.leadStatus === 'Joined' ? 15000 : 2500,
    candidateName: l.candidateName,
    campaignName: l.adCampaignName || 'Search Campaign',
  }));

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'SYNC_OFFLINE_CONVERSIONS',
    entity: 'GoogleAds',
    entityId: 'google_oct',
    details: `Synced ${conversions.length} offline conversions back to Google Ads for Smart Bidding optimization.`,
  });

  res.json({
    syncedCount: conversions.length,
    conversions,
    message: `Successfully uploaded ${conversions.length} candidate milestone conversions to Google Ads API.`,
  });
});

// -------------------------------------------------------------
// 21. CALL BRIDGE: DESKTOP CALL TO PHONE SIM CALL
// -------------------------------------------------------------

interface CallBridgeClient {
  id: string;
  userId: string;
  pairCode?: string;
  role: 'desktop' | 'mobile';
  res: Response;
}

const callBridgeClients: CallBridgeClient[] = [];

// Broadcast event to paired devices / desktop
function broadcastCallBridgeEvent(filter: { userId?: string; pairCode?: string }, event: { type: string; payload: any }) {
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
  for (let i = callBridgeClients.length - 1; i >= 0; i--) {
    const client = callBridgeClients[i];
    let match = false;
    if (filter.userId && client.userId === filter.userId) match = true;
    if (filter.pairCode && client.pairCode && client.pairCode.replace(/\D/g, '') === filter.pairCode.replace(/\D/g, '')) match = true;
    if (match) {
      try {
        client.res.write(data);
      } catch (err) {
        callBridgeClients.splice(i, 1);
      }
    }
  }
}

// 1. Get Call Bridge Status & Paired Devices
apiRouter.get('/call-bridge/status', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const devices = db.getCallBridgeDevices(userId);
  const settings = db.getCallBridgeSettings(userId);
  const primaryDevice = devices.find(d => d.status === 'connected') || devices[0] || null;

  const calls = db.getCallBridgeCalls(userId);
  const activeCall = calls.find(c => c.status === 'ringing' || c.status === 'connected') || null;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCalls = calls.filter(c => c.initiatedAt.startsWith(todayStr));
  const totalDuration = todayCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
  const sim1Calls = todayCalls.filter(c => c.simUsed === 'SIM_1').length;
  const sim2Calls = todayCalls.filter(c => c.simUsed === 'SIM_2').length;
  const connectedCalls = todayCalls.filter(c => c.status === 'completed' && c.durationSeconds > 0).length;

  res.json({
    device: primaryDevice,
    allDevices: devices,
    settings,
    activeCall,
    stats: {
      totalToday: todayCalls.length,
      totalDurationSeconds: totalDuration,
      sim1Count: sim1Calls,
      sim2Count: sim2Calls,
      connectedCount: connectedCalls,
      connectRate: todayCalls.length > 0 ? Math.round((connectedCalls / todayCalls.length) * 100) : 0,
    },
  });
});

// 2. Real-time Server-Sent Events (SSE) Stream
apiRouter.get('/call-bridge/stream', (req, res) => {
  const token = req.query.token as string | undefined;
  const pairCode = req.query.pairCode as string | undefined;
  const role = (req.query.role as 'desktop' | 'mobile') || 'desktop';

  let userId = 'usr_admin';
  if (token) {
    try {
      // In this system token decode or demo fallback
      const users = db.getUsers();
      const found = users.find(u => token.includes(u.id));
      if (found) userId = found.id;
    } catch (e) {
      // ignore
    }
  } else if (pairCode) {
    const dev = db.getCallBridgeDeviceByPairCode(pairCode);
    if (dev) userId = dev.userId;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = 'cl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const client: CallBridgeClient = {
    id: clientId,
    userId,
    pairCode: pairCode || undefined,
    role,
    res,
  };

  callBridgeClients.push(client);

  // Send initial handshake
  res.write(`event: handshake\ndata: ${JSON.stringify({ status: 'connected', clientId, userId, role })}\n\n`);

  // Heartbeat ping every 15s to keep connection alive
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    const idx = callBridgeClients.findIndex(c => c.id === clientId);
    if (idx !== -1) callBridgeClients.splice(idx, 1);
  });
});

// 3. Pair or Register Mobile Device
apiRouter.post('/call-bridge/pair', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { action, pairCode, deviceName, platform, sim1Carrier, sim2Carrier, defaultSim } = req.body;

  if (action === 'generate_code') {
    // Generate new 6-digit pair code for desktop
    const newCode = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    const newDevice: CallBridgeDevice = {
      id: 'dev_' + Date.now().toString(36),
      userId,
      deviceName: deviceName || 'Smart Phone SIM Companion',
      platform: platform || 'android',
      sim1Carrier: sim1Carrier || 'Jio 5G (Work SIM)',
      sim2Carrier: sim2Carrier || 'Airtel (Personal SIM)',
      defaultSim: defaultSim || 'SIM_1',
      batteryLevel: 95,
      networkSignal: 'strong',
      status: 'connected',
      pairCode: newCode,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.createOrUpdateDevice(newDevice);
    res.json({ success: true, pairCode: newCode, device: newDevice });
    return;
  }

  // Mobile companion app pairs using entered code
  const code = pairCode || req.body.code;
  if (!code) {
    res.status(400).json({ error: 'Pair code is required' });
    return;
  }

  let device = db.getCallBridgeDeviceByPairCode(code);
  if (!device) {
    // Auto-create or link
    device = {
      id: 'dev_paired_' + Date.now().toString(36),
      userId,
      deviceName: deviceName || 'Mobile SIM Companion',
      platform: platform || 'android',
      sim1Carrier: sim1Carrier || 'Jio 5G',
      sim2Carrier: sim2Carrier || 'Airtel 4G',
      defaultSim: defaultSim || 'SIM_1',
      batteryLevel: 88,
      networkSignal: 'strong',
      status: 'connected',
      pairCode: code,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.createOrUpdateDevice(device);
  } else {
    device.status = 'connected';
    device.lastSeenAt = new Date().toISOString();
    if (deviceName) device.deviceName = deviceName;
    if (platform) device.platform = platform;
    db.createOrUpdateDevice(device);
  }

  // Broadcast device status update to desktop
  broadcastCallBridgeEvent({ userId }, {
    type: 'DEVICE_CONNECTED',
    payload: { device, message: `Device "${device.deviceName}" paired successfully!` },
  });

  res.json({ success: true, device, message: 'Device paired successfully' });
});

// 4. Trigger Desktop Call to Phone SIM Call
apiRouter.post('/call-bridge/dial', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { leadId, candidateName, phoneNumber, simSlot } = req.body;

  if (!phoneNumber) {
    res.status(400).json({ error: 'Phone number is required' });
    return;
  }

  const settings = db.getCallBridgeSettings(userId);
  const devices = db.getCallBridgeDevices(userId);
  const device = devices.find(d => d.status === 'connected') || devices[0];

  const chosenSim: SimSlot = simSlot || settings.defaultSim || 'SIM_1';
  const carrier = chosenSim === 'SIM_1' ? (device?.sim1Carrier || settings.sim1Carrier) : (device?.sim2Carrier || settings.sim2Carrier);

  // Look up candidate if leadId provided
  let candidateTitle = candidateName || 'Candidate';
  let lead = leadId ? db.getLeadById(leadId) : undefined;
  if (lead && !candidateName) {
    candidateTitle = lead.candidateName;
  }

  let dialPhone = phoneNumber;
  if (lead && (dialPhone.includes('•') || dialPhone.includes('*') || dialPhone.length < 8)) {
    dialPhone = lead.primaryPhone;
  }

  // Create bridged call event
  const callEvent = db.createCallBridgeCall({
    userId,
    deviceId: device?.id,
    leadId,
    candidateName: candidateTitle,
    phoneNumber: dialPhone,
    simUsed: chosenSim,
    carrierName: carrier,
    status: 'ringing',
    durationSeconds: 0,
    disposition: undefined,
    notes: `Desktop SIM Bridge call triggered via ${chosenSim} (${carrier})`,
  });

  // Broadcast to mobile companion devices
  broadcastCallBridgeEvent({ userId, pairCode: device?.pairCode }, {
    type: 'INCOMING_DIAL_REQUEST',
    payload: {
      callId: callEvent.id,
      leadId,
      candidateName: candidateTitle,
      phoneNumber,
      simSlot: chosenSim,
      carrierName: carrier,
      jobTitle: lead?.jobTitle || 'Job Candidate',
      clientName: lead?.clientName || 'OAKsphere Client',
      telUrl: `tel:${phoneNumber.replace(/[^0-9+]/g, '')}`,
      timestamp: new Date().toISOString(),
    },
  });

  // Audit log
  db.logAudit({
    userId,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'SIM_CALL_TRIGGERED',
    entity: 'Lead',
    entityId: leadId || callEvent.id,
    details: `Initiated Desktop-to-Phone SIM call to ${candidateTitle} (+91 ${phoneNumber}) on ${chosenSim} (${carrier}).`,
  });

  res.json({
    success: true,
    call: callEvent,
    device,
    simUsed: chosenSim,
    carrierName: carrier,
    message: `Broadcasting call to mobile phone (${device?.deviceName || 'SIM Phone'}). Pick up or confirm on phone to start conversation.`,
  });
});

// 5. Update Call Status (Ringing, Connected, Completed, Hangup)
apiRouter.post('/call-bridge/call-event', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { callId, status, durationSeconds, disposition, notes, leadId } = req.body;

  if (!callId) {
    res.status(400).json({ error: 'Call ID is required' });
    return;
  }

  const updates: Partial<CallBridgeCallEvent> = {};
  if (status) updates.status = status;
  if (typeof durationSeconds === 'number') updates.durationSeconds = durationSeconds;
  if (disposition) updates.disposition = disposition;
  if (notes) updates.notes = notes;

  if (status === 'connected') {
    updates.connectedAt = new Date().toISOString();
  } else if (status === 'completed' || status === 'rejected' || status === 'failed') {
    updates.endedAt = new Date().toISOString();
  }

  const updated = db.updateCallBridgeCall(callId, updates);

  // If completed and disposition provided, log in candidate CRM history
  if ((status === 'completed' || disposition) && updated?.leadId) {
    try {
      db.createCallLog({
        leadId: updated.leadId,
        recruiterId: userId,
        recruiterName: req.user!.name,
        candidateName: updated.candidateName,
        phone: updated.phoneNumber,
        disposition: (disposition || updated.disposition || 'Connected – Interested') as any,
        durationSeconds: durationSeconds || updated.durationSeconds || 45,
        notes: notes || `Phone SIM Bridge Call (${updated.simUsed} - ${updated.carrierName}): ${disposition || 'Completed'}`,
      });

      db.logActivity({
        leadId: updated.leadId,
        type: 'call',
        title: `Phone SIM Call Logged: ${disposition || 'Completed'}`,
        description: `Call placed from desktop via phone SIM (${updated.simUsed} - ${updated.carrierName}). Duration: ${durationSeconds || 45}s.`,
        performedBy: { id: userId, name: req.user!.name, role: req.user!.role },
      });
    } catch (e) {
      console.error('Failed to auto-log CRM call from SIM bridge:', e);
    }
  }

  // Broadcast to all connected SSE clients (desktop + mobile)
  broadcastCallBridgeEvent({ userId }, {
    type: 'CALL_STATUS_UPDATE',
    payload: {
      callId,
      status: updated?.status,
      durationSeconds: updated?.durationSeconds,
      disposition: updated?.disposition,
      notes: updated?.notes,
      updatedAt: new Date().toISOString(),
    },
  });

  res.json({ success: true, call: updated });
});

// 6. Update Recruiter Call Bridge Settings
apiRouter.post('/call-bridge/settings', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const updated = db.updateCallBridgeSettings(userId, req.body);
  res.json({ success: true, settings: updated });
});

// 7. Get Call Bridge Call Logs
apiRouter.get('/call-bridge/logs', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const calls = db.getCallBridgeCalls(userId);
  res.json({ calls });
});

// 8. Simulator: Test Phone SIM Event Trigger (for testing without physical secondary phone)
apiRouter.post('/call-bridge/simulate-phone-event', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { callId, simulatedAction } = req.body;

  // simulatedAction: 'answer' | 'hangup_interested' | 'hangup_callback' | 'busy'
  let newStatus: any = 'connected';
  let duration = 0;
  let disposition: any = 'Connected – Interested';

  if (simulatedAction === 'answer') {
    newStatus = 'connected';
    duration = 15;
  } else if (simulatedAction === 'hangup_interested') {
    newStatus = 'completed';
    duration = 84;
    disposition = 'Connected – Interested';
  } else if (simulatedAction === 'hangup_callback') {
    newStatus = 'completed';
    duration = 32;
    disposition = 'Callback';
  } else if (simulatedAction === 'busy') {
    newStatus = 'failed';
    duration = 0;
    disposition = 'Busy';
  }

  const updated = db.updateCallBridgeCall(callId, {
    status: newStatus,
    durationSeconds: duration,
    disposition,
    notes: `Simulated phone action: ${simulatedAction}`,
  });

  broadcastCallBridgeEvent({ userId }, {
    type: 'CALL_STATUS_UPDATE',
    payload: {
      callId,
      status: newStatus,
      durationSeconds: duration,
      disposition,
      notes: `Simulated phone action: ${simulatedAction}`,
    },
  });

  if (newStatus === 'completed' && updated?.leadId) {
    db.createCallLog({
      leadId: updated.leadId,
      recruiterId: userId,
      recruiterName: req.user!.name,
      candidateName: updated.candidateName,
      phone: updated.phoneNumber,
      disposition: disposition as any,
      durationSeconds: duration,
      notes: `SIM Bridge Call Simulator (${updated.simUsed} - ${updated.carrierName}): ${disposition}`,
    });
  }

  res.json({ success: true, call: updated, simulatedAction });
});

// -------------------------------------------------------------
// 22. TELEPHONY DASHBOARD & CALL ANALYTICS ENGINE
// -------------------------------------------------------------

apiRouter.get('/telephony/dashboard', authenticateToken, (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const userRole = req.user!.role;
  const canViewAll = userRole === 'admin' || userRole === 'team_leader' || req.user!.permissions?.canViewAllLeads;
  const canViewPhone = req.user!.permissions?.canViewCandidatePhone ?? (userRole !== 'recruiter');

  const { period = 'today', recruiterId, sim } = req.query as {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'all';
    recruiterId?: string;
    sim?: 'SIM_1' | 'SIM_2' | 'all';
  };

  const users = db.getUsers().filter(u => u.isActive);
  const userMap = new Map(users.map(u => [u.id, u]));

  // Retrieve all call events from call bridge & crm calls
  const rawCalls = db.getAllCallBridgeCalls();
  const crmCalls = db.getCalls();

  // Merge crmCalls into call events if missing
  const mergedCalls: CallBridgeCallEvent[] = [...rawCalls];
  crmCalls.forEach(c => {
    if (!mergedCalls.some(mc => mc.id === c.id || (mc.leadId === c.leadId && Math.abs(new Date(mc.initiatedAt).getTime() - new Date(c.createdAt).getTime()) < 10000))) {
      mergedCalls.push({
        id: c.id,
        userId: c.recruiterId,
        leadId: c.leadId,
        candidateName: c.candidateName,
        phoneNumber: c.phone,
        simUsed: 'SIM_1',
        carrierName: 'Jio 5G',
        status: 'completed',
        durationSeconds: c.durationSeconds || 45,
        disposition: c.disposition,
        notes: c.notes,
        initiatedAt: c.createdAt,
        connectedAt: c.createdAt,
        endedAt: new Date(new Date(c.createdAt).getTime() + (c.durationSeconds || 45) * 1000).toISOString(),
      });
    }
  });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const weekStart = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Filter based on user scope
  let scopedCalls = mergedCalls;
  if (!canViewAll) {
    scopedCalls = scopedCalls.filter(c => c.userId === currentUserId);
  } else if (recruiterId && recruiterId !== 'all') {
    scopedCalls = scopedCalls.filter(c => c.userId === recruiterId);
  }

  if (sim && sim !== 'all') {
    scopedCalls = scopedCalls.filter(c => c.simUsed === sim);
  }

  // Active in-progress calls (Live mode)
  const activeCallsRaw = mergedCalls.filter(c => c.status === 'connected' || c.status === 'ringing');
  const activeCalls = activeCallsRaw.map(c => {
    const recruiter = userMap.get(c.userId);
    const maskedPhone = !canViewPhone && c.phoneNumber.length >= 7 
      ? c.phoneNumber.substring(0, 5) + '•••••'
      : c.phoneNumber;
    
    // Live ticking duration
    const started = new Date(c.connectedAt || c.initiatedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - started) / 1000));

    return {
      ...c,
      phoneNumber: maskedPhone,
      isPhoneMasked: !canViewPhone,
      recruiterName: recruiter?.name || 'Recruiter',
      recruiterRole: recruiter?.role || 'recruiter',
      teamName: recruiter?.teamName || 'Staffing Operations',
      liveDurationSeconds: elapsedSeconds,
    };
  });

  // Calls for selected period
  const filterByDate = (call: CallBridgeCallEvent, targetPeriod: string) => {
    const callDateStr = call.initiatedAt.split('T')[0];
    const callDate = new Date(call.initiatedAt);

    if (targetPeriod === 'today') return callDateStr === todayStr;
    if (targetPeriod === 'yesterday') return callDateStr === yesterdayStr;
    if (targetPeriod === 'week') return callDate >= weekStart;
    if (targetPeriod === 'month') return callDate >= monthStart;
    return true;
  };

  const periodCalls = scopedCalls.filter(c => filterByDate(c, period));
  const yesterdayCalls = scopedCalls.filter(c => filterByDate(c, 'yesterday'));

  // Calculate top 4 KPIs
  const totalCalls = periodCalls.length;
  const yesterdayTotalCalls = yesterdayCalls.length;
  const totalCallsDiff = yesterdayTotalCalls > 0 
    ? Math.round(((totalCalls - yesterdayTotalCalls) / yesterdayTotalCalls) * 100) 
    : 0;

  const connectedCallsList = periodCalls.filter(c => 
    c.durationSeconds > 0 || (c.disposition && !['Busy', 'No Answer', 'Switched Off', 'Invalid Number', 'Unreachable'].includes(c.disposition))
  );
  const connectedCount = connectedCallsList.length;
  const connectRate = totalCalls > 0 ? Math.round((connectedCount / totalCalls) * 1000) / 10 : 0;

  const yestConnectedCalls = yesterdayCalls.filter(c => 
    c.durationSeconds > 0 || (c.disposition && !['Busy', 'No Answer', 'Switched Off', 'Invalid Number', 'Unreachable'].includes(c.disposition))
  ).length;
  const yestConnectRate = yesterdayTotalCalls > 0 ? Math.round((yestConnectedCalls / yesterdayTotalCalls) * 1000) / 10 : 0;
  const connectRateDiff = Math.round((connectRate - yestConnectRate) * 10) / 10;

  const totalTalkSeconds = periodCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
  const avgTalkSeconds = connectedCount > 0 ? Math.round(totalTalkSeconds / connectedCount) : 0;

  const yestTotalTalkSeconds = yesterdayCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
  const talkTimeDiff = yestTotalTalkSeconds > 0 
    ? Math.round(((totalTalkSeconds - yestTotalTalkSeconds) / yestTotalTalkSeconds) * 100)
    : 0;

  const productiveDispositions = ['Connected – Interested', 'Interview Scheduled', 'Callback'];
  const productiveCalls = periodCalls.filter(c => c.disposition && productiveDispositions.includes(c.disposition));
  const productiveCount = productiveCalls.length;
  const productiveRate = connectedCount > 0 ? Math.round((productiveCount / connectedCount) * 1000) / 10 : 0;

  // Format durations
  const formatSeconds = (sec: number) => {
    if (sec <= 0) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Connected & Gap Analysis Targets
  const activeRecruiters = users.filter(u => u.role === 'recruiter' || u.role === 'team_leader');
  const targetPerRecruiter = 60; // 60 calls/day
  const recruiterCount = (!canViewAll || (recruiterId && recruiterId !== 'all')) ? 1 : Math.max(1, activeRecruiters.length);
  const totalDailyTarget = recruiterCount * targetPerRecruiter;
  const totalWeeklyTarget = totalDailyTarget * 5;
  const totalMonthlyTarget = totalDailyTarget * 22;

  const allWeekCalls = scopedCalls.filter(c => filterByDate(c, 'week'));
  const allMonthCalls = scopedCalls.filter(c => filterByDate(c, 'month'));

  const dailyActual = period === 'today' ? totalCalls : scopedCalls.filter(c => filterByDate(c, 'today')).length;
  const dailyGap = dailyActual - totalDailyTarget;
  const dailyPercent = totalDailyTarget > 0 ? Math.min(100, Math.round((dailyActual / totalDailyTarget) * 100)) : 0;

  const weeklyActual = allWeekCalls.length;
  const weeklyGap = weeklyActual - totalWeeklyTarget;
  const weeklyPercent = totalWeeklyTarget > 0 ? Math.min(100, Math.round((weeklyActual / totalWeeklyTarget) * 100)) : 0;

  const monthlyActual = allMonthCalls.length;
  const monthlyGap = monthlyActual - totalMonthlyTarget;
  const monthlyPercent = totalMonthlyTarget > 0 ? Math.min(100, Math.round((monthlyActual / totalMonthlyTarget) * 100)) : 0;

  // Hourly Distribution (9 AM to 7 PM working hours)
  const hoursMap: { [hour: string]: { calls: number; connected: number } } = {};
  for (let h = 9; h <= 19; h++) {
    const key = h.toString().padStart(2, '0');
    hoursMap[key] = { calls: 0, connected: 0 };
  }

  periodCalls.forEach(c => {
    const dt = new Date(c.initiatedAt);
    const h = dt.getHours().toString().padStart(2, '0');
    if (hoursMap[h]) {
      hoursMap[h].calls += 1;
      if (c.durationSeconds > 0 || (c.disposition && productiveDispositions.includes(c.disposition))) {
        hoursMap[h].connected += 1;
      }
    }
  });

  const hourlyDistribution = Object.keys(hoursMap).map(hKey => {
    const item = hoursMap[hKey];
    const hNum = parseInt(hKey, 10);
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const displayHour = hNum % 12 === 0 ? 12 : hNum % 12;
    const hourTarget = Math.round(totalDailyTarget / 8);
    const gap = item.calls - hourTarget;
    const rate = item.calls > 0 ? Math.round((item.connected / item.calls) * 100) : 0;
    const isPeak = (hNum >= 10 && hNum <= 12) || (hNum >= 15 && hNum <= 17);

    return {
      hour: `${hKey}:00`,
      hourLabel: `${displayHour} ${ampm}`,
      calls: item.calls,
      connected: item.connected,
      targetCalls: hourTarget,
      gap,
      connectRate: rate,
      isPeakHour: isPeak,
    };
  });

  // Call Summary 8 Metric Cards
  const getOutcomeStats = (matcher: (disp?: string, duration?: number) => boolean) => {
    const matched = periodCalls.filter(c => matcher(c.disposition, c.durationSeconds));
    const count = matched.length;
    const percent = totalCalls > 0 ? Math.round((count / totalCalls) * 1000) / 10 : 0;
    const totSec = matched.reduce((a, b) => a + (b.durationSeconds || 0), 0);
    const avgSec = count > 0 ? Math.round(totSec / count) : 0;
    return {
      count,
      percent,
      avgDuration: formatSeconds(avgSec),
    };
  };

  const callSummary = {
    connected: getOutcomeStats((d, dur) => 
      (dur !== undefined && dur > 0) || (d !== undefined && (d.includes('Connected') || d.includes('Interview')))
    ),
    busy: getOutcomeStats(d => d === 'Busy'),
    noAnswer: getOutcomeStats(d => d === 'No Answer'),
    switchedOff: getOutcomeStats(d => d === 'Switched Off' || d === 'Unreachable'),
    declined: getOutcomeStats(d => d === 'Not Interested' || d === 'Salary Issue' || d === 'Location Issue'),
    invalidNumber: getOutcomeStats(d => d === 'Invalid Number'),
    inbound: getOutcomeStats((d, dur) => d === 'Callback' || (dur !== undefined && dur > 60 && d === 'Connected – Interested')),
    followup: getOutcomeStats(d => d === 'Callback' || d === 'Call Back Later'),
  };

  // Recruiter Presence Status
  const recruiterPresence = users
    .filter(u => u.role === 'recruiter' || u.role === 'team_leader')
    .map(u => {
      const activeCall = activeCallsRaw.find(c => c.userId === u.id);
      const userTodayCalls = scopedCalls.filter(c => c.userId === u.id && filterByDate(c, 'today'));
      const userTodayConn = userTodayCalls.filter(c => c.durationSeconds > 0).length;
      const userTodaySec = userTodayCalls.reduce((a, b) => a + (b.durationSeconds || 0), 0);

      let status: 'in_call' | 'available' | 'wrap_up' | 'offline' = 'available';
      if (activeCall) {
        status = 'in_call';
      } else if (!u.isActive) {
        status = 'offline';
      }

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        teamName: u.teamName || 'Staffing',
        phone: u.phone,
        status,
        activeCall: activeCall ? {
          candidateName: activeCall.candidateName,
          carrierName: activeCall.carrierName,
          simSlot: activeCall.simUsed,
          durationSeconds: activeCall.durationSeconds || 15,
        } : null,
        todayCalls: userTodayCalls.length,
        todayConnected: userTodayConn,
        todayTalkSeconds: userTodaySec,
        todayTalkFormatted: formatSeconds(userTodaySec),
      };
    });

  // Recruiter Performance Table
  const recruiterPerformance = users
    .filter(u => u.role === 'recruiter' || u.role === 'team_leader')
    .map(u => {
      const userPeriodCalls = scopedCalls.filter(c => c.userId === u.id && filterByDate(c, period));
      const outCalls = userPeriodCalls.length;
      const target = period === 'today' ? u.dailyCallTarget || 60 
        : period === 'yesterday' ? u.dailyCallTarget || 60 
        : (u.dailyCallTarget || 60) * 5;
      
      const gap = outCalls - target;
      const achRate = target > 0 ? Math.round((outCalls / target) * 100) : 0;

      const connList = userPeriodCalls.filter(c => 
        c.durationSeconds > 0 || (c.disposition && productiveDispositions.includes(c.disposition))
      );
      const connCount = connList.length;
      const cRate = outCalls > 0 ? Math.round((connCount / outCalls) * 1000) / 10 : 0;

      const talkSec = userPeriodCalls.reduce((a, b) => a + (b.durationSeconds || 0), 0);
      const avgSec = connCount > 0 ? Math.round(talkSec / connCount) : 0;

      const interested = userPeriodCalls.filter(c => c.disposition === 'Connected – Interested').length;
      const scheduled = userPeriodCalls.filter(c => c.disposition === 'Interview Scheduled').length;

      let paceStatus: 'Ahead' | 'On Track' | 'Needs Attention' = 'On Track';
      if (achRate >= 100) paceStatus = 'Ahead';
      else if (achRate < 70) paceStatus = 'Needs Attention';

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        teamName: u.teamName || 'Staffing',
        outboundCalls: outCalls,
        targetCalls: target,
        gap,
        achievementRate: achRate,
        connectedCalls: connCount,
        connectRate: cRate,
        totalTalkSeconds: talkSec,
        totalTalkFormatted: formatSeconds(talkSec),
        avgTalkSeconds: avgSec,
        avgTalkFormatted: formatSeconds(avgSec),
        interestedCount: interested,
        interviewsScheduled: scheduled,
        paceStatus,
      };
    });

  // Recent detailed call logs (masked phone if restricted)
  const callLogs = periodCalls.slice(0, 50).map(c => {
    const recruiter = userMap.get(c.userId);
    const maskedPhone = !canViewPhone && c.phoneNumber.length >= 7 
      ? c.phoneNumber.substring(0, 5) + '•••••'
      : c.phoneNumber;

    return {
      ...c,
      phoneNumber: maskedPhone,
      isPhoneMasked: !canViewPhone,
      recruiterName: recruiter?.name || 'Recruiter',
      recruiterRole: recruiter?.role || 'recruiter',
      durationFormatted: formatSeconds(c.durationSeconds || 0),
    };
  });

  res.json({
    period,
    periodLabel: period === 'today' ? 'Today' : period === 'yesterday' ? 'Yesterday' : period === 'week' ? 'This Week' : 'This Month',
    lastUpdated: now.toISOString(),
    kpis: {
      totalCalls: {
        value: totalCalls,
        vsYesterdayPercent: totalCallsDiff,
        trend: totalCallsDiff >= 0 ? 'up' : 'down',
        target: totalDailyTarget,
        achievementPercent: totalDailyTarget > 0 ? Math.round((totalCalls / totalDailyTarget) * 100) : 0,
      },
      connectedCalls: {
        value: connectedCount,
        connectRate,
        vsYesterdayPercent: connectRateDiff,
        trend: connectRateDiff >= 0 ? 'up' : 'down',
        targetRate: 50,
      },
      talkTime: {
        totalSeconds: totalTalkSeconds,
        totalFormatted: formatSeconds(totalTalkSeconds),
        avgSeconds: avgTalkSeconds,
        avgFormatted: formatSeconds(avgTalkSeconds),
        vsYesterdayPercent: talkTimeDiff,
      },
      productiveOutcomes: {
        value: productiveCount,
        conversionRate: productiveRate,
        vsYesterdayPercent: totalCallsDiff >= 0 ? totalCallsDiff : 0,
      },
    },
    gapAnalysis: {
      dailyTarget: totalDailyTarget,
      dailyActual,
      dailyGap,
      dailyPercent,
      weeklyTarget: totalWeeklyTarget,
      weeklyActual,
      weeklyGap,
      weeklyPercent,
      monthlyTarget: totalMonthlyTarget,
      monthlyActual,
      monthlyGap,
      monthlyPercent,
      connectedTarget: Math.round(totalDailyTarget * 0.5),
      connectedActual: connectedCount,
      connectedGap: connectedCount - Math.round(totalDailyTarget * 0.5),
      connectedPercent: Math.min(100, Math.round((connectedCount / (totalDailyTarget * 0.5)) * 100)),
      hourlyDistribution,
      speedToCall: {
        under15m: { count: Math.round(totalCalls * 0.42), percent: 42 },
        m15to60: { count: Math.round(totalCalls * 0.31), percent: 31 },
        h1to4: { count: Math.round(totalCalls * 0.18), percent: 18 },
        over4h: { count: Math.max(1, Math.round(totalCalls * 0.09)), percent: 9 },
      },
    },
    callSummary,
    activeCalls,
    recruiterPresence,
    recruiterPerformance,
    callLogs,
  });
});

// Simulate placing a live active or completed call from dashboard
apiRouter.post('/telephony/simulate-call', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { 
    candidateName, 
    phoneNumber, 
    recruiterId, 
    simSlot = 'SIM_1', 
    mode = 'completed', // 'live' | 'completed'
    disposition = 'Connected – Interested',
    durationSeconds = 115,
  } = req.body;

  const targetUserId = recruiterId || req.user!.id;
  const users = db.getUsers();
  const recruiter = users.find(u => u.id === targetUserId) || req.user!;

  const newCall = db.createCallBridgeCall({
    userId: targetUserId,
    candidateName: candidateName || 'Candidate Simulation',
    phoneNumber: phoneNumber || ('98200' + Math.floor(10000 + Math.random() * 90000)),
    simUsed: simSlot,
    carrierName: simSlot === 'SIM_1' ? 'Jio 5G' : 'Airtel 4G',
    status: mode === 'live' ? 'connected' : 'completed',
    durationSeconds: mode === 'live' ? 12 : durationSeconds,
    disposition: mode === 'live' ? undefined : disposition,
    notes: `Telephony simulator call: ${mode === 'live' ? 'Live active call' : disposition}`,
  });

  // Broadcast to SSE clients if live
  if (mode === 'live') {
    broadcastCallBridgeEvent({ userId: targetUserId }, {
      type: 'CALL_STATUS_UPDATE',
      payload: {
        callId: newCall.id,
        status: 'connected',
        durationSeconds: 12,
        notes: newCall.notes,
      },
    });
  }

  res.json({
    success: true,
    call: newCall,
    message: mode === 'live' 
      ? `Live active call initiated for ${recruiter.name} with ${newCall.candidateName}` 
      : `Completed call logged with disposition "${disposition}"`,
  });
});

// End active call from Live Telephony monitor
apiRouter.post('/telephony/end-call', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { callId, disposition = 'Connected – Interested', durationSeconds = 65, notes } = req.body;

  if (!callId) {
    res.status(400).json({ error: 'callId is required' });
    return;
  }

  const updated = db.updateCallBridgeCall(callId, {
    status: 'completed',
    durationSeconds,
    disposition,
    notes: notes || `Call ended via Live Telephony Monitor (${disposition})`,
    endedAt: new Date().toISOString(),
  });

  if (updated?.userId) {
    broadcastCallBridgeEvent({ userId: updated.userId }, {
      type: 'CALL_STATUS_UPDATE',
      payload: {
        callId,
        status: 'completed',
        durationSeconds,
        disposition,
        notes: updated.notes,
      },
    });
  }

  res.json({ success: true, call: updated });
});

// Export Telephony CSV
apiRouter.get('/telephony/export-csv', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'recruiter' && req.user!.permissions?.canExportData === false) {
    res.status(403).json({ error: 'Access Denied: Telephony export is restricted by your administrator.' });
    return;
  }

  const calls = db.getAllCallBridgeCalls();
  const users = db.getUsers();
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const canViewPhone = req.user!.permissions?.canViewCandidatePhone ?? (req.user!.role !== 'recruiter');

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = ['Call ID', 'Timestamp', 'Recruiter', 'Candidate Name', 'Phone Number', 'SIM Slot', 'Carrier', 'Status', 'Duration (Seconds)', 'Disposition', 'Notes'];
  const rows = calls.map(c => {
    const rawPhone = c.phoneNumber;
    const phone = !canViewPhone && rawPhone.length >= 7 
      ? rawPhone.substring(0, 5) + '•••••'
      : rawPhone;

    return [
      escapeCsv(c.id),
      escapeCsv(c.initiatedAt),
      escapeCsv(userMap.get(c.userId) || c.userId),
      escapeCsv(c.candidateName),
      escapeCsv(phone),
      escapeCsv(c.simUsed),
      escapeCsv(c.carrierName),
      escapeCsv(c.status),
      escapeCsv(c.durationSeconds || 0),
      escapeCsv(c.disposition || 'N/A'),
      escapeCsv(c.notes || ''),
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="oak_telephony_call_logs.csv"');
  res.send(csvContent);
});

