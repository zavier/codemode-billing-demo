// 独立复算 ground truth：直接和 MCP server 用 JSON-RPC 对话，不经过 pi。
// 用法: node scripts/verify-baseline.mjs
import { spawn } from "node:child_process";

const srv = spawn("node", ["mcp/server.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
srv.stdout.on("data", (d) => (buf += d));

const send = (obj) => srv.stdin.write(JSON.stringify(obj) + "\n");
send({ jsonrpc: "2.0", id: 1, method: "initialize",
       params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "verify", version: "1" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_invoices", arguments: {} } });

setTimeout(() => {
  let text = "";
  for (const line of buf.split("\n")) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 2) text = msg.result.content[0].text;
    } catch {}
  }
  const rows = text.split("\n").filter(Boolean).map((l) => {
    const m = l.match(/id=(\S+) customer=(\S+) amount=([\d.]+) status=(\S+)/);
    return m && { id: m[1], customer: m[2], amount: Number(m[3]), status: m[4] };
  }).filter(Boolean);

  const overdue = rows.filter((r) => r.status === "overdue");
  const byAmount = {};
  const byCount = {};
  for (const r of overdue) {
    byAmount[r.customer] = (byAmount[r.customer] || 0) + r.amount;
    byCount[r.customer] = (byCount[r.customer] || 0) + 1;
  }
  const ranked = Object.entries(byAmount).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) { console.error("没拿到发票列表——检查 mcp/node_modules 是否已安装 (cd mcp && npm install)"); srv.kill(); process.exit(1); }
  console.log("发票总数:", rows.length);
  console.log("overdue 总数:", overdue.length);
  console.log("overdue 金额合计最高的客户:", top[0], "| 金额:", top[1].toFixed(2), "| 张数:", byCount[top[0]]);
  console.log("它的 overdue 发票:", overdue.filter((r) => r.customer === top[0]).map((r) => r.id).join(", "));
  console.log("其余客户金额排名:", Object.entries(byAmount).sort((a, b) => b[1] - a[1]).slice(1, 4)
    .map(([c, v]) => `${c}=${v.toFixed(2)}`).join("  "));
  console.log("总 overdue 金额:", Object.values(byAmount).reduce((a, b) => a + b, 0).toFixed(2));
  srv.kill();
  process.exit(0);
}, 800);
