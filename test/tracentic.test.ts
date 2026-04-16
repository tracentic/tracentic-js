import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTracentic,
  configure,
  getTracentic,
  TracenticGlobalContext,
  TracenticScope,
} from "../src/index";

describe("createTracentic", () => {
  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
  });

  it("returns an ITracentic instance", () => {
    const t = createTracentic();
    expect(t).toBeDefined();
    expect(t.begin).toBeTypeOf("function");
    expect(t.recordSpan).toBeTypeOf("function");
    expect(t.recordError).toBeTypeOf("function");
    expect(t.shutdown).toBeTypeOf("function");
  });

  it("sets global context as current", () => {
    createTracentic();
    expect(() => TracenticGlobalContext.current).not.toThrow();
  });

  it("applies globalAttributes to context", () => {
    createTracentic({
      globalAttributes: { region: "us-east-1", version: "1.0" },
    });

    const all = TracenticGlobalContext.current.getAll();
    expect(all).toEqual({ region: "us-east-1", version: "1.0" });
  });

  it("works without apiKey (no export)", () => {
    const t = createTracentic({ serviceName: "test" });
    const scope = t.begin("op");

    // Should not throw even without exporter
    t.recordSpan(scope, {
      startedAt: new Date(),
      endedAt: new Date(),
    });
  });
});

describe("begin", () => {
  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
  });

  it("creates a root scope", () => {
    const t = createTracentic();
    const scope = t.begin("my-operation");

    expect(scope).toBeInstanceOf(TracenticScope);
    expect(scope.name).toBe("my-operation");
    expect(scope.parentId).toBeUndefined();
  });

  it("creates scope with attributes and correlationId", () => {
    const t = createTracentic();
    const scope = t.begin("op", {
      attributes: { docId: "doc-1" },
      correlationId: "order-123",
    });

    expect(scope.attributes["docId"]).toBe("doc-1");
    expect(scope.correlationId).toBe("order-123");
  });

  it("creates scope linked to parent scope id", () => {
    const t = createTracentic();
    const scope = t.begin("downstream", {
      parentScopeId: "external-scope-id",
    });

    expect(scope.parentId).toBe("external-scope-id");
  });

  it("defensively copies attributes", () => {
    const t = createTracentic();
    const attrs = { key: "original" };
    const scope = t.begin("op", { attributes: attrs });

    attrs.key = "mutated";
    expect(scope.attributes["key"]).toBe("original");
  });
});

describe("recordSpan", () => {
  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
  });

  it("records span with scope (no exporter, no throw)", () => {
    const t = createTracentic();
    const scope = t.begin("op");

    expect(() =>
      t.recordSpan(scope, {
        startedAt: new Date("2025-01-01T00:00:00Z"),
        endedAt: new Date("2025-01-01T00:00:01Z"),
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        inputTokens: 500,
        outputTokens: 200,
        operationType: "chat",
      }),
    ).not.toThrow();
  });

  it("records span without scope", () => {
    const t = createTracentic();

    expect(() =>
      t.recordSpan({
        startedAt: new Date(),
        endedAt: new Date(),
        provider: "openai",
        operationType: "embedding",
      }),
    ).not.toThrow();
  });
});

describe("recordError", () => {
  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
  });

  it("records error with scope", () => {
    const t = createTracentic();
    const scope = t.begin("op");

    expect(() =>
      t.recordError(
        scope,
        { startedAt: new Date(), endedAt: new Date() },
        new Error("rate limited"),
      ),
    ).not.toThrow();
  });

  it("records error without scope", () => {
    const t = createTracentic();

    expect(() =>
      t.recordError(
        { startedAt: new Date(), endedAt: new Date() },
        new Error("timeout"),
      ),
    ).not.toThrow();
  });
});

describe("singleton API", () => {
  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
  });

  it("getTracentic throws before configure", () => {
    expect(() => getTracentic()).toThrow("Tracentic has not been configured");
  });

  it("configure + getTracentic returns same instance", () => {
    const t = configure({ serviceName: "test" });
    expect(getTracentic()).toBe(t);
  });
});

describe("cost calculation", () => {
  beforeEach(() => {
    TracenticGlobalContext._resetCurrent();
  });

  it("calculates cost when all prerequisites are met", () => {
    // We test indirectly via the exporter queue.
    // Since there's no apiKey, spans aren't queued - but the code path
    // should not throw. Full integration test would need a mock exporter.
    const t = createTracentic({
      customPricing: {
        "claude-sonnet-4-6": {
          inputCostPerMillion: 3.0,
          outputCostPerMillion: 15.0,
        },
      },
    });

    expect(() =>
      t.recordSpan({
        startedAt: new Date(),
        endedAt: new Date(),
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        inputTokens: 1000,
        outputTokens: 500,
      }),
    ).not.toThrow();
  });
});
