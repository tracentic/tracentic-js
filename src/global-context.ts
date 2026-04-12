/**
 * Store for global attributes applied to every span.
 * Accessible via the static current accessor or passed directly.
 *
 * In Node.js there is no threading — a plain Map is sufficient.
 * Copy-on-read via getAll() prevents callers from mutating internal state.
 */
export class TracenticGlobalContext {
  private static _current: TracenticGlobalContext | undefined;

  /** Singleton instance. Throws if createTracentic() has not been called. */
  static get current(): TracenticGlobalContext {
    if (!TracenticGlobalContext._current) {
      throw new Error(
        'TracenticGlobalContext has not been initialized. ' +
          'Call createTracentic() or configure() first.',
      );
    }
    return TracenticGlobalContext._current;
  }

  /** @internal */
  static _setCurrent(instance: TracenticGlobalContext): void {
    TracenticGlobalContext._current = instance;
  }

  /** @internal */
  static _resetCurrent(): void {
    TracenticGlobalContext._current = undefined;
  }

  private readonly _attributes = new Map<string, unknown>();

  /** Set a global attribute. */
  set(key: string, value: unknown): void {
    this._attributes.set(key, value);
  }

  /** Remove a global attribute. */
  remove(key: string): void {
    this._attributes.delete(key);
  }

  /** Snapshot of all current global attributes. */
  getAll(): Readonly<Record<string, unknown>> {
    return Object.fromEntries(this._attributes);
  }
}
