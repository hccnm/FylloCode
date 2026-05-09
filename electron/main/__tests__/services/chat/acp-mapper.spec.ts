import { describe, expect, it } from "vitest";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { mapSessionUpdate } from "@main/services/chat/acp-mapper";

describe("mapSessionUpdate", () => {
  it("maps usage_update events", () => {
    const update = {
      sessionUpdate: "usage_update",
      used: 29017,
      size: 1000000,
      cost: { amount: 0.145305, currency: "USD" },
    } as SessionUpdate;

    expect(mapSessionUpdate(update)).toEqual({
      type: "usage_update",
      used: 29017,
      size: 1000000,
      cost: { amount: 0.145305, currency: "USD" },
    });
  });

  it("omits absent usage_update cost", () => {
    const update = {
      sessionUpdate: "usage_update",
      used: 29017,
      size: 1000000,
    } as SessionUpdate;

    expect(mapSessionUpdate(update)).toEqual({
      type: "usage_update",
      used: 29017,
      size: 1000000,
      cost: undefined,
    });
  });
});
