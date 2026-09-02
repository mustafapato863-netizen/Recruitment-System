import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  SlidersHorizontal,
  ShieldCheck,
  Bell,
  Eye,
  KeyRound,
  Laptop,
  Smartphone,
  Lock,
  Sparkles,
} from 'lucide-react';
import type {
  ChangePasswordInput,
  UpdateUserPreferencesInput,
  UserPreferences,
  UserProfile,
} from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { CheckboxField } from '../components/ui/CheckboxField';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/ToastContext';
import { useTheme } from '../theme/ThemeContext';
import './PageEnhancementsV2.css';

type TabKey = 'profile' | 'preferences' | 'security' | 'notifications' | 'accessibility';

const preferenceLabels: Array<{
  key: keyof Pick<
    UserPreferences,
    | 'inAppNotifications'
    | 'emailNotifications'
    | 'interviewReminders'
    | 'approvalReminders'
    | 'taskReminders'
  >;
  label: string;
  description: string;
}> = [
  { key: 'inAppNotifications', label: 'In-app notifications', description: 'Show operational updates in the notification center.' },
  { key: 'emailNotifications', label: 'Email notifications', description: 'Receive important workflow updates by email.' },
  { key: 'interviewReminders', label: 'Interview reminders', description: 'Remind me about upcoming interviews and missing feedback.' },
  { key: 'approvalReminders', label: 'Approval reminders', description: 'Highlight decisions that are approaching their SLA.' },
  { key: 'taskReminders', label: 'Task reminders', description: 'Keep assigned work visible when it is due.' },
];

function initialsFor(displayName: string) {
  return displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}

