import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
import { PrismaService } from '../database/prisma.service';
import { defaultPhoneCountryCode, repairContactKeys } from '../candidates/contact-keys';

/** B6: recompute candidate contact keys with the configured country code at boot (non-fatal). */
@Injectable()
export class ContactKeysBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContactKeysBootstrap.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.CONTACT_KEYS_REPAIR_ON_BOOT === 'false') return;
    try {
      const fixed = await repairContactKeys(this.prisma, defaultPhoneCountryCode());
      if (fixed > 0) this.logger.log(`Repaired contact keys on ${fixed} candidate(s).`);
    } catch (error) {
      this.logger.warn(`Contact key repair skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
