import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle chunk loading failures when a new version has been deployed
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
    <App />
  </StrictMode>,
)
