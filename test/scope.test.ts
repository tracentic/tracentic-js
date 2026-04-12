import { describe, it, expect } from 'vitest';
import { TracenticScope } from '../src/scope';

describe('TracenticScope', () => {
  it('creates a root scope with auto-generated id', () => {
    const scope = new TracenticScope('test-op');

    expect(scope.id).toBeDefined();
    expect(scope.id).toHaveLength(32); // UUID without dashes
    expect(scope.name).toBe('test-op');
    expect(scope.parentId).toBeUndefined();
    expect(scope.correlationId).toBeUndefined();
    expect(scope.startedAt).toBeInstanceOf(Date);
    expect(scope.attributes).toEqual({});
  });

  it('stores attributes as a defensive copy', () => {
    const attrs = { key: 'value' };
    const scope = new TracenticScope('op', attrs);

    attrs.key = 'mutated';
    expect(scope.attributes['key']).toBe('value');
  });

  it('stores correlationId and parentId', () => {
    const scope = new TracenticScope('op', undefined, 'corr-123', 'parent-456');

    expect(scope.correlationId).toBe('corr-123');
    expect(scope.parentId).toBe('parent-456');
  });

  it('createChild sets parentId to parent scope id', () => {
    const parent = new TracenticScope('parent-op');
    const child = parent.createChild('child-op');

    expect(child.parentId).toBe(parent.id);
    expect(child.name).toBe('child-op');
    expect(child.id).not.toBe(parent.id);
  });

  it('createChild passes attributes and correlationId', () => {
    const parent = new TracenticScope('parent');
    const child = parent.createChild('child', {
      attributes: { region: 'us-east-1' },
      correlationId: 'order-789',
    });

    expect(child.attributes['region']).toBe('us-east-1');
    expect(child.correlationId).toBe('order-789');
    expect(child.parentId).toBe(parent.id);
  });

  it('createChild defensively copies attributes', () => {
    const parent = new TracenticScope('parent');
    const attrs = { key: 'original' };
    const child = parent.createChild('child', { attributes: attrs });

    attrs.key = 'mutated';
    expect(child.attributes['key']).toBe('original');
  });

  it('generates unique ids for each scope', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(new TracenticScope('op').id);
    }
    expect(ids.size).toBe(100);
  });
});
