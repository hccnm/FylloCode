import type { IpcResponse } from "@shared/types/ipc";
import type { ProposalMeta } from "@shared/types/proposal";

export const proposalApi = {
  list(projectId: string): Promise<IpcResponse<ProposalMeta[]>> {
    return window.api.proposal.list(projectId);
  },

  readFile(
    projectId: string,
    changeId: string,
    filename: string
  ): Promise<IpcResponse<string | null>> {
    return window.api.proposal.readFile(projectId, changeId, filename);
  },
};
