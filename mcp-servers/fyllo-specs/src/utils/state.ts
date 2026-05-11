export function wrapState(skillPrompt: string, state: unknown): string {
  return `<skill_prompt>\n${skillPrompt}\n</skill_prompt>\n\n<state>\n${JSON.stringify(state, null, 2)}\n</state>`;
}
