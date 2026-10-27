# 工作台合并与需求审阅

2026-10-27。本地 main 从 df0a987 快进至 89a2d24，合入 origin/claude/claude-code-host-and-workbench 的两个提交。未 push。本地未提交工作已从 stash 恢复；README 冲突保留双方有效说明，stash 留作恢复备份。

## 发现与优先级

| 级别 | 问题与依据 | 处理/建议 |
| --- | --- | --- |
| P1（已修） | adapter.mjs 遍历五 Skill，但仅为四 Skill 定义 docs 映射，读取 undefined.at；原工作台测试 3 项失败，API 返回 500 | 导学标签/文件元数据补齐，未接入产物保持 null；不假称导学展示已完成 |
| P1 | 任一流程结束默认提供工作台尚未接通：五份 SKILL.md 无统一收尾交付动作；research-intent.mjs 只读交接，无可用 URL；打包脚本仅带 research-pack 文件 | 后续接入可验证的当前工作区启动/复用入口；随包提供可选展示资源或明确安装路径；不可只增加一个不存在的 URL |
| P1 | documents.mjs 状态转换误判，实际调用得到 execOf('incomplete')=done、execOf('blocked (not run)')=pending、decisionOf('未授权')=delegated | 修复否定语义、状态优先级和完整词匹配；不能以文案子串推导已授权/已完成。本轮保留作为待修发现 |
| P2 | live.js 的 poll 捕获服务断连后静默保留旧页面，用户不知当前数据已陈旧 | 显示断连/最后成功读取时间，恢复后再消除提示 |
| P2 | adapter 的 DOCS 仅含四种研究文档，RESEARCH-GUIDE.md 未纳入展示与指纹；导学单独完成无法成为可见产物 | 接通导学正文展示；个人练习仍不默认读取 |
| P2 | fingerprint 只跟踪 current、文档、部分 run/journal 和显式 paths，未完整覆盖引用原件/待同步状态变化；无法保证所有变化 5 秒内出现 | 与 readWorkbench 的读取依赖对齐，或定时重新校验；README 不承诺全部变化自动刷新 |

## 与 README / 需求不一致

- README 同时声称“等待新版 UI”与提供工作台启动命令：已改为已合入、默认入口未接通、交互待验收。
- 需求正文仍把导学/答辩写为未纳入，而变更记录写为已实现：已对齐现状。
- 无 Wiki 不能启动仅适用于旧 wiki-reader，新工作台已经支持核心阶段独立展示；两者已区分。
- 下载的独立 ZIP 仍是合并前构建，不包含本次 Claude Code 安装支持或工作台；此次没有重新打包，不能用旧 ZIP 验收合入分支。
- 截图占位继续保留；Team 保持占位。auto-research 未实施。工作台只负责展示，执行仍以文件和 trace 为依据。

## 实测范围

- 首轮工作台 6 项中 3 项失败（五 Skill 映射崩溃）；修复后原测试通过。
- 首轮文件测试 39 项中 1 项失败：合入测试写死四 Skill，而本地已五 Skill；改为分发清单长度并保留逐个检查安装文件。
- 新增核心单阶段测试：仅 TAILOR / DAG / EXPERIMENT-PLAN / STORY-PLAN，无 Wiki 能读取且不写工作区；五 Skill 不再导致崩溃。
- 只读检查真实 C:/Users/ZYF/Downloads/ds-flow-test：Wiki 和四份文档均可读取，投影 19 任务、10 实验计划、1 方案；这是读取成功，不代表内容和研究结论验收通过。
- 未进行浏览器视觉/点击全验收，也没有运行新的科研实验。状态转换错误按原样记录，未放宽断言假称已解决。

后续实施顺序：状态误判 → 默认收尾与分发 → 导学展示及刷新失联提示 → 浏览器联合验收。任一流程部分完成且有产物也应交付展示入口；启动失败提供真实错误与 Markdown 路径，不补跑其他研究阶段。
