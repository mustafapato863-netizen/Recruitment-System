import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SectionHeader } from './SectionHeader';

export type FormSectionTone = 'default' | 'subtle';

interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: FormSectionTone;
  className?: string;
  contentClassName?: string;
}

/** Groups related form fields into an announced, token-driven section. */
export function FormSection({
  title,
  description,
  eyebrow,
  actions,
  children,
  tone = 'default',
  className,
  contentClassName,
}: FormSectionProps) {
  const headingId = useId();

  return (
    <section className={cn('rf-ds-form-section', `rf-ds-form-section--${tone}`, className)} aria-labelledby={headingId}>
      <SectionHeader
        as="h2"
        headingId={headingId}
        title={title}
        description={description}
        eyebrow={eyebrow}
        actions={actions}
      />
      <div className={cn('rf-ds-form-section__content', contentClassName)}>{children}</div>
    </section>
  );
}
