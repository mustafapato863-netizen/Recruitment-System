export type AssistantAnswerMode = 'llm' | 'grounded-fallback';

export type AssistantSeat = 'employee' | 'manager' | 'admin';

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantAskRequest {
  question: string;
  currentRoute?: string;
  seat?: AssistantSeat;
  errorCode?: string;
  history?: AssistantHistoryTurn[];
}

export interface AssistantCitation {
  chunkId: string;
  title: string;
  topic: string;
  sourceDoc: string;
  routes: string[];
  errorCodes: string[];
}

export interface AssistantActionLink {
  label: string;
  route: string;
}

export interface AssistantAskResponse {
  answer: string;
  mode: AssistantAnswerMode;
  seat: AssistantSeat;
  provider?: string;
  citations: AssistantCitation[];
  suggestedActions: AssistantActionLink[];
  followUpQuestions: string[];
  warnings?: string[];
}

export interface AssistantSuggestionsResponse {
  seat: AssistantSeat;
  mode: AssistantAnswerMode;
  prompts: string[];
}
