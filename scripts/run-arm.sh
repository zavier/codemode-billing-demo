#!/bin/bash
# 跑一组实验。用法: scripts/run-arm.sh A|B|C [timeout_seconds]
# 依赖: pi 已安装、已登录；node。
set -e
ARM="${1:-A}"
SECS="${2:-600}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

case "$ARM" in
  A) TOOLS="read,bash"; EXPOSURE="" ;;          # bash 可用，MCP 工具不进工具列表
  B) TOOLS="codemode"; EXPOSURE="" ;;           # 只有 codemode
  C) TOOLS="read,bash"; EXPOSURE="direct" ;;    # bash 可用 + MCP 工具直接暴露
  *) echo "用法: $0 A|B|C"; exit 1 ;;
esac

# 备份并写入全局 MCP 配置（pi 的项目级 .pi/mcp.json 需要信任目录才生效）
BACKUP="$HERE/mcp.json.bak"
[ -f "$BACKUP" ] || cp ~/.pi/agent/mcp.json "$BACKUP" 2>/dev/null || echo '{"mcpServers":{}}' > "$BACKUP"
python3 - "$EXPOSURE" "$HERE" <<'PY'
import json, sys, os
exposure, here = sys.argv[1], sys.argv[2]
cfg = {"mcpServers": {"billing": {"command": "node", "args": [os.path.join(here, "mcp", "server.mjs")]}}}
if exposure: cfg["mcpServers"]["billing"]["exposure"] = exposure
os.makedirs(os.path.expanduser("~/.pi/agent"), exist_ok=True)
json.dump(cfg, open(os.path.expanduser("~/.pi/agent/mcp.json"), "w"), indent=2)
print("MCP 配置:", json.dumps(cfg))
PY

PROMPT="你是记账助手。有一个 billing 工具可查这家公司的发票。请完成三件事：
1. 找出 overdue 金额合计最高的客户
2. 把那个客户所有 overdue 的发票状态改成 signed
3. 报告：客户名、overdue 发票数量、overdue 金额合计
注意：改状态要用 billing 提供的工具，不要直接改数据。"

mkdir -p "$HERE/results/sessions-$ARM"
"$HERE/scripts/run.sh" "$HERE/results/arm-$ARM.log" "$SECS" \
  pi --print --approve --session-dir "$HERE/results/sessions-$ARM" --tools "$TOOLS" "$PROMPT"

# 恢复配置
cp "$BACKUP" ~/.pi/agent/mcp.json
echo "--- 会话统计 ---"
python3 "$HERE/scripts/stats.py" "$(ls -t "$HERE"/results/sessions-$ARM/*.jsonl | head -1)"
