import type { HTMLAttributes, ReactNode } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type PresenceStatus = 'online' | 'away' | 'offline';

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  initials: string;
  size?: AvatarSize;
  presence?: PresenceStatus;
  color?: string;
}

export function Avatar({
  initials,
  size = 'md',
  presence,
  className = '',
  color,
  ...props
}: AvatarProps) {
  const avatarElement = (
    <span
      className={['avatar-demo text-rf-on-action font-extrabold select-none', size, className].filter(Boolean).join(' ')}
      style={color ? { background: color } : undefined}
      {...props}
    >
      {initials}
    </span>
  );

  if (presence) {
    return (
      <span className="avatar-presence">
        {avatarElement}
        <span
          className={`presence-dot ${presence}`}
          title={presence.charAt(0).toUpperCase() + presence.slice(1)}
        />
      </span>
    );
  }

  return avatarElement;
}

interface AvatarStackProps {
  children: ReactNode;
  maxCount?: number;
  totalCount?: number;
  className?: string;
}

export function AvatarStack({ children, totalCount, maxCount = 3, className = '' }: AvatarStackProps) {
  const overflow = totalCount && totalCount > maxCount ? totalCount - maxCount : null;
  return (
    <div className={['avatar-stack', className].filter(Boolean).join(' ')}>
      {children}
      {overflow !== null && overflow > 0 && (
        <span className="avatar-stack-more">+{overflow}</span>
      )}
    </div>
  );
}
