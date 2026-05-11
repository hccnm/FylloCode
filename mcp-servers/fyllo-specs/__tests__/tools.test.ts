import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { applyChangeTool } from "../src/tools/apply-change";
import { createProposalTool } from "../src/tools/create-proposal";
import { archiveChangeTool } from "../src/tools/archive-change";
import { exploreTool } from "../src/tools/explore";

describe("tools", () => {
  const cliPath = join(
    process.cwd(),
    "node_modules",
    "@fission-ai",
    "openspec",
    "bin",
    "openspec.js"
  );

  it("explore returns state", async () => {
    const text = await exploreTool({});
    expect(text).toContain("<skill_prompt>");
    expect(text).toContain("<state>");
  });

  it("create-proposal rejects invalid input", async () => {
    await expect(createProposalTool({ name: "bad name" })).rejects.toBeTruthy();
  });

  it("apply-change returns ready for the active change", async () => {
    const text = await applyChangeTool({});
    expect(text).toContain('"applyState": "ready"');
  });

  it("apply-change handles missing selection", async () => {
    const root = mkdtempSync(join(tmpdir(), "fyllo-open-spec-"));
    mkdirSync(join(root, "openspec"), { recursive: true });
    mkdirSync(join(root, "openspec", "changes"), { recursive: true });
    writeFileSync(join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
    const prev = process.env.FYLLO_PROJECT_PATH;
    const prevCli = process.env.FYLLO_OPENSPEC_CLI_PATH;
    process.env.FYLLO_PROJECT_PATH = root;
    process.env.FYLLO_OPENSPEC_CLI_PATH = cliPath;
    try {
      const text = await applyChangeTool({});
      expect(text).toContain('"changeName": null');
      expect(text).toContain('"applyState": "blocked"');
    } finally {
      process.env.FYLLO_PROJECT_PATH = prev;
      process.env.FYLLO_OPENSPEC_CLI_PATH = prevCli;
    }
  });

  it("apply-change rejects missing change", async () => {
    const root = mkdtempSync(join(tmpdir(), "fyllo-open-spec-"));
    mkdirSync(join(root, "openspec"), { recursive: true });
    mkdirSync(join(root, "openspec", "changes"), { recursive: true });
    writeFileSync(join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
    const prev = process.env.FYLLO_PROJECT_PATH;
    const prevCli = process.env.FYLLO_OPENSPEC_CLI_PATH;
    process.env.FYLLO_PROJECT_PATH = root;
    process.env.FYLLO_OPENSPEC_CLI_PATH = cliPath;
    try {
      await expect(applyChangeTool({ changeName: "missing-change" })).rejects.toBeInstanceOf(
        McpError
      );
    } finally {
      process.env.FYLLO_PROJECT_PATH = prev;
      process.env.FYLLO_OPENSPEC_CLI_PATH = prevCli;
    }
  });

  it("archive-change rejects missing change", async () => {
    const root = mkdtempSync(join(tmpdir(), "fyllo-open-spec-"));
    mkdirSync(join(root, "openspec"), { recursive: true });
    mkdirSync(join(root, "openspec", "changes"), { recursive: true });
    writeFileSync(join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
    const prev = process.env.FYLLO_PROJECT_PATH;
    process.env.FYLLO_PROJECT_PATH = root;
    try {
      await expect(archiveChangeTool({ changeName: "missing-change" })).rejects.toBeInstanceOf(
        McpError
      );
    } finally {
      process.env.FYLLO_PROJECT_PATH = prev;
    }
  });

  it("archive-change rejects missing name", async () => {
    await expect(archiveChangeTool({})).rejects.toBeTruthy();
  });
});
