// 从会话 JSONL 里提取 codemode 脚本源码 + 每次执行的结果摘要。
// 用法: node scripts/extract-codemode.mjs results/sessions-B/<session>.jsonl
import fs from "node:fs";

const path = process.argv[2];
if (!path) { console.error("用法: node scripts/extract-codemode.mjs <session.jsonl>"); process.exit(1); }

const calls = [];   // { code }
const results = []; // { text }

const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (!o || typeof o !== "object") return;
  const content = o.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block?.type === "toolCall" && block.name === "codemode") {
        const code = block.arguments?.code ?? block.arguments?.script;
        if (typeof code === "string") calls.push(code);
      }
    }
    if (o.role === "toolResult") {
      const text = content.filter((c) => c?.type === "text").map((c) => c.text).join("\n");
      if (text) results.push(text);
    }
  }
  for (const v of Object.values(o)) walk(v);
};

for (const line of fs.readFileSync(path, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { walk(JSON.parse(line)); } catch {}
}

calls.forEach((code, i) => {
  console.log(`\n${"=".repeat(72)}\ncodemode 脚本 #${i + 1}   (${code.length} 字符)\n${"=".repeat(72)}\n${code}`);
  const r = results[i];
  if (r) {
    // 去掉 "Script completed | Wall time ... | Output:" 之类的样板，只留真实输出
    const body = r.replace(/^Script (completed|failed)[\s\S]*?Output:\s*/i, "").replace(/<\/?console_output>/g, "").trim();
    const lines = body.split("\n").filter((l) => l.trim());
    const summary = lines.slice(0, 6).join("\n            ");
    console.log(`\n[执行结果] ${summary.slice(0, 600) || "(空)"}`);
  }
});
console.log(`\n共 ${calls.length} 个脚本，${results.length} 条结果记录。`);
