// 任务：找出 overdue 金额合计最高的客户，用 billing 工具把它的 overdue 发票改成 signed。
// 全部在同一个 MCP 会话里完成（server 是内存态，换进程数据就重置）。
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(here, "server.mjs")],
});
const client = new Client({ name: "bookkeeper", version: "1.0.0" });
await client.connect(transport);

const text = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return r.content.map((c) => c.text).join("\n");
};

const parse = (t) =>
  t.split("\n").filter(Boolean).map((l) => {
    const m = l.match(/id=(\S+) customer=(\S+) amount=([\d.]+) status=(\S+)/);
    return m && { id: m[1], customer: m[2], amount: Number(m[3]), status: m[4] };
  }).filter(Boolean);

// 1) 通过 billing 工具拉全部发票
const rows = parse(await text("list_invoices", {}));
const overdue = rows.filter((r) => r.status === "overdue");

// 按客户汇总 overdue 金额
const total = {}, count = {};
for (const r of overdue) {
  total[r.customer] = (total[r.customer] || 0) + r.amount;
  count[r.customer] = (count[r.customer] || 0) + 1;
}
const ranked = Object.entries(total).sort((a, b) => b[1] - a[1]);
const [customer, amount] = ranked[0];
const targets = overdue.filter((r) => r.customer === customer);

console.log("发票总数:", rows.length, "| overdue 总数:", overdue.length);
console.log("overdue 金额排名:", ranked.map(([c, a]) => `${c}=${a.toFixed(2)}`).join("  "));
console.log(`最高: ${customer} | 金额: ${amount.toFixed(2)} | 张数: ${targets.length}`);
console.log("发票:", targets.map((t) => t.id).join(", "));

// 2) 用 billing 工具把该客户所有 overdue 发票改成 signed
for (const t of targets) {
  const out = await text("set_invoice_status", { id: t.id, status: "signed" });
  console.log("set:", out);
}

// 3) 重新拉取，逐条对账
const after = parse(await text("list_invoices", {}));
const afterMap = new Map(after.map((r) => [r.id, r.status]));
const bad = targets.filter((t) => afterMap.get(t.id) !== "signed");
console.log("对账:", bad.length === 0 ? "全部为 signed ✓" : `未生效: ${bad.map((b) => b.id)}`);
console.log("该客户剩余 overdue:", after.filter((r) => r.customer === customer && r.status === "overdue").length);
console.log("全局 overdue 数量:", after.filter((r) => r.status === "overdue").length);

await client.close();
