// 审计一次 pi 会话：顶层工具调用、codemode 脚本里的嵌套调用、token 用量。
// 用法: node scripts/check-session.mjs results/sessions-B/<session>.jsonl
import fs from "node:fs";

const path = process.argv[2];
if (!path) { console.error("用法: node scripts/check-session.mjs <session.jsonl>"); process.exit(1); }

const top = {};
const nested = [];
const usage = {};

for (const line of fs.readFileSync(path, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let d; try { d = JSON.parse(line); } catch { continue; }
  const m = d.message;
  if (!m || typeof m !== "object") continue;

  if (m.role === "assistant") {
    if (m.usage && typeof m.usage === "object")
      for (const [k, v] of Object.entries(m.usage)) if (typeof v === "number") usage[k] = v;
    for (const block of m.content || [])
      if (block?.type === "toolCall") top[block.name] = (top[block.name] || 0) + 1;
  } else if (m.role === "toolResult") {
    for (const c of m.nestedCalls?.calls || []) nested.push(c);
  }
}

console.log("顶层工具调用:", JSON.stringify(top));
console.log("嵌套调用数:", nested.length);
for (const c of nested) {
  const a = c.arguments ?? c.args ?? {};
  console.log(`  ${c.name ?? c.tool}(${JSON.stringify(a)})`);
}
const keys = ["input", "output", "totalTokens", "cacheRead", "cacheWrite"];
console.log("usage:", keys.filter((k) => k in usage).map((k) => `${k}=${usage[k]}`).join("  "));
