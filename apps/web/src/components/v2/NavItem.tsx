import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface NavItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  /** Not permitted → not rendered at all. There is no locked state (Roadmap v2 §1, §6). */
  permitted?: boolean;
  badge?: number;
  badgeLabel?: string;
  /** Render through a router link (e.g. <NavLink>) via Radix Slot. */
  asChild?: boolean;
}

/** v2 NavItem. States: default, hover, focus-visible, pressed, selected (aria-current). */
export const NavItem = React.forwardRef<HTMLAnchorElement, NavItemProps>(function NavItem(
  { label, icon, active = false, permitted = true, badge, badgeLabel, asChild, className, children, ...rest },
  ref,
) {
  if (!permitted) return null;
  const Comp = asChild ? Slot : 'a';
  const content = (
    <>
      <span aria-hidden="true" style={{ display: 'contents' }}>{icon}</span>
      <span className="rf2-nav-item__label">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="rf2-nav-item__badge" aria-label={badgeLabel ?? `${badge} pending`}>{badge}</span>
      ) : null}
    </>
  );
  return (
    <Comp ref={ref} className={cn('rf2-nav-item', className)} aria-current={active ? 'page' : undefined} {...rest}>
      {asChild && React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ children?: React.ReactNode }>, undefined, content)
        : content}
    </Comp>
  );
});

export function NavList({ label, children }: { label: string; children: React.ReactNode }) {
  // Drop non-permitted items here too, so no empty <li> is left behind.
  const items = React.Children.toArray(children).filter(
    (child) => !(React.isValidElement<{ permitted?: boolean }>(child) && child.props.permitted === false),
  );
  return (
    <nav aria-label={label}>
      <ul className="rf2-nav-list">
        {items.map((child, i) => <li key={i}>{child}</li>)}
      </ul>
    </nav>
  );
}
