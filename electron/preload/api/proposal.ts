import { ipcRenderer } from "electron";
import { ProposalChannels } from "@shared/types/channels";
import type { IpcResponse } from "@shared/types/ipc";
import type { ProposalMeta } from "@shared/types/proposal";

export const proposalApi = {
  list(projectId: string): Promise<IpcResponse<ProposalMeta[]>> {
    return ipcRenderer.invoke(ProposalChannels.list, { projectId });
  },

  readFile(
    projectId: string,
    changeId: string,
    filename: string
  ): Promise<IpcResponse<string | null>> {
    return ipcRenderer.invoke(ProposalChannels.readFile, { projectId, changeId, filename });
  },
};
