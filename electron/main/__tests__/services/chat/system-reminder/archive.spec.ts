import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemReminderContext } from "@main/services/chat/system-reminder/types";
import { renderSystemReminderTemplate } from "@main/services/chat/system-reminder/providers/shared";
import archiveTemplate from "@main/services/chat/system-reminder/templates/archive.txt?raw";

const logger = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock("@main/infra/logger", () => ({
  default: logger,
}));

function createContext(overrides: Partial<SystemReminderContext> = {}): SystemReminderContext {
  return {
    owner: "archive",
    projectPath: "/abs",
    cwd: "/abs",
    fylloSessionId: "archive-session-1",
    agentId: "claude-acp",
    changeId: "foo",
    runId: "archive-run-1",
    ...overrides,
  };
}

describe("archive system-reminder template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the worktree section with concrete worktree and branch values", () => {
    const reminder = renderSystemReminderTemplate(
      archiveTemplate,
      createContext({
        worktreePath: "/abs/.worktrees/foo",
      })
    );

    expect(reminder).toContain("<worktree>");
    expect(reminder).toContain("</worktree>");
    expect(reminder).toContain("/abs/.worktrees/foo");
    expect(reminder).toContain("proposal/foo");
    expect(reminder).toContain("git -C /abs merge --ff-only proposal/foo");
    expect(reminder).toContain("git -C /abs worktree remove /abs/.worktrees/foo");
    expect(reminder).toContain("git -C /abs branch -d proposal/foo");
    expect(reminder).toContain("MUST run merge as `git merge --ff-only`");
    expect(reminder).toContain("MUST NOT use `worktree remove --force` / `branch -D`.");
  });

  it("renders an empty worktreePath and keeps the explicit downgrade instructions", () => {
    const reminder = renderSystemReminderTemplate(archiveTemplate, createContext());

    expect(reminder).toContain("<worktree>");
    expect(reminder).toContain("如果 `` 为空字符串");
    expect(reminder).toContain("跳过本段全部 git 编排");
    expect(reminder).toContain("本 archive 不需要 merge / worktree remove / branch delete。");
  });

  it("renders mainProjectPath as the same value as projectPath", () => {
    const reminder = renderSystemReminderTemplate(
      "main={{mainProjectPath}} project={{projectPath}}",
      createContext({
        projectPath: "/abs/project",
      })
    );

    expect(reminder).toBe("main=/abs/project project=/abs/project");
  });

  it("replaces changeId placeholders consistently for archive branches", () => {
    const reminder = renderSystemReminderTemplate(
      archiveTemplate,
      createContext({
        changeId: "foo_bar",
        worktreePath: "/abs/.worktrees/foo_bar",
      })
    );

    expect(reminder).toContain("archive foo_bar");
    expect(reminder).toContain("proposal/foo_bar");
    expect(reminder).toContain("git -C /abs branch -d proposal/foo_bar");
  });

  it("returns null and warns when any field contains angle brackets", () => {
    const reminder = renderSystemReminderTemplate(
      archiveTemplate,
      createContext({
        changeId: "foo<bar>",
      })
    );

    expect(reminder).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "[system-reminder] rejected reminder variable",
      expect.objectContaining({
        owner: "archive",
        field: "changeId",
        fylloSessionId: "archive-session-1",
      })
    );
  });
});
