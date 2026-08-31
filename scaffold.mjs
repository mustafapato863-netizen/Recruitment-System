import fs from 'fs';
import path from 'path';

const basePath = 'd:/Projects/Recruitment Workflow System/apps/web/src';

const files = {
  'api/client.ts': `
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(\`\${API_BASE_URL}\${path}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    const problem = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(problem?.message) ? problem.message.join(', ') : problem?.message;
    if (response.status === 403) {
      throw new Error(message ?? 'Forbidden');
    }
    throw new Error(message ?? \`Request failed with status \${response.status}\`);
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
`,
  'components/Modal.tsx': `
import React from 'react';

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="form-backdrop" role="presentation">
      <div className="form-card">
        <div className="form-heading">
          <h2>{title}</h2>
          <button className="close-button" type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
`,
  'components/StatusBadge.tsx': `
import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  const statusClass = \`status-chip status-\${status.toLowerCase().replaceAll(' ', '-')}\`;
  return <em className={statusClass}>{status}</em>;
}
`,
  'styles/auth.css': `
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top right, rgba(124, 58, 237, 0.15), transparent 40%), var(--bg);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  text-align: center;
}
.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}
.auth-brand .brand-mark {
  width: 48px;
  height: 48px;
  font-size: 24px;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}
.auth-form label {
  display: grid;
  gap: 8px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}
.auth-form input {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}
.auth-form input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
  outline: none;
}
.auth-button {
  margin-top: 8px;
  padding: 12px;
  color: white;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
`,
  'styles/admin.css': `
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.filter {
  display: flex;
  gap: 12px;
}
.filter select, .filter input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 11px;
}
table.data-table {
  width: 100%;
  border-collapse: collapse;
}
table.data-table th, table.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
}
table.data-table th {
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.05em;
}
.page-layout {
  display: flex;
  gap: 24px;
}
.sidebar-panel {
  width: 250px;
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.content-area {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}
.nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-list a {
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--muted);
  text-decoration: none;
  font-size: 11px;
  font-weight: 600;
}
.nav-list a:hover, .nav-list a.active {
  background: var(--primary-soft);
  color: var(--primary);
}
.chip-catalog {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.chip {
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  font-size: 10px;
  color: var(--text);
}
`,
  'auth/AuthContext.tsx': `
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, LoginRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApi<UserProfile>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (credentials: LoginRequest) => {
    await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const profile = await fetchApi<UserProfile>('/auth/me');
    setUser(profile);
  };

  const logout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
`,
  'auth/ProtectedRoute.tsx': `
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="alert loading-alert" style={{ margin: '40px auto', width: 'fit-content' }}>Checking authentication...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
`,
  'auth/LoginPage.tsx': `
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import '../styles/auth.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">R</span>
          <div>
            <strong>RecruitFlow</strong>
            <small>Recruitment operations</small>
          </div>
        </div>

        {error && <div className="alert error-alert" style={{ marginBottom: '16px' }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="auth-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
`,
  'layout/AppShell.tsx': `
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const breadcrumbs: Record<string, string> = {
    '/': 'Dashboard',
    '/users': 'Users & Roles',
    '/master-data': 'Master Data',
    '/audit-log': 'Audit Log',
  };
  const currentBreadcrumb = breadcrumbs[location.pathname] || 'Dashboard';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <span><strong>RecruitFlow</strong><small>Recruitment operations</small></span>
        </div>
        <nav className="navigation" aria-label="Main navigation">
          <p className="nav-label">Overview</p>
          <NavLink to="/" className={({ isActive }) => \`nav-item \${isActive ? 'active' : ''}\`} end>
            <span className="nav-icon" aria-hidden="true">D</span>Dashboard
          </NavLink>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">T</span>My Tasks</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">N</span>Notifications</a>

          <p className="nav-label">Vacancy Management</p>
          <NavLink to="/vacancy-requests" className={({ isActive }) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-icon" aria-hidden="true">V</span>Vacancy Requests
          </NavLink>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">A</span>Approval Inbox</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">L</span>Vacant List</a>

          <p className="nav-label">Talent</p>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">C</span>Candidates</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">P</span>Talent Pool</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">E</span>Import/Export</a>

          <p className="nav-label">Recruitment</p>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">P</span>Pipeline</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">I</span>Interviews</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">O</span>Offers</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">H</span>Hire Management</a>

          <p className="nav-label">Analytics</p>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">R</span>Reports</a>

          <p className="nav-label">Administration</p>
          <NavLink to="/users" className={({ isActive }) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-icon" aria-hidden="true">U</span>Users & Roles
          </NavLink>
          <NavLink to="/master-data" className={({ isActive }) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-icon" aria-hidden="true">M</span>Master Data
          </NavLink>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">S</span>Pipeline Settings</a>
          <a href="#" className="nav-item"><span className="nav-icon" aria-hidden="true">I</span>Integrations</a>
          <NavLink to="/audit-log" className={({ isActive }) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-icon" aria-hidden="true">A</span>Audit Log
          </NavLink>
        </nav>
        <div className="user-card">
          <span className="avatar">{user ? getInitials(user.displayName) : 'U'}</span>
          <span>
            <strong>{user?.displayName || 'User'}</strong>
            <small onClick={handleLogout} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Sign out</small>
          </span>
          <span className="user-more" aria-hidden="true">•••</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="breadcrumb">Workspace / <strong>{currentBreadcrumb}</strong></span>
          <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search" placeholder="Search candidates, vacancies, tasks..." /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Notifications">◉</button>
            <button className="scope-button" type="button">All branches <span>⌄</span></button>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
`,
  'pages/UsersRolesPage.tsx': `
import React, { useState, useEffect } from 'react';
import { UserRecord, RoleRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import '../styles/admin.css';

export function UsersRolesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          fetchApi<{ data: UserRecord[] }>('/users'),
          fetchApi<{ data: RoleRecord[] }>('/roles')
        ]);
        setUsers(usersRes.data || []);
        setRoles(rolesRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Users & Roles</h1>
          <p>Manage system access and assign permissions.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="quiet-button" onClick={() => setIsRoleOpen(true)}>Create Role</button>
          <button className="primary-button" onClick={() => setIsInviteOpen(true)}>Invite User</button>
        </div>
      </section>

      {error && <div className="alert error-alert">{error}</div>}

      <div className="page-layout">
        <div className="content-area">
          <div className="toolbar">
            <div className="filter">
              <input type="text" placeholder="Search users..." />
              <select><option>All Roles</option></select>
              <select><option>All Statuses</option></select>
            </div>
          </div>

          {isLoading ? (
            <div className="alert loading-alert">Loading users...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.displayName}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <div className="chip-catalog" style={{ marginTop: 0 }}>
                        {u.roles.map(r => <span key={r.id} className="chip">{r.name}</span>)}
                      </div>
                    </td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="sidebar-panel">
          <h3 style={{ fontSize: '12px', marginBottom: '16px' }}>System Roles</h3>
          <div className="chip-catalog">
            {roles.map(r => (
              <span key={r.id} className="chip">{r.name}</span>
            ))}
          </div>
          <h3 style={{ fontSize: '12px', margin: '24px 0 16px' }}>Sensitive Permissions</h3>
          <div className="nav-list">
            <a href="#">Manage Users</a>
            <a href="#">Manage Master Data</a>
            <a href="#">Approve Vacancies</a>
          </div>
        </div>
      </div>

      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite User">
        <div className="form-grid">
          <label className="full-field">Email <input type="email" /></label>
          <label className="full-field">Name <input type="text" /></label>
        </div>
        <div className="form-actions">
          <button className="quiet-button" onClick={() => setIsInviteOpen(false)}>Cancel</button>
          <button className="primary-button" onClick={() => setIsInviteOpen(false)}>Send Invite</button>
        </div>
      </Modal>

      <Modal isOpen={isRoleOpen} onClose={() => setIsRoleOpen(false)} title="Create Role">
        <div className="form-grid">
          <label className="full-field">Code <input type="text" /></label>
          <label className="full-field">Name <input type="text" /></label>
        </div>
        <div className="form-actions">
          <button className="quiet-button" onClick={() => setIsRoleOpen(false)}>Cancel</button>
          <button className="primary-button" onClick={() => setIsRoleOpen(false)}>Create</button>
        </div>
      </Modal>
    </div>
  );
}
`,
  'pages/MasterDataPage.tsx': `
import React, { useState, useEffect } from 'react';
import { LegalEntityRecord, BranchRecord, PositionRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import '../styles/admin.css';

type Category = 'legal-entities' | 'branches' | 'positions';

export function MasterDataPage() {
  const [category, setCategory] = useState<Category>('legal-entities');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetchApi<{ data: any[] }>(\`/\${category}\`);
        setData(res.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [category]);

  const categoryTitles = {
    'legal-entities': 'Legal Entities',
    'branches': 'Branches',
    'positions': 'Positions'
  };

  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Master Data</h1>
          <p>Manage organizational structure and catalog data.</p>
        </div>
        <button className="primary-button" onClick={() => setIsModalOpen(true)}>Create {categoryTitles[category].slice(0, -1)}</button>
      </section>

      {error && <div className="alert error-alert">{error}</div>}

      <div className="page-layout">
        <div className="sidebar-panel">
          <div className="nav-list">
            <a href="#" className={category === 'legal-entities' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCategory('legal-entities'); }}>Legal Entities</a>
            <a href="#" className={category === 'branches' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCategory('branches'); }}>Branches</a>
            <a href="#" className={category === 'positions' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCategory('positions'); }}>Positions</a>
            <a href="#" style={{ opacity: 0.5 }}>Departments</a>
            <a href="#" style={{ opacity: 0.5 }}>Cost Centers</a>
          </div>
        </div>

        <div className="content-area">
          {isLoading ? (
            <div className="alert loading-alert">Loading {categoryTitles[category]}...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name/Title</th>
                  {category === 'branches' && <th>City</th>}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td><strong>{item.name || item.title}</strong></td>
                    {category === 'branches' && <td>{item.city || '—'}</td>}
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>No records found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={\`Create \${categoryTitles[category].slice(0, -1)}\`}>
        <div className="form-grid">
          <label className="full-field">Code <input type="text" /></label>
          <label className="full-field">{category === 'positions' ? 'Title' : 'Name'} <input type="text" /></label>
        </div>
        <div className="form-actions">
          <button className="quiet-button" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="primary-button" onClick={() => setIsModalOpen(false)}>Create</button>
        </div>
      </Modal>
    </div>
  );
}
`,
  'pages/AuditLogPage.tsx': `
import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import '../styles/admin.css';

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchApi<{ data: AuditLogEntry[] }>('/audit-logs');
        setLogs(res.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load audit logs');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Audit Log</h1>
          <p>System-wide activity and security events.</p>
        </div>
        <button className="quiet-button">Export CSV</button>
      </section>

      <section className="metric-grid" style={{ marginBottom: '24px' }}>
        <article className="metric-card">
          <div className="metric-icon blue">●</div>
          <span>Events Today</span>
          <strong>{logs.length}</strong>
        </article>
        <article className="metric-card">
          <div className="metric-icon orange">●</div>
          <span>Sensitive Access</span>
          <strong>0</strong>
        </article>
        <article className="metric-card">
          <div className="metric-icon purple">●</div>
          <span>Blocked Actions</span>
          <strong>0</strong>
        </article>
        <article className="metric-card">
          <div className="metric-icon green">●</div>
          <span>Retention</span>
          <strong>90 days</strong>
        </article>
      </section>

      {error && <div className="alert error-alert">{error}</div>}

      <div className="content-area">
        <div className="toolbar">
          <div className="filter">
            <input type="date" />
            <select><option>All Actions</option></select>
            <input type="text" placeholder="Search actor or entity..." />
          </div>
        </div>

        {isLoading ? (
          <div className="alert loading-alert">Loading audit logs...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.actorDisplayName || log.actorUserId || 'System'}</td>
                  <td><strong>{log.action}</strong></td>
                  <td>{log.entityType} ({log.entityId.substring(0,8)}...)</td>
                  <td>
                    <span className={\`chip \${log.result === 'Success' ? 'status-approved' : 'status-rejected'}\`} style={{ display: 'inline-block' }}>
                      {log.result}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}
console.log('Done scaffolding new files.');
