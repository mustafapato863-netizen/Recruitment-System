// Dev-only token preview. Served by `vite` at /dev/tokens-v2.html; not part of
// the production build (only index.html is a build input) and not a product route.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../styles/tokens.css';
import '../styles/tokens-v2.css';
import { applyUiVersion, initUiVersion } from '../theme/uiVersion';
import { TokenPreviewV2 } from './TokenPreviewV2';

// Preview defaults to v2; ?ui=v1 shows the legacy values for comparison.
if (initUiVersion() === 'v1' && !new URLSearchParams(window.location.search).has('ui')) applyUiVersion('v2');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TokenPreviewV2 />
  </StrictMode>,
);
