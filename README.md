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

原 WK 组件的固定版本、原文件、裁剪 diff 与许可证保留在 reader 目录。图谱、完整 DAG 白板及 Team 调度不在此版本交付范围。
