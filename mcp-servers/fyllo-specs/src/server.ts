import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { invalidParams } from "./utils/mcp-errors";
import { exploreInputSchema, exploreTool } from "./tools/explore";
import { createProposalInputSchema, createProposalTool } from "./tools/create-proposal";
import { applyChangeInputSchema, applyChangeTool } from "./tools/apply-change";
import { archiveChangeInputSchema, archiveChangeTool } from "./tools/archive-change";

export async function startServer(signal?: AbortSignal): Promise<void> {
  const server = new McpServer({ name: "fyllo-specs", version: "0.1.0" });
  const transport = new StdioServerTransport();

  server.registerTool(
    "explore",
    {
      description: "Explore OpenSpec changes and current state.",
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

  server.registerTool(
    "create-proposal",
    {
      description: "Create or inspect an OpenSpec change.",
      inputSchema: createProposalInputSchema,
    },
    async (input) => {
      return {
        content: [
          {
            type: "text" as const,
            text: await createProposalTool(input),
          },
        ],
      };
    }
  );

  server.registerTool(
    "apply-change",
    {
      description: "Apply an OpenSpec change.",
      inputSchema: applyChangeInputSchema,
    },
    async (input) => {
      if (!input.changeName) {
        throw invalidParams("changeName is required");
      }
      return {
        content: [
          {
            type: "text" as const,
            text: await applyChangeTool(input),
          },
        ],
      };
    }
  );

  server.registerTool(
    "archive-change",
    {
      description: "Archive an OpenSpec change.",
      inputSchema: archiveChangeInputSchema,
    },
    async (input) => {
      if (!input.changeName) {
        throw invalidParams("changeName is required");
      }
      return {
        content: [
          {
            type: "text" as const,
            text: await archiveChangeTool(input),
          },
        ],
      };
    }
  );

  await server.connect(transport);
  if (signal) {
    signal.addEventListener("abort", () => {
      void transport.close();
    });
  }
}
