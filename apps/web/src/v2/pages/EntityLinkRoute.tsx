import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { authorizedLanding, routeActor } from '../destinations';
import { allowedReturn, withReturnTo } from '../returnTarget';

type Kind = 'offer' | 'hire';
const PATH: Record<Kind, string> = { offer: '/offers', hire: '/hiring' };

/** Where an offer/hire deep link goes: its file; the Manager gets the offer decision open over it (?decide=). */
export function entityTarget(kind: Kind, id: string, appId: string, seat: string | undefined): string {
  const file = `/applications/${encodeURIComponent(appId)}`;
  return kind === 'offer' && seat === 'manager' ? `${file}?decide=${encodeURIComponent(id)}` : file;
}

/**
 * /offers/:id resolves to the file. /hires/:id in the live router stays on the hiring case.
 * Unknown or forbidden ids fall back to the actor's authorized home.
 * A returnTo query is kept only when the file contract and the route policy both accept it.
 */
export function EntityLinkRoute({ kind }: { kind: Kind }) {
  const { id = '' } = useParams();
  const seat = useV2Shell()?.seat ?? 'employee';
  const { user } = useAuth();
  const returnTo = useSearchParams()[0].get('returnTo');
  const permKey = (user?.permissions ?? []).join('\u0000');
  const roleKey = (user?.roles ?? []).map((role) => role.code).join('\u0000');
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    const actor = routeActor(seat, user);
    const fallback = authorizedLanding(actor);
    const back = allowedReturn(returnTo, actor);
    if (actor.interviewerOnly) {
      setTo(fallback);
      return undefined;
    }
    let live = true;
    getApi<{ applicationId?: string; application?: { id?: string } }>(`${PATH[kind]}/${encodeURIComponent(id)}`)
      .then((r) => {
        const app = r?.applicationId ?? r?.application?.id;
        if (live) setTo(app ? withReturnTo(entityTarget(kind, id, app, seat), back) : fallback);
      })
      .catch(() => { if (live) setTo(fallback); });
    return () => { live = false; };
  }, [kind, id, seat, user, returnTo, permKey, roleKey]);
  return to ? <Navigate to={to} replace /> : <p className="rf2-file__muted" role="status">Opening…</p>;
}
