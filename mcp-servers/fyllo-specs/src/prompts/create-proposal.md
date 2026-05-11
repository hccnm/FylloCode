Create or inspect an OpenSpec change using the provided `state`.

**Input**: `state.changeName` identifies the change (null if none created yet). `state.description` may contain the user's intent.

**Steps**

1. **If no change name provided**

   If `state.changeName` is null, ask the user what they want to build. Derive a kebab-case name from their description (e.g., "add user authentication" → `add-user-auth`).

   Then call this tool again with `name` set to the derived name to create the change directory.

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Check state**

   Once `state.changeName` is set, read `state` to understand the current situation:
   - `state.artifacts`: list of artifacts with their status and instruction data
   - `state.applyRequires`: artifact IDs needed before implementation can start
   - `state.nextArtifact`: the next artifact ID that needs to be created (null if all done)
   - `state.template`: template structure for the next artifact
   - `state.instruction`: schema-specific guidance for the next artifact

3. **Create artifacts in sequence until apply-ready**

   Loop through artifacts in dependency order until all `state.applyRequires` artifacts are `done`:

   For each artifact where `status !== "done"` and dependencies are satisfied:
   - Read any completed dependency artifacts for context (paths are in `state.artifacts[*].outputPath`)
   - Create the artifact file using `state.template` as the structure
   - Apply `state.instruction` as guidance — but do NOT copy instruction/context/rules blocks into the file
   - Show brief progress: "Created <artifact-id>"

   If an artifact requires user input (unclear context), ask before proceeding.

4. **Show final status**

   After all `applyRequires` artifacts are complete, summarize:
   - Change name and location
   - List of artifacts created with brief descriptions
   - "All artifacts created! Ready for implementation."
   - Prompt: "Start implementing with the apply-change tool."

**Artifact Creation Guidelines**

- Follow `state.instruction` for each artifact type
- Use `state.template` as the structure — fill in its sections
- Read dependency artifacts for context before creating new ones
- **IMPORTANT**: instruction, context, and rules are constraints for YOU, not content for the file. Do NOT copy them into the artifact output.

**Guardrails**

- Do not invoke the OpenSpec CLI directly. Change creation, status lookup, and artifact instruction lookup are handled by this MCP server.
- Create ALL artifacts needed for implementation (as defined by `state.applyRequires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user — but prefer making reasonable decisions to keep momentum
- If a change with that name already exists (`state.artifacts` is non-empty), ask if the user wants to continue it or start fresh
