import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Requests a user with `mustChangePassword` may still make while forced to
 * change it. Paths are matched after stripping the `/api/v1` global prefix
 * (req.path carries the prefix — see main.ts — but the strip keeps this
 * working if a caller passes an unprefixed path). Method matters: only the
 * profile read and the password change itself are open, not profile edits.
 */
const PASSWORD_CHANGE_ALLOW_LIST: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'GET', path: '/auth/me' },
  { method: 'POST', path: '/auth/logout' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'GET', path: '/me/profile' },
  { method: 'POST', path: '/me/password' },
];

export function isPasswordChangeAllowedRequest(method: string, path: string): boolean {
  const normalized = path
    .replace(/\/+$/, '')
    .replace(/^\/api\/v1(?=\/|$)/, '') || '/';
  return PASSWORD_CHANGE_ALLOW_LIST.some(
    (entry) => entry.method === method.toUpperCase() && entry.path === normalized,
  );
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Await Passport authentication so request.user is populated before we read it.
    const allowed = await (super.canActivate(context) as Promise<boolean>);

    // After JWT validation, attach the authoritative tenant context.
    // This is the only safe place — middleware runs before guards and cannot access req.user.
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user && user.organizationId) {
      request.tenantId = user.organizationId;
    }

    // Forced password change: block everything except the allow-list above
    // (profile read, logout, refresh, and the password change itself).
    if (user?.mustChangePassword === true) {
      const method = typeof request.method === 'string' ? request.method : 'GET';
      const path = typeof request.path === 'string' ? request.path : '';
      if (!isPasswordChangeAllowedRequest(method, path)) {
        throw new ForbiddenException({
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your password before continuing.',
        });
      }
    }

    return allowed;
  }
}
