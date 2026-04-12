import { describe, it, expect } from 'vitest';
import { AttributeLimits } from '../src/options';

describe('AttributeLimits', () => {
  it('uses platform defaults when no options provided', () => {
    const limits = new AttributeLimits();
    expect(limits.maxAttributeCount).toBe(128);
    expect(limits.maxStringValueLength).toBe(4096);
    expect(limits.maxKeyLength).toBe(256);
  });

  it('accepts custom values within range', () => {
    const limits = new AttributeLimits({
      maxAttributeCount: 50,
      maxStringValueLength: 1024,
      maxKeyLength: 64,
    });
    expect(limits.maxAttributeCount).toBe(50);
    expect(limits.maxStringValueLength).toBe(1024);
    expect(limits.maxKeyLength).toBe(64);
  });

  it('clamps values to platform maximums', () => {
    const limits = new AttributeLimits({
      maxAttributeCount: 9999,
      maxStringValueLength: 99999,
      maxKeyLength: 9999,
    });
    expect(limits.maxAttributeCount).toBe(128);
    expect(limits.maxStringValueLength).toBe(4096);
    expect(limits.maxKeyLength).toBe(256);
  });

  it('clamps values to minimum of 1', () => {
    const limits = new AttributeLimits({
      maxAttributeCount: 0,
      maxStringValueLength: -5,
      maxKeyLength: 0,
    });
    expect(limits.maxAttributeCount).toBe(1);
    expect(limits.maxStringValueLength).toBe(1);
    expect(limits.maxKeyLength).toBe(1);
  });

  it('exposes platform constants', () => {
    expect(AttributeLimits.PLATFORM_MAX_ATTRIBUTE_COUNT).toBe(128);
    expect(AttributeLimits.PLATFORM_MAX_STRING_VALUE_LENGTH).toBe(4096);
    expect(AttributeLimits.PLATFORM_MAX_KEY_LENGTH).toBe(256);
  });
});
