<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@renderer/stores/chat";
import { useSessionStore } from "@renderer/stores/session";
import ChatAgentSelect from "./ChatAgentSelect.vue";
import ContextUsageRing from "./ContextUsageRing.vue";
import UIMessageList from "@renderer/components/shared/UIMessageList.vue";

const store = useChatStore();
const sessionStore = useSessionStore();
const { chatStatus } = storeToRefs(store);
const { activeSession, draftAgentId } = storeToRefs(sessionStore);

const agent = computed<string | undefined>({
  get: () => activeSession.value?.agentId ?? draftAgentId.value ?? undefined,
  set: (agentId) => {
    if (!agentId) {
      return;
    }

    if (activeSession.value) {
      void sessionStore.setSessionAgent(agentId).catch((error: unknown) => {
        console.error("Failed to update session agent:", error);
      });
      return;
    }

    sessionStore.setDraftAgent(agentId);
  },
});

const isAgentLocked = computed(() => (activeSession.value?.messages.length ?? 0) > 0);

const input = ref("");

async function handleSubmit(): Promise<void> {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await store.sendMessage(text);
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <div class="flex-1 overflow-y-auto py-4 px-2 relative">
      <div class="max-w-240 mx-auto">
        <UIMessageList
          :messages="activeSession?.messages ?? []"
          :status="chatStatus"
          type="chat"
          :agent-id="activeSession?.agentId"
        />
      </div>
    </div>

    <div class="p-4">
      <div class="max-w-240 mx-auto">
        <UChatPrompt
          v-model="input"
          variant="subtle"
          class="sticky bottom-0 [view-transition-name:chat-prompt]"
          :ui="{ base: 'px-1.5' }"
          @submit="handleSubmit"
        >
          <template #footer>
            <div class="inline-flex items-center gap-2 min-w-0">
              <ContextUsageRing
                v-if="activeSession"
                :used="activeSession.tokenUsage.used"
                :size="activeSession.tokenUsage.size"
                :cost="activeSession.tokenUsage.cost"
              />
              <ChatAgentSelect v-if="!isAgentLocked" v-model="agent" />
            </div>

            <UChatPromptSubmit
              :status="chatStatus"
              color="neutral"
              size="sm"
              @stop="store.cancelStream()"
            />
          </template>
        </UChatPrompt>
      </div>
    </div>
  </div>
</template>
