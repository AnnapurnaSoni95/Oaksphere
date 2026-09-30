# OAKsphere Connect — High-Volume Bulk Staffing & Recruitment CRM

> **Enterprise Operations Engine for Bulk Hiring Agencies, RPO Teams, and High-Velocity Staffing Desks.**

---

## 1. Project Overview

**OAKsphere Connect** is a high-volume recruitment CRM designed for bulk-staffing agencies, RPO (Recruitment Process Outsourcing) firms, and telesales recruitment teams managing thousands of candidates, client job openings, daily calling quotas, interview walk-ins, and offer-to-joining pipelines.

### Core Stack
- **Frontend Framework**: React 19 (SPA) with TypeScript
- **Bundler & Tooling**: Vite 8, Tailwind CSS v4, TypeScript 5.8
- **UI Components & Icons**: Lucide React, Recharts data visualization
- **Backend Server**: Node.js Express server mounted via `server.ts` (`tsx` in dev, static dist in prod)
- **Database & Persistence**: In-memory ACID-style JSON document store (`data/crm_store.json`) with automated atomic persistence, seed fallback, and audit logging
- **Authentication**: Stateless HMAC-SHA256 JWT auth with role-based access control (RBAC), candidate phone masking permissions, and a 1-click Demo Role Switcher

---

## 2. Setup & Development Instructions

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or bun

### Local Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (optional for local testing; defaults are provided)
cp .env.example .env

# 3. Run the development server (runs Express API on port 3000 with Vite middleware)
npm run dev

# 4. Open in browser
http://localhost:3000
```

### Verification & Testing
```bash
# Run automated database integrity, phone normalization, and auth token tests
npx tsx tests/crm_verify.ts

# Run TypeScript type check
npm run lint

