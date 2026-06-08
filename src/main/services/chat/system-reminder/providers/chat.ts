import template from "../templates/chat.txt?raw";
import { formatFylloActionContractInstructions } from "@shared/constants/fyllo-action-contracts";
import { renderSystemReminderTemplate } from "./shared";
import type { SystemReminderContext } from "../types";

export async function resolveChatSystemReminder(
  ctx: SystemReminderContext
): Promise<string | null> {
  const rendered = renderSystemReminderTemplate(template, ctx);
  if (rendered === null) {
    return null;
  }

  return [rendered, formatFylloActionContractInstructions()].join("\n\n");
}
