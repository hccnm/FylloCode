import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MoreAgentsTile from "@renderer/components/chat/empty/MoreAgentsTile.vue";

describe("MoreAgentsTile", () => {
  it("keeps the installed-agents tile square", () => {
    const wrapper = mount(MoreAgentsTile, {
      props: {
        variant: "more",
        totalCount: 12,
      },
    });

    expect(wrapper.get("button").classes()).toContain("aspect-square");
  });

  it("uses a bounded height for the first-agent promo tile", () => {
    const wrapper = mount(MoreAgentsTile, {
      props: {
        variant: "promo",
        totalCount: 12,
      },
    });

    const classes = wrapper.get("button").classes();
    expect(classes).toContain("min-h-36");
    expect(classes).toContain("w-full");
    expect(classes).not.toContain("aspect-square");
  });
});
