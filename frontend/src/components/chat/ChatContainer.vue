<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@renderer/stores/chat";
import { useSessionStore } from "@renderer/stores/session";
import ChatMessageList from "@renderer/components/chat/message/ChatMessageList.vue";
import ChatEmptyAgentPicker from "./empty/ChatEmptyAgentPicker.vue";
import ChatStreamError from "./ChatStreamError.vue";
import ChatPromptPanel from "./prompt/ChatPromptPanel.vue";

const store = useChatStore();
const { chatStatus, streamError } = storeToRefs(store);
const { activeSession } = storeToRefs(useSessionStore());

const isEmpty = computed(() => (activeSession.value?.messages.length ?? 0) === 0);
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <div class="flex-1 overflow-y-auto py-4 px-2 relative">
      <div class="max-w-3xl mx-auto h-full">
        <ChatEmptyAgentPicker v-if="isEmpty" />
        <ChatMessageList
          v-else
          :messages="activeSession?.messages ?? []"
          :status="chatStatus"
          type="chat"
        />

        <div v-if="streamError" class="px-2.5">
          <ChatStreamError />
        </div>
      </div>
    </div>

    <div>
      <div class="max-w-3xl mx-auto">
        <ChatPromptPanel />
      </div>
    </div>
  </div>
</template>
