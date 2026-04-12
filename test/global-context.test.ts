import { describe, it, expect, beforeEach } from 'vitest';
import { TracenticGlobalContext } from '../src/global-context';

describe('TracenticGlobalContext', () => {
  let ctx: TracenticGlobalContext;

  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
    ctx = new TracenticGlobalContext();
  });

  it('set and getAll', () => {
    ctx.set('key', 'value');
    expect(ctx.getAll()).toEqual({ key: 'value' });
  });

  it('remove deletes a key', () => {
    ctx.set('key', 'value');
    ctx.remove('key');
    expect(ctx.getAll()).toEqual({});
  });

  it('getAll returns a snapshot (not a live reference)', () => {
    ctx.set('a', 1);
    const snap = ctx.getAll();
    ctx.set('b', 2);

    expect(snap).toEqual({ a: 1 });
    expect(ctx.getAll()).toEqual({ a: 1, b: 2 });
  });

  it('current throws if not initialized', () => {
    expect(() => TracenticGlobalContext.current).toThrow(
      'TracenticGlobalContext has not been initialized',
    );
  });

  it('current returns the set instance', () => {
    TracenticGlobalContext._setCurrent(ctx);
    expect(TracenticGlobalContext.current).toBe(ctx);
  });

  it('resetCurrent clears the singleton', () => {
    TracenticGlobalContext._setCurrent(ctx);
    TracenticGlobalContext._resetCurrent();
    expect(() => TracenticGlobalContext.current).toThrow();
  });
});
