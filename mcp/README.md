# billing-mcp

Deterministic billing MCP server for reproducible demos. Stdio transport, in-memory data only.

## Run

```sh
/usr/local/bin/node /tmp/billing-mcp/server.mjs
```

(Equivalent: `cd /tmp/billing-mcp && node server.mjs`. The process speaks MCP JSON-RPC over stdin/stdout; it also works as an MCP stdio server entry in any client config.)

## Tools

- `list_invoices` — no args; returns all 200 invoices as newline-separated lines (`id=... customer=... amount=... status=...`, ~12 KB of text).
- `get_invoice` — args `{id}`; returns one full detail line for that invoice, including `signed` and `signedAt` fields (~320 chars).
- `set_invoice_status` — args `{id, status}`; mutates the in-memory invoice and returns `ok id=... status=...`.
