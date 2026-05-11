import explore from "../prompts/explore.md";
import createProposal from "../prompts/create-proposal.md";
import applyChange from "../prompts/apply-change.md";
import archiveChange from "../prompts/archive-change.md";

const prompts = {
  explore,
  "create-proposal": createProposal,
  "apply-change": applyChange,
  "archive-change": archiveChange,
} as const;

export type PromptId = keyof typeof prompts;

export function loadPrompt(id: PromptId): string {
  return prompts[id];
}
