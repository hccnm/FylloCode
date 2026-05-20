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

  it("renders the workspace section with archive-change result handling", () => {
    const reminder = renderSystemReminderTemplate(
      archiveTemplate,
      createContext({
        worktreePath: "/abs/.worktrees/foo",
      })
    );

    expect(reminder).toContain("<workspace>");
    expect(reminder).toContain("</workspace>");
    expect(reminder).toContain("Workspace Policy");
    expect(reminder).toContain("/abs/.worktrees/foo");
    expect(reminder).toContain("mcp__fyllo_specs__archive-change");
    expect(reminder).toContain("state.archive");
    expect(reminder).toContain("state.workspace");
    expect(reminder).toContain("bypasses the MCP workspace runtime");
    expect(reminder).not.toBeNull();
    expect(reminder!.indexOf("<rules>")).toBeLessThan(reminder!.indexOf("<workspace>"));
    expect(reminder).not.toContain("git -C /abs merge --ff-only");
    expect(reminder).not.toContain("git -C /abs worktree remove");
    expect(reminder).not.toContain("git -C /abs branch -d");
  });

  it("renders an empty worktreePath as main workspace", () => {
    const reminder = renderSystemReminderTemplate(archiveTemplate, createContext());

    expect(reminder).toContain("<workspace>");
    expect(reminder).toContain("the current workspace is the main workspace");
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

  it("replaces changeId placeholders consistently for archive context", () => {
    const reminder = renderSystemReminderTemplate(
      archiveTemplate,
      createContext({
        changeId: "foo_bar",
        worktreePath: "/abs/.worktrees/foo_bar",
      })
    );

    expect(reminder).toContain("OpenSpec change `foo_bar`");
    expect(reminder).not.toContain("branch -d proposal/foo_bar");
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
