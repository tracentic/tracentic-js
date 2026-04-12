/**
 * Data about a single LLM call. Pass to recordSpan after the call
 * completes. startedAt and endedAt are required; all other fields
 * are optional.
 */
export interface TracenticSpan {
  /** UTC timestamp when the LLM call started. */
  startedAt: Date;

  /** UTC timestamp when the LLM call completed. */
  endedAt: Date;

  /** "anthropic", "openai", "google", etc. */
  provider?: string;

  /** The model identifier used for this call. */
  model?: string;

  /** Number of input/prompt tokens consumed. */
  inputTokens?: number;

  /** Number of output/completion tokens generated. */
  outputTokens?: number;

  /** "chat", "completion", "embedding" */
  operationType?: string;

  /**
   * Call-specific attributes. These have the highest merge priority —
   * they override scope and global attributes on key collision.
   */
  attributes?: Record<string, unknown>;
}
