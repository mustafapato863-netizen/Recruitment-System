import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

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

    return allowed;
  }
}
