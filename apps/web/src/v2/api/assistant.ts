import type {
  AssistantAskRequest,
  AssistantAskResponse,
  AssistantSeat,
  AssistantSuggestionsResponse,
} from '@recruitflow/contracts';
import { getApi, postApi } from '../../api/client';

export function fetchAssistantSuggestions(
  currentRoute?: string,
  seat?: AssistantSeat,
): Promise<AssistantSuggestionsResponse> {
  const params = new URLSearchParams();
  if (currentRoute) params.set('currentRoute', currentRoute);
  if (seat) params.set('seat', seat);
  const qs = params.toString();
  return getApi<AssistantSuggestionsResponse>(`/assistant/suggestions${qs ? `?${qs}` : ''}`);
}

export function askAssistant(payload: AssistantAskRequest): Promise<AssistantAskResponse> {
  return postApi<AssistantAskResponse>('/assistant/ask', payload);
}
