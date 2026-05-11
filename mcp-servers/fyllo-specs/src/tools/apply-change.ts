import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { wrapState } from "../utils/state";
import { loadPrompt } from "../utils/load-prompt";
import { resolveProjectRoot } from "../utils/project-root";
import { listChanges, computeStatus } from "../openspec-runtime";
import { loadApplyState } from "../openspec-runtime/tasks";
import { invalidRequest } from "../utils/mcp-errors";

export const applyChangeInputSchema = z.object({ changeName: z.string().optional() });

function changeDir(projectRoot: string, name: string): string {
  return join(projectRoot, "openspec", "changes", name);
}

export async function applyChangeTool(
  input: z.infer<typeof applyChangeInputSchema>
): Promise<string> {
  const projectRoot = resolveProjectRoot();
  const activeChanges = await listChanges(projectRoot);
  const changeName =
    input.changeName ?? (activeChanges.length === 1 ? activeChanges[0].name : null);

  if (!changeName) {
    return wrapState(loadPrompt("apply-change"), {
      changeName: null,
      schemaName: "spec-driven",
      applyState: "blocked",
      contextFiles: {},
      tasks: [],
      progress: { total: 0, complete: 0, remaining: 0 },
    });
  }

  if (!existsSync(changeDir(projectRoot, changeName))) {
    throw invalidRequest(`Change not found: ${changeName}`);
  }

  const state = await loadApplyState(projectRoot, changeName);
  const status = await computeStatus(projectRoot, changeName);
  const applyState =
    state.applyState === "all_done"
      ? "all_done"
      : status.artifacts.some((artifact) => artifact.status !== "done")
        ? "blocked"
        : state.applyState;

  return wrapState(loadPrompt("apply-change"), {
    ...state,
    changeName,
    applyState,
  });
}
