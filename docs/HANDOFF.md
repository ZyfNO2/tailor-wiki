# Skill 与工作台完善交接

更新日期：2026-10-27。接手入口：先读本文，再读 [产品需求](PRODUCT-REQUIREMENTS.md)、[工作台合并审阅](WORKBENCH-MERGE-REVIEW.md)。下列三批待办已在分支 `claude/handoff-fixes` 实施，逐项结果、代码位置与未验证项见文末[实施结果](#实施结果2026-10-27)。**Ch3 真实回归未做**：本机找不到该工作区。

## 当前基线与边界

- 已合入 `claude/claude-code-host-and-workbench`，基线提交 `89a2d24`。有五个独立 Skill：wiki-maintain、academic-tailor、experiment-design、research-story、research-guide；软依赖，不强制串行。
- 已完成目标缺口分析、导学、可选答辩、多种叙事表达、实验复盘、进度回顾的 Skill 指令及导学安装/路由支持。已修复五 Skill 导致工作台读取 undefined.at 的崩溃。
- 工作台只给人看，展示 Wiki、研究编排和实验等文件。文件、实验产物和 trace 是事实源；不增加 UI 执行、审批、调度或另一套状态库。
- 研究叙事已有页面，结构化展示不完整；导学只有安装元数据，尚未完整接入展示。Team 继续占位，auto-research 不在本次交接实施范围。
- 实验、叙事之后默认增量回流 Wiki。学习者答案和模拟答辩记录不默认作为科研证据或 Wiki 输入。
- 不修改用户论文正文、公式和结论；需另行提出方案并确认。不要为测试插件重跑科研实验。

## Ch3 用户试跑证据

以下来自用户报告，交接作者未重新访问该工作区或复验这些计数。工作区给出的是相对路径 `_workspace/ch3-wiki-trial-20261027`，接手时先确认绝对位置；截图在其 `_handoff/screens/`。服务报告地址为 http://127.0.0.1:8772 ，使用前验证工作区绑定及服务是否仍在线。

- 输入：6 篇论文、2 份章节草稿、21 份 FFS 实验产物。
- 22 个 Wiki 页均 reviewed，20 个 DAG 任务，9 个实验计划（2 BLOCKED，本轮未执行），11 步导学路线及待回答题，5 项叙事贡献。
- 用户报告产物回流、幂等、材料变化和回滚测试通过；七个工作台视图已渲染。
- 最终快照简称 `commit-2246a0b8`，41 条来源语境、9 次提交、4 条 open issue。不要从简称猜完整提交 ID。
- 曾有两个主张误作为 DAG 依赖端点，用户已修正，dagMissing=0；曾两次全量重写无关 sourceContexts，已回滚重做。
- 报告末尾另有“工作台没覆盖”的旧段落，与前面的已补测记录冲突：以已补测描述作为最新用户报告，但不要据此声称本次独立复验通过。短命令注册仍无验收证据。

## 第一批：工具与状态正确性

| 编号 | 位置／现状 | 实施要求与验收 |
| --- | --- | --- |
| B1 | wiki-maintain/scripts/wiki.mjs 的 source() 在 extraction 分支前 bounded 默认 4 MiB | 分开 PDF 原件与文本限额。侧车模式可对大 PDF 计算哈希并校验 sourceSha256，不必全量载入 PDF 解析；保留文本/侧车限制和明确报错。测试 >4 MiB 原件+有效侧车成功、哈希不符失败、文本超限失败；不得截断或绕过来源校验。 |
| B3 | page-model.mjs sourceContexts() 按 sourceId 替换整条记录；RUNTIME 仅写增量数组，容易误解 | 明确省略的来源保持原样，提交的每条记录整体替换、不是字段合并；只提交本轮实际核读且需要更新的来源。新增局部更新样例、提交前变更范围提示。测单来源更新不改变无关语境/页面复核、相关页复核按真实变化失效；不得阻止用户明确授权的全量维护。 |
| W1 | documents.mjs verdictOf()/parseStory() 将证据性质混入支持状态 | 分离 provenance（报告记载、已核验原始结果文件、本轮实际运行、模拟、假设）与 verdict（支持、不足、反驳、待核实等），保留原始文字。运行过不等于支持主张，模拟不等于真实实验。当前“假设”已映射 pending，并非全部词都不识别。测五类来源性质、支持状态、缺失/未知输入和 UI 标签。 |
| S1 | execOf/decisionOf 有子串及优先级错误 | 修复 incomplete→done、blocked (not run)→pending、未授权→delegated。否定与阻塞优先，未知保留未知，不凭推断标记授权。补中英文回归。 |

## 第二批：解析、计数及 DAG 自检

| 编号 | 问题 | 实施与验收 |
| --- | --- | --- |
| W2 | parseStory gaps/weak 只提取列表 | 支持表格和列表、禁用表述等标题；相同内容输出一致且不重复。缺失与无法识别要区分，保留正文，不把解析失败展示成 0 个缺口。 |
| W3 | research-intent typeOf 按文件名分类；adapter 只接特定类型 | 在用户指定扫描范围内按内容结构识别运行集合，例如 validation_summaries_val.json 的 runs；验证记录结构，保留文件/条目定位，不将任意 JSON 当运行。用户报告该文件有17条记录，真实回归时核对；历史记录不能标本轮运行。 |
| W4 | 概览 coverageTotal 显示为登记来源 | 拆开扫描文件、登记来源、排除项、不可用项；概览/来源列表/筛选计数一致。用户案例54扫描项、41登记来源、13排除项，实测核对后再断言。 |
| D1 | DAG 任务与主张混用，曾靠 UI 才发现 | Skill 交付前检查 ID 唯一、端点存在、自依赖、环；明确任务依赖与贡献/主张关联。给出文件位置和诊断，不静默删边，不强迫用户把主张变成任务。保留 UI 诊断。 |

## 第三批：工作台展示与默认交付

| 展示位置 | 要补充的内容 |
| --- | --- |
| 研究叙事 | 为什么做→什么问题→如何解决→数据支持什么；贡献—证据表、补证事项、禁用表述；按需已生成的组会稿/开题摘要，不凭空生成。 |
| 新研究导学页 | RESEARCH-GUIDE.md 正文、学习目标、阅读路线、论文/代码定位、每步理解目标、当前待答题；个人回答/反馈仅显式提供时展示。对话交互仍在 Agent 中。 |
| 实验页 | 复盘：尝试、实际运行、失败、观察、解释边界、下一步；区分阻塞、未执行、历史与本轮结果。 |
| 概览／任务 | 已交付、受阻、待验证、下一步、Wiki 回流状态。 |
| 研究方案 | 目标对齐以及表达、证据、实验、方法缺口，关联已有材料。 |

默认收尾：任一 Skill 独立或部分完成且有产物时，交付该工作区可用工作台。验证服务工作区绑定后再复用；不能因为端口已占用就返回别的项目。启动失败保留真实错误，交付实际 Markdown，不补跑其他阶段、不返回未经验证 URL。无 Wiki、仅故事、仅导学也须可展示。

同步修复 live.js 断连静默及 fingerprint 读取依赖遗漏：展示最后成功读取时间、过期/失联提示；新增文档和实际读取的来源/待回流状态变化可被发现。不要承诺未测试的实时性。

## 接手、验证与分发

1. 安装依赖 `npm ci --ignore-scripts`；运行 `npm test`、`npm run test:workbench`。现有工程测试不覆盖上述所有问题，先补针对性失败用例再修。
2. 从源码安装到全新试验工作区：`node research-pack/install-independent.mjs --workspace <绝对路径> --host claude --write`。其他默认宿主省略 host；不要覆盖用户修改过的已安装 Skill。
3. 启动 `npm run workbench -- --workspace <绝对路径>`；运行资料按实际目录加 `--paths`。浏览器测试上述标签、表格、计数、导学、单阶段页面、断连恢复及链接，确认只读不改源文件。
4. 用 Ch3 工作区的副本回归，不依赖压缩 PDF 绕过 B1；保留原件和用户已修结果。工作区不能取得时使用可复现 fixture，并明确真实回归未做。
5. 同步 Skill、RUNTIME、需求与展示行为。README 保持产品介绍及真实能力，不写版本号营销标题；工作台职责边界写在 docs。
6. 本次不上传本地旧生成包：它们是合并前构建。`releases/independent-skills.zip` 及对应目录仍是本地旧产物；README 已改为源码安装，避免未发布的下载链接。接手完成后按当前源码重新打包并做正式包安装验收；不要分发旧包或带编号旧副本。

本次提交前重新运行：`npm test` 39/39 通过，`npm run test:workbench` 7/7 通过，`git diff --check` 通过。这些是现有基线测试结果，不代表上述待办已解决；本次未做浏览器回归。

本次交接未实现以上修复、不声称 Ch3 真实回归通过。先完成第一批，再完成解析与展示，最后统一浏览器验收和打包。

## 研究内容单独处理

用户报告细化迭代、3090 时延、参数量、主干结构名称存在草稿/论文/实验差异；CVA-Net 与本地 CVCL 应区分。保留为待核对问题，不把跨分辨率时延或不同表参数直接判定等价，也不在插件修复中替用户改论文结论。

## 实施结果（2026-10-27）

分支 `claude/handoff-fixes`，基于 b326da5；三批各一个提交（99cc47c、dd10fa0、46d3905），文档与正式包另行提交。仓库里没有 AGENTS.md，按本文与需求文档执行。

| 编号 | 结果 | 代码位置 | 验证 |
| --- | --- | --- | --- |
| B1 | PDF 原件流式计算哈希（上限 1 GiB），侧车单独限 8 MiB、文本 4 MiB、pdf.js 解析 64 MiB；sourceSha256 不符或页为空即失败，不截断、不绕过校验 | wiki-maintain/scripts/wiki.mjs（LIMITS、streamDigest、digestSource、source） | tests/file-wiki/pdf-sidecar.spec.mjs |
| B3 | sourceContexts 省略的来源保持原样，列出的整条替换；改写本轮 prepare 范围外的语境会被 CONTEXT_SCOPE 拒绝，需在 contextUpdate 写明来源（或 all）与理由；dryRun 预览变更及会失效的复核页 | wiki.mjs（apply、checkContextScope）、page-model.mjs（contextChanges）、RUNTIME.md、SKILL.md | tests/file-wiki/source-contexts.spec.mjs |
| W1 | 证据性质（报告记载、已核验结果文件、本轮运行、模拟、假设）与支持状态分列，均保留原文 | apps/workbench/lib/documents.mjs（provenanceOf、verdictOf）、views/story.js | documents.spec.mjs |
| S1 | 否定与阻塞优先：incomplete、blocked (not run)、未授权 等不再误判，识别不了保持未知 | documents.mjs（execOf、decisionOf） | documents.spec.mjs 中英文回归 |
| W2 | 补证事项、禁用表述从表格或列表读取并去重；无法识别显示原文，不计为 0 | documents.mjs（sectionItems、parseStory） | documents.spec.mjs |
| W3 | 按结构识别运行集合，保留文件与 JSON 指针；性质只取记录或文件写明的 | research-pack/research-intent.mjs（runCollection 等）、adapter.mjs（runsOf） | intake.spec.mjs；Ch3 的 17 条未实测 |
| W4 | 扫描项、登记来源、排除项、不可用项分开计数，概览、覆盖、来源列表一致并可筛选 | apps/workbench/lib/wiki.mjs（counts）、derive.js、knowledge.js、overview.js | intake.spec.mjs；54/41/13 未实测 |
| D1 | academic-tailor 交付前自检：重复 ID、端点、自依赖、环、主张作依赖、占位行、计划依赖执行自身的任务，给出文件:行；工作台把主张关联与占位行分开列出 | academic-tailor/scripts/check-dag.mjs、SKILL.md、views/dagview.js | tests/file-wiki/check-dag.spec.mjs；ds-flow-test 只读复现 |
| 研究叙事 | 开篇四段（为什么做 → 遇到什么问题 → 怎样解决 → 数据支持什么），贡献—证据表、补证事项、禁用表述；文件已有组会提纲或开题摘要时才列出 | documents.mjs（storyOpening、storyFormats）、views/story.js | documents.spec、delivery.spec、浏览器 |
| 研究导学 | 新页面：学习目标、阅读范围、路线表、待答题；RESEARCH-PRACTICE.md 只在 --paths 明确提供时显示 | documents.mjs（parseGuide）、views/guide.js | delivery.spec、浏览器 |
| 实验复盘 | 复盘标签，五项分列；受阻、未执行、本轮、历史、模拟分开计数 | documents.mjs（parseRetro）、views/experiments.js | delivery.spec、浏览器 |
| 概览／任务 | 已交付、受阻、待验证、下一步（有进度回顾时“下一步”取其原文）；Wiki 回流按内容哈希比对 | adapter.mjs（progress、wikiFeedback）、ui.js（ui.progress）、overview.js、tasks.js | delivery.spec、浏览器 |
| 研究方案 | 目标对齐表：表达、证据、实验、方法缺口与关联材料 | documents.mjs（alignment）、views/schemes.js | delivery.spec、浏览器 |
| 默认收尾 | open.mjs 用 /api/identity 核对工作区与 --paths 后才复用；被其他程序或项目占用的端口跳过；后台启动并核对后才输出地址；失败给真实错误与 Markdown 路径。安装器默认装到 `<宿主目录>/workbench`，`--no-workbench` 跳过；五个 SKILL.md 增加“交付展示” | apps/workbench/open.mjs、server.mjs、lib/pack.mjs、research-pack/install-independent.mjs、scripts/build-independent-skills.mjs | launch.spec.mjs、distribution.spec、浏览器 |
| 刷新与断连 | 顶栏显示最后检查时间；服务失联、长时间未检查成功、同一地址换了工作区均有横幅；指纹覆盖导学、运行事件和登记来源原件 | live.js、adapter.mjs（fingerprint）、wiki.mjs（drift） | delivery.spec、浏览器断连与恢复 |

工程测试与浏览器验收的具体结果见 [工程验证记录](VERIFICATION.md)。验收中发现窄屏表格挤压、复盘把未运行的本轮记录计入执行两处问题，已在 5ea2ef2 修复。open.mjs 会在后台留下服务，6d30ad6 让服务拒绝非回环 Host（防 DNS 重绑定）。正式包 `releases/independent-skills.zip` 由 6d30ad6 重新构建，旧的带编号 ZIP 已删除，清单与哈希见 releases/CONTENTS.json。

### 未验证项与复现方式

- **Ch3 真实回归未做**：本机没有 `_workspace/ch3-wiki-trial-20261027`。W3 的 17 条记录、W4 的 54/41/13 计数、B1 的真实大 PDF 侧车只有 fixture 验证。复现：在 Ch3 工作区副本运行 `npm run workbench:open -- --workspace <副本> --paths <运行记录目录>`，核对来源计数与运行条目；对原始大 PDF 及其侧车运行 wiki-maintain 的 prepare/apply，确认哈希校验与侧车限额。
- 已用 ds-flow-test 的副本做只读回归与浏览器检查；它是 DSH 试跑产物，不含 Ch3 的实验记录。
- 活宿主（Claude Code、DSH）里由 Skill 自动执行“交付展示”未实测；launcher 本身已用测试和真实启动验证。
- 研究内容差异（细化迭代、3090 时延、参数量、主干名称、CVA-Net 与 CVCL）仍按上节单独处理，未改论文或结论。
