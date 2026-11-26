import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequisitionsGate } from './auth/RequisitionsGate';
import { PermissionGate } from './auth/PermissionGate';
import { LoginPage } from './auth/LoginPage';
import { ThemeProvider } from './theme/ThemeContext';
import { ToastProvider } from './components/ui/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoadingFallback } from './components/Spinner';

import './App.css';
import './styles/tokens.css';
import './styles/density.css';
import './styles/tokens-v2.css';

// Lazy loaded page components for optimal bundle splitting. v2 is the only signed-in UI (v2 default):
// v1 URLs are redirected to their v2 equivalents by the shell (v2/destinations.ts), so only v2 routes exist here.
const JobsListRoute = lazy(() => import('./v2/pages/JobsRoute').then((m) => ({ default: m.JobsListRoute })));
const JobDetailRoute = lazy(() => import('./v2/pages/JobsRoute').then((m) => ({ default: m.JobDetailRoute })));
const UploadCvPage = lazy(() => import('./v2/pages/UploadCvPageV2').then((m) => ({ default: m.UploadCvPageV2 })));
const ApplicationRoute = lazy(() => import('./v2/pages/ApplicationRoute').then((m) => ({ default: m.ApplicationRoute })));
const ScreeningPage = lazy(() => import('./v2/pages/ScreeningPageV2').then((m) => ({ default: m.ScreeningPageV2 })));
const ScorecardPage = lazy(() => import('./v2/pages/ScorecardPageV2').then((m) => ({ default: m.ScorecardPageV2 })));
const MyWorkRoute = lazy(() => import('./v2/pages/MyWorkRoute').then((m) => ({ default: m.MyWorkRoute })));
const TeamWorkRoute = lazy(() => import('./v2/pages/TeamWorkV2').then((m) => ({ default: m.TeamWorkV2 })));
const MyInterviewsGate = lazy(() => import('./v2/pages/MyInterviewsV2').then((m) => ({ default: m.MyInterviewsV2 })));
const RequisitionsRoute = lazy(() => import('./v2/pages/RequisitionsRoute').then((m) => ({ default: m.RequisitionsRoute })));
const ApprovalsRoute = lazy(() => import('./v2/pages/ApprovalsRoute').then((m) => ({ default: m.ApprovalsRoute })));
const TeamInterviewsRoute = lazy(() => import('./v2/pages/TeamInterviewsV2').then((m) => ({ default: m.TeamInterviewsV2 })));
const SearchV2 = lazy(() => import('./v2/search/SearchV2').then((m) => ({ default: m.SearchV2 })));
const MyResultV2 = lazy(() => import('./v2/pages/MyResultV2').then((m) => ({ default: m.MyResultV2 })));
const JoiningRoute = lazy(() => import('./v2/pages/JoiningV2').then((m) => ({ default: m.JoiningV2 })));
const LicensesRoute = lazy(() => import('./v2/admin/LicenseManagementV2').then((m) => ({ default: m.LicenseManagementV2 })));
const CandidatesListRoute = lazy(() => import('./v2/pages/CandidatesRoute').then((m) => ({ default: m.CandidatesListRoute })));
const CandidatesCompareRoute = lazy(() => import('./v2/pages/CandidatesRoute').then((m) => ({ default: m.CandidatesCompareRoute })));


const ReportsRoute = lazy(() => import('./v2/pages/ReportsRoute').then((m) => ({ default: m.ReportsRoute })));
const UsersRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.UsersRoute })));
const MasterDataRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.MasterDataRoute })));
const PipelineRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.PipelineRoute })));
const TemplatesRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.TemplatesRoute })));
const AuditRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.AuditRoute })));
const IntegrationsRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.IntegrationsRoute })));
const RolesRoute = lazy(() => import('./v2/admin/AdminRoutes').then((m) => ({ default: m.RolesRoute })));
const NotificationsPage = lazy(() => import('./v2/pages/NotificationsV2').then((m) => ({ default: m.NotificationsV2 })));
const ProfilePage = lazy(() => import('./v2/pages/ProfileV2').then((m) => ({ default: m.ProfileV2 })));
const EntityLinkRoute = lazy(() => import('./v2/pages/EntityLinkRoute').then((m) => ({ default: m.EntityLinkRoute })));
// Native V2 hiring, candidate, CV bank, matching, analytics, and import workflows.
const HireManagementPage = lazy(() => import('./v2/pages/HiresV2').then((m) => ({ default: m.HiresV2 })));
const HiringCasePage = lazy(() => import('./v2/pages/HiringCaseDetailV2').then((m) => ({ default: m.HiringCaseDetailV2 })));
const FinalApprovalInboxPage = lazy(() => import('./v2/pages/FinalApprovalInboxV2').then((m) => ({ default: m.FinalApprovalInboxV2 })));
const OffersPage = lazy(() => import('./v2/pages/OffersV2').then((m) => ({ default: m.OffersV2 })));
const JobAnalyticsPage = lazy(() => import('./v2/pages/JobAnalyticsV2').then((m) => ({ default: m.JobAnalyticsV2 })));
const CandidateDetailPage = lazy(() => import('./v2/pages/CandidateProfileV2').then((m) => ({ default: m.CandidateProfileV2 })));
// Native V2 document vault retains the stable candidate URL and audited document APIs.
const CandidateDocumentsPage = lazy(() => import('./v2/pages/CandidateDocumentsV2').then((m) => ({ default: m.CandidateDocumentsV2 })));
const CVBankPage = lazy(() => import('./v2/pages/CvBankV2').then((m) => ({ default: m.CvBankV2 })));
const TalentPoolPage = lazy(() => import('./v2/pages/MatchSkillsV2').then((m) => ({ default: m.MatchSkillsV2 })));
const BulkImportPage = lazy(() => import('./v2/pages/BulkImportV2').then((m) => ({ default: m.BulkImportV2 })));
const V2Shell = lazy(() => import('./layout/V2Shell').then((m) => ({ default: m.V2Shell })));

