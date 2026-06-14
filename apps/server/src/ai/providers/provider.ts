// Provider abstraction — every AI provider implements this interface.
// Adding Anthropic, Gemini, Ollama, or a local model never requires
// touching gateway code. Implement this interface and register it.

export interface AIRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
}

export interface AIProvider {
  readonly id: string;
  generate(request: AIRequest): Promise<AIResponse>;
  healthCheck(): Promise<{ available: boolean; latencyMs?: number }>;
}
