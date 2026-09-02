/**
 * TenantContextMiddleware has been intentionally disabled for M1-G4.
 *
 * Rationale: NestJS middleware executes BEFORE guards. Since JwtAuthGuard
 * populates `req.user` during the guard phase, any middleware that reads
 * `req.user` will always see `undefined`. The authoritative tenant context
 * is now set exclusively by JwtAuthGuard.canActivate() after awaiting
 * Passport authentication.
 *
 * This file is kept as a no-op to avoid breaking the barrel export in
 * `middleware/index.ts`. It will be removed entirely when middleware
 * references are cleaned up.
 */
import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    // No-op: tenant context is set by JwtAuthGuard after JWT validation.
    next();
  }
}
