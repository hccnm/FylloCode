import path from "path";
import type {
  ArchiveGitOpResult,
  ArchiveGitStep,
  FinalizeArchiveWorkspaceResult,
  WorkspaceMode,
  WorkspaceRuntimeError,
} from "./types";
import { runGitCompositeStep, runGitStep } from "./git";

function createStepError(step: ArchiveGitStep, op: ArchiveGitOpResult): WorkspaceRuntimeError {
  const detail = op.stderr.trim() || op.stdout.trim() || `git exited with code ${op.exitCode}`;
  const hints: Record<ArchiveGitStep, string> = {
    commit:
      "Commit failed. Inspect the workspace status and retry archive-change after resolving the git error.",
    "merge-to-main":
      "Fast-forward merge failed. Resolve main/worktree history divergence, then retry archive-change or complete recovery manually.",
    "worktree-remove":
      "Worktree removal failed. Close processes using the worktree or resolve dirty files, then retry cleanup.",
    "branch-delete":
      "Branch deletion failed. Verify the proposal branch is merged before deleting it manually or retrying cleanup.",
  };
  return {
    code: `git-${step}-failed`,
    message: detail,
    retryHint: hints[step],
  };
}

async function runOrStop(
  gitOps: ArchiveGitOpResult[],
  input: { step: ArchiveGitStep; cwd: string; args: string[] }
): Promise<WorkspaceRuntimeError | null> {
  const op = await runGitStep(input);
  gitOps.push(op);
  if (op.ok) {
    return null;
  }
  return createStepError(input.step, op);
}

async function runCommitOrStop(
  gitOps: ArchiveGitOpResult[],
  input: { cwd: string; commitMessage: string }
): Promise<WorkspaceRuntimeError | null> {
  const op = await runGitCompositeStep({
    step: "commit",
    cwd: input.cwd,
    commands: [
      ["add", "-A"],
      ["commit", "-m", input.commitMessage],
    ],
  });
  gitOps.push(op);
  if (op.ok) {
    return null;
  }
  return createStepError("commit", op);
}

export async function finalizeArchiveWorkspace(input: {
  mainProjectPath: string;
  workspacePath: string;
  changeName: string;
  commitMessage: string;
}): Promise<FinalizeArchiveWorkspaceResult> {
  const mainPath = path.resolve(input.mainProjectPath);
  const workspacePath = path.resolve(input.workspacePath);
  const mode: WorkspaceMode = workspacePath === mainPath ? "main" : "linked";
  const gitOps: ArchiveGitOpResult[] = [];

  const commitError = await runCommitOrStop(gitOps, {
    cwd: workspacePath,
    commitMessage: input.commitMessage,
  });
  if (commitError) {
    return {
      mode,
      path: workspacePath,
      ok: false,
      gitOps,
      failedStep: "commit",
      error: commitError,
    };
  }

  if (mode === "main") {
    return {
      mode,
      path: workspacePath,
      ok: true,
      gitOps,
      failedStep: null,
    };
  }

  const steps: Array<{ step: ArchiveGitStep; cwd: string; args: string[] }> = [
    {
      step: "merge-to-main",
      cwd: mainPath,
      args: ["merge", "--ff-only", `proposal/${input.changeName}`],
    },
    {
      step: "worktree-remove",
      cwd: mainPath,
      args: ["worktree", "remove", workspacePath],
    },
    {
      step: "branch-delete",
      cwd: mainPath,
      args: ["branch", "-d", `proposal/${input.changeName}`],
    },
  ];

  for (const step of steps) {
    const error = await runOrStop(gitOps, step);
    if (error) {
      return {
        mode,
        path: workspacePath,
        ok: false,
        gitOps,
        failedStep: step.step,
        error,
      };
    }
  }

  return {
    mode,
    path: workspacePath,
    ok: true,
    gitOps,
    failedStep: null,
  };
}
