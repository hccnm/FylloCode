import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentCard from "@renderer/components/settings/AgentCard.vue";
import type { AcpAgentEntry, AcpAgentStatus } from "@shared/types/acp-agent";

const agent: AcpAgentEntry = {
  id: "claude-code",
  name: "Claude Code",
  version: "1.2.3",
  description: "ACP agent",
  authors: ["Anthropic"],
  license: "MIT",
  distribution: {
    npx: { package: "@anthropic/claude-code" },
    uvx: { package: "@openai/codex" },
    binary: { darwin: { archive: "https://example.com/agent.tar.gz", cmd: "claude" } },
  },
};

function mounted(status?: Partial<AcpAgentStatus>) {
  return mount(AgentCard, {
    props: {
      agent,
      userDataPath: "/Users/test/Library/Application Support/FylloCode",
      agentStatus: {
        id: "claude-code",
        installed: true,
        managedBy: "fyllocode",
        installMethod: "npx",
        updateAvailable: false,
        latestVersion: "1.2.3",
        ...status,
      },
    },
  });
}

describe("AgentCard uninstall", () => {
  it("renders uninstall when installed and hides it when not installed", () => {
    const installedWrapper = mounted();
    expect(installedWrapper.text()).toContain("卸载");

    const uninstalledWrapper = mount(AgentCard, {
      props: {
        agent,
        agentStatus: {
          id: "claude-code",
          installed: false,
          managedBy: null,
          updateAvailable: false,
          latestVersion: "1.2.3",
        },
      },
    });
    expect(uninstalledWrapper.text()).not.toContain("卸载");
  });

  it.each([
    [
      "fyllocode",
      "npx",
      "npm uninstall -g @anthropic/claude-code",
      "卸载完成后将清除本地安装记录。",
      "卸载",
    ],
    [
      "fyllocode",
      "uvx",
      "uv tool uninstall @openai/codex",
      "卸载完成后将清除本地安装记录。",
      "卸载",
    ],
    [
      "fyllocode",
      "binary",
      "/Users/test/Library/Application Support/FylloCode/acp/bin/claude-code",
      "卸载完成后将清除本地安装记录。",
      "卸载",
    ],
    [
      "user",
      "npx",
      "npm uninstall -g @anthropic/claude-code",
      "此操作会修改你的全局环境，不可撤销。",
      "同意并卸载",
    ],
    [
      "user",
      "uvx",
      "uv tool uninstall @openai/codex",
      "此操作会修改你的全局环境，不可撤销。",
      "同意并卸载",
    ],
    [
      "user",
      "binary",
      "/Users/test/Library/Application Support/FylloCode/acp/bin/claude-code",
      "此操作不可撤销。",
      "同意并卸载",
    ],
  ])(
    "renders the uninstall modal copy for %s managed %s agents",
    async (managedBy, installMethod, commandText, footnote, buttonLabel) => {
      const wrapper = mounted({
        managedBy: managedBy as "user" | "fyllocode",
        installMethod: installMethod as "npx" | "uvx" | "binary",
      });

      const uninstallButton = wrapper
        .findAll("button")
        .find((button) => button.text().trim() === "卸载");
      expect(uninstallButton).toBeTruthy();
      await uninstallButton!.trigger("click");

      expect(wrapper.text()).toContain("卸载 Claude Code？");
      expect(wrapper.text()).toContain(commandText);
      expect(wrapper.text()).toContain(footnote);
      expect(wrapper.text()).toContain(buttonLabel);
    }
  );

  it("closes the modal on cancel without emitting uninstall", async () => {
    const wrapper = mounted();

    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "卸载")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "取消")!
      .trigger("click");

    expect(wrapper.emitted("uninstall")).toBeUndefined();
  });

  it("emits uninstall(agentId) on confirm", async () => {
    const wrapper = mounted();

    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "卸载")!
      .trigger("click");

    const uninstallButtons = wrapper
      .findAll("button")
      .filter((button) => button.text().trim() === "卸载");
    expect(uninstallButtons).toHaveLength(2);
    await uninstallButtons[1]!.trigger("click");

    expect(wrapper.emitted("uninstall")).toEqual([["claude-code"]]);
  });
});
