// Barrel export + provider initialization.
// Import this once at server startup; everything else uses the barrel.

import { CohereProvider } from './providers/cohereProvider.js';
import { providerRegistry } from './providers/ProviderRegistry.js';

// Initialize providers at startup
const cohereProvider = new CohereProvider();
providerRegistry.register('cohere', cohereProvider);

export { providerRegistry } from './providers/ProviderRegistry.js';
export type { ProviderId } from './providers/ProviderRegistry.js';
export type { AIProvider, AIRequest, AIResponse } from './providers/provider.js';
export { aiGateway } from './gateway/aiGateway.js';
export { responseCache } from './cache/responseCache.js';
export { AI_CONFIG } from './config.js';
