import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapState } from "../utils/state";
import { loadPrompt } from "../utils/load-prompt";
import { listChanges, computeStatus } from "../openspec-runtime";
import { resolveProjectRoot } from "../utils/project-root";

const exploreInputSchema = z.object({
  changeName: z
    .string()
    .optional()
    .describe(
      "Name of a specific change to inspect. Omit to get an overview of all active changes."
    ),
});

export async function exploreTool(input: z.infer<typeof exploreInputSchema>): Promise<string> {
  const projectRoot = resolveProjectRoot();
  const activeChanges = await listChanges(projectRoot);
  const currentChange = input.changeName
    ? await computeStatus(projectRoot, input.changeName)
    : null;
  return wrapState(loadPrompt("explore"), {
    projectRoot,
    activeChanges,
    currentChange,
  });
}

export function registerExploreTool(server: McpServer): void {
  server.registerTool(
    "explore",
    {
      description:
        "Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change.",
      inputSchema: exploreInputSchema,
    },
    async (input) => {
      return {
        content: [
          {
            type: "text" as const,
            text: await exploreTool(input),
          },
        ],
      };
    }
  );
}
