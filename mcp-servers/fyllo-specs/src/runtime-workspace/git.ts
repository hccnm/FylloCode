import { spawn } from "child_process";
import type { ArchiveGitOpResult, ArchiveGitStep } from "./types";

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

export async function runGitStep(input: {
  step: ArchiveGitStep;
  cwd: string;
  args: string[];
}): Promise<ArchiveGitOpResult> {
  const result = await runGit(input.cwd, input.args);
  return {
    step: input.step,
    cwd: input.cwd,
    command: formatCommand("git", input.args),
    ...result,
    ok: result.exitCode === 0,
  };
}

export async function runGitCompositeStep(input: {
  step: ArchiveGitStep;
  cwd: string;
  commands: string[][];
}): Promise<ArchiveGitOpResult> {
  let stdout = "";
  let stderr = "";

  for (const args of input.commands) {
    const result = await runGit(input.cwd, args);
    stdout += result.stdout;
    stderr += result.stderr;
    if (result.exitCode !== 0) {
      return {
        step: input.step,
        cwd: input.cwd,
        command: input.commands.map((command) => formatCommand("git", command)).join(" && "),
        exitCode: result.exitCode,
        stdout,
        stderr,
        ok: false,
      };
    }
  }

  return {
    step: input.step,
    cwd: input.cwd,
    command: input.commands.map((command) => formatCommand("git", command)).join(" && "),
    exitCode: 0,
    stdout,
    stderr,
    ok: true,
  };
}

export async function runGit(
  cwd: string,
  args: string[]
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({
        exitCode: null,
        stdout,
        stderr: stderr || error.message,
      });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}
