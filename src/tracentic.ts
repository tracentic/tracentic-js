import { TracenticScope } from "./scope.js";
import type { TracenticSpan } from "./span.js";
import type { TracenticOptions, ModelPricing } from "./options.js";
import { AttributeLimits } from "./options.js";
import { TracenticGlobalContext } from "./global-context.js";
import { AttributeMerger } from "./attribute-merger.js";
import { OtlpJsonExporter, type ExportableSpan } from "./exporter.js";

/**
 * Public interface for the Tracentic SDK.
 */
export interface ITracentic {
  /** Creates a new root operation scope. */
  begin(
    name: string,
    options?: {
      attributes?: Record<string, unknown>;
      correlationId?: string;
    },
  ): TracenticScope;

  /** Creates a child scope linked to a parent scope in another service. */
  begin(
    name: string,
    options: {
      parentScopeId: string;
      attributes?: Record<string, unknown>;
      correlationId?: string;
    },
  ): TracenticScope;

  /** Records a completed LLM span associated with a scope. */
  recordSpan(scope: TracenticScope, span: TracenticSpan): void;

  /** Records a completed LLM span with no scope association. */
  recordSpan(span: TracenticSpan): void;

  /** Records an LLM span that resulted in an error, with scope. */
  recordError(scope: TracenticScope, span: TracenticSpan, error: Error): void;

  /** Records an LLM span that resulted in an error, without scope. */
  recordError(span: TracenticSpan, error: Error): void;

  /** Flushes all buffered spans and shuts down the exporter. */
  shutdown(): Promise<void>;
}

/**
 * Header / property name used to propagate a parent scope ID across
 * services. Use this constant rather than hard-coding the string so
 * a typo on either end can't silently break cross-service linking.
 */
export const TRACENTIC_SCOPE_HEADER = "x-tracentic-scope-id";

// ── Resolved internal options ──────────────────────────────────────

interface ResolvedOptions {
  serviceName: string;
  endpoint: string;
  environment: string;
  customPricing: Record<string, ModelPricing> | undefined;
  attributeLimits: AttributeLimits;
}

// ── Implementation ─────────────────────────────────────────────────

export class TracenticClient implements ITracentic {
  private readonly _global: TracenticGlobalContext;
  private readonly _merger: AttributeMerger;
  private readonly _options: ResolvedOptions;
  private readonly _exporter: OtlpJsonExporter | undefined;
  private readonly _pricingWarned = new Set<string>();
  private _exitHandlerRegistered = false;

  /** @internal */
  constructor(
    globalContext: TracenticGlobalContext,
    options: ResolvedOptions,
    exporter: OtlpJsonExporter | undefined,
  ) {
    this._global = globalContext;
    this._options = options;
    this._merger = new AttributeMerger(globalContext, options.attributeLimits);
    this._exporter = exporter;

    if (this._exporter) {
      this._exporter.start();
      this._registerExitHandler();
    }
  }

  begin(
    name: string,
    options?: {
      parentScopeId?: string;
      attributes?: Record<string, unknown>;
      correlationId?: string;
    },
  ): TracenticScope {
    return new TracenticScope(
      name,
      options?.attributes ? { ...options.attributes } : undefined,
      options?.correlationId,
      options?.parentScopeId,
    );
  }

  recordSpan(scope: TracenticScope, span: TracenticSpan): void;
  recordSpan(span: TracenticSpan): void;
  recordSpan(
    scopeOrSpan: TracenticScope | TracenticSpan,
    maybeSpan?: TracenticSpan,
  ): void {
    if (scopeOrSpan instanceof TracenticScope) {
      const merged = this._merger.merge(scopeOrSpan, maybeSpan!.attributes);
      this._recordInternal(maybeSpan!, merged, scopeOrSpan);
    } else {
      const merged = this._merger.merge(undefined, scopeOrSpan.attributes);
      this._recordInternal(scopeOrSpan, merged, undefined);
    }
  }

