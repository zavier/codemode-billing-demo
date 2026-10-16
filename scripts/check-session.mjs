// 审计一次运行的会话记录：调用了哪些工具、每次嵌套调用的名字和参数。
// 用法: node scripts/check-session.mjs <session.jsonl>
import fs from "node:fs";

const path = process.argv[2];
if (!path) { console.error("用法: node scripts/check-session.mjs <session.jsonl>"); process.exit(1); }

const top = {};
const nested = [];
const usage = {};
let resultText = "";

const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (!o || typeof o !== "object") return;
  for (const [k, v] of Object.entries(o)) {
    if (k === "usage" && v && typeof v === "object")
      for (const [uk, uv] of Object.entries(v)) if (typeof uv === "number") usage[uk] = uv;
    if (k === "nestedCalls" && v && typeof v === "object")
      for (const c of v.calls || []) nested.push(c);
    if (k === "name" && typeof v === "string" && !k.startsWith("nested")) top[v] = (top[v] || 0) + 1;
    if (k === "text" && typeof v === "string" && v.length > resultText.length && !v.includes("{") ) resultText = v;
    walk(v);
  }
};

for (const line of fs.readFileSync(path, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { walk(JSON.parse(line)); } catch {}
}

console.log("顶层工具调用:", JSON.stringify(top));
console.log("嵌套调用数:", nested.length);
for (const c of nested) {
  const a = c.arguments ?? c.args ?? {};
  console.log(`  ${c.name ?? c.tool}(${JSON.stringify(a)})`);
}
const keys = ["input", "output", "totalTokens", "cacheRead", "cacheWrite"];
console.log("usage:", keys.filter((k) => k in usage).map((k) => `${k}=${usage[k]}`).join("  "));
