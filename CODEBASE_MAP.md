# OAKsphere Connect — Codebase Architecture & Feature Map

This document is a comprehensive navigation guide for developers and engineers maintaining, extending, or refactoring the **OAKsphere Connect CRM** codebase.

---

## 1. Quick Navigation Table

| Feature / Domain | Primary Component / View | API Route / Endpoint | Data Store Collection | Related Files |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | `src/context/AuthContext.tsx` | `/api/auth/*` | `users` | `server/auth.ts`, `src/pages/LoginPage.tsx` |
| **CRM Dashboard** | `src/pages/DashboardPage.tsx` | `/api/dashboard` | Aggregated | `src/components/common/Badge.tsx` |
| **My Day (Tasks)** | `src/pages/MyDayPage.tsx` | `/api/my-day` | `leads`, `interviews`, `followups` | `src/components/leads/LeadCard.tsx` |
| **Calling Queue** | `src/pages/CallingQueuePage.tsx` | `/api/leads?queue=true` | `leads` | `src/components/leads/CallModal.tsx` |
| **Power Calling Mode** | `src/pages/PowerCallingPage.tsx` | `/api/leads/:id/call` | `leads`, `callEvents` | `src/components/leads/CallModal.tsx` |
| **Phone SIM Bridge** | `src/pages/CallBridgePage.tsx` | `/api/call-bridge/*` | `bridgeDevices`, `bridgeEvents` | `src/pages/MobileBridgeCompanionPage.tsx` |
| **Telephony Analytics** | `src/pages/CallAnalyticsPage.tsx`| `/api/telephony/dashboard` | `callEvents`, `bridgeEvents` | `recharts`, `server/routes.ts` |
| **Pipeline Kanban** | `src/pages/PipelineKanbanPage.tsx`| `/api/leads/:id/stage` | `leads` | `src/components/leads/LeadCard.tsx` |
| **Candidate Directory**| `src/pages/LeadsPage.tsx` | `/api/leads` | `leads` | `src/components/leads/BulkActionBar.tsx` |
| **Bulk Actions Engine**| `src/components/leads/BulkActionBar.tsx`| `/api/leads/bulk-*` | `leads` | `src/components/leads/BulkAssignModal.tsx` |
| **Follow-up Tracker** | `src/pages/FollowupsPage.tsx` | `/api/followups` | `leads` (followupDate) | `src/components/leads/LeadDetailModal.tsx` |
| **Interviews & Lineups**| `src/pages/InterviewsPage.tsx` | `/api/interviews` | `interviews` | `src/components/leads/LeadDetailModal.tsx` |
| **Joining Tracker** | `src/pages/JoiningsPage.tsx` | `/api/joinings` | `joinings` | `src/components/leads/LeadDetailModal.tsx` |
| **Action Required** | `src/pages/ActionRequiredPage.tsx`| `/api/action-required` | Aggregated exceptions | `src/components/leads/LeadDetailModal.tsx` |
| **Clients & Job Vacancies**| `src/pages/ClientsJobsPage.tsx`| `/api/clients`, `/api/jobs` | `clients`, `jobOpenings` | `src/components/leads/SmartJobMatcherModal.tsx` |
| **Recruiters & Quotas**| `src/pages/RecruitersPage.tsx` | `/api/users` | `users` | `src/context/AuthContext.tsx` |
| **Leaderboard & Ranks**| `src/pages/LeaderboardPage.tsx` | `/api/leaderboard` | `users`, `callEvents` | `src/components/common/Badge.tsx` |
| **Funnel & Aging Reports**| `src/pages/ReportsPage.tsx` | `/api/reports/funnel` | Aggregated | `recharts` |
| **WhatsApp Templates** | `src/pages/TemplatesPage.tsx` | `/api/templates` | `templates` | `src/components/leads/TemplateDrawerModal.tsx` |
| **CSV Bulk Import** | `src/pages/ImportWizardPage.tsx`| `/api/import/*` | `leads` | `server/db.ts` (normalizePhoneNumber) |
| **Duplicate Merge** | `src/pages/DuplicateMergePage.tsx`| `/api/duplicates/*` | `leads` | `src/components/common/Badge.tsx` |
| **Notification Center**| `src/pages/NotificationsPage.tsx`| `/api/notifications` | `notifications` | `src/components/layout/Navbar.tsx` |
| **Compliance Audit Log**| `src/pages/AuditLogPage.tsx` | `/api/audit-logs` | `auditLogs` | `server/db.ts` (logAudit) |
| **Agency Settings & Ads**| `src/pages/SettingsPage.tsx` | `/api/settings` | `settings` | `server/routes.ts` |

