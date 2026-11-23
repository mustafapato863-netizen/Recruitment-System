import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../components/v2/__tests__/axe';

const getApi = vi.fn();
const postApi = vi.fn();
const openGuide = vi.fn();

vi.mock('../../../api/client', () => ({
  getApi: (p: string) => getApi(p),
  postApi: (p: string, b?: unknown) => postApi(p, b),
}));

vi.mock('../../../quickguide', () => ({
  useQuickGuide: () => ({ openGuide }),
}));

import { AssistantDrawer } from '../AssistantDrawer';

function renderDrawer(props: Partial<React.ComponentProps<typeof AssistantDrawer>> = {}, initialPath = '/applications/a1') {
  document.documentElement.setAttribute('data-ui', 'v2');
  const onClose = props.onClose ?? vi.fn();
  const res = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <AssistantDrawer
              open={props.open ?? true}
              seat={props.seat ?? 'employee'}
              initialQuestion={props.initialQuestion}
              onInitialQuestionConsumed={props.onInitialQuestionConsumed}
              onClose={onClose}
            />
          }
        />
        <Route path="/my-work" element={<p>navigated to my work</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onClose, ...res };
}

beforeEach(() => {
  getApi.mockReset();
  postApi.mockReset();
  openGuide.mockReset();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-ui');
});

describe('AssistantDrawer', () => {
  it('loads workspace suggestions, renders answers with citations & route actions, and has zero axe violations', async () => {
    getApi.mockResolvedValue({
      seat: 'employee',
      mode: 'llm',
      prompts: ['Why did Move to Offer return GATE_SCORECARD_NOT_SUBMITTED?'],
    });
    postApi.mockResolvedValue({
      answer: '**Where to go:** `/applications/:id`\n\n**Next action:** Submit a scorecard on `/my-interviews` before advancing.',
      mode: 'llm',
      seat: 'employee',
      provider: 'gemini:gemini-2.5-flash',
      citations: [
        {
          chunkId: 'wf-stage-gates',
          title: 'Canonical 8-Stage Application Pipeline & 5 Server Hard Gates',
          topic: 'workflow',
          sourceDoc: 'ai-assistant/KNOWLEDGE_CHUNKS.jsonl',
          routes: ['/applications/:id'],
          errorCodes: ['GATE_SCORECARD_NOT_SUBMITTED'],
        },
      ],
      suggestedActions: [{ label: 'Open My Work', route: '/my-work' }],
      followUpQuestions: ['Which 5 server hard gates block application stage moves?'],
    });

    const u = userEvent.setup();
    const { onClose } = renderDrawer();

    const dialog = await screen.findByRole('dialog', { name: 'RecruitFlow Guide Assistant' });
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /GATE_SCORECARD_NOT_SUBMITTED/ })).toBeInTheDocument();
    expect(await axeViolations(document.body)).toEqual([]);

    await u.click(screen.getByRole('button', { name: /GATE_SCORECARD_NOT_SUBMITTED/ }));

    expect(await screen.findByText(/Submit a scorecard on/)).toBeInTheDocument();
    expect(screen.getByText(/Verified sources \(1\)/)).toBeInTheDocument();
    expect(postApi).toHaveBeenCalledWith(
      '/assistant/ask',
      expect.objectContaining({
        seat: 'employee',
        currentRoute: '/applications/a1',
        question: 'Why did Move to Offer return GATE_SCORECARD_NOT_SUBMITTED?',
      }),
    );

    await u.click(screen.getByRole('button', { name: 'Open My Work' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('navigated to my work')).toBeInTheDocument();
  });

  it('shows rate-limit recovery UI on 429 and retries cleanly', async () => {
    getApi.mockResolvedValue({ seat: 'manager', mode: 'grounded-fallback', prompts: [] });
    postApi
      .mockRejectedValueOnce({ statusCode: 429, retryAfterSeconds: 12, message: 'Too many requests' })
      .mockResolvedValueOnce({
        answer: '**Where to go:** `/vacancy-requests`',
        mode: 'grounded-fallback',
        seat: 'manager',
        citations: [],
        suggestedActions: [],
        followUpQuestions: [],
      });

    const u = userEvent.setup();
    renderDrawer({ seat: 'manager', initialQuestion: 'Why does DUE_DATE_REQUIRED happen?' });

    const input = await screen.findByLabelText('Ask a question about RecruitFlow');
    expect(input).toHaveValue('Why does DUE_DATE_REQUIRED happen?');
    await u.click(screen.getByRole('button', { name: 'Send question' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Rate limit reached.*12s/i);

    await u.click(screen.getByRole('button', { name: 'Retry question' }));
    expect(await screen.findByText('/vacancy-requests')).toBeInTheDocument();
  });

  it('closes on Escape and switches cleanly to Page Guide', async () => {
    getApi.mockResolvedValue({ seat: 'admin', mode: 'grounded-fallback', prompts: [] });
    const u = userEvent.setup();
    const { onClose } = renderDrawer({ seat: 'admin' });

    await screen.findByRole('dialog', { name: 'RecruitFlow Guide Assistant' });
    await u.click(screen.getByRole('button', { name: 'Page Guide' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openGuide).toHaveBeenCalledTimes(1);

    await u.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});
