import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const promptDir = join(process.cwd(), "mcp-servers", "fyllo-specs", "src", "prompts");
const promptFiles = ["explore.md", "create-proposal.md", "apply-change.md", "archive-change.md"];

describe("fyllo-specs prompts", () => {
  for (const file of promptFiles) {
    it(`${file} is non-empty and hides direct openspec CLI`, () => {
      const text = readFileSync(join(promptDir, file), "utf8");
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(
        /openspec list --json|openspec status|openspec instructions|openspec new change/
      );
    });
  }
});
