import { describe, it, expect, beforeEach } from "vitest";
import { AttributeMerger } from "../src/attribute-merger";
import { AttributeLimits } from "../src/options";
import { TracenticGlobalContext } from "../src/global-context";
import { TracenticScope } from "../src/scope";

describe("AttributeMerger", () => {
  let global: TracenticGlobalContext;
  let merger: AttributeMerger;

  beforeEach(() => {
    global = new TracenticGlobalContext();
    merger = new AttributeMerger(global, new AttributeLimits());
  });

  it("returns empty object when no attributes exist", () => {
    const result = merger.merge(undefined, undefined);
    expect(result).toEqual({});
  });

  it("includes global attributes", () => {
    global.set("region", "us-east-1");
    const result = merger.merge(undefined, undefined);
    expect(result).toEqual({ region: "us-east-1" });
  });

  it("scope attributes override global on collision", () => {
    global.set("env", "global-val");
    const scope = new TracenticScope("op", { env: "scope-val" });

    const result = merger.merge(scope, undefined);
    expect(result["env"]).toBe("scope-val");
  });

  it("span attributes override scope and global on collision", () => {
    global.set("key", "global");
    const scope = new TracenticScope("op", { key: "scope" });

    const result = merger.merge(scope, { key: "span" });
    expect(result["key"]).toBe("span");
  });

  it("merges all three layers without collision", () => {
    global.set("g", 1);
    const scope = new TracenticScope("op", { s: 2 });
    const result = merger.merge(scope, { p: 3 });

    expect(result).toEqual({ g: 1, s: 2, p: 3 });
  });

  it("truncates keys exceeding maxKeyLength", () => {
    const limits = new AttributeLimits({ maxKeyLength: 5 });
    const m = new AttributeMerger(global, limits);

    const result = m.merge(undefined, { longkey: "value" });
    expect(result).toHaveProperty("longk");
    expect(result).not.toHaveProperty("longkey");
  });

  it("truncates string values exceeding maxStringValueLength", () => {
    const limits = new AttributeLimits({ maxStringValueLength: 3 });
    const m = new AttributeMerger(global, limits);

    const result = m.merge(undefined, { k: "abcdef" });
    expect(result["k"]).toBe("abc");
  });

  it("does not truncate non-string values", () => {
    const limits = new AttributeLimits({ maxStringValueLength: 3 });
    const m = new AttributeMerger(global, limits);

    const result = m.merge(undefined, { k: 123456 });
    expect(result["k"]).toBe(123456);
  });

  it("caps total attributes to maxAttributeCount", () => {
    const limits = new AttributeLimits({ maxAttributeCount: 3 });
    const m = new AttributeMerger(global, limits);

    const result = m.merge(undefined, { a: 1, b: 2, c: 3, d: 4, e: 5 });
    expect(Object.keys(result)).toHaveLength(3);
  });

  it("produces a new object - does not mutate inputs", () => {
    const spanAttrs = { key: "value" };
    const result = merger.merge(undefined, spanAttrs);

    expect(result).not.toBe(spanAttrs);
    expect(result).toEqual({ key: "value" });
  });
});
