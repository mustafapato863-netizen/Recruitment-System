import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PermissionGate } from './auth/PermissionGate';
import { LoginPage } from './auth/LoginPage';
import { ThemeProvider } from './theme/ThemeContext';
import { ToastProvider } from './components/ui/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoadingFallback } from './components/Spinner';

import './App.css';
import './styles/tokens.css';
import './styles/ui-primitives.css';
import './styles/design-system.css';
import './styles/shell.css';
import './styles/polish.css';
import './styles/source-integration.css';
import './styles/v2-parity.css';

// Lazy loaded page components for optimal bundle splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const UsersRolesPage = lazy(() => import('./pages/UsersRolesPage').then((m) => ({ default: m.UsersRolesPage })));
const MasterDataPage = lazy(() => import('./pages/MasterDataPage').then((m) => ({ default: m.MasterDataPage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const VacancyRequestsPage = lazy(() => import('./pages/VacancyRequestsPage').then((m) => ({ default: m.VacancyRequestsPage })));
const CreateVacancyRequestPage = lazy(() => import('./pages/CreateVacancyRequestPage').then((m) => ({ default: m.CreateVacancyRequestPage })));
const VacancyRequestDetailPage = lazy(() => import('./pages/VacancyRequestDetailPage').then((m) => ({ default: m.VacancyRequestDetailPage })));
const ApprovalInboxPage = lazy(() => import('./pages/ApprovalInboxPage').then((m) => ({ default: m.ApprovalInboxPage })));
const VacantListPage = lazy(() => import('./pages/VacantListPage').then((m) => ({ default: m.VacantListPage })));
const VacancyOverviewPage = lazy(() => import('./pages/VacancyOverviewPage').then((m) => ({ default: m.VacancyOverviewPage })));
const JobAnalyticsPage = lazy(() => import('./pages/JobAnalyticsPage').then((m) => ({ default: m.JobAnalyticsPage })));
const CandidatesPage = lazy(() => import('./pages/CandidatesPage').then((m) => ({ default: m.CandidatesPage })));
const CandidateDetailPage = lazy(() => import('./pages/CandidateDetailPage').then((m) => ({ default: m.CandidateDetailPage })));
const CandidateDocumentsPage = lazy(() => import('./pages/CandidateDocumentsPage').then((m) => ({ default: m.CandidateDocumentsPage })));
const CVBankPage = lazy(() => import('./pages/CVBankPage').then((m) => ({ default: m.CVBankPage })));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })));
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage })));
const StageTransitionPage = lazy(() => import('./pages/StageTransitionPage').then((m) => ({ default: m.StageTransitionPage })));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage').then((m) => ({ default: m.InterviewsPage })));
const InterviewCalendarPage = lazy(() => import('./pages/InterviewCalendarPage').then((m) => ({ default: m.InterviewCalendarPage })));
const InterviewDetailPage = lazy(() => import('./pages/InterviewDetailPage').then((m) => ({ default: m.InterviewDetailPage })));
const OffersPage = lazy(() => import('./pages/OffersPage').then((m) => ({ default: m.OffersPage })));
const CreateOfferPage = lazy(() => import('./pages/CreateOfferPage').then((m) => ({ default: m.CreateOfferPage })));
const OfferDetailPage = lazy(() => import('./pages/OfferDetailPage').then((m) => ({ default: m.OfferDetailPage })));
const OfferApprovalInboxPage = lazy(() => import('./pages/OfferApprovalInboxPage').then((m) => ({ default: m.OfferApprovalInboxPage })));
const HireManagementPage = lazy(() => import('./pages/HireManagementPage').then((m) => ({ default: m.HireManagementPage })));
const HiringCasePage = lazy(() => import('./pages/HiringCasePage').then((m) => ({ default: m.HiringCasePage })));
const FinalApprovalInboxPage = lazy(() => import('./pages/FinalApprovalInboxPage').then((m) => ({ default: m.FinalApprovalInboxPage })));
const LicenseManagementPage = lazy(() => import('./pages/LicenseManagementPage').then((m) => ({ default: m.LicenseManagementPage })));
const JoiningManagementPage = lazy(() => import('./pages/JoiningManagementPage').then((m) => ({ default: m.JoiningManagementPage })));
const TalentPoolPage = lazy(() => import('./pages/TalentPoolPage').then((m) => ({ default: m.TalentPoolPage })));
const TalentPoolDetailPage = lazy(() => import('./pages/TalentPoolDetailPage').then((m) => ({ default: m.TalentPoolDetailPage })));
const ImportPreviewPage = lazy(() => import('./pages/ImportPreviewPage').then((m) => ({ default: m.ImportPreviewPage })));
const BulkImportPage = lazy(() => import('./pages/BulkImportPage').then((m) => ({ default: m.BulkImportPage })));
const CVIntakePage = lazy(() => import('./pages/CVIntakePage').then((m) => ({ default: m.CVIntakePage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const PipelineSettingsPage = lazy(() => import('./pages/PipelineSettingsPage').then((m) => ({ default: m.PipelineSettingsPage })));
const EmailTemplatesPage = lazy(() => import('./pages/EmailTemplatesPage').then((m) => ({ default: m.EmailTemplatesPage })));
const PositionLevelTargetSettingsPage = lazy(() => import('./pages/PositionLevelTargetSettingsPage').then((m) => ({ default: m.PositionLevelTargetSettingsPage })));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })));
const CandidateComparisonPage = lazy(() => import('./pages/CandidateComparisonPage').then((m) => ({ default: m.CandidateComparisonPage })));
const ApplicantPortalPage = lazy(() => import('./pages/ApplicantPortalPage').then((m) => ({ default: m.ApplicantPortalPage })));
const AppShell = lazy(() => import('./layout/AppShell').then((m) => ({ default: m.AppShell })));

