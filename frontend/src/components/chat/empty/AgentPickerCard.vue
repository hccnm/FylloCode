<script setup lang="ts">
import { computed } from "vue";
import type { AcpAgentEntry, AcpAgentStatus, AcpInstallProgress } from "@shared/types/acp-agent";

const props = defineProps<{
  agent: AcpAgentEntry;
  icon?: string;
  agentStatus?: AcpAgentStatus;
  installProgress?: AcpInstallProgress;
  selected?: boolean;
  selectable?: boolean;
  installDisabled?: boolean;
}>();

const emit = defineEmits<{
  select: [agentId: string];
  install: [agentId: string];
}>();

const installed = computed(() => props.agentStatus?.installed === true);
const isInstalling = computed(() => {
  const status = props.installProgress?.status;
  return status === "downloading" || status === "installing";
});
const hasInstallError = computed(() => props.installProgress?.status === "error");
const progressMessage = computed(() => props.installProgress?.message ?? "正在处理...");

function handleClick(): void {
  if (!installed.value || !props.selectable) {
    return;
  }
  emit("select", props.agent.id);
}

function handleInstall(event: MouseEvent): void {
  event.stopPropagation();
  emit("install", props.agent.id);
}
</script>

<template>
  <div
    class="group relative rounded-lg border bg-default p-3 transition-colors"
    :class="[
      installed && selectable ? 'cursor-pointer hover:border-primary/40' : '',
      selected
        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
        : 'border-default hover:bg-elevated/40',
    ]"
    @click="handleClick"
  >
    <div class="flex items-start gap-3">
      <div
        class="w-9 h-9 shrink-0 rounded-lg bg-white flex items-center justify-center overflow-hidden"
      >
        <img v-if="icon" :src="icon" :alt="agent.name" class="w-full h-full object-cover" />
        <UIcon v-else name="i-lucide-terminal" class="w-4 h-4 text-muted" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <p class="text-sm font-medium text-highlighted truncate">{{ agent.name }}</p>
          <span class="text-xs text-muted/60 shrink-0">v{{ agent.version }}</span>
        </div>
        <p class="mt-0.5 text-xs text-muted line-clamp-2">{{ agent.description }}</p>
      </div>
      <div class="shrink-0 flex flex-col items-end gap-1.5">
        <div v-if="selected" class="flex h-5 items-center">
          <UIcon name="i-lucide-check-circle-2" class="w-4 h-4 text-primary" />
        </div>
        <template v-else-if="!installed">
          <div v-if="isInstalling" class="flex items-center gap-1 text-xs text-muted">
            <UIcon name="i-lucide-loader-circle" class="w-3.5 h-3.5 animate-spin" />
            <span class="max-w-24 truncate">{{ progressMessage }}</span>
          </div>
          <UButton
            v-else
            size="xs"
            :color="hasInstallError ? 'error' : 'neutral'"
            :variant="hasInstallError ? 'soft' : 'outline'"
            :disabled="installDisabled"
            :icon="hasInstallError ? 'i-lucide-rotate-ccw' : 'i-lucide-download'"
            @click="handleInstall"
          >
            {{ hasInstallError ? "重试" : "安装" }}
          </UButton>
        </template>
      </div>
    </div>
  </div>
</template>
