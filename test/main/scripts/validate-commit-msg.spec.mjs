import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runCommitMessageValidation,
  validateCommitMessage,
} from "../../../scripts/validate-commit-msg.mjs";

describe("validateCommitMessage", () => {
  it("accepts a conventional header", () => {
    expect(validateCommitMessage("feat(renderer): add session sidebar")).toEqual({ valid: true });
  });

  it("accepts an optional bullet body", () => {
    expect(
      validateCommitMessage(`fix(main): handle missing settings

- Keep default config when the file is absent.
- Avoid rewriting user data during startup.`)
    ).toEqual({ valid: true });
  });

  it("ignores git comment lines", () => {
    expect(
      validateCommitMessage(`docs(workflow): document hooks

- Mention the commit message rule.
# Please enter the commit message for your changes.`)
    ).toEqual({ valid: true });
  });

  it("allows selected generated commit headers", () => {
    expect(validateCommitMessage("Merge branch 'main' into feature")).toEqual({ valid: true });
    expect(validateCommitMessage('Revert "feat(main): add lifecycle guard"')).toEqual({
      valid: true,
    });
    expect(validateCommitMessage("Squashed commit of the following:")).toEqual({ valid: true });
  });

  it("rejects a non-conventional header", () => {
    expect(validateCommitMessage("update docs")).toEqual({
      valid: false,
      error: "Header must match: type(scope): summary",
    });
  });

  it("requires a blank line before the body", () => {
    expect(
      validateCommitMessage(`feat(main): add hook
- Missing separator.`)
    ).toEqual({
      valid: false,
      error: "Separate the header and body with a blank line.",
    });
  });

  it("requires non-empty body lines to be bullets", () => {
    expect(
      validateCommitMessage(`feat(main): add hook

This body is not a bullet.`)
    ).toEqual({
      valid: false,
      error: 'Body line 3 must start with "- ".',
    });
  });

  it("validates a commit message file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "fyllocode-commit-msg-"));
    const messageFile = join(tempDir, "COMMIT_EDITMSG");

    try {
      await writeFile(messageFile, "chore(workflow): add commit message hook\n", "utf8");
      await expect(runCommitMessageValidation(messageFile)).resolves.toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
