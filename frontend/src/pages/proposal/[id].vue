<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ChatComark from "@renderer/components/chat/ChatComark";
import { proposalApi } from "@renderer/api/proposal";
import { useProjectStore } from "@renderer/stores/project";
import { useProposalStore } from "@renderer/stores/proposal";
import type { ProposalMeta, ProposalStatus } from "@shared/types/proposal";

type MarkdownTabValue = "proposal" | "design" | "tasks";

interface MarkdownTab {
  label: string;
  value: MarkdownTabValue;
  filename: string;
  content: string | null;
}

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const proposalStore = useProposalStore();
const activeTab = ref<MarkdownTabValue>("proposal");
const tabs = ref<MarkdownTab[]>([]);
const loadingFiles = ref(false);
const fileError = ref<string | null>(null);

const statusConfig: Record<
  ProposalStatus,
  {
    label: string;
    color: "neutral" | "primary" | "warning" | "success" | "error" | "info" | "secondary";
    variant: "soft" | "outline" | "subtle";
  }
> = {
  creating: { label: "创建中", color: "primary", variant: "soft" },
  draft: { label: "草稿", color: "neutral", variant: "soft" },
  applying: { label: "实现中", color: "warning", variant: "soft" },
  archived: { label: "已归档", color: "neutral", variant: "outline" },
};

const changeId = computed(() => {
  const value = (route.params as { id?: string | string[] }).id;
  return Array.isArray(value) ? value[0] : value;
});

const currentProposal = computed<ProposalMeta | null>(() => {
  return proposalStore.proposals.find((proposal) => proposal.id === changeId.value) ?? null;
});

const visibleTabs = computed(() =>
  tabs.value
    .filter((tab) => tab.content !== null)
    .map((tab) => ({
      label: tab.label,
      value: tab.value,
    }))
);

const activeContent = computed(() => {
  return tabs.value.find((tab) => tab.value === activeTab.value)?.content ?? "";
});

async function ensureProposalLoaded(): Promise<void> {
  if (proposalStore.proposals.length > 0) {
    return;
  }

  await proposalStore.loadProposals();
}

async function loadMarkdownFiles(): Promise<void> {
  const projectId = projectStore.currentProject?.id;
  const changeIdSnapshot = changeId.value;
  if (!projectId || !changeIdSnapshot) {
    return;
  }

  loadingFiles.value = true;
  fileError.value = null;

  try {
    const fileRequests: Omit<MarkdownTab, "content">[] = [
      { label: "Proposal", value: "proposal", filename: "proposal.md" },
      { label: "Design", value: "design", filename: "design.md" },
      { label: "Tasks", value: "tasks", filename: "tasks.md" },
    ];

    const results = await Promise.all(
      fileRequests.map(async (tab) => {
        const result = await proposalApi.readFile(projectId, changeIdSnapshot, tab.filename);
        if (!result.ok) {
          throw new Error(result.error.message);
        }

        return {
          ...tab,
          content: result.data,
        };
      })
    );

    tabs.value = results;
    activeTab.value = visibleTabs.value[0]?.value ?? "proposal";
  } catch (err: unknown) {
    fileError.value = err instanceof Error ? err.message : String(err);
    tabs.value = [];
  } finally {
    loadingFiles.value = false;
  }
}

function backToList(): void {
  void router.push("/proposal");
}

onMounted(() => {
  void (async () => {
    await ensureProposalLoaded();
    await loadMarkdownFiles();
  })();
});
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden bg-default">
    <div class="shrink-0 border-b border-default">
      <div class="max-w-3xl mx-auto px-6 py-5 space-y-3">
        <div class="flex items-center gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-arrow-left"
            @click="backToList"
          >
            返回
          </UButton>
        </div>
        <div v-if="currentProposal" class="flex items-start justify-between gap-4">
          <h1 class="text-xl font-semibold text-highlighted">{{ currentProposal.title }}</h1>
          <UBadge
            :color="statusConfig[currentProposal.status].color"
            :variant="statusConfig[currentProposal.status].variant"
            class="shrink-0 mt-0.5"
          >
            {{ statusConfig[currentProposal.status].label }}
          </UBadge>
        </div>
        <div v-if="currentProposal" class="flex items-center gap-4 text-sm text-muted">
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
            {{ currentProposal.date }}
          </span>
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-check-square" class="w-3.5 h-3.5" />
            {{ currentProposal.doneTasks }}/{{ currentProposal.totalTasks }} tasks
          </span>
        </div>
        <div v-else class="space-y-2">
          <h1 class="text-xl font-semibold text-highlighted">{{ changeId }}</h1>
          <p class="text-sm text-muted">未找到该 proposal 的元数据</p>
        </div>
      </div>
    </div>

    <div class="shrink-0">
      <div class="max-w-3xl mx-auto px-6">
        <UTabs
          v-if="visibleTabs.length > 0"
          v-model="activeTab"
          :items="visibleTabs"
          size="sm"
          variant="link"
          value-key="value"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="max-w-3xl mx-auto px-6 py-6">
        <div
          v-if="loadingFiles"
          class="flex items-center justify-center gap-2 py-12 text-sm text-muted"
        >
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          正在加载 markdown
        </div>

        <div v-else-if="fileError" class="rounded-lg border border-error/30 bg-error/5 px-4 py-4">
          <div class="flex items-start gap-2 text-sm text-error">
            <UIcon name="i-lucide-circle-alert" class="w-4 h-4 mt-0.5 shrink-0" />
            <span>{{ fileError }}</span>
          </div>
        </div>

        <div
          v-else-if="visibleTabs.length === 0"
          class="rounded-lg border border-default bg-elevated px-4 py-8 text-center text-sm text-muted"
        >
          暂无可展示的 markdown 文件
        </div>

        <div v-else class="prose prose-sm dark:prose-invert max-w-none">
          <ChatComark :markdown="activeContent" />
        </div>
      </div>
    </div>
  </div>
</template>
