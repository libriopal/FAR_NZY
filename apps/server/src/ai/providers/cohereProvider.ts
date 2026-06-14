import { CohereClient } from 'cohere-ai';
import { AI_CONFIG } from '../config.js';
import type { AIProvider, AIRequest, AIResponse } from './provider.js';

export class CohereProvider implements AIProvider {
  readonly id = 'cohere';
  private readonly client: CohereClient;

  constructor() {
    this.client = new CohereClient({ token: AI_CONFIG.cohereApiKey });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startMs = Date.now();
    try {
      const response = await this.client.generate({
        model: request.model,
        prompt: request.prompt,
        maxTokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.3,
      });

      const generation = response.generations?.[0];
      const text = generation?.text ?? '';
      const meta = response.meta;
      const inputTokens = meta?.billedUnits?.inputTokens ?? 0;
      const outputTokens = meta?.billedUnits?.outputTokens ?? 0;

      return {
        text,
        model: request.model,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startMs,
        cached: false,
      };
    } catch (err) {
      return {
        text: `[CohereProvider error: ${String(err)}]`,
        model: request.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startMs,
        cached: false,
      };
    }
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number }> {
    if (!AI_CONFIG.cohereApiKey) return { available: false };
    const startMs = Date.now();
    try {
      await this.client.generate({
        model: AI_CONFIG.rtpModel,
        prompt: 'ping',
        maxTokens: 1,
      });
      return { available: true, latencyMs: Date.now() - startMs };
    } catch {
      return { available: false, latencyMs: Date.now() - startMs };
    }
  }
}
