Archive the change using the provided `state`.

Use preview data from `state` to assess:

- artifact completion
- target archive path
- conflicts

If archive should proceed, call this same tool again with `confirm: true`.

Do not invoke the OpenSpec CLI or shell archive commands directly for this flow. Those steps are handled by this MCP server.
