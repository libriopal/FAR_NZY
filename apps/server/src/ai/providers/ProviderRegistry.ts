// ProviderRegistry — single gateway point for all AI provider access.
// Extend ProviderId union when adding providers. Never modify gateway code.

import type { AIProvider } from './provider.js';

export type ProviderId = 'cohere';
// Future: | 'anthropic' | 'gemini' | 'ollama' | 'local'

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, AIProvider>();

  register(id: ProviderId, provider: AIProvider): void {
    this.providers.set(id, provider);
  }

  getProvider(id: ProviderId): AIProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider '${id}' not registered. Register it in ai/index.ts.`);
    return p;
  }

  getDefault(): AIProvider {
    return this.getProvider('cohere');
  }
}

// Singleton — initialize once at server startup via ai/index.ts
export const providerRegistry = new ProviderRegistry();
