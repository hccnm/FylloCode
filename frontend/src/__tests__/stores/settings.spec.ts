import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "@renderer/stores/settings";
import { settingsApi } from "@renderer/api/settings";

vi.mock("@renderer/api/settings", () => ({
  settingsApi: {
    getAppInfo: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
}));

describe("useSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("deduplicates concurrent ensureAboutInfoLoaded calls", async () => {
    let resolveRequest:
      | ((value: Awaited<ReturnType<typeof settingsApi.getAppInfo>>) => void)
      | undefined;
    vi.mocked(settingsApi.getAppInfo).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const store = useSettingsStore();
    const loading = Promise.all([store.ensureAboutInfoLoaded(), store.ensureAboutInfoLoaded()]);

    expect(settingsApi.getAppInfo).toHaveBeenCalledTimes(1);
    expect(store.aboutInfoLoading).toBe(true);

    resolveRequest?.({
      ok: true,
      data: {
        version: "0.9.0-beta.1",
        releaseChannel: "Preview",
        copyright: "Copyright © 2026 Fio",
        repositoryUrl: "https://github.com/Fioooooooo/FylloCode",
        feedbackUrl: "https://github.com/Fioooooooo/FylloCode/issues",
      },
    });

    await loading;

    expect(store.aboutInfoLoading).toBe(false);
    expect(store.aboutInfoError).toBeNull();
    expect(store.aboutInfo).toEqual({
      version: "0.9.0-beta.1",
      releaseChannel: "Preview",
      copyright: "Copyright © 2026 Fio",
      repositoryUrl: "https://github.com/Fioooooooo/FylloCode",
      feedbackUrl: "https://github.com/Fioooooooo/FylloCode/issues",
    });
  });
});
