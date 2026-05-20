## Why

This change exists to exercise the FylloCode proposal-to-apply workflow with a minimal, deterministic repository change. The task is intentionally small so the proposal flow can be tested without touching application behavior.

## What Changes

- Add a repository-root `time.md` file.
- Write the current time captured during proposal creation into `time.md`: `2026-05-20 18:35:57 CST`.
- Do not modify Electron, Vue, TypeScript, IPC, UI, build, or test code.

## Capabilities

### New Capabilities

- `test-time-file`: Defines the minimal test behavior for creating a repository-root time marker file through the Apply workflow.

### Modified Capabilities

- None.

## Impact

- Affected file: `time.md` at the repository root.
- No runtime behavior, public API, IPC channel, storage format, dependency, or UI behavior is affected.
