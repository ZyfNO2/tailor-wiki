# 四个研究意图入口

这是本地只读路由与当前 Agent 的交接协议，不是总 Skill，不启动模型、实验、Team 或联网，也不注册任何宿主原生命令。四个原 Skill 名继续有效。

| 本地意图 | Skill | 默认边界 |
|---|---|---|
| init / research-init | wiki-maintain | 恢复或整理指定材料；无材料询问目标与联网意愿 |
| tailor | academic-tailor | 直接读取现有论文、代码或目标，交付方案和任务 DAG |
| exp | experiment-design | 设计或分析已有结果；命令本身不构成执行授权 |
| story | research-story | 可直接从方案进入，叙事保持待验证/报告归属 |

宿主 `/init` 可能是内置工程初始化。此分发始终保留其行为；无冲突入口使用本地 `--intent research-init`，或直接调用 `wiki-maintain`。`/tailor`、`/exp`、`/story` 是用户表达的短意图，尚未在活 DSH 菜单注册，不能把本脚本输出称为注册成功。

在解压包目录执行：

```powershell
node research-intent.mjs --workspace "F:\my-project" --intent research-init
node research-intent.mjs --workspace "F:\my-project" --input intent.json
```

`intent.json` 示例（工程格式示意）：

```json
{"intent":"story","goal":"把当前方法设计组织为待验证叙事","paths":["TAILOR.md","EXPERIMENT-PLAN.md"]}
```

当前 Agent 读取返回的 `installedSkill` / `skillContent`、用户目标和材料，再实际使用对应 Skill。无前序 Wiki 或方案不构成全局门禁；缺输入只阻塞依赖它的分支。无材料 init 已有 goal 时不重复问目标；没有明确 `allowInternet:true|false` 时仍询问联网意愿，脚本本身从不联网。

路径只读取已明确指定的目录/文件，另探测工作区根已有的 TAILOR.md、RESEARCH-DAG.md、EXPERIMENT-PLAN.md、STORY-PLAN.md。返回原文、SHA256、文件相对身份及能明确解析的 planId/designId/taskId/runId/researchId/storyId；没有 domain ID 就保留未知，不把文件 hash 冒充实验 Run ID。只读投影不建立第二状态库。JSON 解析失败、超限、路径逃逸会报错；不支持格式、缺文件显式列出，不把它们当空成功。

存在 Wiki 时，通过同目录独立运行助手校验真实 manifest、读取当前提交及恢复 journal。未发布/损坏快照不降级为空。读取路径匹配的来源时保留原 sourceId/revision 与当前字节一致性；实验/叙事默认 Wiki 回流使用运行助手的增量交接，不能据本脚本的发现列表宣称已同步。同步失败只重试维护，不重跑实验。

## DSH 发现的实际限制

已安装 DSH 的 filesystem provider 确认支持项目 `.agents/skills`，而同一项目 `.dsh/skills` 具有更高优先级。它会向上寻找最近 `.git` 作为项目根；在某个 Git 仓库子目录安装后，从子目录启动并不保证扫描该子目录下的 `.agents/skills`。应安装到实际项目根，或由宿主显式配置 customSkillDirs；不要据独立安装器成功推断活宿主发现。

本轮已在隔离项目根使用真实已安装 provider 的 list/get 读到四个 Skill，详见工程验证记录。该调用未启动活 DSH 会话，也未修改用户配置，未验证 slash UI、真实模型运行或权限系统。完整名称调用是跨宿主兼容方式。
