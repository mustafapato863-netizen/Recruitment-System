import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './ui/Button';
import { usePermissions } from '../hooks/usePermissions';

export interface PermissionAwareButtonProps extends ButtonProps {
  requiredPermission?: string;
  requiredAnyPermissions?: readonly string[];
  /** Shown when the user lacks permission. Defaults to a Needs… label. */
  deniedTitle?: string;
  children: ReactNode;
}

/**
 * Button that stays visible when permission is missing, but is disabled with a
 * clear "Needs …" tooltip so nav/actions never become cryptic dead ends.
 */
export function PermissionAwareButton({
  requiredPermission,
  requiredAnyPermissions,
  deniedTitle,
  disabled,
  title,
  children,
  ...props
}: PermissionAwareButtonProps) {
  const { canAccess, describeRequirement } = usePermissions();
  const allowed = canAccess({ requiredPermission, requiredAnyPermissions });
  const requirementTitle =
    deniedTitle
    ?? `Needs ${describeRequirement({ requiredPermission, requiredAnyPermissions })}`;
  const isDenied = !allowed;
  const mergedTitle = isDenied ? requirementTitle : title;

  if (!isDenied) {
    return (
      <Button disabled={disabled} title={mergedTitle} {...props}>
        {children}
      </Button>
    );
  }

  // Wrapper keeps the tooltip hoverable even though Button uses pointer-events-none when disabled.
  return (
    <span className="inline-flex" title={requirementTitle}>
      <Button
        {...props}
        disabled
        aria-disabled="true"
        title={requirementTitle}
        className={['pointer-events-none', props.className].filter(Boolean).join(' ')}
      >
        {children}
      </Button>
    </span>
  );
}
