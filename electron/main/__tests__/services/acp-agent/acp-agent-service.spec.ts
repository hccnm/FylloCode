import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRegistry: vi.fn(),
  refreshRegistry: vi.fn(),
  readInstalledRecords: vi.fn(),
  removeInstalledRecord: vi.fn(),
  detectAgentStatuses: vi.fn(),
  uninstallAgent: vi.fn(),
  installAgent: vi.fn(),
  removeAgentCapabilities: vi.fn(),
  getCachedPromptCapabilities: vi.fn(),
  getOrStartProcess: vi.fn(),
  getAgentIcons: vi.fn(),
}));

vi.mock("@main/infra/storage/acp-registry-cache", () => ({
  getRegistry: mocks.getRegistry,
  refreshRegistry: mocks.refreshRegistry,
}));

vi.mock("@main/domain/acp/detector", () => ({
  detectAgentStatuses: mocks.detectAgentStatuses,
  readInstalledRecords: mocks.readInstalledRecords,
  removeInstalledRecord: mocks.removeInstalledRecord,
}));

vi.mock("@main/services/acp-agent/installer", () => ({
  installAgent: mocks.installAgent,
  uninstallAgent: mocks.uninstallAgent,
}));

vi.mock("@main/infra/storage/agent-capability-store", () => ({
  getCachedPromptCapabilities: mocks.getCachedPromptCapabilities,
  removeAgentCapabilities: mocks.removeAgentCapabilities,
}));

vi.mock("@main/infra/process/acp-process-pool", () => ({
  getOrStartProcess: mocks.getOrStartProcess,
}));

vi.mock("@main/infra/storage/acp-icon-cache", () => ({
  getAgentIcons: mocks.getAgentIcons,
}));

describe("acp-agent-service uninstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRegistry.mockResolvedValue({
      agents: [
        {
          id: "claude-code",
          name: "Claude Code",
          version: "1.2.3",
          description: "ACP agent",
          authors: ["Anthropic"],
          license: "MIT",
          distribution: { npx: { package: "@anthropic/claude-code" } },
        },
      ],
    });
    mocks.readInstalledRecords.mockResolvedValue({
      "claude-code": {
        managedBy: "fyllocode",
        installMethod: "npx",
        installedVersion: "1.2.3",
        installedAt: Date.now(),
      },
    });
  });

  it("removes installed and capability records after a successful uninstall", async () => {
    const { uninstallAgentById } = await import("@main/services/acp-agent/acp-agent-service");

    await uninstallAgentById("claude-code");

    expect(mocks.uninstallAgent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "claude-code" }),
      "npx",
      expect.any(Function)
    );
    expect(mocks.removeInstalledRecord).toHaveBeenCalledWith("claude-code");
    expect(mocks.removeAgentCapabilities).toHaveBeenCalledWith("claude-code");
  });

  it("does not remove records when uninstall fails", async () => {
    mocks.uninstallAgent.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "UNINSTALL_FAILED" })
    );
    const { uninstallAgentById } = await import("@main/services/acp-agent/acp-agent-service");

    await expect(uninstallAgentById("claude-code")).rejects.toMatchObject({
      message: "boom",
    });
    expect(mocks.removeInstalledRecord).not.toHaveBeenCalled();
    expect(mocks.removeAgentCapabilities).not.toHaveBeenCalled();
  });

  it("rejects when the installed record is missing", async () => {
    mocks.readInstalledRecords.mockResolvedValueOnce({});
    const { uninstallAgentById } = await import("@main/services/acp-agent/acp-agent-service");

    await expect(uninstallAgentById("claude-code")).rejects.toMatchObject({
      code: "AGENT_NOT_FOUND",
      message: "Agent claude-code is not installed",
    });
  });
});