const ForgotPasswordPage = lazy(() => import('./auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const ChangePasswordRequiredPage = lazy(() => import('./auth/ChangePasswordRequiredPage').then((m) => ({ default: m.ChangePasswordRequiredPage })));
const AcceptInvitationPage = lazy(() => import('./auth/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage })));
const VerifyEmailPage = lazy(() => import('./auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const PublicJobsPage = lazy(() => import('./public/PublicJobsPage').then((m) => ({ default: m.PublicJobsPage })));
const PublicJobDetailPage = lazy(() => import('./public/PublicJobDetailPage').then((m) => ({ default: m.PublicJobDetailPage })));
const PublicApplyPage = lazy(() => import('./public/PublicApplyPage').then((m) => ({ default: m.PublicApplyPage })));
const CandidateSelfSchedulePage = lazy(() => import('./public/CandidateSelfScheduleV2').then((m) => ({ default: m.CandidateSelfScheduleV2 })));
const CandidatePortalPage = lazy(() => import('./public/CandidatePortalPage').then((m) => ({ default: m.CandidatePortalPage })));

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
                <Route path="/change-password" element={<ChangePasswordRequiredPage />} />
                <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
                <Route path="/portal" element={<CandidatePortalPage />} />
                <Route path="/portal/applications/:token" element={<CandidatePortalPage />} />
                <Route path="/my-applications" element={<CandidatePortalPage />} />
                <Route path="/careers/:organizationCode/jobs" element={<PublicJobsPage />} />
                <Route path="/careers/:organizationCode/jobs/:vacancyCode/apply" element={<PublicApplyPage />} />
                <Route path="/careers/:organizationCode/jobs/:vacancyCode" element={<PublicJobDetailPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<V2Shell />}>
                  <Route path="/my-work" element={<MyWorkRoute />} />
                  <Route path="/team-work" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><TeamWorkRoute /></PermissionGate>} />
                  <Route path="/my-result" element={<MyResultV2 />} />
                  <Route path="/my-interviews" element={<PermissionGate requiredPermission="VACANCY_VIEW"><MyInterviewsGate /></PermissionGate>} />
                  <Route path="/search" element={<SearchV2 />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/notifications" element={<PermissionGate requiredPermission="NOTIFICATION_VIEW"><NotificationsPage /></PermissionGate>} />

                  {/* Employee */}
                  <Route path="/vacancies" element={<PermissionGate requiredPermission="VACANCY_VIEW"><JobsListRoute /></PermissionGate>} />
                  <Route path="/vacancies/:id/upload-cv" element={<PermissionGate requiredPermission="VACANCY_VIEW"><UploadCvPage /></PermissionGate>} />
                  <Route path="/vacancies/:id" element={<PermissionGate requiredPermission="VACANCY_VIEW"><JobDetailRoute /></PermissionGate>} />
                  <Route path="/candidates" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidatesListRoute /></PermissionGate>} />
                  <Route path="/candidates/compare" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidatesCompareRoute /></PermissionGate>} />
                  <Route path="/talent-pools" element={<Navigate to="/sourcing-match" replace />} />
                  <Route path="/talent-pools/:id" element={<Navigate to="/sourcing-match" replace />} />
                  <Route path="/offers/:id" element={<EntityLinkRoute kind="offer" />} />
                  <Route path="/applications/:id/screening" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><ScreeningPage /></PermissionGate>} />
                  <Route path="/applications/:id" element={<PermissionGate requiredAnyPermission={['APPLICATION_VIEW', 'FINAL_HIRING_APPROVAL', 'LICENSE_CHECK']}><ApplicationRoute /></PermissionGate>} />
                  <Route path="/interviews/:id/scorecard" element={<PermissionGate requiredPermission="VACANCY_VIEW"><ScorecardPage /></PermissionGate>} />

                  {/* Manager */}
                  <Route path="/vacancy-requests" element={<RequisitionsGate><PermissionGate requiredPermission="VACANCY_REQUEST_VIEW"><RequisitionsRoute /></PermissionGate></RequisitionsGate>} />
                  <Route path="/approvals" element={<ApprovalsRoute />} />
                  <Route path="/team-interviews" element={<PermissionGate requiredPermission="VACANCY_VIEW"><TeamInterviewsRoute /></PermissionGate>} />
                  <Route path="/reports" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><ReportsRoute /></PermissionGate>} />

                  {/* Admin */}
                  <Route path="/users" element={<PermissionGate requiredPermission="USERS_VIEW"><UsersRoute /></PermissionGate>} />
                  <Route path="/roles" element={<PermissionGate requiredPermission="ROLES_VIEW"><RolesRoute /></PermissionGate>} />
                  <Route path="/master-data" element={<PermissionGate requiredPermission="MASTER_DATA_VIEW"><MasterDataRoute /></PermissionGate>} />
                  <Route path="/audit-log" element={<PermissionGate requiredPermission="AUDIT_VIEW"><AuditRoute /></PermissionGate>} />
                  <Route path="/pipeline-settings" element={<PermissionGate requiredPermission="MASTER_DATA_VIEW"><PipelineRoute /></PermissionGate>} />
                  <Route path="/email-templates" element={<PermissionGate requiredAnyPermission={['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW']}><Navigate to="/whatsapp-templates" replace /></PermissionGate>} />
                  <Route path="/whatsapp-templates" element={<PermissionGate requiredAnyPermission={['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW']}><TemplatesRoute /></PermissionGate>} />
                  <Route path="/integrations" element={<PermissionGate requiredPermission="MASTER_DATA_VIEW"><IntegrationsRoute /></PermissionGate>} />

                  {/* 404 Catch All */}

                  {/* Classic pages, same PermissionGate as in v1 (a1682ad). */}
                  <Route path="/hires/approvals/inbox" element={<PermissionGate requiredPermission="FINAL_HIRING_APPROVAL"><FinalApprovalInboxPage /></PermissionGate>} />
                  <Route path="/hires" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><HireManagementPage /></PermissionGate>} />
                  <Route path="/hires/:id" element={<PermissionGate requiredAnyPermission={['APPLICATION_VIEW', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'LICENSE_CHECK']}><HiringCasePage /></PermissionGate>} />
                  <Route path="/licenses" element={<PermissionGate requiredAnyPermission={['APPLICATION_VIEW', 'LICENSE_CHECK', 'USERS_VIEW']}><LicensesRoute /></PermissionGate>} />
                  <Route path="/joinings" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><JoiningRoute /></PermissionGate>} />
                  <Route path="/interviews" element={<PermissionGate requiredPermission="VACANCY_VIEW"><TeamInterviewsRoute /></PermissionGate>} />
                  <Route path="/interviews/calendar" element={<PermissionGate requiredPermission="VACANCY_VIEW"><TeamInterviewsRoute /></PermissionGate>} />
                  <Route path="/offers" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><OffersPage /></PermissionGate>} />
                  <Route path="/vacancies/:id/analytics" element={<PermissionGate requiredPermission="VACANCY_VIEW"><JobAnalyticsPage /></PermissionGate>} />
                  <Route path="/candidates/:id" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidateDetailPage /></PermissionGate>} />
                  <Route path="/candidates/:id/documents" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidateDocumentsPage /></PermissionGate>} />
                  <Route path="/cv-bank" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CVBankPage /></PermissionGate>} />
                  <Route path="/sourcing-match" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><TalentPoolPage /></PermissionGate>} />
                  <Route path="/import" element={<PermissionGate requiredAnyPermission={['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW', 'CANDIDATE_CREATE', 'VACANCY_REQUEST_CREATE', 'MASTER_DATA_MANAGE']}><BulkImportPage /></PermissionGate>} />
                  <Route path="/import/:dataset/:jobId" element={<PermissionGate requiredAnyPermission={['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW']}><BulkImportPage /></PermissionGate>} />
                  <Route path="/classic/candidates" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><Navigate to="/candidates" replace /></PermissionGate>} />
                  <Route path="/classic/vacancies" element={<PermissionGate requiredPermission="VACANCY_VIEW"><Navigate to="/vacancies" replace /></PermissionGate>} />
                  <Route path="/settings/targets" element={<PermissionGate requiredAnyPermission={['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN', 'MASTER_DATA_VIEW']}><Navigate to="/master-data" replace /></PermissionGate>} />
                  <Route path="/access-control" element={<PermissionGate requiredPermission="USERS_VIEW"><Navigate to="/roles" replace /></PermissionGate>} />
                  <Route path="/classic/master-data" element={<PermissionGate requiredPermission="MASTER_DATA_VIEW"><Navigate to="/master-data" replace /></PermissionGate>} />
                  <Route path="/settings" element={<PermissionGate requiredAnyPermission={['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW']}><Navigate to="/master-data" replace /></PermissionGate>} />
                  <Route path="/classic/pipeline-settings" element={<PermissionGate requiredPermission="OVERRIDE_WORKFLOW"><Navigate to="/pipeline-settings" replace /></PermissionGate>} />
                  <Route path="/joining" element={<Navigate to="/joinings" replace />} />
                  <Route path="/talent-pool" element={<Navigate to="/sourcing-match" replace />} />

                  {/* Every other signed-in URL (v1 pages included) is redirected by the shell; this is a safety net. */}
                  <Route path="*" element={<Navigate to="/" replace />} />
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