---

## 2. Detailed Module Breakdown

### 1. Authentication & Role Switcher
- **Primary Location**: `src/context/AuthContext.tsx`
- **Related Files**: `server/auth.ts`, `src/pages/LoginPage.tsx`, `src/components/layout/Navbar.tsx`
- **Dependencies**: React Context, `localStorage`, `server/auth.ts` (JWT generator/verifier)
- **Used By**: All pages via `useAuth()` hook.
- **Modification Warning**: Do NOT remove the demo user token injection in `switchUser()`. In preview environments, the 1-click switcher allows testers and stakeholders to instantly evaluate Admin, Team Leader, and Recruiter views without re-typing passwords.

### 2. Phone SIM Call Bridge & Mobile Companion
- **Primary Location**: `src/pages/CallBridgePage.tsx`
- **Mobile Client**: `src/pages/MobileBridgeCompanionPage.tsx` (accessible via route `/bridge/mobile`)
- **Backend Handlers**: `server/routes.ts` (lines 4300–4750)
- **Data Collections**: `this.state.bridgeDevices`, `this.state.bridgeCallEvents`
- **How It Works**:
  1. Recruiter pairs their smartphone by scanning the QR code or visiting `/bridge/mobile?code=OAK-BRIDGE-7821`.
  2. Clicking "Call" in the CRM triggers `/api/call-bridge/trigger-call`.
  3. The paired phone's SSE/long-poll stream immediately receives the `DIAL_REQUEST`.
  4. The phone executes the call through the device's native SIM card (SIM 1 or SIM 2) via `tel:+91...`.
  5. The mobile companion posts call status events (`RINGING`, `CONNECTED`, `COMPLETED`, call duration, and SIM slot) back to `/api/call-bridge/report-event`.
  6. Call duration and disposition are automatically recorded in the candidate's CRM timeline.

### 3. Telephony Dashboard & Live Monitor
- **Primary Location**: `src/pages/CallAnalyticsPage.tsx`
- **API Endpoint**: `GET /api/telephony/dashboard`
- **Key Features**:
  - Live Active Calls ticker with duration counters and live supervisor audio monitor simulator.
  - Recruiter Daily Targets vs Actuals with gap analysis (`gapCalls`, `gapConnected`).
  - 8-Disposition breakdown cards (Connected, Not Reachable, Busy, Switched Off, Callback Scheduled, Interested, Not Interested, Invalid Number).
  - Hourly call volume distribution chart (9 AM to 8 PM).
  - Recent Call Logs table with audio recording playback modal and dual SIM badge indicators.

### 4. Candidate Leads Management & Bulk Engine
- **Primary Location**: `src/pages/LeadsPage.tsx`
- **Components**:
  - `src/components/leads/LeadCard.tsx`: High-density 4-column card view with quick action buttons.
  - `src/components/leads/BulkActionBar.tsx`: Floating action toolbar displaying selected count and batch operations.
  - `src/components/leads/BulkAssignModal.tsx`: Allocation modal for distributing candidates evenly across selected recruiters.
  - `src/components/leads/LeadDetailModal.tsx`: 360-degree candidate dossier containing activity history, screening scorecards, and timeline.
- **Data Model**: `Lead` interface in `src/lib/types.ts` and `server/types.ts`.

### 5. Smart Job Matcher & Screening Scorecards
- **Primary Locations**:
  - `src/components/leads/SmartJobMatcherModal.tsx`: Real-time matching algorithm evaluating candidate experience, target CTC, skills, and current location against active `jobOpenings`.
  - `src/components/leads/ScreeningScorecardModal.tsx`: Structured 5-pillar assessment (Communication, Experience Relevance, Tech/Process Fit, Notice Period, Salary Expectation) with auto-calculated weighted score and Dealbreaker flags.

