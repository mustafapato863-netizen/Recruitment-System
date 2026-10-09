// Dev-only primitives preview at /dev/drawer-v2.html (not a build input, no product route).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../styles/tokens.css';
import '../styles/tokens-v2.css';
import { applyUiVersion, initUiVersion } from '../theme/uiVersion';
import { DrawerPreviewV2 } from './DrawerPreviewV2';

if (initUiVersion() === 'v1' && !new URLSearchParams(window.location.search).has('ui')) applyUiVersion('v2');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DrawerPreviewV2 />
  </StrictMode>,
);
