import { existsSync, mkdirSync, readFileSync, renameSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { dump, load } from "js-yaml";
import type { ArchiveResult } from "./types";
import { invalidRequest } from "../utils/mcp-errors";

function changeDir(projectRoot: string, name: string): string {
  return join(projectRoot, "openspec", "changes", name);
}

function yamlPath(projectRoot: string, name: string): string {
  return join(changeDir(projectRoot, name), ".openspec.yaml");
}

function archiveTarget(projectRoot: string, name: string): string {
  return join(
    projectRoot,
    "openspec",
    "changes",
    "archive",
    `${new Date().toISOString().slice(0, 10)}-${name}`
  );
}

function deltaSummary(changePath: string): { files: string[] } {
  return {
    files: readdirSync(changePath).sort(),
  };
}

export async function archiveChange(
  projectRoot: string,
  name: string,
  opts: { confirm?: boolean } = {}
): Promise<ArchiveResult> {
  const source = changeDir(projectRoot, name);
  if (!existsSync(source)) {
    throw invalidRequest(`Change not found: ${name}`);
  }
  const target = archiveTarget(projectRoot, name);
  const conflicts = existsSync(target) ? [target] : [];
  const summary: ArchiveResult = {
    changeName: name,
    archiveTarget: target,
    conflicts,
    deltaSpecSummary: existsSync(source) ? deltaSummary(source) : null,
  };

  if (!opts.confirm || conflicts.length > 0) {
    return summary;
  }

  const path = yamlPath(projectRoot, name);
  const doc = (load(readFileSync(path, "utf8")) as Record<string, unknown>) ?? {};
  doc.status = "archived";
  writeFileSync(path, dump(doc), "utf8");
  mkdirSync(join(projectRoot, "openspec", "changes", "archive"), { recursive: true });
  renameSync(source, target);
  return summary;
}
