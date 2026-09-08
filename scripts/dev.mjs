#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const pnpmCmd = isWin ? 'pnpm.cmd' : 'pnpm';

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';

console.log(`
${cyan}${bold}╔═══════════════════════════════════════════════════════════════════════════╗
║                   🚀 RecruitFlow Full-Stack Launcher                      ║
║                                                                           ║
║  📡 API Server:    ${green}http://localhost:3000/api/v1/health${cyan}                    ║
║  💻 Web Client:    ${green}http://localhost:5173${cyan}                                  ║
║                                                                           ║
║  ${yellow}UAT mode: use the administrator account configured in your local .env${cyan}  ║
║  Roles, users, permissions, and sidebar visibility are admin-managed.     ║
║                                                                           ║
║  Press Ctrl+C to stop all RecruitFlow services cleanly.                  ║
╚═══════════════════════════════════════════════════════════════════════════╝${reset}
`);

const children = [];

function startProcess(name, color, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: isWin,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}[${name}]${reset} ${line}`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${color}[${name}]${red} ${line}${reset}`);
      }
    }
  });

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${color}[${name}]${red} Process exited with code ${code}${reset}`);
    }
  });

  children.push(child);
  return child;
}

// 1. Start NestJS API server
startProcess('API', cyan, pnpmCmd, ['--dir', 'apps/api', 'start:dev'], process.cwd());

// 2. Start Vite Web Client
startProcess('WEB', green, pnpmCmd, ['--dir', 'apps/web', 'dev'], process.cwd());

// 3. Start the outbox and sweeper worker for local UAT.
startProcess('WORKER', yellow, pnpmCmd, ['--dir', 'apps/worker', 'dev'], process.cwd());

function cleanup() {
  console.log(`\n${yellow}Shutting down all RecruitFlow services...${reset}`);
  for (const child of children) {
    try {
      if (isWin) {
        spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // ignore cleanup error
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