  recordError(scope: TracenticScope, span: TracenticSpan, error: Error): void;
  recordError(span: TracenticSpan, error: Error): void;
  recordError(
    scopeOrSpan: TracenticScope | TracenticSpan,
    spanOrError: TracenticSpan | Error,
    maybeError?: Error,
  ): void {
    if (scopeOrSpan instanceof TracenticScope) {
      const span = spanOrError as TracenticSpan;
      const error = maybeError!;
      const merged = this._merger.merge(scopeOrSpan, span.attributes);
      this._recordErrorInternal(span, merged, error, scopeOrSpan);
    } else {
      const span = scopeOrSpan as TracenticSpan;
      const error = spanOrError as Error;
      const merged = this._merger.merge(undefined, span.attributes);
      this._recordErrorInternal(span, merged, error, undefined);
    }
  }

  async shutdown(): Promise<void> {
    if (this._exporter) {
      await this._exporter.shutdown();
    }
  }

  // ── Internal ───────────────────────────────────────────────────

  private _recordInternal(
    span: TracenticSpan,
    merged: Readonly<Record<string, unknown>>,
    scope: TracenticScope | undefined,
  ): void {
    const attrs: Record<string, unknown> = { ...merged };

    this._setLlmAttributes(attrs, span);
    this._setScopeAttributes(attrs, scope);
    this._setCost(attrs, span);

    const exportable: ExportableSpan = {
      name: buildSpanName(span.provider, span.operationType),
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      attributes: attrs,
      status: "ok",
    };

    this._exporter?.enqueue(exportable);
  }

  private _recordErrorInternal(
    span: TracenticSpan,
    merged: Readonly<Record<string, unknown>>,
    error: Error,
    scope: TracenticScope | undefined,
  ): void {
    const attrs: Record<string, unknown> = { ...merged };

    this._setLlmAttributes(attrs, span);
    this._setScopeAttributes(attrs, scope);
    attrs["llm.error.type"] = error.name;

    const exportable: ExportableSpan = {
      name: buildSpanName(span.provider, span.operationType),
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      attributes: attrs,
      status: "error",
      errorMessage: error.message,
    };

    this._exporter?.enqueue(exportable);
  }

  private _setLlmAttributes(
    attrs: Record<string, unknown>,
    span: TracenticSpan,
  ): void {
    if (span.provider != null) attrs["llm.provider"] = span.provider;
    if (span.model != null) attrs["llm.request.model"] = span.model;
    if (span.operationType != null)
      attrs["llm.request.type"] = span.operationType;
    if (span.inputTokens != null)
      attrs["llm.usage.input_tokens"] = span.inputTokens;
    if (span.outputTokens != null)
      attrs["llm.usage.output_tokens"] = span.outputTokens;
    if (span.inputTokens != null && span.outputTokens != null)
      attrs["llm.usage.total_tokens"] = span.inputTokens + span.outputTokens;

    attrs["llm.duration_ms"] = Math.round(
      span.endedAt.getTime() - span.startedAt.getTime(),
    );
  }

  private _setScopeAttributes(
    attrs: Record<string, unknown>,
    scope: TracenticScope | undefined,
  ): void {
    if (!scope) return;
    attrs["tracentic.scope.id"] = scope.id;
    attrs["tracentic.scope.name"] = scope.name;
    attrs["tracentic.scope.started_at"] = scope.startedAt.toISOString();
    if (scope.parentId != null)
      attrs["tracentic.scope.parent_id"] = scope.parentId;
    if (scope.correlationId != null)
      attrs["tracentic.scope.correlation_id"] = scope.correlationId;
  }

