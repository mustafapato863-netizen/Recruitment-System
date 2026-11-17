import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './stage-form.css';

/** A named field group with one semantic colour, shared by the stage forms. */
export function StageFormSection({ title, icon: Icon, tone = 'info', children }: {
  title: string; icon: LucideIcon; tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'; children: ReactNode;
}) {
  const id = useId();
  return <section className="rf2-stage-section" data-tone={tone} aria-labelledby={id}>
    <h3 className="rf2-stage-section__title" id={id}><span aria-hidden="true"><Icon /></span>{title}</h3>
    <div className="rf2-stage-section__body">{children}</div>
  </section>;
}
