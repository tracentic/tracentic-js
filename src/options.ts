const PLATFORM_MAX_ATTRIBUTE_COUNT = 128;
const PLATFORM_MAX_STRING_VALUE_LENGTH = 4096;
const PLATFORM_MAX_KEY_LENGTH = 256;

/**
 * Guards against unbounded attribute data. Applied during the merge
 * step so limits are enforced uniformly across global, scope, and
 * span attributes.
 *
 * Users may lower these limits to catch accidental bloat during
 * development, but values are clamped to platform maximums that
 * cannot be exceeded.
 */
export interface AttributeLimitsOptions {
  maxAttributeCount?: number;
  maxStringValueLength?: number;
  maxKeyLength?: number;
}

export class AttributeLimits {
  static readonly PLATFORM_MAX_ATTRIBUTE_COUNT = PLATFORM_MAX_ATTRIBUTE_COUNT;
  static readonly PLATFORM_MAX_STRING_VALUE_LENGTH = PLATFORM_MAX_STRING_VALUE_LENGTH;
  static readonly PLATFORM_MAX_KEY_LENGTH = PLATFORM_MAX_KEY_LENGTH;

  readonly maxAttributeCount: number;
  readonly maxStringValueLength: number;
  readonly maxKeyLength: number;

  constructor(opts?: AttributeLimitsOptions) {
    this.maxAttributeCount = clamp(
      opts?.maxAttributeCount ?? PLATFORM_MAX_ATTRIBUTE_COUNT,
      1,
      PLATFORM_MAX_ATTRIBUTE_COUNT,
    );
    this.maxStringValueLength = clamp(
      opts?.maxStringValueLength ?? PLATFORM_MAX_STRING_VALUE_LENGTH,
      1,
      PLATFORM_MAX_STRING_VALUE_LENGTH,
    );
    this.maxKeyLength = clamp(
      opts?.maxKeyLength ?? PLATFORM_MAX_KEY_LENGTH,
      1,
      PLATFORM_MAX_KEY_LENGTH,
    );
  }
}

/** Pricing entry for a single model. */
export interface ModelPricing {
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

/**
 * Configuration options for the Tracentic SDK.
 */
export interface TracenticOptions {
  /**
   * Your Tracentic API key. If null/undefined, spans are created
   * locally but not exported. Enables local dev without an account.
   */
  apiKey?: string;

  /** Identifies your service in the dashboard. Default: "unknown-service". */
  serviceName?: string;

  /**
   * OTLP ingestion endpoint. Defaults to Tracentic cloud.
   * Override for self-hosted or local testing.
   */
  endpoint?: string;

  /** Deployment environment tag. Default: "production". */
  environment?: string;

  /**
   * Pricing for LLM cost calculation. Keys are model identifiers
   * (exact, case-sensitive match). If a model is not present,
   * llm.cost.total_usd is omitted. No built-in fallback pricing.
   */
  customPricing?: Record<string, ModelPricing>;

  /**
   * Static attributes applied to every span for the lifetime of
   * the application. Use for values known at startup: environment,
   * region, version, deployment ID, etc.
   */
  globalAttributes?: Record<string, unknown>;

  /**
   * Limits applied to user-supplied attributes to prevent oversized
   * payloads. Defaults are aligned with platform maximums.
   */
  attributeLimits?: AttributeLimitsOptions;

  /**
   * Per-request timeout in milliseconds for OTLP exports.
   * Default: 30000 (30 seconds).
   */
  exportTimeoutMs?: number;

  /**
   * Enable verbose diagnostic logging. When true, the SDK logs
   * detailed information about span recording, batching, export
   * requests, and shutdown. Default: false.
   */
  debug?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
