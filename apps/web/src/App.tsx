import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './layout/AppShell';
import { ThemeProvider } from './theme/ThemeContext';
import { PageLoadingFallback } from './components/Spinner';
import './App.css';

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
const CandidatesPage = lazy(() => import('./pages/CandidatesPage').then((m) => ({ default: m.CandidatesPage })));
const CandidateDetailPage = lazy(() => import('./pages/CandidateDetailPage').then((m) => ({ default: m.CandidateDetailPage })));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })));
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage })));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage').then((m) => ({ default: m.InterviewsPage })));
const InterviewDetailPage = lazy(() => import('./pages/InterviewDetailPage').then((m) => ({ default: m.InterviewDetailPage })));
const CandidateDocumentsPage = lazy(() => import('./pages/CandidateDocumentsPage').then((m) => ({ default: m.CandidateDocumentsPage })));
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
const ImportPreviewPage = lazy(() => import('./pages/ImportPreviewPage').then((m) => ({ default: m.ImportPreviewPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const PipelineSettingsPage = lazy(() => import('./pages/PipelineSettingsPage').then((m) => ({ default: m.PipelineSettingsPage })));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })));
const StatesFeedbackPage = lazy(() => import('./pages/StatesFeedbackPage').then((m) => ({ default: m.StatesFeedbackPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage').then((m) => ({ default: m.MaintenancePage })));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersRolesPage />} />
                  <Route path="/master-data" element={<MasterDataPage />} />
                  <Route path="/audit-log" element={<AuditLogPage />} />

                  {/* Vacancy Management */}
                  <Route path="/vacancy-requests" element={<VacancyRequestsPage />} />
                  <Route path="/vacancy-requests/create" element={<CreateVacancyRequestPage />} />
                  <Route path="/vacancy-requests/:id" element={<VacancyRequestDetailPage />} />
                  <Route path="/approval-inbox" element={<ApprovalInboxPage />} />
                  <Route path="/vacancies" element={<VacantListPage />} />
                  <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />

                  {/* Talent */}
                  <Route path="/candidates" element={<CandidatesPage />} />
                  <Route path="/candidates/:id" element={<CandidateDetailPage />} />
                  <Route path="/candidates/:id/documents" element={<CandidateDocumentsPage />} />
                  <Route path="/talent-pool" element={<TalentPoolPage />} />
                  <Route path="/import" element={<ImportPreviewPage />} />

                  {/* Recruitment Pipeline */}
                  <Route path="/applications" element={<ApplicationsPage />} />
                  <Route path="/applications/:id" element={<ApplicationDetailPage />} />
                  <Route path="/interviews" element={<InterviewsPage />} />
                  <Route path="/interviews/:id" element={<InterviewDetailPage />} />

                  {/* Offers */}
                  <Route path="/offers" element={<OffersPage />} />
                  <Route path="/offers/create" element={<CreateOfferPage />} />
                  <Route path="/offers/approvals/inbox" element={<OfferApprovalInboxPage />} />
                  <Route path="/offers/:id" element={<OfferDetailPage />} />

                  {/* Hiring & Joining */}
                  <Route path="/hires" element={<HireManagementPage />} />
                  <Route path="/hires/:id" element={<HiringCasePage />} />
                  <Route path="/hires/approvals/inbox" element={<FinalApprovalInboxPage />} />
                  <Route path="/licenses" element={<LicenseManagementPage />} />
                  <Route path="/joinings" element={<JoiningManagementPage />} />

                  {/* Analytics & System */}
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/pipeline-settings" element={<PipelineSettingsPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/design-system" element={<DesignSystemPage />} />
                  <Route path="/states-feedback" element={<StatesFeedbackPage />} />
                  <Route path="/maintenance" element={<MaintenancePage />} />

                  {/* 404 Catch All */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
