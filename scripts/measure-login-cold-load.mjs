// Cold load of a preview /login URL until #login-email can take focus.
// Usage: node scripts/measure-login-cold-load.mjs <preview-url> [runs]
// Does not submit credentials. Each run is a new headless browser profile with cache disabled.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const previewUrl = process.argv[2];
const runs = Number(process.argv[3] ?? 5);

if (!previewUrl || !/^https?:\/\//.test(previewUrl)) {
  console.error('Usage: node scripts/measure-login-cold-load.mjs <preview-url> [runs]');
  process.exit(1);
}

if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
  console.error('Runs must be an integer from 1 to 20.');
  process.exit(1);
}

const POLL_SOURCE = `(() => {
  const LIMIT_MS = 15000;
  window.__loginColdLoad = new Promise((resolve) => {
    const tick = (now) => {
      const elapsed = typeof now === 'number' ? now : performance.now();
      const el = document.getElementById('login-email');
      const laidOut = !!el && (
        el.offsetParent !== null ||
        (typeof el.checkVisibility === 'function' && el.checkVisibility())
      );
      if (el && el.disabled !== true && laidOut) {
        resolve({ ok: true, ms: elapsed, timeout: false });
        return;
      }
      if (elapsed >= LIMIT_MS) {
        resolve({
          ok: false,
          ms: elapsed,
          timeout: true,
          reason: 'timeout: #login-email was not ready to take focus within 15000ms',
          exists: !!el,
          disabled: el ? el.disabled === true : null,
          offsetParent: el ? el.offsetParent !== null : null,
          readyState: document.readyState,
          href: location.href,
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
})();`;

function findBrowser() {
  const candidates = [
    process.env.LOGIN_COLD_BROWSER,
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const text = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
      const message = JSON.parse(text);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
        else pending.resolve(message.result ?? {});
      } else if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
      }
    });
    ws.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('websocket closed'));
      }
      this.pending.clear();
    });
    this.listeners = new Map();
  }

  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  send(method, params = {}, timeoutMs = 20000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('websocket open timeout'));
    }, 10000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`websocket error for ${url}`));
    });
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }
  child.kill('SIGKILL');
}

async function waitForDevtoolsPort(userDataDir, child) {
  const file = join(userDataDir, 'DevToolsActivePort');
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`browser exited before DevTools was ready (code ${child.exitCode})`);
    }
    try {
      const text = await readFile(file, 'utf8');
      const port = Number(text.split(/\r?\n/)[0].trim());
      if (Number.isInteger(port) && port > 0) return port;
    } catch {
      // File is created when the browser finishes starting.
    }
    await delay(50);
  }
  throw new Error('timed out waiting for DevToolsActivePort');
}

async function measureOnce(browserPath, run) {
  const userDataDir = await mkdtemp(join(tmpdir(), 'login-cold-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=Translate,BackForwardCache',
    '--disk-cache-size=1',
    '--media-cache-size=1',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'about:blank',
  ];
  const child = spawn(browserPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-1500);
  });

  let cdp = null;
  try {
    const port = await waitForDevtoolsPort(userDataDir, child);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => {
      if (!response.ok) throw new Error(`DevTools list HTTP ${response.status}`);
      return response.json();
    });
    const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (!page) throw new Error('no page target from DevTools');

    cdp = new Cdp(await openWebSocket(page.webSocketDebuggerUrl));
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: POLL_SOURCE });

    const navigated = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('navigation did not commit within 20000ms')), 20000);
      cdp.on('Page.frameNavigated', (params) => {
        if (params.frame?.parentId) return;
        const frameUrl = params.frame?.url ?? '';
        if (frameUrl.startsWith(previewUrl) || frameUrl.includes('/login')) {
          clearTimeout(timer);
          resolve(frameUrl);
        }
      });
    });

    const nav = await cdp.send('Page.navigate', { url: previewUrl });
    if (nav.errorText) throw new Error(nav.errorText);
    const frameUrl = await navigated;

    const evaluated = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        if (!window.__loginColdLoad) {
          return { ok: false, ms: performance.now(), timeout: false, reason: 'measurement hook missing after navigation', href: location.href };
        }
        return window.__loginColdLoad;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, 20000);

    if (evaluated.exceptionDetails) {
      const text = evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text || 'page evaluation failed';
      throw new Error(text);
    }

    const value = evaluated.result?.value;
    if (!value || typeof value.ms !== 'number') {
      throw new Error('measurement returned no timing');
    }

    return {
      run,
      ok: value.ok === true && value.timeout !== true,
      ms: Math.round(value.ms * 10) / 10,
      timeout: value.timeout === true,
      reason: value.ok === true ? null : (value.reason || 'measurement failed'),
      frameUrl,
      exists: value.exists ?? null,
      disabled: value.disabled ?? null,
      offsetParent: value.offsetParent ?? null,
      href: value.href ?? frameUrl,
    };
  } catch (error) {
    return {
      run,
      ok: false,
      ms: null,
      timeout: false,
      reason: error instanceof Error ? error.message : String(error),
      browserStderr: stderr.trim() || null,
    };
  } finally {
    try {
      cdp?.close();
    } catch {
      // Closing the socket must not hide the measurement result.
    }
    await stopProcess(child);
    await delay(300);
    try {
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
    } catch (error) {
      console.error(`cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const browser = findBrowser();
if (!browser) {
  console.error('No Microsoft Edge or Google Chrome installation was found.');
  process.exit(1);
}

const results = [];
for (let run = 1; run <= runs; run += 1) {
  console.error(`run ${run}/${runs}`);
  results.push(await measureOnce(browser, run));
}

const successful = results.filter((result) => result.ok && typeof result.ms === 'number').map((result) => result.ms);
const summary = {
  url: previewUrl,
  browser,
  cacheDisabled: true,
  freshContextPerRun: true,
  runs: results,
  medianMs: median(successful),
  failedRuns: results.filter((result) => !result.ok).length,
};

console.log(JSON.stringify(summary, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;
