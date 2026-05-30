<script setup lang="ts">
import { computed, ref } from "vue";
import AgentKindBadge from "@renderer/components/acp/AgentKindBadge.vue";
import {
  stripPackageVersion,
  type AcpAgentEntry,
  type AcpAgentStatus,
  type AcpInstallMethod,
  type AcpInstallProgress,
  type AcpUninstallProgress,
} from "@shared/types/acp-agent";

const props = defineProps<{
  agent: AcpAgentEntry;
  icon?: string;
  agentStatus?: AcpAgentStatus;
  installProgress?: AcpInstallProgress | AcpUninstallProgress;
  userDataPath?: string;
  isInstalling?: boolean;
  actionDisabled?: boolean;
}>();

const emit = defineEmits<{
  install: [agentId: string];
  uninstall: [agentId: string];
}>();

const showTakeoverModal = ref(false);
const showUninstallModal = ref(false);

const canUpdate = computed(() => props.agentStatus?.installed && props.agentStatus.updateAvailable);
const isUserManagedUpdate = computed(
  () => canUpdate.value && props.agentStatus?.managedBy === "user"
);
const hasError = computed(() => props.installProgress?.status === "error");
const progressMessage = computed(() => props.installProgress?.message ?? "正在处理...");
const detectedVersion = computed(() => props.agentStatus?.detectedVersion ?? props.agent.version);
const versionLabel = computed(() => `v${props.agent.version}`);
const resolvedInstallMethod = computed<AcpInstallMethod>(() => {
  if (props.agentStatus?.installMethod) {
    return props.agentStatus.installMethod;
  }
  if (props.agent.distribution.npx) {
    return "npx";
  }
  if (props.agent.distribution.uvx) {
    return "uvx";
  }
  return "binary";
});
const uninstallCommandLabel = computed(() =>
  resolvedInstallMethod.value === "binary" ? "将会删除" : "将会执行"
);
const uninstallCommandText = computed(() => {
  if (resolvedInstallMethod.value === "npx") {
    const pkg = props.agent.distribution.npx?.package ?? props.agent.id;
    return `npm uninstall -g ${stripPackageVersion(pkg)}`;
  }
  if (resolvedInstallMethod.value === "uvx") {
    const pkg = props.agent.distribution.uvx?.package ?? props.agent.id;
    return `uv tool uninstall ${stripPackageVersion(pkg)}`;
  }

  return `${props.userDataPath ?? ""}/acp/bin/${props.agent.id}`;
});
const uninstallLeadText = computed(() =>
  props.agentStatus?.managedBy === "user"
    ? "该 Agent 由你自行安装，是否同意 FylloCode 代为卸载？"
    : "该 Agent 由 FylloCode 安装，确定卸载吗？"
);
const uninstallFootnote = computed(() => {
  if (props.agentStatus?.managedBy !== "user") {
    return "卸载完成后将清除本地安装记录。";
  }

  return resolvedInstallMethod.value === "binary"
    ? "此操作不可撤销。"
    : "此操作会修改你的全局环境，不可撤销。";
});
const uninstallButtonLabel = computed(() =>
  props.agentStatus?.managedBy === "user" ? "同意并卸载" : "卸载"
);
const uninstallButtonColor = computed(() =>
  props.agentStatus?.managedBy === "user" ? "warning" : "error"
);

function requestInstall(): void {
  if (isUserManagedUpdate.value) {
    showTakeoverModal.value = true;
    return;
  }

  emit("install", props.agent.id);
}

function confirmTakeoverInstall(): void {
  showTakeoverModal.value = false;
  emit("install", props.agent.id);
}

function requestUninstall(): void {
  showUninstallModal.value = true;
}

function confirmUninstall(): void {
  showUninstallModal.value = false;
  emit("uninstall", props.agent.id);
}
</script>

