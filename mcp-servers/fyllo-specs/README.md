# fyllo-specs MCP server

## Layout

- `src/index.ts`: stdio MCP entry
- `src/server.ts`: tool registration
- `src/prompts/*.md`: prompt text
- `src/openspec-runtime/`: OpenSpec CLI adapter
- `__tests__/`: Vitest tests

## Workflow

- Change markdown prompt files without touching tool TypeScript unless state shape changes.
- Build output is `out/mcp-servers/fyllo-specs/index.js`.
- Development debug:
  - `process.execPath`
  - `out/mcp-servers/fyllo-specs/index.js`

## Notes

- The server reads `FYLLO_PROJECT_PATH` first.
- `openspec` is consumed via CLI spawn, not imported as a library.
