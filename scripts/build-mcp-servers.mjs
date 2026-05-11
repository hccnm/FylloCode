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
  // Some ESM deps (e.g. fdir via tinyglobby) use `createRequire(import.meta.url)`.
  // esbuild rewrites `import.meta` to `{}` in CJS output, which breaks createRequire.
  // Provide a valid file URL so those call sites keep working.
  banner: {
    js: "const __esbuild_import_meta_url = require('url').pathToFileURL(__filename).href;",
  },
  define: {
    "import.meta.url": "__esbuild_import_meta_url",
  },
});
