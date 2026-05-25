<script setup lang="ts">
import type { UIMessage } from "ai";
import AssistantMessage from "./AssistantMessage.vue";
import UserMessage from "./UserMessage.vue";
import type { ChatStatus, MessageMeta } from "@shared/types/chat";

const { messages, status } = defineProps<{
  messages: UIMessage<MessageMeta>[];
  status: ChatStatus;
  type: "chat" | "side";
}>();
</script>

<template>
  <div class="min-w-0">
    <UChatMessages
      should-auto-scroll
      should-scroll-to-bottom
      :auto-scroll="false"
      :messages="messages"
      :status="status"
      :user="{ side: 'right', variant: 'naked', ui: { content: 'flex flex-col items-end' } }"
      :ui="{ indicator: '*:bg-accented' }"
    >
      <template #content="{ message }">
        <UserMessage v-if="message.role === 'user'" :message="message" />
        <AssistantMessage v-else :message="message" />
      </template>
    </UChatMessages>
  </div>
</template>
