import type { AttributeLimits } from './options.js';
import type { TracenticGlobalContext } from './global-context.js';
import type { TracenticScope } from './scope.js';

/**
 * Merges three layers of attributes into a single flat record.
 * Priority (lowest → highest): global → scope → span.
 * On key collision the higher layer wins. The merge always produces
 * a new object — no input is mutated.
 *
 * Enforces AttributeLimits to prevent oversized payloads: keys and
 * string values are truncated, and the total attribute count is capped.
 */
export class AttributeMerger {
  private readonly _global: TracenticGlobalContext;
  private readonly _limits: AttributeLimits;

  constructor(global: TracenticGlobalContext, limits: AttributeLimits) {
    this._global = global;
    this._limits = limits;
  }

  merge(
    scope: TracenticScope | undefined,
    spanAttributes: Readonly<Record<string, unknown>> | undefined,
  ): Readonly<Record<string, unknown>> {
    // Layer 1 — global (lowest priority)
    const result: Record<string, unknown> = { ...this._global.getAll() };

    // Layer 2 — scope attributes
    if (scope) {
      for (const [k, v] of Object.entries(scope.attributes)) {
        result[k] = v;
      }
    }

    // Layer 3 — span-level (highest priority)
    if (spanAttributes) {
      for (const [k, v] of Object.entries(spanAttributes)) {
        result[k] = v;
      }
    }

    return this._enforce(result);
  }

  private _enforce(
    attrs: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let count = 0;

    for (const [key, value] of Object.entries(attrs)) {
      const safeKey =
        key.length > this._limits.maxKeyLength
          ? key.slice(0, this._limits.maxKeyLength)
          : key;

      const safeValue =
        typeof value === 'string' &&
        value.length > this._limits.maxStringValueLength
          ? value.slice(0, this._limits.maxStringValueLength)
          : value;

      result[safeKey] = safeValue;
      count++;

      if (count >= this._limits.maxAttributeCount) {
        break;
      }
    }

    return result;
  }
}
