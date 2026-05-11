import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapState } from "../utils/state";
import { loadPrompt } from "../utils/load-prompt";
import { archiveChange } from "../openspec-runtime";
import { resolveProjectRoot } from "../utils/project-root";
import { invalidRequest } from "../utils/mcp-errors";
import { readFileSync } from "fs";
import { join } from "path";

const archiveChangeInputSchema = z.object({
  changeName: z.string().optional().describe("Name of the change to archive."),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Set to true to perform the actual archive move. Omit (or false) to preview conflicts and completion status first."
    ),
});

export async function archiveChangeTool(
  input: z.infer<typeof archiveChangeInputSchema>
): Promise<string> {
  const projectRoot = resolveProjectRoot();
  if (!input.changeName) {
    throw invalidRequest("changeName is required");
  }
  const preview = await archiveChange(projectRoot, input.changeName ?? "", {
    confirm: input.confirm,
  });
  if (input.confirm && preview.conflicts.length > 0) {
    throw invalidRequest(`Archive target exists: ${preview.archiveTarget}`);
  }
  const tasksText = readFileSync(
    join(projectRoot, "openspec", "changes", input.changeName, "tasks.md"),
    "utf8"
  );
  const incompleteTasks = tasksText
    .split("\n")
    .filter((line) => /^- \[ \]/.test(line.trimEnd())).length;
  return wrapState(loadPrompt("archive-change"), {
    changeName: preview.changeName,
    artifactStatus: (preview.deltaSpecSummary as { files?: string[] } | null)?.files ?? [],
    incompleteTasks,
    deltaSpecSummary: preview.deltaSpecSummary,
    archiveTarget: preview.archiveTarget,
    conflicts: preview.conflicts,
    confirm: input.confirm ?? false,
  });
}

export function registerArchiveChangeTool(server: McpServer): void {
  server.registerTool(
    "archive-change",
    {
      description:
        "Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.",
      inputSchema: archiveChangeInputSchema,
    },
    async (input) => {
      return {
        content: [{ type: "text" as const, text: await archiveChangeTool(input) }],
      };
    }
  );
}
