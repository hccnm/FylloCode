export type WorkspaceMode = "linked" | "main";

export interface WorkspaceInfo {
  mode: WorkspaceMode;
  path: string;
}

export type ArchiveGitStep = "commit" | "merge-to-main" | "worktree-remove" | "branch-delete";

export interface ArchiveGitOpResult {
  step: ArchiveGitStep;
  cwd: string;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  ok: boolean;
}

export interface WorkspaceRuntimeError {
  code: string;
  message: string;
  retryHint: string;
}

export interface PrepareProposalWorkspaceResult {
  workspace: WorkspaceInfo;
  warnings: string[];
}

export interface FinalizeArchiveWorkspaceResult extends WorkspaceInfo {
  ok: boolean;
  gitOps: ArchiveGitOpResult[];
  failedStep: ArchiveGitStep | null;
  error?: WorkspaceRuntimeError;
}
