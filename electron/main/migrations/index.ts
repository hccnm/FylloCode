import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { app } from "electron";
import { getDataSubPath } from "@main/infra/paths";
import { runMigrations } from "./runner";
import type { Migration } from "./types";

// 按文件名字母序追加新迁移到此数组末尾，顺序即执行顺序
const migrations: Migration[] = [];

export async function runAllMigrations(): Promise<void> {
  const migrationsPath = getDataSubPath("migrations");
  const dataPath = is.dev ? join(process.cwd(), "data") : app.getPath("userData");
  await runMigrations(migrations, migrationsPath, dataPath);
}
