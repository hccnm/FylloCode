import { ipcRenderer } from "electron";
import type { IpcResponse } from "@shared/types/ipc";
import { SettingsChannels } from "@shared/types/channels";
import type { AppAboutInfo, PreferencesConfig } from "@shared/types/settings";

export const settingsApi = {
  get(): Promise<IpcResponse<PreferencesConfig | null>> {
    return ipcRenderer.invoke(SettingsChannels.get, {});
  },

  getAppInfo(): Promise<IpcResponse<AppAboutInfo>> {
    return ipcRenderer.invoke(SettingsChannels.getAppInfo, {});
  },

  update(patch: Partial<PreferencesConfig>): Promise<IpcResponse<PreferencesConfig>> {
    return ipcRenderer.invoke(SettingsChannels.update, patch);
  },
};
