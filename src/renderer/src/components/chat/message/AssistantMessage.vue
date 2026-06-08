<script setup lang="ts">
import type { UIMessage } from "ai";
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from "ai";
import { isPartStreaming, isToolStreaming } from "@nuxt/ui/utils/ai";
import MarkStream from "@renderer/components/shared/MarkStream.vue";
import { getToolText, getToolSuffix, getToolOutput } from "@renderer/utils/chatTool";
import { useSessionStore } from "@renderer/stores/session";
import type { FylloActionState } from "@shared/types/fyllo-action";

const props = defineProps<{
  message: UIMessage;
  isDark: boolean;
  enableActions?: boolean;
  sessionId?: string | null;
  messageIndex?: number;
  actionStates?: Record<string, FylloActionState>;
}>();

const sessionStore = useSessionStore();

function buildActionContext(partIndex: number) {
  if (
    !props.enableActions ||
    !props.sessionId ||
    props.messageIndex === undefined ||
    props.messageIndex < 0
  ) {
    return undefined;
  }

  return {
    sessionId: props.sessionId,
    messageIndex: props.messageIndex,
    partIndex,
    actionStates: props.actionStates,
    persistActionState: (actionId: string, state: FylloActionState) =>
      sessionStore.persistSessionActionState(props.sessionId!, actionId, state),
  };
}
</script>

<template>
  <template
    v-for="(part, index) in props.message.parts"
    :key="`${message.id}-${part.type}-${index}`"
  >
    <UChatReasoning
      v-if="isReasoningUIPart(part)"
      :text="part.text"
      :streaming="isPartStreaming(part)"
      :default-open="true"
    >
      <MarkStream
        :id="`${message.id}-${part.type}-${index}`"
        :content="part.text"
        :is-streaming="isPartStreaming(part)"
        :is-dark="props.isDark"
        :enable-actions="false"
      />
    </UChatReasoning>

    <UChatTool
      v-else-if="isToolUIPart(part)"
      :streaming="isToolStreaming(part)"
      :text="getToolText(part)"
      :suffix="getToolSuffix(part)"
    >
      <pre v-if="getToolOutput(part)" class="whitespace-pre-wrap wrap-anywhere text-xs">{{
        getToolOutput(part)
      }}</pre>
    </UChatTool>

    <MarkStream
      v-else-if="isTextUIPart(part)"
      :id="`${message.id}-${part.type}-${index}`"
      :content="part.text"
      :is-streaming="isPartStreaming(part)"
      :is-dark="props.isDark"
      :enable-actions="Boolean(buildActionContext(index))"
      :action-context="buildActionContext(index)"
    />
  </template>
</template>
