import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipcMain } from "electron";
import { SettingsChannels } from "@shared/types/channels";
import { IpcErrorCodes } from "@shared/constants/error-codes";

const mocks = vi.hoisted(() => ({
  getAppAboutInfo: vi.fn(),
  getSettingsPreferences: vi.fn(),
  updateSettingsPreferences: vi.fn(),
}));

vi.mock("@main/services/settings/settings-service", () => ({
  getAppAboutInfo: mocks.getAppAboutInfo,
  getSettingsPreferences: mocks.getSettingsPreferences,
  updateSettingsPreferences: mocks.updateSettingsPreferences,
}));

describe("registerSettingsHandlers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getAppAboutInfo.mockReturnValue({
      version: "0.9.0-beta.1",
      releaseChannel: "Preview",
      copyright: "Copyright © 2026 Fio",
      repositoryUrl: "https://github.com/Fioooooooo/FylloCode",
      feedbackUrl: "https://github.com/Fioooooooo/FylloCode/issues",
    });
    mocks.getSettingsPreferences.mockReturnValue(null);
    mocks.updateSettingsPreferences.mockReturnValue(null);

    const { registerSettingsHandlers } = await import("@main/ipc/settings");
    registerSettingsHandlers();
  });

  function handler(channel: string): (event: unknown, input: unknown) => Promise<unknown> {
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([registeredChannel]) => registeredChannel === channel);
    expect(call).toBeTruthy();
    return call![1] as (event: unknown, input: unknown) => Promise<unknown>;
  }

  it("returns app about info in the standard IpcResponse shape", async () => {
    const result = await handler(SettingsChannels.getAppInfo)({}, {});

    expect(result).toEqual({
      ok: true,
      data: {
        version: "0.9.0-beta.1",
        releaseChannel: "Preview",
        copyright: "Copyright © 2026 Fio",
        repositoryUrl: "https://github.com/Fioooooooo/FylloCode",
        feedbackUrl: "https://github.com/Fioooooooo/FylloCode/issues",
      },
    });
    expect(mocks.getAppAboutInfo).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid getAppInfo payloads through validation", async () => {
    const result = await handler(SettingsChannels.getAppInfo)({}, { unexpected: true });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: IpcErrorCodes.VALIDATION_ERROR,
      }),
    });
    expect(mocks.getAppAboutInfo).not.toHaveBeenCalled();
  });
});
