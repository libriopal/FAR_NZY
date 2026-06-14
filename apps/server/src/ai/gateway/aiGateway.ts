// Transport only. No policy decisions. No budget decisions. No compliance decisions.
// Responsibilities: check cache → call provider → record response → return.

import { responseCache } from '../cache/responseCache.js';
import { providerRegistry } from '../providers/ProviderRegistry.js';
import type { AIRequest, AIResponse } from '../providers/provider.js';

export async function generate(request: AIRequest): Promise<AIResponse> {
  const cacheKey = responseCache.key(request.prompt);
  const cached = responseCache.get(cacheKey);

  if (cached) {
    return {
      text: cached.text,
      model: cached.model,
      inputTokens: cached.inputTokens,
      outputTokens: cached.outputTokens,
      latencyMs: 0,
      cached: true,
    };
  }

  const provider = providerRegistry.getDefault();
  const response = await provider.generate(request);

  responseCache.set(cacheKey, {
    text: response.text,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  return response;
}

export const aiGateway = { generate };
