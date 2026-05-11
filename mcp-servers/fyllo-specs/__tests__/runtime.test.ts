import { describe, expect, it } from "vitest";
import { wrapState } from "../src/utils/state";

describe("fyllo-specs runtime", () => {
  it("wraps prompt and state", () => {
    const text = wrapState("prompt", { ok: true });
    expect(text).toContain("<skill_prompt>");
    expect(text).toContain("<state>");
  });
});
