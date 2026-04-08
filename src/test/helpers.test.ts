import { describe, expect, it } from "vitest";

import { normalizeMdValue } from "@/lib/helpers";

describe("normalizeMdValue", () => {
  it("preserves zero md values for off-day logs", () => {
    expect(normalizeMdValue(0)).toBe(0);
    expect(normalizeMdValue("0")).toBe(0);
  });

  it("keeps valid decimal md values", () => {
    expect(normalizeMdValue(0.5)).toBe(0.5);
    expect(normalizeMdValue("1.5")).toBe(1.5);
  });

  it("falls back only for invalid md values", () => {
    expect(normalizeMdValue(undefined)).toBe(1);
    expect(normalizeMdValue("")).toBe(1);
    expect(normalizeMdValue("abc")).toBe(1);
  });
});
