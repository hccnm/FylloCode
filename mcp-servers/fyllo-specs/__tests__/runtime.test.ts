import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { wrapState } from "../src/utils/state";
import { finalizeArchiveWorkspace } from "../src/runtime-workspace";

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

function createGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "fyllo-workspace-runtime-"));
  git(root, ["init"]);
  git(root, ["config", "user.name", "Fyllo Test"]);
  git(root, ["config", "user.email", "test@example.com"]);
  writeFileSync(join(root, "README.md"), "initial\n", "utf8");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", "chore(test): initial"]);
  return root;
}

describe("fyllo-specs runtime", () => {
  it("wraps prompt and state", () => {
    const text = wrapState("prompt", { ok: true });
    expect(text).toContain("<tool_instruction>");
    expect(text).toContain("<state>");
  });

  it("finalizes main workspace with commit only", async () => {
    const root = createGitRepo();
    writeFileSync(join(root, "CHANGE.md"), "archived\n", "utf8");

    const result = await finalizeArchiveWorkspace({
      mainProjectPath: root,
      workspacePath: root,
      changeName: "sample-change",
      commitMessage: "chore(specs): archive sample change",
    });

    expect(result.mode).toBe("main");
    expect(result.ok).toBe(true);
    expect(result.failedStep).toBeNull();
    expect(result.gitOps.map((op) => op.step)).toEqual(["commit"]);
  });

  it("finalizes linked workspace through all git steps", async () => {
    const root = createGitRepo();
    const workspacePath = join(root, ".worktrees", "sample-change");
    mkdirSync(join(root, ".worktrees"), { recursive: true });
    git(root, ["worktree", "add", workspacePath, "-b", "proposal/sample-change"]);
    writeFileSync(join(workspacePath, "CHANGE.md"), "archived\n", "utf8");

    const result = await finalizeArchiveWorkspace({
      mainProjectPath: root,
      workspacePath,
      changeName: "sample-change",
      commitMessage: "chore(specs): archive sample change",
    });

    expect(result.mode).toBe("linked");
    expect(result.ok).toBe(true);
    expect(result.failedStep).toBeNull();
    expect(result.gitOps.map((op) => op.step)).toEqual([
      "commit",
      "merge-to-main",
      "worktree-remove",
      "branch-delete",
    ]);
  });

  it("stops linked finalization when merge fails", async () => {
    const root = createGitRepo();
    const workspacePath = join(root, ".worktrees", "sample-change");
    mkdirSync(join(root, ".worktrees"), { recursive: true });
    git(root, ["worktree", "add", workspacePath, "-b", "proposal/sample-change"]);
    writeFileSync(join(root, "MAIN.md"), "main changed\n", "utf8");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "chore(test): move main"]);
    writeFileSync(join(workspacePath, "CHANGE.md"), "archived\n", "utf8");

    const result = await finalizeArchiveWorkspace({
      mainProjectPath: root,
      workspacePath,
      changeName: "sample-change",
      commitMessage: "chore(specs): archive sample change",
    });

    expect(result.ok).toBe(false);
    expect(result.failedStep).toBe("merge-to-main");
    expect(result.gitOps.map((op) => op.step)).toEqual(["commit", "merge-to-main"]);
    expect(result.error?.retryHint).toContain("Fast-forward merge failed");
  });
});
