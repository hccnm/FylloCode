Create or inspect an OpenSpec proposal using the provided `state`.

If `state.changeName` is present, the tool may already have created the change directory.

Use `state.artifacts`, `state.applyRequires`, and any provided instruction/template data to decide what artifact should be created next.

Do not invoke the OpenSpec CLI directly. Change creation, status lookup, and artifact instruction lookup are handled by this MCP server.
