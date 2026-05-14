import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionMeta } from "@main/infra/storage/session-store";

const { tempRoot } = vi.hoisted(() => ({
  tempRoot: `/private/tmp/fyllocode-session-store-${Math.random().toString(36).slice(2)}`,
}));

vi.mock("@main/infra/paths", () => ({
  getDataSubPath: vi.fn((subPath: string) => `${tempRoot}/${subPath}`),
}));

import { loadSessionMeta, saveSessionMeta } from "@main/infra/storage/session-store";
import { sessionsDir } from "@main/infra/storage/project-paths";

const projectPath = "/tmp/project";

function meta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: "session-1",
    agentId: "claude-acp",
    title: "Session",
    turnCount: 0,
    tokenUsage: { used: 0, size: 0 },
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:00.000Z",
    ...overrides,
  };
}

function sessionMetaPath(sessionId = "session-1"): string {
  return `${sessionsDir(projectPath)}/${sessionId}.json`;
}

beforeEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("session-store", () => {
  it("round-trips available commands with the snake_case storage key", async () => {
    await saveSessionMeta(
      projectPath,
      meta({
        available_commands: [{ name: "review", description: "Review code", hint: "path" }],
      })
    );

    const raw = JSON.parse(readFileSync(sessionMetaPath(), "utf8")) as Record<string, unknown>;
    expect(raw.available_commands).toEqual([
      { name: "review", description: "Review code", hint: "path" },
    ]);
    expect(raw.availableCommands).toBeUndefined();
    await expect(loadSessionMeta(projectPath, "session-1")).resolves.toEqual(
      meta({
        available_commands: [{ name: "review", description: "Review code", hint: "path" }],
      })
    );
  });

  it("preserves an explicit empty available commands array", async () => {
    await saveSessionMeta(projectPath, meta({ available_commands: [] }));

    await expect(loadSessionMeta(projectPath, "session-1")).resolves.toEqual(
      meta({ available_commands: [] })
    );
  });

  it("keeps missing or invalid available commands as undefined", async () => {
    await saveSessionMeta(projectPath, meta());
    await expect(loadSessionMeta(projectPath, "session-1")).resolves.toEqual(meta());

    mkdirSync(dirname(sessionMetaPath("session-2")), { recursive: true });
    writeFileSync(
      sessionMetaPath("session-2"),
      JSON.stringify({ ...meta({ sessionId: "session-2" }), available_commands: "invalid" }),
      "utf8"
    );

    await expect(loadSessionMeta(projectPath, "session-2")).resolves.toEqual(
      meta({ sessionId: "session-2" })
    );
  });
});