### 6. CSV/XLSX Bulk Import Wizard
- **Primary Location**: `src/pages/ImportWizardPage.tsx`
- **Backend Endpoints**:
  - `POST /api/import/validate`: Inspects headers, parses sample rows, auto-detects column mappings (Phone, Name, Email, Experience, Current CTC), and flags validation warnings.
  - `POST /api/import/commit`: Persists leads, normalizes phone numbers, assigns default recruiter, and logs audit events.

### 7. Duplicate Phone Detection & Field Merge
- **Primary Location**: `src/pages/DuplicateMergePage.tsx`
- **Backend Endpoints**:
  - `GET /api/duplicates`: Groups leads sharing normalized 10-digit phone numbers or email addresses.
  - `POST /api/duplicates/merge`: Performs field-level merge (selecting Primary vs Duplicate attributes, combining activity histories, updating interview references).

---

## 3. Data Flow & State Lifecycle

```
[User Action in Browser]
         │
         ▼
[React Page / Component]
         │  (uses apiRequest from src/lib/api.ts)
         ▼
[Express Server: server/routes.ts]
         │
         ├──► [auth.ts: authenticateToken & requireRole]
         │          │ (Validates JWT, enforces phone masking & recruiter isolation)
         │          ▼
         └──► [db.ts: Database Engine]
                    │
                    ├──► [Mutates in-memory state: this.state.leads, etc.]
                    ├──► [Logs audit trail: this.logAudit(...)]
                    └──► [Persists atomically to data/crm_store.json: this.save()]
```

---

## 4. API Endpoints Reference

### Auth & User Management
- `POST /api/auth/login`: Authenticates user credentials and returns JWT token.
- `GET /api/auth/me`: Fetches current user profile and permission flags.
- `POST /api/auth/switch-demo`: Instantly swaps active user context for demo/testing.
- `GET /api/users`: Fetches recruiter roster, daily targets, and performance metrics.
- `PATCH /api/users/:id/targets`: Updates recruiter daily call targets and connected quotas.

### Candidate Leads
- `GET /api/leads`: Lists leads filtered by status, priority, recruiter, client, or search text.
- `POST /api/leads`: Ingests a new candidate with phone validation.
- `GET /api/leads/:id`: Returns full candidate details, scorecard, and activity logs.
- `PATCH /api/leads/:id`: Updates candidate fields.
- `PATCH /api/leads/:id/stage`: Transitions candidate pipeline stage.
- `POST /api/leads/:id/call`: Logs a telephonic outreach attempt and disposition.
- `POST /api/leads/bulk-assign`: Bulk reassigns an array of lead IDs to a recruiter.
- `POST /api/leads/bulk-status`: Bulk updates status for an array of lead IDs.

### Telephony & Phone Bridge
- `GET /api/telephony/dashboard`: Returns aggregate call stats, gaps, and disposition metrics.
- `GET /api/call-bridge/devices`: Lists registered mobile companion devices.
- `POST /api/call-bridge/pair`: Pairs a new smartphone bridge using a pairing code.
- `POST /api/call-bridge/trigger-call`: Dispatches a call command to the paired device.
- `GET /api/call-bridge/events`: Server-Sent Events (SSE) stream for real-time mobile sync.
- `POST /api/call-bridge/report-event`: Ingests call events from the mobile companion.

---

## 5. Coding Standards & Maintenance Guidelines
1. **Always use `apiRequest<T>`**: Client requests should go through `apiRequest<T>` in `src/lib/api.ts` to automatically attach the `Authorization: Bearer <token>` header.
2. **Never expose unmasked phone numbers to standard recruiters**: Always verify `req.user.permissions.canViewCandidatePhone`.
3. **Keep data in `data/crm_store.json` synchronized**: Any new entity array added to `server/types.ts` must be initialized in `server/db.ts`'s default state and written to disk via `this.save()`.
