import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WhatsAppTemplateItem } from '@recruitflow/contracts';
import { getApi, postApi } from '../../api/client';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Textarea } from '../ui/Textarea';
import { Icon } from '../Icon';
import { useFeedback } from '../../hooks/useFeedback';
import { getErrorMessage } from '../../api/errors';
import '../../pages/WhatsAppTemplatesPage.css';

export type WhatsAppSendContext = {
  phone?: string | null;
  candidateName?: string;
  positionTitle?: string;
  organizationName?: string;
  interviewType?: string;
  interviewDate?: string;
  recruiterName?: string;
};

type PreviewResponse = {
  body: string;
  waMeUrl: string;
  template: WhatsAppTemplateItem;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  context: WhatsAppSendContext;
};

const PLACEHOLDERS = [
  'candidateName',
  'positionTitle',
  'organizationName',
  'interviewType',
  'interviewDate',
  'recruiterName',
] as const;

function renderLocal(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function buildWaMe(phone: string, text: string) {
  const digits = phone.replace(/[^\d]/g, '');
  const q = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function SendWhatsAppDialog({ isOpen, onClose, context }: Props) {
  const { error: toastError, success: toastSuccess } = useFeedback();
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [phone, setPhone] = useState(context.phone || '');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const vars = useMemo(
    () => ({
      candidateName: context.candidateName || '',
      positionTitle: context.positionTitle || '',
      organizationName: context.organizationName || '',
      interviewType: context.interviewType || '',
      interviewDate: context.interviewDate || '',
      recruiterName: context.recruiterName || 'Recruiter',
    }),
    [context],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = context.interviewType
        ? `?interviewType=${encodeURIComponent(context.interviewType)}`
        : '';
      const data = await getApi<WhatsAppTemplateItem[]>(`/whatsapp-templates/for-send${q}`);
      setTemplates(Array.isArray(data) ? data : []);
      if (data?.[0]) {
        setSelectedId(data[0].id);
        setBody(renderLocal(data[0].bodyTemplate, vars));
      }
    } catch (err) {
      toastError(err, 'Unable to load WhatsApp templates');
    } finally {
      setLoading(false);
    }
  }, [context.interviewType, toastError, vars]);

  useEffect(() => {
    if (!isOpen) return;
    setPhone(context.phone || '');
    void load();
  }, [isOpen, context.phone, load]);

  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedId);
    if (tpl) setBody(renderLocal(tpl.bodyTemplate, vars));
  }, [selectedId, templates, vars]);

  const waUrl = useMemo(() => buildWaMe(phone, body), [phone, body]);

  const openWhatsApp = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      if (selectedId) {
        await postApi<PreviewResponse>(`/whatsapp-templates/${selectedId}/preview`, {
          ...vars,
          phone,
          bodyOverride: body,
        });
      }
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      toastSuccess('WhatsApp opened', 'Review the message in WhatsApp, then send.');
      onClose();
    } catch (err) {
      // Still open locally if preview endpoint fails
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      toastError(err, getErrorMessage(err, 'Opened WhatsApp with local preview'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send WhatsApp message"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        <FormField id="wa-phone" label="Candidate phone">
          <input
            id="wa-phone"
            className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+9665…"
          />
        </FormField>

        <FormField id="wa-tpl" label="Template">
          <select
            id="wa-tpl"
            className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink"
            value={selectedId}
            disabled={loading}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.interviewType}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="wa-body" label="Message (editable)">
          <Textarea
            id="wa-body"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-rf-ink-muted">
            Placeholders: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')}
          </p>
        </FormField>

        <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface-subtle p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
            Live preview
          </div>
          <div className="wa-preview-shell p-4">
            <div className="wa-bubble relative z-[1] ml-auto max-w-[92%] px-3 py-2 text-[13px] leading-relaxed">
              {body || 'Select a template to preview…'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void openWhatsApp()}
            disabled={busy || !body.trim()}
            className="inline-flex items-center gap-2"
          >
            <Icon name="chat" size={14} />
            Open in WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
}
