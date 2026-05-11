import { spawn } from "child_process";
import { OpenspecCliError, OpenspecTimeoutError } from "./types";

const TIMEOUT_MS = 30_000;

function buildEnv(extraEnv: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DO_NOT_TRACK: "1",
    OPENSPEC_TELEMETRY: "0",
    POSTHOG_DISABLED: "1",
    OPENSPEC_NO_TELEMETRY: "1",
    CI: "1",
    NO_COLOR: "1",
    ...extraEnv,
  };
}

export async function spawnOpenspec(
  cliPath: string,
  args: string[],
  cwd: string,
  extraEnv: NodeJS.ProcessEnv = {},
  parseJson = true
): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: buildEnv(extraEnv),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new OpenspecTimeoutError(`OpenSpec CLI timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new OpenspecCliError(
            `OpenSpec CLI exited with code ${code ?? "unknown"}`,
            stderr.slice(0, 400),
            code ?? -1
          )
        );
        return;
      }

      if (!parseJson) {
        resolve(stdout);
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(
          new OpenspecCliError(
            "OpenSpec CLI produced invalid JSON",
            stderr.slice(0, 400),
            code ?? -1
          )
        );
      }
    });
  });
}
