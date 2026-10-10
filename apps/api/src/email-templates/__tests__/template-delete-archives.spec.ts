/** Template DELETE deactivates (status Archived) and never hard-deletes. */
import { describe, expect, it, vi } from 'vitest';
import { EmailTemplatesService } from '../email-templates.service';
import { WhatsAppTemplatesService } from '../../whatsapp-templates/whatsapp-templates.service';

const model = () => ({ findFirst: vi.fn().mockResolvedValue({ id: 't1', isDefault: false }), update: vi.fn().mockResolvedValue({}), delete: vi.fn(), deleteMany: vi.fn() });

describe('template DELETE archives', () => {
  it('email and WhatsApp templates are set Archived, never deleted', async () => {
    const email = model(); const wa = model();
    await new EmailTemplatesService({ emailTemplate: email } as never).archiveTemplate('org', 't1');
    await new WhatsAppTemplatesService({ whatsAppTemplate: wa } as never).archiveTemplate('org', 't1');
    for (const m of [email, wa]) {
      expect(m.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'Archived' } });
      expect(m.delete).not.toHaveBeenCalled(); expect(m.deleteMany).not.toHaveBeenCalled();
    }
  });
});
