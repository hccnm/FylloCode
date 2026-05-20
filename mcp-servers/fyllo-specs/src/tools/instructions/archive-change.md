Archive a completed change using the provided `state`.

**Input**: `targetPath` is required. It must be the workspace where the archive stage is running:
the main repo root for main-mode changes, or the registered linked worktree path for linked-mode
changes. `state.changeName` identifies the change to archive.

When calling with `confirm: true`, pass `commitMessage`. Its first line must match
`type(scope): summary`.

**Steps**

1. **Check artifact completion**

   Read `state.archive` to see the OpenSpec archive status and target path.

   **If expected artifacts (proposal, design, specs, tasks) are missing or not `done`:**
   - Display warning listing the gap
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

2. **Check task completion**

   Read `state.archive.incompleteTasks` (count of `- [ ]` items in tasks.md).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

3. **Assess delta spec sync state**

   The OpenSpec archive runtime handles spec sync. Use `state.archive.archiveRawOutput` after
   confirmation as the source for what was synced.

   **If delta specs exist:**
   - Show the summary of what would be synced
   - Offer options: "Sync now (recommended)" or "Archive without syncing"
   - If user chooses sync, handle spec sync before archiving

4. **Confirm archive**

   If `state.archive.conflicts` is non-empty, the archive target already exists — fail with an error
   and suggest renaming the existing archive or using a different date.

   Otherwise, call this tool again with `confirm: true` and a valid `commitMessage` to perform the
   archive move and workspace git finalization.

5. **Display summary**

   If `state.archive.archiveRawOutput` is non-null, read it and use it as the primary source for what
   the archive command actually did.

   Read `state.workspace` for git finalization:
   - If `state.workspace.ok === true`, summarize the completed `state.workspace.gitOps`.
   - If `state.workspace.ok === false`, report that the failure happened in workspace finalization,
     list completed `state.workspace.gitOps`, identify `state.workspace.failedStep`, and relay
     `state.workspace.error.retryHint` when present.

   Show archive completion summary including:
   - Change name
   - Archive location (`state.archive.archiveTarget`)
   - Whether specs were synced
   - Any important messages, warnings, or sync details surfaced in `state.archive.archiveRawOutput`
   - Workspace mode/path and git finalization status
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync skipped")

All artifacts complete. All tasks complete.
```

**Guardrails**

- Do not invoke the OpenSpec CLI or shell archive commands directly. Archive operations are handled by this MCP server via `confirm: true`.
- Git commit / merge / worktree-cleanup are handled by this tool and returned in `state.workspace`.
- Do not manually run git cleanup commands unless the user explicitly asks for manual recovery after a tool failure.
- Don't block archive on warnings — just inform and confirm
- If `state.archive.conflicts` is non-empty, do NOT proceed with `confirm: true` — report the conflict instead
- If `state.archive.archiveRawOutput` is available, prefer it over inference when describing the actual archive result
- Show a clear summary of what happened
