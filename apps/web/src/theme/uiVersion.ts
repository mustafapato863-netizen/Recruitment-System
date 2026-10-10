/**
 * v2 UI switch (F1). The v2 design tokens in styles/tokens-v2.css only apply
 * under [data-ui="v2"]. With the flag off nothing changes.
 *
 * Precedence: ?ui=v2 | ?ui=v1 (persisted to localStorage) > localStorage
 * "recruitflow.ui" > VITE_UI_V2=true > off.
 */
export type UiVersion = 'v1' | 'v2';
export const UI_VERSION_STORAGE_KEY = 'recruitflow.ui';
export const UI_VERSION_ATTRIBUTE = 'data-ui';

function isUiVersion(value: unknown): value is UiVersion {
  return value === 'v1' || value === 'v2';
}

export function resolveUiVersion(options: {
  search?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  envFlag?: string | boolean | undefined;
} = {}): UiVersion {
  const { search = '', storage = null, envFlag } = options;
  const fromQuery = new URLSearchParams(search).get('ui');
  if (isUiVersion(fromQuery)) {
    try { storage?.setItem(UI_VERSION_STORAGE_KEY, fromQuery); } catch { /* storage unavailable */ }
    return fromQuery;
  }
  try {
    const stored = storage?.getItem(UI_VERSION_STORAGE_KEY);
    if (isUiVersion(stored)) return stored;
  } catch { /* storage unavailable */ }
  return envFlag === true || envFlag === 'true' ? 'v2' : 'v1';
}

export function applyUiVersion(version: UiVersion, root: HTMLElement = document.documentElement): void {
  if (version === 'v2') root.setAttribute(UI_VERSION_ATTRIBUTE, 'v2');
  else root.removeAttribute(UI_VERSION_ATTRIBUTE);
}

export function initUiVersion(): UiVersion {
  if (typeof window === 'undefined') return 'v1';
  let storage: Storage | null;
  try { storage = window.localStorage; } catch { storage = null; }
  const version = resolveUiVersion({
    search: window.location.search,
    storage,
    envFlag: import.meta.env.VITE_UI_V2,
  });
  applyUiVersion(version);
  return version;
}