const ForgotPasswordPage = lazy(() => import('./auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const AcceptInvitationPage = lazy(() => import('./auth/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage })));
const VerifyEmailPage = lazy(() => import('./auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const PublicJobsPage = lazy(() => import('./public/PublicJobsPage').then((m) => ({ default: m.PublicJobsPage })));
const PublicJobDetailPage = lazy(() => import('./public/PublicJobDetailPage').then((m) => ({ default: m.PublicJobDetailPage })));
const PublicApplyPage = lazy(() => import('./public/PublicApplyPage').then((m) => ({ default: m.PublicApplyPage })));
const CandidateSelfSchedulePage = lazy(() => import('./pages/CandidateSelfSchedulePage').then((m) => ({ default: m.CandidateSelfSchedulePage })));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
                <Route path="/careers/:organizationCode/jobs" element={<PublicJobsPage />} />
                <Route path="/careers/:organizationCode/jobs/:vacancyCode/apply" element={<PublicApplyPage />} />
                <Route path="/careers/:organizationCode/jobs/:vacancyCode" element={<PublicJobDetailPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>

                  <Route path="/" element={<DashboardPage />} />
                  <Route
                    path="/users"
                    element={
                      <PermissionGate requiredPermission="USERS_VIEW">
                        <UsersRolesPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/master-data"
                    element={
                      <PermissionGate requiredPermission="MASTER_DATA_VIEW">
                        <MasterDataPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/audit-log"
                    element={
                      <PermissionGate requiredPermission="AUDIT_VIEW">
                        <AuditLogPage />
                      </PermissionGate>
                    }
                  />

                  {/* Vacancy Management */}
                  <Route path="/vacancy-requests" element={<PermissionGate requiredPermission="VACANCY_REQUEST_VIEW"><VacancyRequestsPage /></PermissionGate>} />
                  <Route path="/vacancy-requests/create" element={<PermissionGate requiredPermission="VACANCY_REQUEST_CREATE"><CreateVacancyRequestPage /></PermissionGate>} />
                  <Route path="/vacancy-requests/:id" element={<PermissionGate requiredPermission="VACANCY_REQUEST_VIEW"><VacancyRequestDetailPage /></PermissionGate>} />
                  <Route path="/approval-inbox" element={<PermissionGate requiredAnyPermission={['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL']}><ApprovalInboxPage /></PermissionGate>} />
                  <Route path="/vacancies" element={<PermissionGate requiredPermission="VACANCY_VIEW"><VacantListPage /></PermissionGate>} />
                  <Route path="/vacancies/:id" element={<PermissionGate requiredPermission="VACANCY_VIEW"><VacancyOverviewPage /></PermissionGate>} />
                  <Route path="/vacancies/:id/analytics" element={<PermissionGate requiredPermission="VACANCY_VIEW"><JobAnalyticsPage /></PermissionGate>} />

                  {/* Talent */}
                  <Route path="/candidates" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidatesPage /></PermissionGate>} />
                  <Route path="/candidates/compare" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidateComparisonPage /></PermissionGate>} />
                  <Route path="/candidates/:id" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidateDetailPage /></PermissionGate>} />
                  <Route path="/candidates/:id/documents" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidateDocumentsPage /></PermissionGate>} />
                  <Route path="/cv-bank" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CVBankPage /></PermissionGate>} />
                  <Route path="/talent-pool" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><TalentPoolPage /></PermissionGate>} />
                  <Route path="/talent-pool/:id" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><TalentPoolDetailPage /></PermissionGate>} />
                  <Route path="/cv-intake" element={<PermissionGate requiredPermission="CANDIDATE_CREATE"><CVIntakePage /></PermissionGate>} />
                  <Route path="/cv-intake/:jobId" element={<PermissionGate requiredPermission="CANDIDATE_CREATE"><ImportPreviewPage /></PermissionGate>} />
                  <Route path="/import/:dataset/:jobId" element={<PermissionGate requiredAnyPermission={['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW']}><BulkImportPage /></PermissionGate>} />
                  <Route path="/import" element={<PermissionGate requiredAnyPermission={['CANDIDATE_CREATE', 'VACANCY_REQUEST_CREATE', 'MASTER_DATA_MANAGE']}><BulkImportPage /></PermissionGate>} />

                  {/* Recruitment Pipeline */}
                  <Route path="/applications" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><ApplicationsPage /></PermissionGate>} />
                  <Route path="/applications/:id" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><ApplicationDetailPage /></PermissionGate>} />
                  <Route path="/applications/:id/transition" element={<PermissionGate requiredPermission="APPLICATION_MOVE_STAGE"><StageTransitionPage /></PermissionGate>} />
                  <Route path="/interviews" element={<PermissionGate requiredPermission="VACANCY_VIEW"><InterviewsPage /></PermissionGate>} />
                  <Route path="/interviews/calendar" element={<PermissionGate requiredPermission="VACANCY_VIEW"><InterviewCalendarPage /></PermissionGate>} />
                  <Route path="/interviews/:id" element={<PermissionGate requiredPermission="VACANCY_VIEW"><InterviewDetailPage /></PermissionGate>} />

                  {/* Offers */}
                  <Route path="/offers" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><OffersPage /></PermissionGate>} />
                  <Route path="/offers/create" element={<PermissionGate requiredPermission="APPLICATION_MOVE_STAGE"><CreateOfferPage /></PermissionGate>} />
                  <Route path="/offers/approvals/inbox" element={<PermissionGate requiredPermission="APPROVE_OFFERS"><OfferApprovalInboxPage /></PermissionGate>} />
                  <Route path="/offers/:id" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><OfferDetailPage /></PermissionGate>} />

                  {/* Hiring & Joining */}
                  <Route path="/hires" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><HireManagementPage /></PermissionGate>} />
                  <Route path="/hires/:id" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><HiringCasePage /></PermissionGate>} />
                  <Route path="/hires/approvals/inbox" element={<PermissionGate requiredPermission="FINAL_HIRING_APPROVAL"><FinalApprovalInboxPage /></PermissionGate>} />
                  <Route path="/licenses" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><LicenseManagementPage /></PermissionGate>} />
                  <Route path="/joinings" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><JoiningManagementPage /></PermissionGate>} />

                  {/* Analytics & System */}
                  <Route
                    path="/reports"
                    element={
                      <PermissionGate requiredPermission="APPLICATION_VIEW">
                        <ReportsPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/pipeline-settings"
                    element={
                      <PermissionGate requiredPermission="OVERRIDE_WORKFLOW">
                        <PipelineSettingsPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/email-templates"
                    element={
                      <PermissionGate requiredPermission="MASTER_DATA_MANAGE">
                        <EmailTemplatesPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/settings/targets"
                    element={
                      <PermissionGate requiredAnyPermission={['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'MASTER_DATA_VIEW']}>
                        <PositionLevelTargetSettingsPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/integrations"
                    element={
                      <PermissionGate requiredPermission="MASTER_DATA_VIEW">
                        <IntegrationsPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <PermissionGate requiredAnyPermission={['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW']}>
                        <SettingsPage />
                      </PermissionGate>
                    }
                  />
                  {/* Operational work surfaces */}
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/portal" element={<ApplicantPortalPage />} />
                  <Route path="/my-applications" element={<ApplicantPortalPage />} />
                  <Route path="/notifications" element={<PermissionGate requiredPermission="NOTIFICATION_VIEW"><NotificationsPage /></PermissionGate>} />
                  <Route path="/tasks" element={<PermissionGate requiredPermission="TASK_VIEW"><TasksPage /></PermissionGate>} />

                  {/* Component Showcase & Design System (Admin Only) */}
                  <Route
                    path="/components"
                    element={
                      <PermissionGate requiredPermission="USERS_VIEW">
                        <DesignSystemPage />
                      </PermissionGate>
                    }
                  />
                  <Route
                    path="/design-system"
                    element={
                      <PermissionGate requiredPermission="USERS_VIEW">
                        <DesignSystemPage />
                      </PermissionGate>
                    }
                  />

                  {/* 404 Catch All */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
                </Routes>
            </Suspense>
          </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
