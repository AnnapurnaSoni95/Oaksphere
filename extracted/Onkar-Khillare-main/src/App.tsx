import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';

import { DashboardPage } from './pages/DashboardPage';
import { MyDayPage } from './pages/MyDayPage';
import { CallingQueuePage } from './pages/CallingQueuePage';
import { LeadsPage } from './pages/LeadsPage';
import { FollowupsPage } from './pages/FollowupsPage';
import { InterviewsPage } from './pages/InterviewsPage';
import { JoiningsPage } from './pages/JoiningsPage';
import { ActionRequiredPage } from './pages/ActionRequiredPage';
import { ClientsJobsPage } from './pages/ClientsJobsPage';
import { RecruitersPage } from './pages/RecruitersPage';
import { ImportWizardPage } from './pages/ImportWizardPage';
import { DuplicateMergePage } from './pages/DuplicateMergePage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { PipelineKanbanPage } from './pages/PipelineKanbanPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PowerCallingPage } from './pages/PowerCallingPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { CallBridgePage } from './pages/CallBridgePage';
import { CallAnalyticsPage } from './pages/CallAnalyticsPage';
import { MobileBridgeCompanionPage } from './pages/MobileBridgeCompanionPage';

const ProtectedLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Loading OAKsphere Connect CRM...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/my-day" element={<MyDayPage />} />
            <Route path="/calling-queue" element={<CallingQueuePage />} />
            <Route path="/power-calling" element={<PowerCallingPage />} />
            <Route path="/call-bridge" element={<CallBridgePage />} />
            <Route path="/telephony" element={<CallAnalyticsPage />} />
            <Route path="/call-analytics" element={<CallAnalyticsPage />} />
            <Route path="/pipeline" element={<PipelineKanbanPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/followups" element={<FollowupsPage />} />
            <Route path="/interviews" element={<InterviewsPage />} />
            <Route path="/joinings" element={<JoiningsPage />} />
            <Route path="/action-required" element={<ActionRequiredPage />} />
            <Route path="/clients-jobs" element={<ClientsJobsPage />} />
            <Route path="/recruiters" element={<RecruitersPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/import" element={<ImportWizardPage />} />
            <Route path="/duplicates" element={<DuplicateMergePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/bridge/mobile" element={<MobileBridgeCompanionPage />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

