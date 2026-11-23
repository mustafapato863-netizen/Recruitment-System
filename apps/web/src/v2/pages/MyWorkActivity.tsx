import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CircleCheck, CircleX, ClipboardCheck, FileSignature, History, Users } from 'lucide-react';
import { ButtonV2 } from '../../components/v2/Button';
import { SkeletonV2 } from '../../components/v2/PageStates';
import { fetchMyWorkActivity, type MyWorkActivityItem } from '../api/myWorkActivity';
import { useCachedResource } from '../api/useCachedResource';
import { withReturnTo } from '../returnTarget';

const visuals = {
  Applied: { Icon: Users, tone: 'info' }, Screening: { Icon: ClipboardCheck, tone: 'info' }, Interview: { Icon: CalendarClock, tone: 'info' },
  Offer: { Icon: FileSignature, tone: 'success' }, 'Pre-Hire': { Icon: ClipboardCheck, tone: 'warning' }, Joined: { Icon: CircleCheck, tone: 'success' },
  Rejected: { Icon: CircleX, tone: 'danger' }, Withdrawn: { Icon: CircleX, tone: 'neutral' },
} as const;

export function MyWorkActivity({ employeeId, canView, refreshKey, returnTo, timezone }: {
  employeeId?: string; canView: boolean; refreshKey: number; returnTo: string | null; timezone: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const res = useCachedResource<MyWorkActivityItem[]>({
    key: `my-work:activity:${employeeId ?? ''}`,
    enabled: canView && Boolean(employeeId),
    attempt: attempt + refreshKey,
    revalidateOnVisible: true,
    fetcher: () => fetchMyWorkActivity(employeeId!),
  });
  if (!canView || !employeeId) return null;
  const current = res.kind === 'loading'
    ? { status: 'loading' as const }
    : res.kind === 'error'
      ? { status: 'error' as const }
      : { status: 'ready' as const, items: res.data };
  const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
  const fullDate = (date: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  return <section className="rf2-mywork__card rf2-mywork-activity" aria-labelledby="mywork-activity-title">
    <div><div className="rf2-mywork__card-title-wrap"><span className="rf2-mywork__card-icon" aria-hidden="true"><History /></span><h2 className="rf2-mywork__card-title" id="mywork-activity-title">Last activity</h2></div><p className="rf2-mywork-activity__caption">Your recently updated applications</p></div>
    {current.status === 'loading' ? <SkeletonV2 lines={3} label="Loading last activity" /> : null}
    {current.status === 'error' ? <div role="alert"><p className="rf2-mywork-activity__caption">Could not load recent activity.</p><ButtonV2 kind="secondary" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry activity</ButtonV2></div> : null}
    {current.status === 'ready' && !current.items.length ? <p className="rf2-mywork-activity__caption">No recent updates on your assigned applications.</p> : null}
    {current.status === 'ready' && current.items.length ? <ul className="rf2-mywork-activity__list">
      {current.items.map(item => {
        const { Icon, tone } = visuals[item.stage as keyof typeof visuals] ?? { Icon: History, tone: 'neutral' };
        return <li key={item.id}><Link className="rf2-mywork-activity__row" to={withReturnTo(`/applications/${encodeURIComponent(item.id)}`, returnTo)} aria-label={`Open activity for ${item.name}`}>
          <span className="rf2-mywork-activity__icon" data-tone={tone} aria-hidden="true"><Icon /></span>
          <span className="rf2-mywork-activity__main"><strong>{item.name}</strong><span>{item.job}</span><span>{item.stage || 'Application updated'}</span></span>
          <time dateTime={item.updatedAt} title={`Application updated: ${fullDate(item.updatedAt)}`} aria-label={`Application updated: ${fullDate(item.updatedAt)}`}>{shortDate(item.updatedAt)}</time>
        </Link></li>;
      })}
    </ul> : null}
  </section>;
}
