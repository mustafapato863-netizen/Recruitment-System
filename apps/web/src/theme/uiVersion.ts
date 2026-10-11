/**
 * v2 is the only UI (v2 default). The v2 design tokens in styles/tokens-v2.css apply under [data-ui="v2"], so the
 * attribute is always set. The old switches (?ui=, localStorage "recruitflow.ui", VITE_UI_V2) are retired:
 * nothing reads them any more. `applyUiVersion` stays for the dev preview entries.
 */
export type UiVersion = 'v1' | 'v2';
export const UI_VERSION_ATTRIBUTE = 'data-ui';

export function applyUiVersion(version: UiVersion, root: HTMLElement = document.documentElement): void {
  if (version === 'v2') root.setAttribute(UI_VERSION_ATTRIBUTE, 'v2');
  else root.removeAttribute(UI_VERSION_ATTRIBUTE);
}

/** Always v2. */
export function initUiVersion(): UiVersion {
  if (typeof document !== 'undefined') applyUiVersion('v2');
  return 'v2';
}
