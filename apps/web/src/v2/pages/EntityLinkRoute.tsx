import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getApi } from '../../api/client';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';

type Kind = 'offer' | 'hire';
const PATH: Record<Kind, string> = { offer: '/offers', hire: '/hiring' };

/** Where an offer/hire deep link goes: its file; the Manager gets the offer decision open over it (?decide=). */
export function entityTarget(kind: Kind, id: string, appId: string, seat: string | undefined): string {
  const file = `/applications/${encodeURIComponent(appId)}`;
  return kind === 'offer' && seat === 'manager' ? `${file}?decide=${encodeURIComponent(id)}` : file;
}

/**
 * PR33-1: /offers/:id and /hires/:id (notifications, My Work) resolve to the file instead of a generic My Work.
 * Unknown/forbidden ids fall back to My Work.
 */
export function EntityLinkRoute({ kind }: { kind: Kind }) {
  const { id = '' } = useParams();
  const seat = useV2Shell()?.seat;
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getApi<{ applicationId?: string; application?: { id?: string } }>(`${PATH[kind]}/${encodeURIComponent(id)}`)
      .then((r) => { const app = r?.applicationId ?? r?.application?.id; if (live) setTo(app ? entityTarget(kind, id, app, seat) : '/my-work'); })
      .catch(() => live && setTo('/my-work'));
    return () => { live = false; };
  }, [kind, id, seat]);
  return to ? <Navigate to={to} replace /> : <p className="rf2-file__muted" role="status">Opening…</p>;
}