  /**
   * Cost is only computed when all four prerequisites are met:
   * Model, InputTokens, OutputTokens, and a matching CustomPricing entry.
   * Partial data produces no cost rather than a misleading estimate.
   */
  private _setCost(attrs: Record<string, unknown>, span: TracenticSpan): void {
    if (
      span.model == null ||
      span.inputTokens == null ||
      span.outputTokens == null
    )
      return;

    const pricing = this._options.customPricing?.[span.model];
    if (!pricing) {
      this._warnMissingPricing(span.model);
      return;
    }

    const cost =
      (span.inputTokens / 1_000_000) * pricing.inputCostPerMillion +
      (span.outputTokens / 1_000_000) * pricing.outputCostPerMillion;

    attrs["llm.cost.total_usd"] = cost;
  }

  private _warnMissingPricing(model: string): void {
    if (this._pricingWarned.has(model)) return;
    this._pricingWarned.add(model);
    console.warn(
      `[tracentic] No customPricing entry for model "${model}" - llm.cost.total_usd will be omitted. ` +
        `Pass customPricing to createTracentic() to enable cost tracking.`,
    );
  }

  private _registerExitHandler(): void {
    if (this._exitHandlerRegistered) return;
    this._exitHandlerRegistered = true;

    const flush = () => {
      void this.shutdown();
    };

    process.on("beforeExit", flush);
    process.on("SIGTERM", flush);
    process.on("SIGINT", flush);
  }
}

function buildSpanName(
  provider: string | undefined,
  operationType: string | undefined,
): string {
  if (provider && operationType) return `llm.${provider}.${operationType}`;
  if (provider) return `llm.${provider}`;
  return "llm.call";
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Creates a new Tracentic SDK instance. This is the primary entry point.
 *
 * ```ts
 * // src/tracentic.ts
 * import { createTracentic } from 'tracentic';
 * export const tracentic = createTracentic({ apiKey: '...', serviceName: 'my-service' });
 *
 * // src/agents/summarizer.ts
 * import { tracentic } from '../tracentic';
 * const scope = tracentic.begin('summarize');
 * ```
 */
export function createTracentic(options: TracenticOptions = {}): ITracentic {
  const resolved: ResolvedOptions = {
    serviceName: options.serviceName ?? "unknown-service",
    endpoint: options.endpoint ?? "https://tracentic.dev",
    environment: options.environment ?? "production",
    customPricing: options.customPricing
      ? { ...options.customPricing }
      : undefined,
    attributeLimits: new AttributeLimits(options.attributeLimits),
  };

  const globalContext = new TracenticGlobalContext();
  TracenticGlobalContext._setCurrent(globalContext);

  // Apply initial global attributes
  if (options.globalAttributes) {
    for (const [key, value] of Object.entries(options.globalAttributes)) {
      globalContext.set(key, value);
    }
  }

  // Create exporter only if API key is provided
  let exporter: OtlpJsonExporter | undefined;
  if (options.apiKey) {
    exporter = new OtlpJsonExporter({
      endpoint: resolved.endpoint,
      apiKey: options.apiKey,
      serviceName: resolved.serviceName,
      environment: resolved.environment,
    });
  } else {
    console.info(
      "[tracentic] No apiKey provided - spans will be created locally but " +
        "not exported. Pass apiKey to createTracentic() to send spans to Tracentic.",
    );
  }

  return new TracenticClient(globalContext, resolved, exporter);
}

// ── Singleton convenience API ──────────────────────────────────────

let _singleton: ITracentic | undefined;

/**
 * Configures the global Tracentic singleton. Call once at startup.
 *
 * ```ts
 * import { configure } from 'tracentic';
 * configure({ apiKey: '...', serviceName: 'my-service' });
 * ```
 */
export function configure(options: TracenticOptions): ITracentic {
  _singleton = createTracentic(options);
  return _singleton;
}

/**
 * Returns the global Tracentic singleton. Throws if configure() has
 * not been called.
 *
 * ```ts
 * import { getTracentic } from 'tracentic';
 * const tracentic = getTracentic();
 * ```
 */
export function getTracentic(): ITracentic {
  if (!_singleton) {
    throw new Error(
      "Tracentic has not been configured. Call configure() first.",
    );
  }
  return _singleton;
}
