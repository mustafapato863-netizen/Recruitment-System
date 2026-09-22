import { describe, expect, it } from 'vitest';
import { WhatsAppTemplatesService } from '../whatsapp-templates.service';

describe('WhatsAppTemplatesService helpers', () => {
  it('renders supported placeholders', () => {
    const out = WhatsAppTemplatesService.render(
      'Hi {{candidateName}} for {{positionTitle}} at {{organizationName}}',
      {
        candidateName: 'Sara',
        positionTitle: 'Nurse',
        organizationName: 'SGH',
      },
    );
    expect(out).toBe('Hi Sara for Nurse at SGH');
  });

  it('builds wa.me URL with digits-only phone', () => {
    const url = WhatsAppTemplatesService.buildWaMeUrl('+966 50 123 4567', 'Hello');
    expect(url).toBe('https://wa.me/966501234567?text=Hello');
  });

  it('keeps unknown placeholders intact', () => {
    expect(WhatsAppTemplatesService.render('X {{missing}}', {})).toBe('X {{missing}}');
  });
});