# Build for production
npm run build
```

---

## 3. Folder Structure

```
├── .env.example             # Documented environment variables template
├── metadata.json            # AI Studio applet configuration & capabilities
├── package.json             # Dependencies and scripts (dev, build, lint, start)
├── tsconfig.json            # Strict TypeScript configuration
├── vite.config.ts           # Vite bundler configuration
├── server.ts                # Express backend entry point (Vite middleware in dev, dist in prod)
├── index.html               # Main HTML entry point with synced SEO metadata
│
├── data/                    # Database storage
│   └── crm_store.json       # Persisted JSON document database store
│
├── tests/                   # Verification and test suites
│   └── crm_verify.ts        # Automated verification of phone normalization, auth, & entities
│
├── server/                  # Backend API, Authentication & Database Engine
│   ├── auth.ts              # JWT signing, verification, RBAC middleware, and permission checks
│   ├── db.ts                # Database class, JSON persistence, seeding, search, and activity logs
│   ├── routes.ts            # REST API endpoints, webhook receivers, and SSE stream handlers
│   └── types.ts             # Server-side TypeScript interfaces, enums, and domain types
│
└── src/                     # Client Frontend Application
    ├── main.tsx             # React entry point mounting App to DOM root
    ├── index.css            # Tailwind CSS global import and base styles
    ├── App.tsx              # Router configuration, protected layouts, and route definitions
    │
    ├── context/             # Global Application State
    │   └── AuthContext.tsx  # User session, JWT tokens, active recruiter state, demo switcher
    │
    ├── lib/                 # Shared Client Libraries & Types
    │   ├── api.ts           # Type-safe apiRequest wrapper, WhatsApp protocol launcher, time formatters
    │   └── types.ts         # Frontend TypeScript interfaces, CRM settings, and Telephony data types
    │
    ├── components/          # Reusable UI Component Library
    │   ├── common/          # Atomic UI elements
    │   │   ├── Badge.tsx    # PriorityBadge, StatusBadge, PhoneStatusBadge, MatchBadge
    │   │   ├── Modal.tsx    # Reusable accessible Modal dialog wrapper
    │   │   └── OakLogo.tsx  # OAKsphere SVG emblems and brand marks
    │   ├── layout/          # Application shell
    │   │   ├── Navbar.tsx   # Top navigation bar, demo account switcher, active user menu
    │   │   └── Sidebar.tsx  # Left navigation sidebar categorized by workspace domain
    │   └── leads/           # Candidate & Lead specific components
    │       ├── BulkActionBar.tsx         # Floating/sticky bulk assignment & status updates bar
    │       ├── BulkAssignModal.tsx       # Modal for bulk allocating leads to recruiters
    │       ├── CallModal.tsx             # Interactive in-CRM dialer and disposition logger
    │       ├── LeadCard.tsx              # High-density candidate card for grid view
    │       ├── LeadDetailModal.tsx       # Comprehensive 360-degree candidate dossier & audit trail
    │       ├── NewLeadModal.tsx          # Manual lead ingestion modal with phone validation
    │       ├── ScreeningScorecardModal.tsx# Structured hiring scorecard & dealbreaker assessment
    │       ├── SmartJobMatcherModal.tsx  # Algorithmic job recommendation tagger
    │       └── TemplateDrawerModal.tsx   # Fast WhatsApp messaging template selector
    │
    └── pages/               # Page Views & Workspaces (24 Modules)
        ├── DashboardPage.tsx             # High-level agency KPI overview & funnel snapshot
        ├── MyDayPage.tsx                 # Recruiter daily action agenda, urgent tasks & lineups
        ├── CallingQueuePage.tsx          # Prioritized calling queue with 1-click speed dialing
        ├── PowerCallingPage.tsx          # Rapid calling console with keyboard hotkeys
        ├── CallBridgePage.tsx            # Desktop-to-Phone SIM bridge relay & pairing console
        ├── CallAnalyticsPage.tsx         # Telephony Dashboard, Live Active Monitor & Gap Analysis
        ├── PipelineKanbanPage.tsx        # Multi-stage recruitment pipeline drag/move board
        ├── LeadsPage.tsx                 # Primary candidate directory (dense grid & table views)
        ├── FollowupsPage.tsx             # Follow-up tracker with overdue escalation auditing
        ├── InterviewsPage.tsx            # Walk-in & virtual interview lineup schedule tracker
        ├── JoiningsPage.tsx              # Post-selection onboarding tracker & document checklist
        ├── ActionRequiredPage.tsx        # Executive exception management & compliance alerts
        ├── ClientsJobsPage.tsx           # Client accounts, openings, and commercial terms
        ├── RecruitersPage.tsx            # Staff roster, daily calling quotas & target manager
        ├── LeaderboardPage.tsx           # Gamified recruiter rankings, streaks & incentives
        ├── ReportsPage.tsx               # End-to-end recruitment funnel & lead aging reports
        ├── TemplatesPage.tsx             # WhatsApp & SMS outreach templates manager
        ├── ImportWizardPage.tsx          # CSV/XLSX bulk candidate import with column mapper
        ├── DuplicateMergePage.tsx        # Duplicate phone/email detection & merge resolver
        ├── NotificationsPage.tsx         # Real-time alert center and system pings
        ├── AuditLogPage.tsx              # Tamper-evident compliance and user action audit trail
        ├── SettingsPage.tsx              # CMS configuration, Meta Lead Ads & Google Ads sync
        ├── LoginPage.tsx                 # Authentication screen with 1-click role switcher
        └── MobileBridgeCompanionPage.tsx # Lightweight mobile companion view for paired phones
