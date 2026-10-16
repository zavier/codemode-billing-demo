#!/usr/bin/env node
// Deterministic in-memory "billing" MCP server (stdio) for a reproducible demo.
// No data file: all 200 invoices are generated at startup from a fixed seed.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SEED = 0x5eed2026;
const CUSTOMERS = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Wonka"];
const STATUSES = ["signed", "pending", "overdue"];
const INVOICE_COUNT = 200;
const SIGNED_HEX_LEN = 222; // keeps a get_invoice detail line at ~320 chars
const SIGNED_BASE_MS = Date.UTC(2026, 0, 5, 9, 0, 0);

// Small deterministic PRNG (mulberry32) so every run yields identical data.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const HEX_CHARS = "0123456789abcdef";

function randomHex(length) {
  let out = "";
  for (let i = 0; i < length; i++) out += HEX_CHARS[Math.floor(rand() * 16)];
  return out;
}

const invoices = new Map();
for (let i = 0; i < INVOICE_COUNT; i++) {
  const id = `INV-${String(i + 1).padStart(4, "0")}`;
  invoices.set(id, {
    id,
    customer: CUSTOMERS[i % CUSTOMERS.length],
    amount: (100 + rand() * 8900).toFixed(2),
    // i % 3 across a stride-8 customer cycle gives every customer all three statuses.
    status: STATUSES[i % STATUSES.length],
    signed: randomHex(SIGNED_HEX_LEN),
    signedAt: new Date(SIGNED_BASE_MS + i * 37 * 60_000).toISOString(),
  });
}

const summaryLine = (inv) =>
  `id=${inv.id} customer=${inv.customer} amount=${inv.amount} status=${inv.status}`;

const detailLine = (inv) =>
  `${summaryLine(inv)} signed=${inv.signed} signedAt=${inv.signedAt}`;

const server = new McpServer({ name: "billing", version: "1.0.0" });

server.registerTool(
  "list_invoices",
  {
    title: "List invoices",
    description: "List all 200 invoices, one line per invoice: id, customer, amount, status.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: [...invoices.values()].map(summaryLine).join("\n"),
      },
    ],
  })
);

server.registerTool(
  "get_invoice",
  {
    title: "Get invoice",
    description: "Return one full invoice detail line (with signature fields) for an invoice id.",
    inputSchema: { id: z.string().describe("Invoice id, e.g. INV-0001") },
  },
  async ({ id }) => {
    const inv = invoices.get(id);
    if (!inv) {
      return { content: [{ type: "text", text: `error: unknown invoice id=${id}` }], isError: true };
    }
    return { content: [{ type: "text", text: detailLine(inv) }] };
  }
);

server.registerTool(
  "set_invoice_status",
  {
    title: "Set invoice status",
    description: "Update the in-memory status of an invoice and return the result.",
    inputSchema: {
      id: z.string().describe("Invoice id, e.g. INV-0001"),
      status: z.string().describe("New status, e.g. signed, pending, overdue"),
    },
  },
  async ({ id, status }) => {
    const inv = invoices.get(id);
    if (!inv) {
      return { content: [{ type: "text", text: `error: unknown invoice id=${id}` }], isError: true };
    }
    inv.status = status;
    return { content: [{ type: "text", text: `ok id=${id} status=${status}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
