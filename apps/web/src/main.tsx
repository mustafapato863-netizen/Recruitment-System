import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pages/RecruitFlowUi.css'
import './pages/CommandCenterPolish.css'
import './pages/ApplicantProfilePolish.css'
import './pages/ApplicationCardPolish.css'
import './i18n'
import App from './App.tsx'
import { CollapseInitialMatchSkills } from './components/candidate/CollapseInitialMatchSkills'
import { ApplicantProfilePolish } from './components/candidate/ApplicantProfilePolish'
import { ApplicationCardPolish } from './components/candidate/ApplicationCardPolish'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const storageKey = 'rf_vite_preload_retry';
  const last = sessionStorage.getItem(storageKey);
  const now = Date.now();
  if (!last || now - Number(last) > 15000) {
    sessionStorage.setItem(storageKey, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApplicantProfilePolish />
    <ApplicationCardPolish />
    <CollapseInitialMatchSkills />
    <App />
  </StrictMode>,
)
