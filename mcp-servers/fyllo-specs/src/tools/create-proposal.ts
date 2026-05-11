import { z } from "zod";
import { wrapState } from "../utils/state";
import { loadPrompt } from "../utils/load-prompt";
import { createChange, computeStatus, getInstructions } from "../openspec-runtime";
import { resolveProjectRoot } from "../utils/project-root";
import { invalidParams, invalidRequest } from "../utils/mcp-errors";

export const createProposalInputSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export async function createProposalTool(
  input: z.infer<typeof createProposalInputSchema>
): Promise<string> {
  const projectRoot = resolveProjectRoot();
  if (input.name) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(input.name)) {
      throw invalidParams("name must be kebab-case");
    }
    await createChange(projectRoot, input.name);
  }
  const status = input.name ? await computeStatus(projectRoot, input.name) : null;
  if (input.name && !status) {
    throw invalidRequest(`Change not found: ${input.name}`);
  }
  const artifacts = status
    ? await Promise.all(
        status.artifacts.map(async (artifact) => ({
          ...artifact,
          ...(await getInstructions(projectRoot, input.name!, artifact.id)),
        }))
      )
    : [];
  return wrapState(loadPrompt("create-proposal"), {
    changeName: input.name ?? null,
    description: input.description ?? null,
    schemaName: "spec-driven",
    applyRequires: status?.applyRequires ?? [],
    artifacts,
    template: artifacts[0]?.template ?? null,
    instruction: artifacts[0]?.instruction ?? null,
    nextArtifact: artifacts.find((artifact) => artifact.status !== "done")?.id ?? null,
  });
}
