import { build } from "esbuild";
import { mkdir } from "fs/promises";
import { join } from "path";

const repoRoot = process.cwd();
const outDir = join(repoRoot, "out", "mcp-servers", "fyllo-specs");

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [join(repoRoot, "mcp-servers", "fyllo-specs", "src", "index.ts")],
  outfile: join(outDir, "index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  minify: true,
  external: ["@fission-ai/openspec"],
  loader: {
    ".md": "text",
  },
  alias: {
    "@shared": join(repoRoot, "shared"),
    "@main": join(repoRoot, "electron", "main"),
  },
});
