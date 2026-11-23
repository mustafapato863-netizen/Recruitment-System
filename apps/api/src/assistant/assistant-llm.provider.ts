import { Injectable, Logger } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AssistantHistoryTurn } from '@recruitflow/contracts';

export interface LlmSynthesisInput {
  systemPrompt: string;
  userPrompt: string;
  history?: AssistantHistoryTurn[] | undefined;
}

export interface LlmSynthesisResult {
  text: string;
  provider: string;
}

type ProviderKind = 'gemini' | 'openai-compatible';

interface ResolvedProviderConfig {
  kind: ProviderKind;
  apiKey: string;
  model: string;
  baseUrl?: string | undefined;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 15_000;

@Injectable()
export class AssistantLlmProvider {
  private readonly logger = new Logger(AssistantLlmProvider.name);

  constructor(private readonly configService?: ConfigService) {}

  private readEnv(key: string): string | undefined {
    const fromConfig = this.configService?.get<string>(key);
    const val = fromConfig ?? process.env[key];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }

  isEnabled(): boolean {
    const raw = this.readEnv('AI_ASSISTANT_ENABLED');
    return raw?.toLowerCase() !== 'false';
  }

  resolveConfig(): ResolvedProviderConfig | null {
    if (!this.isEnabled()) return null;

    const explicitProvider = this.readEnv('AI_ASSISTANT_PROVIDER')?.toLowerCase();
    const geminiKey = this.readEnv('GEMINI_API_KEY');
    const genericKey = this.readEnv('AI_ASSISTANT_API_KEY');
    const baseUrl = this.readEnv('AI_ASSISTANT_BASE_URL');

    if (explicitProvider === 'openai-compatible' || (baseUrl && !geminiKey && genericKey)) {
      const apiKey = genericKey ?? geminiKey;
      if (!apiKey || !baseUrl) return null;
      return {
        kind: 'openai-compatible',
        apiKey,
        model: this.readEnv('AI_ASSISTANT_MODEL') ?? DEFAULT_OPENAI_MODEL,
        baseUrl: baseUrl.replace(/\/+$/, ''),
      };
    }

    const apiKey = geminiKey ?? genericKey;
    if (!apiKey) return null;

    return {
      kind: 'gemini',
      apiKey,
      model: this.readEnv('AI_ASSISTANT_MODEL') ?? DEFAULT_GEMINI_MODEL,
    };
  }

  isLlmConfigured(): boolean {
    return this.resolveConfig() !== null;
  }

  async synthesize(input: LlmSynthesisInput): Promise<LlmSynthesisResult | null> {
    const cfg = this.resolveConfig();
    if (!cfg) return null;

    try {
      if (cfg.kind === 'openai-compatible') {
        return await this.callOpenAiCompatible(cfg, input);
      }
      return await this.callGemini(cfg, input);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Assistant LLM request failed (${cfg.kind}); falling back to grounded guide: ${msg}`);
      return null;
    }
  }

  private async callGemini(
    cfg: ResolvedProviderConfig,
    input: LlmSynthesisInput,
  ): Promise<LlmSynthesisResult | null> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
    const contents = [
      ...(input.history ?? []).map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })),
      {
        role: 'user',
        parts: [{ text: input.userPrompt }],
      },
    ];

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cfg.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900,
        },
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      this.logger.warn(`Gemini API returned HTTP ${res.status}; using grounded fallback.`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim();

    if (!text) return null;
    return { text, provider: `gemini:${cfg.model}` };
  }

  private async callOpenAiCompatible(
    cfg: ResolvedProviderConfig,
    input: LlmSynthesisInput,
  ): Promise<LlmSynthesisResult | null> {
    const endpoint = `${cfg.baseUrl}/chat/completions`;
    const messages = [
      { role: 'system', content: input.systemPrompt },
      ...(input.history ?? []).map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      { role: 'user', content: input.userPrompt },
    ];

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      this.logger.warn(`OpenAI-compatible endpoint returned HTTP ${res.status}; using grounded fallback.`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return { text, provider: `openai-compatible:${cfg.model}` };
  }
}
