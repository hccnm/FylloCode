export type TaskSource = "local" | "yunxiao" | "github";

export type TaskStatus = "open" | "closed";

export interface TaskUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface TaskLabel {
  id: string;
  name: string;
  color?: string;
}

export interface LocalTaskMeta {
  source: "local";
}

export interface YunxiaoTaskMeta {
  source: "yunxiao";
  url?: string;
  key?: string;
  issueType?: "需求" | "任务" | "缺陷";
}

export interface GithubTaskMeta {
  source: "github";
  url?: string;
  repository?: string;
  number?: number;
  issueType?: "issue" | "pull_request";
}

export type TaskSourceMeta = LocalTaskMeta | YunxiaoTaskMeta | GithubTaskMeta;

export interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  source: TaskSource;
  sourceMeta: TaskSourceMeta;
  labels: TaskLabel[];
  assignee?: TaskUser;
  proposalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLocalTaskInput {
  title: string;
  description?: string;
  proposalId?: string;
}

export type UpdateTaskInput = Partial<
  Pick<TaskItem, "title" | "description" | "status" | "labels" | "assignee" | "proposalId">
>;