<template>
  <UCard :ui="{ body: 'p-0!' }">
    <div class="flex flex-col gap-3 p-4">
      <div class="flex items-center gap-3">
        <div class="relative shrink-0">
          <div class="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden">
            <img v-if="icon" :src="icon" :alt="agent.name" class="w-full h-full object-cover" />
            <UIcon v-else name="i-lucide-terminal" class="w-4 h-4 text-muted" />
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="min-w-0 text-sm font-medium text-highlighted truncate">
              {{ agent.name }}
            </span>
            <AgentKindBadge :kind="agent.__fyllo?.kind" />
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-muted/60">{{ versionLabel }}</span>
            <span class="text-xs text-muted/40">·</span>
            <span class="text-xs text-muted/60 truncate">{{ agent.license }}</span>
          </div>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
          <div v-if="isInstalling" class="flex items-center gap-2 text-xs text-muted">
            <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
            <span>{{ progressMessage }}</span>
          </div>

          <div v-else-if="hasError" class="flex items-center gap-2 text-xs text-error">
            <UIcon name="i-lucide-circle-x" class="w-4 h-4 shrink-0" />
            <span class="max-w-28 truncate" :title="progressMessage">{{ progressMessage }}</span>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              :title="'重试'"
              @click="requestInstall"
            >
              <UIcon name="i-lucide-rotate-ccw" class="w-3 h-3" />
            </UButton>
          </div>

          <template v-else-if="canUpdate">
            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                color="primary"
                :disabled="actionDisabled"
                :title="actionDisabled ? '其他 Agent 正在处理中' : undefined"
                @click="requestInstall"
              >
                <UIcon name="i-lucide-refresh-cw" class="w-3 h-3 mr-1" />
                更新
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-trash-2"
                :disabled="actionDisabled"
                :title="actionDisabled ? '其他 Agent 正在处理中' : undefined"
                @click="requestUninstall"
              >
                卸载
              </UButton>
            </div>
            <span class="text-xs text-muted">v{{ detectedVersion }}</span>
          </template>

          <template v-else-if="agentStatus?.installed">
            <UBadge color="success" variant="soft">已安装</UBadge>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-trash-2"
              :disabled="actionDisabled"
              :title="actionDisabled ? '其他 Agent 正在处理中' : undefined"
              @click="requestUninstall"
            >
              卸载
            </UButton>
          </template>

          <UButton
            v-else
            size="xs"
            variant="outline"
            color="neutral"
            :disabled="actionDisabled"
            :title="actionDisabled ? '其他 Agent 正在处理中' : undefined"
            class="shrink-0"
            @click="requestInstall"
          >
            <UIcon name="i-lucide-download" class="w-3 h-3 mr-1" />
            安装
          </UButton>
        </div>
      </div>
      <p class="text-xs text-muted line-clamp-2">{{ agent.description }}</p>
      <span class="text-xs text-muted/60 truncate">{{ agent.authors.join(", ") }}</span>
    </div>
  </UCard>

  <UModal v-model:open="showTakeoverModal">
    <template #content>
      <div class="p-6 space-y-4">
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0"
          >
            <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-highlighted">接管此 Agent 的更新？</h3>
            <p class="text-sm text-muted mt-1">
              继续后，FylloCode 将接管这个用户自行安装的 Agent，并负责后续更新管理。
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="neutral" @click="showTakeoverModal = false">取消</UButton>
          <UButton color="warning" @click="confirmTakeoverInstall">确认更新</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="showUninstallModal">
    <template #content>
      <div class="p-6 space-y-4">
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0"
          >
            <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 text-warning" />
          </div>
          <div class="flex-1 min-w-0 space-y-3">
            <h3 class="text-base font-semibold text-highlighted">卸载 {{ agent.name }}？</h3>
            <p class="text-sm text-muted">{{ uninstallLeadText }}</p>
            <p class="text-sm text-muted">{{ uninstallCommandLabel }}</p>
            <div
              class="mt-3 space-y-1.5 text-sm flex flex-col justify-start rounded-md bg-muted px-4 py-2"
            >
              <code class="font-mono break-all whitespace-pre-wrap leading-relaxed">
                {{ uninstallCommandText }}
              </code>
            </div>
            <p class="text-sm text-muted mt-3">{{ uninstallFootnote }}</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="neutral" @click="showUninstallModal = false">
            取消
          </UButton>
          <UButton :color="uninstallButtonColor" @click="confirmUninstall">
            {{ uninstallButtonLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
