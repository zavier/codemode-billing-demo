#!/usr/bin/env python3
"""统计一次 pi 会话的工具调用。
用法: python3 scripts/stats.py <session.jsonl>

顶层调用数只从 assistant 消息的 content[].toolCall 里数（一次调用一条记录）；
嵌套调用读 toolResult 消息的 nestedCalls。
"""
import json, sys
from collections import Counter

path = sys.argv[1]
top, nested = Counter(), Counter()
usage = {}
for line in open(path):
    line = line.strip()
    if not line: continue
    try: d = json.loads(line)
    except: continue
    m = d.get("message") or {}
    if not isinstance(m, dict): continue
    role = m.get("role")
    if role == "assistant":
        if isinstance(m.get("usage"), dict):
            usage.update({k: v for k, v in m["usage"].items() if isinstance(v, (int, float))})
        for block in m.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "toolCall":
                top[block.get("name") or "?"] += 1
    elif role == "toolResult":
        nc = m.get("nestedCalls")
        if isinstance(nc, dict):
            for c in nc.get("calls") or []:
                if isinstance(c, dict): nested[c.get("name") or "?"] += 1

print("顶层调用:", dict(top), f"（合计 {sum(top.values())}）")
print("嵌套调用:", dict(nested), f"（合计 {sum(nested.values())}）")
keys = ["input", "output", "totalTokens", "cacheRead", "cacheWrite"]
print("usage:", "  ".join(f"{k}={usage[k]}" for k in keys if k in usage))
