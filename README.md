# codemode billing demo

配套文章《codemode：让 Agent 学会写代码调工具》的可复现实验。

场景：一个只通过 MCP 暴露的 billing 服务（3 个工具），任务是「找出 overdue 金额合计最高的客户，把它的 overdue 发票改成 signed」。
同一台机器、同一个模型，只改给模型的工具集，对比三组。

## 前置

- `node`（≥ v20，实测 v24）
- `pi`（实测 1.3.0）+ 已登录任一模型
- 安装依赖：

```bash
cd mcp && npm install --no-fund --no-audit && cd ..
```

## 一、先拿到标准答案

```bash
node scripts/verify-baseline.mjs
```

输出（种子数据是固定的，结果应当一致）：

```
发票总数: 200
overdue 总数: 66
overdue 金额合计最高的客户: Initech | 金额: 52383.89 | 张数: 9
它的 overdue 发票: INV-0003, INV-0027, INV-0051, INV-0075, INV-0099, INV-0123, INV-0147, INV-0171, INV-0195
```

## 二、跑三组实验

```bash
scripts/run-arm.sh A     # bash + read（MCP 工具不进工具列表）
scripts/run-arm.sh B     # 只有 codemode
scripts/run-arm.sh C     # bash + read，且 MCP 工具直接暴露（exposure=direct）
```

每组会把日志写到 `results/arm-X.log`，会话记录写到 `results/sessions-X/`。
脚本会临时修改 `~/.pi/agent/mcp.json`，跑完自动恢复（备份在 `mcp.json.bak`）。

## 三、B 组实际写了什么脚本

```bash
node scripts/extract-codemode.mjs results/sessions-B/<session>.jsonl
```

模型一共写了 6 段脚本：试探 `searchTools` 用法（第一次猜错签名，报错）→ 修正 →
看原始数据 → 解析聚合、用 `store()` 存下结论 → `load()` 出来并发改状态 → 重新拉取逐条对账。

完整输出见 [`examples/arm-b-codemode-scripts.txt`](examples/arm-b-codemode-scripts.txt)。

## 四、审计每一组

```bash
node scripts/check-session.mjs results/sessions-B/<session>.jsonl
```

它会打印：顶层工具调用、**嵌套调用（名字 + 参数）**、token 用量。
B 组应该能看到 3 次 `mcp__billing__list_invoices` 和 9 次 `mcp__billing__set_invoice_status`；
A / C 组则只有 bash 调用，看不到任何 MCP 调用——因为模型把 MCP 客户端写成了脚本，跑在 pi 管辖之外。

## 实测结果（2026-10，模型 deepseek-v4.1-flash，pi 1.3.0）

| 组 | 给模型的工具 | 顶层调用 | 总 token | 结果 | 状态改动落在哪 |
|---|---|---|---|---|---|
| A | bash + read | 38 × bash | 40,933 | 三问全对 | 模型自建的 server 实例，pi 不可见 |
| B | 只有 codemode | 6 × codemode | 7,620 | 三问全对 | pi 的实例，21 次 MCP 调用全部可查 |
| C | bash + read + MCP 工具直接暴露 | 9 × bash | 18,762 | 三问全对 | 模型自建的 server 实例，pi 不可见 |

三组都答对，差别在执行路径：A / C 组模型选择了「自己写 MCP stdio 客户端 + bash 运行」，
所以调用不可审计、状态改动不在会话里；B 组的每次调用都记录在会话记录中。

token 数在不同次运行间会有出入（模型每次的走法略有不同），结构结论不变：
B 组始终比 A 组低一个量级，且只有它把调用留在了 pi 的账本上。

## 目录

```
mcp/server.mjs             MCP server（200 条发票，固定种子，内存态）
mcp/README.md               server 的工具说明
scripts/verify-baseline.mjs 独立复算标准答案（不经过 pi）
scripts/run-arm.sh          跑一组实验（A|B|C）
scripts/run.sh             超时包装（macOS bash 3.2 没有 timeout）
scripts/stats.py           从会话 JSONL 里数工具调用
scripts/check-session.mjs  审计会话：嵌套调用 + token
scripts/extract-codemode.mjs 从会话里导出 codemode 脚本源码
examples/                  实际运行导出的脚本样例
results/                   运行产物（日志、会话记录）
```

## 注意

- server 是内存态、固定种子：每次启动数据一样，改动只在进程存活期间有效。
- 用 `scripts/run.sh` 而不是直接 `timeout`：macOS 自带的 bash 3.2 没有 `timeout` 命令。
- pi 的项目级 `.pi/mcp.json` 需要信任目录才生效，所以脚本写的是全局 `~/.pi/agent/mcp.json`。
