import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsAbout from "@renderer/components/settings/SettingsAbout.vue";
import { settingsApi } from "@renderer/api/settings";
import type { AppAboutInfo } from "@shared/types/settings";

vi.mock("@renderer/api/settings", () => ({
  settingsApi: {
    getAppInfo: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
}));

const aboutInfoFixture: AppAboutInfo = {
  version: "0.9.0-beta.1",
  releaseChannel: "Preview",
  copyright: "Copyright © 2026 Fio",
  repositoryUrl: "https://github.com/Fioooooooo/FylloCode",
  feedbackUrl: "https://github.com/Fioooooooo/FylloCode/issues",
};

describe("SettingsAbout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders the heading, a single card, and four rows in order", async () => {
    vi.mocked(settingsApi.getAppInfo).mockResolvedValue({
      ok: true,
      data: aboutInfoFixture,
    });

    const wrapper = mount(SettingsAbout);

    await flushPromises();

    expect(wrapper.text()).toContain("About");
    expect(wrapper.text()).toContain(
      "查看当前应用版本、发布渠道以及 FylloCode 项目的公开入口信息。"
    );
    expect(wrapper.findAll('[data-test="about-card"]')).toHaveLength(1);
    expect(
      wrapper.findAll('[data-test^="about-row-"]').map((row) => row.attributes("data-test"))
    ).toEqual([
      "about-row-version",
      "about-row-copyright",
      "about-row-repository",
      "about-row-feedback",
    ]);
  });

  it("loads and renders app about info with separate link entries", async () => {
    vi.mocked(settingsApi.getAppInfo).mockResolvedValue({
      ok: true,
      data: aboutInfoFixture,
    });

    const wrapper = mount(SettingsAbout);

    await flushPromises();

    expect(settingsApi.getAppInfo).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Preview");
    expect(wrapper.find('[data-test="about-version"]').text()).toBe("v0.9.0-beta.1");
    expect(wrapper.find('[data-test="about-copyright"]').text()).toBe("Copyright © 2026 Fio");
    expect(wrapper.find('[data-test="about-link-repository"]').attributes("href")).toBe(
      "https://github.com/Fioooooooo/FylloCode"
    );
    expect(wrapper.find('[data-test="about-link-feedback"]').attributes("href")).toBe(
      "https://github.com/Fioooooooo/FylloCode/issues"
    );
    expect(wrapper.find('[data-test="about-link-repository"]').text()).toBe("打开 GitHub");
    expect(wrapper.find('[data-test="about-link-feedback"]').text()).toBe("提交反馈");
  });

  it("shows a loading state before app info resolves", async () => {
    let resolveRequest:
      | ((value: Awaited<ReturnType<typeof settingsApi.getAppInfo>>) => void)
      | undefined;
    vi.mocked(settingsApi.getAppInfo).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const wrapper = mount(SettingsAbout);

    await nextTick();

    expect(wrapper.find('[data-test="about-loading"]').exists()).toBe(true);

    resolveRequest?.({
      ok: true,
      data: aboutInfoFixture,
    });
    await flushPromises();
  });

  it("shows an error state when loading app info fails", async () => {
    vi.mocked(settingsApi.getAppInfo).mockResolvedValue({
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "load failed",
      },
    });

    const wrapper = mount(SettingsAbout);

    await flushPromises();

    expect(wrapper.find('[data-test="about-error"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("load failed");
    expect(wrapper.find('[data-test="about-version"]').exists()).toBe(false);
  });

  it("opens both external links via a new window target", async () => {
    vi.mocked(settingsApi.getAppInfo).mockResolvedValue({
      ok: true,
      data: aboutInfoFixture,
    });

    const wrapper = mount(SettingsAbout);

    await flushPromises();

    const repositoryLink = wrapper.find('[data-test="about-link-repository"]');
    const feedbackLink = wrapper.find('[data-test="about-link-feedback"]');

    expect(repositoryLink.attributes("target")).toBe("_blank");
    expect(repositoryLink.attributes("rel")).toContain("noreferrer");
    expect(feedbackLink.attributes("target")).toBe("_blank");
    expect(feedbackLink.attributes("rel")).toContain("noreferrer");
  });
});
