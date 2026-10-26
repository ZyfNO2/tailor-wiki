# Tailor Wiki

四个独立科研 Skill 与文件驱动 Wiki：材料整理、方法裁缝、实验设计、研究叙事。技能包优先更新，DSH 插件随后独立同步；没有总 Skill，Team 仍为后续占位。

- [完整技能包说明](research-pack/README.md)
- [下载 v7 独立技能包](releases/independent-skills-2026-10-26-v7-engineering.zip)
- [本地短意图与宿主发现边界](research-pack/ENTRYPOINTS.md)
- [Wiki 文件协议](research-pack/trial-skills/wiki-maintain/RUNTIME.md)
- [原 WeKnora Vue/TDesign 只读 reader](apps/wiki-reader/README.md)
- [验证记录与边界](docs/VERIFICATION.md)

## 安装技能包

需要 Node.js 24+。解压下载包，在包目录执行；目标研究工作区应已存在：

```powershell
node install-independent.mjs --workspace "F:\my-research"
node install-independent.mjs --workspace "F:\my-research" --write
```

安装到 `.agents/skills/`，不覆盖已有同名目录，不写凭据。可直接使用完整 Skill 名；短意图不意味着宿主已注册 slash 命令，内置 `/init` 保留。

Claude Code 读取项目 `.claude/skills/`，加 `--host claude`：

```powershell
node install-independent.mjs --workspace "F:\my-research" --host claude --write
```

详见 [Claude Code 入口说明](research-pack/ENTRYPOINTS.md#claude-code)。

## 源码验证与 reader

```powershell
npm ci
npm test
npm --prefix apps/wiki-reader ci
npm run test:reader
npm run build:reader
node apps/wiki-reader/server.mjs --workspace "F:\my-research" --port 8771
```

reader 读取你已发布的 Wiki 快照；无快照、manifest 损坏或来源缺失会明确报错，不展示伪造样例。科研原件、实际试跑数据、模型凭据不随仓库分发。实验计划不等于执行授权，叙事不作独立科研证据。

原 WK 组件的固定版本、原文件、裁剪 diff 与许可证保留在 reader 目录。知识图谱与 DAG 白板见下方只读工作台；Team 调度不在此版本交付范围。

## 只读研究工作台

`apps/workbench` 把工作区里已有的文件做成只读展示：Wiki 已发布快照（经运行助手校验）、TAILOR.md、RESEARCH-DAG.md、EXPERIMENT-PLAN.md、STORY-PLAN.md，以及用 `--paths` 指定的运行记录。

```powershell
npm run workbench -- --workspace "F:\my-research" --paths runs
```

浏览器打开 http://127.0.0.1:8772。服务只接受 GET，只返回工作台自己的页面文件，不提供工作区文件；它不拿写锁、不写任何文件，所以四个 Skill 运行时它照常可开，关掉它也不影响 Skill。文件变化后页面约 5 秒内自动更新。表格只取各 Skill 规定的列，状态只认文件中写明的字段，识别不了的按原文显示，不推断。直接双击 `apps/workbench/web/index.html` 显示示例数据（设计原型）。测试：`npm run test:workbench`。
