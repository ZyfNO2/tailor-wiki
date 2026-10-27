# Tailor Wiki · Research Skills

基于 [DSH Paper Tailor](https://github.com/ZyfNO2/dsh-paper-tailor) 的科研技能包。给 Agent 一篇论文或一个研究目录，让它整理知识、追查基线与模块、设计实验、组织研究故事，并持续维护 Wiki。

**先用 `/auto-research`，不必记住整套流程。** 五个专业 Skill 也可以独立使用，工作台可选。技能包先更新，DSH 插件随后同步。

**Agent Team — Coming soon.**

[开始使用](#开始使用) · [其他命令](#其他命令) · [工作台截图](#工作台截图) · [验证与限制](#验证与限制)

![研究概览](docs/images/workbench/overview.png)

## 开始使用

### 1. 下载仓库

在 GitHub 点击 **Code → Download ZIP** 并解压，或者：

```powershell
git clone https://github.com/ZyfNO2/tailor-wiki.git
cd tailor-wiki
```

需要 Node.js 24+，以及能读取文件、发现 Skill 并使用工具的 Agent 宿主。联网溯源需要宿主提供可用的搜索或浏览工具；仅下载仓库不会自动注册命令。

### 2. 安装到你的研究工作区

在仓库根目录执行。下面的路径只是示例，替换成自己的研究目录；目录需已存在。

```powershell
# DSH 等读取 .agents/skills 的宿主：安装全部六个 Skill，并附带工作台
node research-pack/install-independent.mjs --workspace "F:/my-research" --write

# Claude Code：改用此命令，安装到 .claude/skills
node research-pack/install-independent.mjs --workspace "F:/my-research" --host claude --write
```

**只想用 Skill，不要工作台：** 在对应命令末尾加 `--no-workbench`。研究、Wiki、DAG 自检照常运行，成果直接以 Markdown/Mermaid 交付，不启动网页或自动补装 UI。

安装器不覆盖已有同名 Skill；升级前保存本地修改，或先用新的测试工作区。不要对同一目录连续运行上述两种安装示例。安装后在研究工作区打开或新建 Agent 会话。

### 3. 给资料，开 auto

把论文放进工作区，或在对话中提供文件路径：

```text
/auto-research materials/论文.pdf
```

也可以让它继续已有研究：

```text
/auto-research 继续当前工作区
```

Agent 默认会：

- 盘点当前范围的材料，读取论文、核对图表和引用，建立或增量维护 Wiki。
- 对毕业论文按多项研究工作拆解，追查基线、模块原论文与官方代码，区分前人成果、原作者改动和本轮建议。
- 围绕真实问题提出可检验方案，分别生成方法数据流与研究任务 DAG，并检查依赖。
- 优先分析已有结果，安排必要对比和消融，讲清“为什么做、什么问题、怎么解决、证据支持什么”。
- 把新材料与实验/故事产物回流 Wiki；安装了工作台时交付可用地址，否则直接给文件。

**默认允许检索公开资料。** 普通步骤不逐项询问；有重大方向选择时集中讨论，说“放手／你决定”可授权研究分支代选。未具体授权的高风险操作仍需确认。只需说明例外，例如“不要联网”“不要运行实验”或“不用工作台”。无数据或无法联网时应记录缺口，不编造研究结果。

正式命令是 **`/auto-research`**，不是 `/auto`。宿主未发现斜杠命令时，可直接说：“读取本工作区 auto-research 的 SKILL.md，并按它推进这些材料。”宿主发现说明见 [ENTRYPOINTS.md](research-pack/ENTRYPOINTS.md)。

## 其他命令

无需先跑 auto，也不必按表格顺序使用。表中的完整名称用于支持 Skill 命令的宿主；不支持时直接说“用该 Skill 完成……”。

| 命令 | 什么时候用 | 主要产物 |
| --- | --- | --- |
| `/wiki-maintain` | 整理论文、补材料、更新旧 Wiki、检查引用 | `wiki/INDEX.md`、知识页、覆盖与问题记录 |
| `/academic-tailor` | 拆解 A+b+c、追查来源、提出组合和研究路线 | `TAILOR.md`、`RESEARCH-DAG.md` |
| `/experiment-design` | 设计对比/消融、预算，分析已有结果和失败 | `EXPERIMENT-PLAN.md`、结果复盘 |
| `/research-story` | 从现有证据组织简短故事、贡献与局限 | `STORY-PLAN.md` |
| `/research-guide` | 阅读论文/代码、讲解、理解题和复练 | `RESEARCH-GUIDE.md` |

```text
/wiki-maintain 更新 materials/ 中新增的资料
/academic-tailor 比较这两种基线，先给可验证方案
/experiment-design 分析 runs/ 的结果并安排最小消融
/research-story 根据已有实验整理组会主线
/research-guide 帮我理解这篇论文的核心方法
```

`/tailor`、`/exp`、`/story`、`/guide` 是本包支持的短意图，但不保证宿主菜单已注册。不要用 `/init` 替代 Wiki 命令：它可能是宿主自己的工程初始化命令。

## 工作台怎么打开

未手动选择主题时默认浅色；点击右上角“深浅”切换后会记住选择，不随系统自动切换。

通常由 Skill 收尾交付地址，也可以在研究工作区手动打开：

```powershell
# .agents 安装方式
node .agents/workbench/open.mjs --workspace .

# Claude Code 安装方式
node .claude/workbench/open.mjs --workspace .
```

按自己的安装方式选一条。要展示额外运行记录或复盘报告，加 `--paths runs,reports`（替换为实际目录）。使用命令返回的地址，不假定端口始终相同。

纯 Skill 模式无需这些命令。需要临时查看时，也可从源码仓库执行：

```powershell
npm run workbench:open -- --workspace "F:/my-research"
```

工作台无需构建前端。它读取已有产物，尚无内容的分区会显示空状态；不要把双击 HTML 出现的原型数据当作研究结果。详细职责见 [产品需求](docs/PRODUCT-REQUIREMENTS.md)。

## 工作台截图

以下为学位论文试跑工作区的真实界面，截图时隐藏了本机路径并将工作区名称替换为“论文研究示例”，未修改科研数据。示例包含未完成材料、待运行实验和阻塞项；截图不是实验有效性证明。论文原件与完整试跑目录不随这些截图上传。

### 知识库阅读

左侧按主题找页面，正文与原文引用分开阅读；长 ID 与中文标题分行显示。

![Wiki 阅读与原文引用](docs/images/workbench/wiki.png)

<details>
<summary>知识图谱、问题、覆盖与来源</summary>

知识图谱展示已登记的知识关系。

![知识图谱](docs/images/workbench/graph.png)

问题页面保留冲突、缺证据事项及其影响范围。

![问题列表](docs/images/workbench/issues.png)

覆盖页区分扫描、已读和排除项；不把未读材料藏起来。

![材料覆盖](docs/images/workbench/coverage.png)

来源页面可核对文件、版本与定位。

![来源列表](docs/images/workbench/sources.png)

</details>

### Wiki 增量维护：从论文引用到原论文核对

这个示例没有重新生成整库。继首次整理后，Agent 补充了 Harris、Lowe、Zhang 三篇原论文资料，新增三篇来源页与一篇基线/模块核对页，Wiki 从此前截图中的 **15 页增长到 19 页**。原有十个论文主题页仍保持 v1；裁缝方案与核对页按新增证据更新。

核对页从 v1 到 v2 保留了可读差异：补充阅读范围和实现细节，同时保留未获取的文献与未完成的验证。版本记录中“全文已读”是本次 Agent 的阅读记录，不等于公式已复算或实验已复现。

![增量后的原论文核对页与新增来源](docs/images/workbench/wiki-incremental.png)

![Wiki 增量更新的版本差异](docs/images/workbench/wiki-incremental-diff.png)

新材料、实验计划和研究故事都可以按同样规则回流 Wiki；未变化的页面复用，失败或待核对项继续保留。截图拍摄于 2026-10-28，其他界面截图来自此前同一工作区的状态，因此页面数量可能不同。

### 研究方案与 DAG

查看推荐组合、证据和缺口；DAG 展示研究任务的前置依赖，与算法模块图分开。

![研究方案](docs/images/workbench/schemes.png)

![研究任务 DAG](docs/images/workbench/dag.png)

### 实验计划

把验证问题、预算、判据与阻塞原因放在一起。此示例尚未执行实验。

![实验计划](docs/images/workbench/experiments.png)

<details>
<summary>运行记录、对比审查与实验复盘（本示例的真实空状态）</summary>

没有运行结果时不补成绩，没有复盘时不编经验。

![运行记录](docs/images/workbench/runs.png)

![对比与审查](docs/images/workbench/review.png)

![实验复盘](docs/images/workbench/retro.png)

</details>

### 研究故事

先读简短主线，再核对贡献、证据性质、补证事项和禁用表述。

![研究叙事](docs/images/workbench/story.png)

### 研究导学

查看阅读路线和待回答问题，讲解与练习在 Agent 对话中继续。

![研究导学](docs/images/workbench/guide.png)

<details>
<summary>任务列表、看板与 Agent Team — Coming soon</summary>

**Agent Team — Coming soon.** 任务列表与看板已经可用；成员协作与调度尚未提供，页面不会编造正在工作的成员。

![任务列表](docs/images/workbench/tasks.png)

![任务看板](docs/images/workbench/board.png)

![Team 占位](docs/images/workbench/team.png)

</details>

## 验证与限制

- 五个专业 Skill 与 auto 路由可独立安装，工作台可选；PDF 解析/OCR、公开检索及实验执行取决于宿主工具与实际环境。
- Wiki 和故事保留来源性质及未核验项；文档完成、运行完成和研究假设获支持分别记录。
- 当前仍有已知待修项：部分嵌套实验记录识别、部分状态文案、全空 PDF 侧车检查。不能把界面空值直接解释为没有对应材料。
- 当前 auto 与 UI 更新通过仓库源码提供，请按上面的下载和安装步骤使用。`releases/independent-skills.zip` 是旧包，尚未同步本轮更新，不代表当前源码。
- [工程验证](docs/VERIFICATION.md) · [auto 发布验收](docs/AUTO-RESEARCH-RELEASE-CHECK.md) · [交接记录](docs/HANDOFF.md)。工程测试不代替模型真实流程与科研结论验证。

开发者在仓库根目录运行：

```powershell
npm ci --ignore-scripts
npm test
npm run test:workbench
```

## 项目结构与来源

| 目录 | 内容 |
| --- | --- |
| `research-pack/trial-skills/` | 六个 Skill、来源说明与文件运行助手 |
| `research-pack/install-independent.mjs` | 安装器，支持纯 Skill 模式 |
| `apps/workbench/` | 当前研究工作台 |
| `apps/wiki-reader/` | WeKnora 组件剪枝形成的旧 Wiki reader |
| `docs/` | 协作需求、验收记录与截图 |

本项目基于 [DSH Paper Tailor](https://github.com/ZyfNO2/dsh-paper-tailor)；Wiki 机制及旧 reader 参考 [WeKnora](https://github.com/Tencent/WeKnora)。当前工作台不冒称全部来自 WeKnora 原前端。原组件来源与许可见 [reader 说明](apps/wiki-reader/README.md)，各 Skill 的方法来源保留在各自 `references/` 中。

论文检索允许摘要替代：遇到付费墙、拿不到全文时，可使用实际论文摘要继续整理和候选筛选，明确标注“仅摘要已读／全文未获取”；不据此编造方法实现或实验细节，也不要求用户购买全文。
