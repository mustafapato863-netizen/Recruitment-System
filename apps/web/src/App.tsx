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
import './styles/ui-primitives.css';
import './styles/design-system.css';
import './styles/shell.css';
import './styles/polish.css';
import './styles/source-integration.css';
import './styles/v2-parity.css';
import './styles/tokens-v2.css';

// Lazy loaded page components for optimal bundle splitting. v2 is the only signed-in UI (v2 default):
// v1 URLs are redirected to their v2 equivalents by the shell (v2/destinations.ts), so only v2 routes exist here.
const JobsListRoute = lazy(() => import('./v2/pages/JobsRoute').then((m) => ({ default: m.JobsListRoute })));
const JobDetailRoute = lazy(() => import('./v2/pages/JobsRoute').then((m) => ({ default: m.JobDetailRoute })));
const ApplicationRoute = lazy(() => import('./v2/pages/ApplicationRoute').then((m) => ({ default: m.ApplicationRoute })));
const MyWorkRoute = lazy(() => import('./v2/pages/MyWorkRoute').then((m) => ({ default: m.MyWorkRoute })));
const MyInterviewsGate = lazy(() => import('./pages/MyInterviewsGate').then((m) => ({ default: m.MyInterviewsGate })));
const RequisitionsRoute = lazy(() => import('./v2/pages/RequisitionsRoute').then((m) => ({ default: m.RequisitionsRoute })));
const SearchV2 = lazy(() => import('./v2/search/SearchV2').then((m) => ({ default: m.SearchV2 })));
const MyResultV2 = lazy(() => import('./v2/pages/MyResultV2').then((m) => ({ default: m.MyResultV2 })));
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
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ApplicantPortalPage = lazy(() => import('./pages/ApplicantPortalPage').then((m) => ({ default: m.ApplicantPortalPage })));
const EntityLinkRoute = lazy(() => import('./v2/pages/EntityLinkRoute').then((m) => ({ default: m.EntityLinkRoute })));
const V2Shell = lazy(() => import('./layout/V2Shell').then((m) => ({ default: m.V2Shell })));

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
                  {/* Applicant portal: candidates still use it; outside the seat shell, never redirected. */}
                  <Route path="/portal/*" element={<ApplicantPortalPage />} />
                  <Route path="/my-applications" element={<ApplicantPortalPage />} />
                  <Route element={<V2Shell />}>
                  <Route path="/my-work" element={<MyWorkRoute />} />
                  <Route path="/my-result" element={<MyResultV2 />} />
                  <Route path="/my-interviews" element={<PermissionGate requiredPermission="VACANCY_VIEW"><MyInterviewsGate /></PermissionGate>} />
                  <Route path="/search" element={<SearchV2 />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/notifications" element={<PermissionGate requiredPermission="NOTIFICATION_VIEW"><NotificationsPage /></PermissionGate>} />

                  {/* Employee */}
                  <Route path="/vacancies" element={<PermissionGate requiredPermission="VACANCY_VIEW"><JobsListRoute /></PermissionGate>} />
                  <Route path="/vacancies/:id" element={<PermissionGate requiredPermission="VACANCY_VIEW"><JobDetailRoute /></PermissionGate>} />
                  <Route path="/candidates" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidatesListRoute /></PermissionGate>} />
                  <Route path="/candidates/compare" element={<PermissionGate requiredPermission="CANDIDATE_VIEW"><CandidatesCompareRoute /></PermissionGate>} />
                  <Route path="/offers/:id" element={<EntityLinkRoute kind="offer" />} />
                  <Route path="/hires/:id" element={<EntityLinkRoute kind="hire" />} />
                  <Route path="/applications/:id" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><ApplicationRoute /></PermissionGate>} />

                  {/* Manager */}
                  <Route path="/vacancy-requests" element={<RequisitionsGate><PermissionGate requiredPermission="VACANCY_REQUEST_VIEW"><RequisitionsRoute /></PermissionGate></RequisitionsGate>} />
                  <Route path="/reports" element={<PermissionGate requiredPermission="APPLICATION_VIEW"><ReportsRoute /></PermissionGate>} />

                  {/* Admin */}
                  <Route path="/users" element={<PermissionGate requiredPermission="USERS_VIEW"><UsersRoute /></PermissionGate>} />
                  <Route path="/roles" element={<PermissionGate requiredPermission="USERS_VIEW"><RolesRoute /></PermissionGate>} />
                  <Route path="/master-data" element={<PermissionGate requiredPermission="MASTER_DATA_VIEW"><MasterDataRoute /></PermissionGate>} />
                  <Route path="/audit-log" element={<PermissionGate requiredPermission="AUDIT_VIEW"><AuditRoute /></PermissionGate>} />
                  <Route path="/pipeline-settings" element={<PermissionGate requiredPermission="OVERRIDE_WORKFLOW"><PipelineRoute /></PermissionGate>} />
                  <Route path="/email-templates" element={<PermissionGate requiredAnyPermission={['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW']}><TemplatesRoute /></PermissionGate>} />
                  <Route path="/whatsapp-templates" element={<PermissionGate requiredAnyPermission={['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW']}><TemplatesRoute channel="whatsapp" /></PermissionGate>} />
                  <Route path="/integrations" element={<PermissionGate requiredPermission="MASTER_DATA_VIEW"><IntegrationsRoute /></PermissionGate>} />

                  {/* 404 Catch All */}
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
