import type logger from "@main/infra/logger";

type Logger = typeof logger;

export type MigrationContext = {
  dataPath: string;
  logger: Logger;
};

export type Migration = {
  id: string;
  migrate: (ctx: MigrationContext) => Promise<void>;
};

export type MigrationRecord = {
  id: string;
  executedAt: string;
  status: "success" | "failed";
  error?: string;
};

export type MigrationStore = {
  baselineId?: string;
  executed: MigrationRecord[];
};