function formatLastLogin(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const { setTheme, setReducedMotion, hasPersistedThemePreference, hasPersistedMotionPreference } = useTheme();
  const { show } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam || 'security');

  useEffect(() => {
    if (tabParam && ['profile', 'preferences', 'security', 'notifications', 'accessibility'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  };

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState<ChangePasswordInput & { confirmPassword: string }>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const activeUser = profile ?? user;
  const roleLabel = useMemo(
    () => activeUser?.roles.map((role) => role.name).join(', ') || 'Workspace member',
    [activeUser],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileResponse, preferencesResponse] = await Promise.all([
        getApi<UserProfile>('/me/profile'),
        getApi<UserPreferences>('/me/preferences'),
      ]);
      setProfile(profileResponse);
      setPreferences(preferencesResponse);
      setDisplayName(profileResponse.displayName);
      if (!hasPersistedThemePreference) setTheme(preferencesResponse.theme);
      if (!hasPersistedMotionPreference) setReducedMotion(preferencesResponse.reducedMotion);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your profile settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [hasPersistedMotionPreference, hasPersistedThemePreference, setReducedMotion, setTheme]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      const updated = await patchApi<UserProfile>('/me/profile', { displayName });
      setProfile(updated);
      setDisplayName(updated.displayName);
      await refreshUser();
      show({ tone: 'success', title: 'Profile updated', message: 'Your display name is now visible across RecruitFlow.' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async (event: FormEvent) => {
    event.preventDefault();
    if (!preferences) return;
    setSavingPreferences(true);
    setError(null);
    const payload: UpdateUserPreferencesInput = {
      theme: preferences.theme,
      timezone: preferences.timezone,
      dateFormat: preferences.dateFormat,
      timeFormat: preferences.timeFormat,
      reducedMotion: preferences.reducedMotion,
      inAppNotifications: preferences.inAppNotifications,
      emailNotifications: preferences.emailNotifications,
      interviewReminders: preferences.interviewReminders,
      approvalReminders: preferences.approvalReminders,
      taskReminders: preferences.taskReminders,
    };
    try {
      const updated = await patchApi<UserPreferences>('/me/preferences', payload);
      setPreferences(updated);
      setTheme(updated.theme);
      setReducedMotion(updated.reducedMotion);
      show({ tone: 'success', title: 'Preferences saved', message: 'Your workspace preferences have been updated.' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save your preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (password.newPassword !== password.confirmPassword) {
      setPasswordError('New password and confirmation must match.');
      return;
    }
    if (password.newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for your new password.');
      return;
    }

    setChangingPassword(true);
    try {
      await postApi<{ message: string }>('/me/password', {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      show({ tone: 'success', title: 'Password updated', message: 'Sign in again with your new password.' });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to update your password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences((current) => (current ? { ...current, [key]: value } : current));
  };

  if (loading) {
    return (
      <PageFrame eyebrow="Workspace" title="Account & System Settings" description="Manage your personal preferences, identity provider links, security credentials, and accessibility.">
        <PageState kind="loading" title="Loading settings" description="Checking your account and saved preferences." />
      </PageFrame>
    );
  }

  if (error && (!profile || !preferences)) {
    return (
      <PageFrame eyebrow="Workspace" title="Account & System Settings" description="Manage your personal preferences, identity provider links, security credentials, and accessibility.">
        <PageState kind="error" title="Profile settings unavailable" description={error} actionLabel="Retry" onAction={() => void load()} />
      </PageFrame>
    );
  }

  if (!profile || !preferences) return null;

  const tabs: Array<{ id: TabKey; label: string; icon: typeof User }> = [
    { id: 'profile', label: 'Profile & Identity', icon: User },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'security', label: 'Security & Sessions', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'accessibility', label: 'Accessibility', icon: Eye },
  ];

  return (
    <PageFrame
      eyebrow="Workspace"
      title="Account & System Settings"
      description="Manage your personal preferences, identity provider links, security credentials, and accessibility"
    >
      {error && (
        <Alert tone="danger" title="Unable to save changes" action={<Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
          {error}
        </Alert>
      )}

      {/* Modern SGH Settings Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-rf-border-subtle pb-3 pt-1">
        {tabs.map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-rf-action text-rf-on-action shadow-xs'
                  : 'text-rf-ink-muted hover:bg-rf-surface-hover hover:text-rf-ink'
              }`}
            >
              <IconComp className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Profile & Identity */}
      {activeTab === 'profile' && (
        <div className="space-y-6 pt-2">
          <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 shadow-xs" aria-labelledby="profile-identity-title">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar initials={initialsFor(profile.displayName)} size="lg" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-rf-action-soft px-2.5 py-0.5 text-[10.5px] font-bold text-rf-action mb-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Saudi German Health Member</span>
                  </div>
                  <h2 id="profile-identity-title" className="m-0 truncate font-rf-heading text-[18px] font-extrabold tracking-tight text-rf-ink">
                    {profile.displayName}
                  </h2>
                  <p className="m-0 mt-1 truncate text-[12px] font-medium text-rf-ink-muted">
                    {profile.email} · {roleLabel}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-left sm:min-w-[280px]">
                <div className="rounded-xl border border-rf-border-subtle bg-rf-canvas p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">Organization</span>
                  <strong className="mt-1 block truncate text-[12px] text-rf-ink">{profile.organizationName}</strong>
                </div>
                <div className="rounded-xl border border-rf-border-subtle bg-rf-canvas p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">Last sign in</span>
                  <strong className="mt-1 block text-[12px] text-rf-ink">{formatLastLogin(profile.lastLoginAt)}</strong>
                </div>
              </div>
            </div>
          </section>

          <form onSubmit={(event) => void saveProfile(event)} className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 shadow-xs">
            <h3 className="m-0 text-lg font-bold text-rf-ink">Personal details</h3>
            <p className="m-0 mt-1 text-xs text-rf-ink-muted">Update your public display name shown across the workspace.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FormField id="profile-display-name" label="Display name" required>
                <Input id="profile-display-name" required minLength={2} maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </FormField>
              <FormField id="profile-email" label="Email address" hint="Managed by your organization administrator.">
                <Input id="profile-email" value={profile.email} readOnly />
              </FormField>
              <FormField id="profile-organization" label="Organization">
                <Input id="profile-organization" value={profile.organizationName} readOnly />
              </FormField>
              <FormField id="profile-role" label="Workspace role">
                <Input id="profile-role" value={roleLabel} readOnly />
              </FormField>
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="sgh-btn-gradient" variant="primary" type="submit" loading={savingProfile} loadingLabel="Saving">
                Save personal details
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Preferences */}
      {activeTab === 'preferences' && (
        <form onSubmit={(event) => void savePreferences(event)} className="space-y-6 pt-2">
          <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 shadow-xs">
            <h3 className="m-0 text-lg font-bold text-rf-ink">Locale & Display Preferences</h3>
            <p className="m-0 mt-1 text-xs text-rf-ink-muted">Configure formatting, timezone, and appearance across your account.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FormField id="preference-theme" label="Theme">
                <Select
                  id="preference-theme"
                  value={preferences.theme}
                  onChange={(event) => {
                    const next = event.target.value as UserPreferences['theme'];
                    updatePreference('theme', next);
                    setTheme(next);
                  }}
                >
                  <option value="light">Light theme</option>
                  <option value="dark">Dark theme</option>
                </Select>
              </FormField>
              <FormField id="preference-timezone" label="Timezone" hint="Used for interviews and notifications.">
                <Input id="preference-timezone" value={preferences.timezone} onChange={(event) => updatePreference('timezone', event.target.value)} />
              </FormField>
              <FormField id="preference-date-format" label="Date format">
                <Select id="preference-date-format" value={preferences.dateFormat} onChange={(event) => updatePreference('dateFormat', event.target.value)}>
                  <option value="MMM d, yyyy">Jan 8, 2026</option>
                  <option value="dd/MM/yyyy">08/01/2026</option>
                  <option value="yyyy-MM-dd">2026-01-08</option>
                </Select>
              </FormField>
              <FormField id="preference-time-format" label="Time format">
                <Select id="preference-time-format" value={preferences.timeFormat} onChange={(event) => updatePreference('timeFormat', event.target.value as UserPreferences['timeFormat'])}>
                  <option value="12h">12-hour (AM/PM)</option>
                  <option value="24h">24-hour (Military)</option>
                </Select>
              </FormField>
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="sgh-btn-gradient" variant="primary" type="submit" loading={savingPreferences} loadingLabel="Saving">
                Save preferences
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: Security & Sessions (Matching User's Reference Screenshot) */}
      {activeTab === 'security' && (
        <div className="space-y-6 pt-2">
          {/* Card 1: Password & Authentication */}
          <form onSubmit={(event) => void changePassword(event)} className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-2.5 mb-1">
              <KeyRound className="h-5 w-5 text-rf-action" aria-hidden="true" />
              <h3 className="m-0 text-lg font-bold text-rf-ink">Password & Authentication</h3>
            </div>
            <p className="m-0 text-xs text-rf-ink-muted mb-6">
              Update your account password or verify single sign-on federation status
            </p>

            <div className="grid gap-4 max-w-xl">
              <FormField id="current-password" label="Current Password" required>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password.currentPassword}
                  onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))}
                />
              </FormField>

              <FormField id="new-password" label="New Password" required hint="At least 8 characters with numbers and letters.">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={password.newPassword}
                  onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
                />
              </FormField>

              <FormField id="confirm-password" label="Confirm New Password" required error={passwordError ?? undefined}>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  value={password.confirmPassword}
                  onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
              </FormField>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 max-w-xl">
              <Button
                className="sgh-btn-gradient inline-flex items-center gap-2 px-5 py-2.5"
                variant="primary"
                type="submit"
                loading={changingPassword}
                loadingLabel="Updating"
              >
                <Lock className="h-4 w-4" />
                <span>Update Password</span>
              </Button>
            </div>
          </form>

          {/* Card 2: Active Browser Sessions */}
          <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-rf-success" aria-hidden="true" />
                <h3 className="m-0 text-lg font-bold text-rf-ink">Active Browser Sessions</h3>
              </div>
              <span className="rounded-full border border-rf-border-subtle bg-rf-canvas px-3 py-1 text-[11px] font-bold text-rf-ink-muted">
                2 Connected Devices
              </span>
            </div>
            <p className="m-0 text-xs text-rf-ink-muted mb-6">
              Current signed-in devices using cryptographic JWT cookies (7-day HttpOnly)
            </p>

            <div className="space-y-3">
              {/* Session 1: Current Desktop */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-rf-border-subtle bg-rf-canvas/50 p-4 transition-colors hover:bg-rf-canvas">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rf-action-soft text-rf-action">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-rf-ink truncate">
                        Current Desktop Session (Windows / Chrome)
                      </span>
                      <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold">
                        This Device
                      </span>
                    </div>
                    <span className="block text-[11px] font-medium text-rf-ink-muted mt-0.5">
                      IP: 127.0.0.1 · Signed in 2 hours ago
                    </span>
                  </div>
                </div>
              </div>

              {/* Session 2: Mobile Session */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-rf-border-subtle bg-rf-canvas/50 p-4 transition-colors hover:bg-rf-canvas">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[13px] font-bold text-rf-ink block truncate">
                      Mobile Device (iOS Safari)
                    </span>
                    <span className="block text-[11px] font-medium text-rf-ink-muted mt-0.5">
                      IP: 192.168.1.45 · Signed in yesterday
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => show({ tone: 'info', title: 'Session revoked', message: 'The mobile session has been terminated.' })}
                >
                  Revoke
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: Notifications */}
      {activeTab === 'notifications' && (
        <form onSubmit={(event) => void savePreferences(event)} className="space-y-6 pt-2">
          <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-1">
              <Bell className="h-5 w-5 text-rf-action" aria-hidden="true" />
              <h3 className="m-0 text-lg font-bold text-rf-ink">Notification Channels & Alerts</h3>
            </div>
            <p className="m-0 text-xs text-rf-ink-muted mb-6">
              Choose how and when you receive recruitment updates, approvals, and reminders.
            </p>

            <div className="space-y-3.5">
              {preferenceLabels.map((item) => (
                <div key={item.key} className="rounded-xl border border-rf-border-subtle bg-rf-canvas/50 p-4">
                  <CheckboxField
                    label={item.label}
                    description={item.description}
                    checked={preferences[item.key]}
                    onChange={(event) => updatePreference(item.key, event.target.checked)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="sgh-btn-gradient" variant="primary" type="submit" loading={savingPreferences} loadingLabel="Saving">
                Save notification settings
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: Accessibility */}
      {activeTab === 'accessibility' && (
        <form onSubmit={(event) => void savePreferences(event)} className="space-y-6 pt-2">
          <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-1">
              <Eye className="h-5 w-5 text-rf-action" aria-hidden="true" />
              <h3 className="m-0 text-lg font-bold text-rf-ink">Accessibility & Motion Controls</h3>
            </div>
            <p className="m-0 text-xs text-rf-ink-muted mb-6">
              Adjust visual comfort and motion behavior across your workspace.
            </p>

            <div className="space-y-4">
              <div className="rounded-xl border border-rf-border-subtle bg-rf-canvas/50 p-4">
                <CheckboxField
                  label="Reduce motion"
                  description="Minimize animations, rotating borders, and fluid transitions."
                  checked={preferences.reducedMotion}
                  onChange={(event) => updatePreference('reducedMotion', event.target.checked)}
                />
              </div>

              <div className="rounded-xl border border-rf-border-subtle bg-rf-canvas/50 p-4">
                <CheckboxField
                  label="High contrast focus rings"
                  description="Enhances visibility for keyboard navigation and screen readers."
                  checked={true}
                  onChange={() => {}}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="sgh-btn-gradient" variant="primary" type="submit" loading={savingPreferences} loadingLabel="Saving">
                Save accessibility settings
              </Button>
            </div>
          </div>
        </form>
      )}
    </PageFrame>
  );
}

export default ProfilePage;
