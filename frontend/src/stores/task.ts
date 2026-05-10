import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { taskApi } from "@renderer/api/task";
import { useProjectStore } from "./project";
import type {
  CreateLocalTaskInput,
  TaskItem,
  TaskSource,
  TaskStatus,
  UpdateTaskInput,
} from "@shared/types/task";

type TaskSourceFilter = TaskSource | "all";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function normalizeTask(task: TaskItem): TaskItem {
  return {
    ...task,
    createdAt: toDate(task.createdAt),
    updatedAt: toDate(task.updatedAt),
  };
}

function sortTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export const useTaskStore = defineStore("task", () => {
  const tasks = ref<TaskItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sourceFilter = ref<TaskSourceFilter>("all");
  const statusFilter = ref<TaskStatus>("open");

  const tasksBySource = computed(() =>
    sourceFilter.value === "all"
      ? tasks.value
      : tasks.value.filter((task) => task.source === sourceFilter.value)
  );

  const filteredTasks = computed(() => {
    if (sourceFilter.value !== "local") {
      return tasksBySource.value;
    }
    return tasksBySource.value.filter((task) => task.status === statusFilter.value);
  });

  function getCurrentProjectId(): string | undefined {
    return useProjectStore().currentProject?.id;
  }

  function setTasks(items: TaskItem[]): void {
    tasks.value = sortTasks(items.map(normalizeTask));
  }

  function upsertTask(task: TaskItem): void {
    const normalized = normalizeTask(task);
    const index = tasks.value.findIndex((item) => item.id === normalized.id);
    if (index === -1) {
      tasks.value = sortTasks([normalized, ...tasks.value]);
      return;
    }

    const next = [...tasks.value];
    next.splice(index, 1, normalized);
    tasks.value = sortTasks(next);
  }

  async function loadTasks(source?: TaskSource): Promise<void> {
    const projectId = getCurrentProjectId();
    sourceFilter.value = source ?? "all";

    if (!projectId) {
      tasks.value = [];
      error.value = "当前没有选中的项目";
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const result = await taskApi.listTasks(projectId, source);
      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setTasks(result.data);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err);
      tasks.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function createTask(input: CreateLocalTaskInput): Promise<TaskItem> {
    const projectId = getCurrentProjectId();
    if (!projectId) {
      error.value = "当前没有选中的项目";
      throw new Error(error.value);
    }

    const result = await taskApi.createTask(projectId, input);
    if (!result.ok) {
      error.value = result.error.message;
      throw new Error(result.error.message);
    }

    error.value = null;
    upsertTask(result.data);
    return normalizeTask(result.data);
  }

  async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<TaskItem> {
    const projectId = getCurrentProjectId();
    if (!projectId) {
      error.value = "当前没有选中的项目";
      throw new Error(error.value);
    }

    const result = await taskApi.updateTask(projectId, taskId, updates);
    if (!result.ok) {
      error.value = result.error.message;
      throw new Error(result.error.message);
    }

    error.value = null;
    upsertTask(result.data);
    return normalizeTask(result.data);
  }

  async function deleteTask(taskId: string): Promise<void> {
    const projectId = getCurrentProjectId();
    if (!projectId) {
      error.value = "当前没有选中的项目";
      throw new Error(error.value);
    }

    const result = await taskApi.deleteTask(projectId, taskId);
    if (!result.ok) {
      error.value = result.error.message;
      throw new Error(result.error.message);
    }

    error.value = null;
    tasks.value = tasks.value.filter((task) => task.id !== taskId);
  }

  return {
    tasks,
    loading,
    error,
    sourceFilter,
    statusFilter,
    tasksBySource,
    filteredTasks,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
  };
});
