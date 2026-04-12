import { randomUUID } from 'node:crypto';

/**
 * Represents a logical operation scope. Pass to recordSpan to
 * associate spans with this operation. Fire and forget — no
 * disposal or end call required.
 *
 * Create a root scope: tracentic.begin("name")
 * Create a nested scope: scope.createChild("name")
 */
export class TracenticScope {
  /** Auto-generated UUID. Always unique. Never set by the developer. */
  readonly id: string;

  /** Optional business identifier for cross-service correlation. */
  readonly correlationId: string | undefined;

  /** The name of this operation scope. */
  readonly name: string;

  /** The id of the parent scope, or undefined for root scopes. */
  readonly parentId: string | undefined;

  /** UTC timestamp when begin() was called. */
  readonly startedAt: Date;

  /**
   * Attributes associated with this scope. Merged into every span
   * that references this scope — overrides global attributes on key
   * collision. Overridden by span-level attributes.
   */
  readonly attributes: Readonly<Record<string, unknown>>;

  /** @internal */
  constructor(
    name: string,
    attributes?: Record<string, unknown>,
    correlationId?: string,
    parentId?: string,
  ) {
    this.id = randomUUID().replace(/-/g, '');
    this.name = name;
    this.correlationId = correlationId;
    this.parentId = parentId;
    this.startedAt = new Date();
    this.attributes = attributes ? { ...attributes } : {};
  }

  /**
   * Creates a child scope nested under this scope.
   * Child's parentId is set to this scope's id automatically.
   */
  createChild(
    name: string,
    options?: {
      attributes?: Record<string, unknown>;
      correlationId?: string;
    },
  ): TracenticScope {
    return new TracenticScope(
      name,
      options?.attributes ? { ...options.attributes } : undefined,
      options?.correlationId,
      this.id,
    );
  }
}
