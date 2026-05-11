import { z } from "zod";
import { wrapState } from "../utils/state";
import { loadPrompt } from "../utils/load-prompt";
import { listChanges, computeStatus } from "../openspec-runtime";
import { resolveProjectRoot } from "../utils/project-root";

export const exploreInputSchema = z.object({ changeName: z.string().optional() });

export async function exploreTool(input: z.infer<typeof exploreInputSchema>): Promise<string> {
  const projectRoot = resolveProjectRoot();
  const activeChanges = await listChanges(projectRoot);
  const currentChange = input.changeName
    ? await computeStatus(projectRoot, input.changeName)
    : null;
  return wrapState(loadPrompt("explore"), {
    projectRoot,
    schemaName: "spec-driven",
    activeChanges,
    currentChange,
  });
}