```

---

## 4. Feature Map

| Feature / Module | Primary File | Supporting Files | Purpose |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | `src/context/AuthContext.tsx` | `server/auth.ts`, `src/pages/LoginPage.tsx` | JWT issuance, role-based authorization (Admin, TL, Recruiter), permission enforcement |
| **CRM Dashboard** | `src/pages/DashboardPage.tsx` | `server/routes.ts` (`/api/dashboard`) | High-level metrics, funnel stage cards, quick recruiter shortcuts |
| **My Day (Tasks)** | `src/pages/MyDayPage.tsx` | `server/routes.ts` (`/api/my-day`) | Actionable personal agenda: overdue follow-ups, pending confirmations, scheduled walk-ins |
| **Calling Queue** | `src/pages/CallingQueuePage.tsx` | `src/components/leads/CallModal.tsx` | Prioritized lead queue sorted by urgency, heat score, and last contact date |
| **Power Calling Mode** | `src/pages/PowerCallingPage.tsx` | `src/components/leads/CallModal.tsx` | Rapid-fire telecalling interface with keyboard shortcuts (Space to dial, 1–5 for dispositions) |
| **Phone SIM Bridge** | `src/pages/CallBridgePage.tsx` | `src/pages/MobileBridgeCompanionPage.tsx`, `server/routes.ts` | Relays calls from desktop CRM to physical smartphone SIM card via WebSockets/SSE without VoIP fees |
| **Telephony Analytics** | `src/pages/CallAnalyticsPage.tsx` | `server/routes.ts` (`/api/telephony/*`) | Live active call monitor, daily/weekly/monthly gap analysis, 8-card disposition breakdown, audio player |
| **Kanban Pipeline** | `src/pages/PipelineKanbanPage.tsx`| `src/components/leads/LeadCard.tsx` | Visual stage progression from New → Calling → Interested → Interview → Joined |
| **Candidate Directory** | `src/pages/LeadsPage.tsx` | `src/components/leads/LeadCard.tsx`, `BulkActionBar.tsx` | Dense 4-column card grid & compact table view with multi-select bulk operations |
| **Follow-up Engine** | `src/pages/FollowupsPage.tsx` | `server/routes.ts` (`/api/followups`) | Scheduled callback reminders, overdue alerts, and team leader escalations |
| **Interviews & Lineups**| `src/pages/InterviewsPage.tsx` | `server/routes.ts` (`/api/interviews`) | Walk-in drive scheduling, candidate attendance tracking, morning confirmation calls |
| **Joining Tracker** | `src/pages/JoiningsPage.tsx` | `server/routes.ts` (`/api/joinings`) | Offer letter generation, KYC document checklists, reporting confirmation |
| **Action Required** | `src/pages/ActionRequiredPage.tsx`| `server/routes.ts` (`/api/action-required`) | Exception manager: 24h+ uncontacted leads, overdue interviews, missing salary documentation |
| **Clients & Jobs** | `src/pages/ClientsJobsPage.tsx` | `server/routes.ts` (`/api/clients`, `/jobs`) | Corporate client accounts, job vacancies, salary budgets, and placement billing terms |
| **Recruiters & Quotas** | `src/pages/RecruitersPage.tsx` | `server/routes.ts` (`/api/users`) | Staff targets (daily calls, connected target, monthly joinings) and permission toggles |
| **Leaderboard** | `src/pages/LeaderboardPage.tsx` | `server/routes.ts` (`/api/leaderboard`) | Recruiter rankings, streak days, incentive tiers, and peer gamification |
| **Funnel & Reports** | `src/pages/ReportsPage.tsx` | `server/routes.ts` (`/api/reports/funnel`) | Full funnel conversion analysis, lead aging buckets (0-3d, 4-7d, 8-14d, 15d+), missed follow-ups |
| **WhatsApp Templates** | `src/pages/TemplatesPage.tsx` | `src/components/leads/TemplateDrawerModal.tsx` | Screening pitches, interview venue maps, and document checklists with dynamic variable substitution |
| **CSV/XLSX Import** | `src/pages/ImportWizardPage.tsx`| `server/routes.ts` (`/api/import/validate`, `/commit`) | Column auto-mapping, duplicate checking, and validation error preview before committing leads |
| **Duplicate Merge** | `src/pages/DuplicateMergePage.tsx`| `server/routes.ts` (`/api/duplicates/*`) | Automated phone normalization duplicate detection with side-by-side field merge |
| **Notification Center** | `src/pages/NotificationsPage.tsx`| `server/routes.ts` (`/api/notifications`) | Real-time system notifications, overdue task reminders, and supervisor escalations |
| **Compliance Audit** | `src/pages/AuditLogPage.tsx` | `server/routes.ts` (`/api/audit-logs`) | Tamper-evident logging of status transitions, lead transfers, deletions, and CSV downloads |
| **Agency Settings** | `src/pages/SettingsPage.tsx` | `server/routes.ts` (`/api/settings`) | Agency CMS details, Meta Lead Ads webhook simulator, Google Ads conversion sync |

---

## 5. Architecture & Data Flow

### Frontend Architecture
- **Single Page Application (SPA)** routed using `react-router-dom` v7.
- **Root Layout (`src/App.tsx`)**: Wraps routes in `AuthProvider`, validates user session, and renders `Navbar` and `Sidebar` around `<Routes>`.
- **Public Companion Route (`/bridge/mobile`)**: Standalone lightweight page decoupled from the CRM shell, optimized for recruiters' physical Android/iOS phones to pair with desktop browsers.
- **State Management**:
  - `AuthContext`: Centralized user identity, role, permissions, and demo account switching.
  - Page-level data fetching with atomic updates and optimism for instant UI responsiveness.
- **Styling**: Tailwind CSS v4 using modern `@import "tailwindcss";` conventions with zero inline style baggage.

### Backend Architecture
- **Express API Router (`server/routes.ts`)**: Mounted under `/api/*` in `server.ts`.
- **Stateless HMAC Authentication (`server/auth.ts`)**: Cryptographically signs user tokens without heavy external database sessions.
- **Persistence Engine (`server/db.ts`)**: ACID-compliant in-memory store that synchronously reads from and writes to `data/crm_store.json`. Handles automated seed self-healing if files are missing or incomplete.
- **Phone Number Sanitization & Normalization (`normalizePhoneNumber`)**:
  - Automatically cleans raw strings (e.g. `+91 98200 11223` -> `9820011223`).
  - Distinguishes 10-digit valid Indian mobile prefixes (`6, 7, 8, 9`) from malformed numbers.
  - Flags status as `VERIFIED`, `NEEDS_VERIFY`, or `INVALID`.

---

## 6. Environment Variables

| Variable Name | Required | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `3000` | Port on which the Express server and Vite middleware listen. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development` or `production`). |
| `JWT_SECRET` | Optional | `oaksphere_connect_jwt_secret_2026_recruitment_crm` | Cryptographic secret key used to sign and verify HMAC-SHA256 JWT tokens. |
| `GEMINI_API_KEY` | Optional | User Secret | Injected by AI Studio if Gemini server-side operations are invoked. |
| `APP_URL` | Optional | Cloud Run URL | Canonical URL of the hosted application for self-referential links. |

---

## 7. Important Dependencies

- `express` (^4.21.2): Backend REST API server and SSE event broker.
- `react` & `react-dom` (^19.0.1): Core user interface framework.
- `react-router-dom` (^7.18.4): Client-side SPA routing and navigation.
- `lucide-react` (^0.546.0): Uniform, accessible icon set.
- `recharts` (^3.10.1): Responsive SVG charts for the Telephony Dashboard, recruitment funnel, and hourly call distribution.
- `tailwindcss` (^4.3.3): Utility-first CSS styling engine.
- `tsx` (^4.21.0): Zero-configuration TypeScript Node execution engine for `server.ts`.

---

## 8. Developer Safety Notes & Guardrails

1. **Do NOT Modify `canAccessLead` in `server/auth.ts` Without Checking All Lead Endpoints**:
   - `canAccessLead` enforces multi-tenant recruiter isolation. Modifying it will cause data leakage where recruiters can view or modify leads belonging to other agents or teams.
2. **Do NOT Bypass Phone Masking in API Endpoints**:
   - Recruiters have `permissions.canViewCandidatePhone: false` by default. When modifying lead queries or exports, ensure phone masking logic is preserved (`+91 98203•••••`).
3. **Database State Persistence (`server/db.ts`)**:
   - Always call `this.save()` after mutating any array on `this.state`. Omitting `this.save()` will result in data loss upon server restart.
4. **Vite Middleware Mounting (`server.ts`)**:
   - Do NOT mount Express inside `vite.config.ts`. In full-stack AI Studio environments, Express is the primary server and mounts Vite's middlewares (`vite.middlewares`).
