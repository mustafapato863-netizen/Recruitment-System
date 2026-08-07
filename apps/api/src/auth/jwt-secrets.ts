import type { ConfigService } from '@nestjs/config';

export function requireJwtSecret(configService: ConfigService, name: string): string {
  const secret = configService.get<string>(name);
  if (!secret || secret.length < 32 || secret.startsWith('CHANGE_ME')) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return secret;
}
