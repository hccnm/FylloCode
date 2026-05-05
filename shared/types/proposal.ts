export type ProposalStatus = "creating" | "draft" | "applying" | "archived";

export interface ProposalMeta {
  id: string;
  title: string;
  status: ProposalStatus;
  why: string;
  totalTasks: number;
  doneTasks: number;
  hasDesign: boolean;
  date: string;
}
