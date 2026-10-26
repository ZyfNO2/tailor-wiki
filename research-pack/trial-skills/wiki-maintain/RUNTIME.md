# 文件 Wiki 运行说明

这是已实现的独立文件入口。Agent 读取本说明后调用；用户通常只需说“整理指定材料，之后只更新变化部分”。需要 Node.js 24+，不需要 Core、浏览器、数据库或模型客户端。语义判断由当前 Agent 完成，工具只验证文件、定位和提交。

## 安装与发现

解压正式独立包，在包目录执行一次预览；加 `--write` 才安装：

```powershell
node install-independent.mjs --workspace "F:\my-project"
node install-independent.mjs --workspace "F:\my-project" --write
```

默认安装 wiki-maintain、academic-tailor、experiment-design、research-story；只装一个时加 `--skill wiki-maintain`。四者独立，research-story 只把有证据的创新主张整理为叙事方案，不直接改论文正文。写到工作区 `.agents/skills/`，不改全局配置或 MCP，不覆盖任何已存在目录。Claude Code 读取项目 `.claude/skills/`，安装时加 `--host claude`，只写该目录，不改 `.claude/settings*.json`。部分安装失败保留 staging 和 install-receipt.json；先按回执核对已安装项，不盲目重装。宿主能否自动发现、是否显示 slash 命令需要实际宿主验证。

Wiki 运行脚本为本 Skill 内的 [scripts/wiki.mjs](scripts/wiki.mjs)。从源码、解压包和已安装目录均可运行。

## Agent 内部操作

v7 新增指定范围覆盖与产物回流。仍由实际 Agent 读来源、编译正文并复核；脚本不会把实验/叙事模板拼成 Wiki，也不会调用模型或执行实验。

下列 `WIKI_SCRIPT` 代表该脚本的实际绝对路径；PowerShell 中可将它赋给 `$wikiScript`。`--workspace` 始终明确命名用户批准的文件工作区，不指向旧 Core 内部目录。JSON 交接文件可放在工作区或另一个明确的任务目录；源文件只能来自 workspace 内。

```powershell
$wikiScript = "F:\my-project\.agents\skills\wiki-maintain\scripts\wiki.mjs"  # Claude Code 安装：.claude\skills\...
node $wikiScript prepare --workspace "F:\my-project" --input prepare.json
node $wikiScript apply --workspace "F:\my-project" --input draft.json
node $wikiScript status --workspace "F:\my-project"
```

这几个操作是 Agent 内部工具协议，不要求用户逐项敲命令，不新建一排 slash 入口。`status` 包含完整已登记文本，可按实际规模读取；单次扫描上限 256 个文件、单文件 4 MiB、来源历史合计 16 MiB，超限失败，绝不静默截断。

### prepare.json

```json
{"paths":["materials","experiments/metrics.json"]}
```

仅扫描指定路径。支持 UTF-8 Markdown、TXT、JSON、PDF。跳过 wiki 输出、.wiki、.git、.agents、.claude、旧 Core 目录、依赖、构建和常见凭证文件名。拒绝路径逃逸、符号链接和 junction；整个流程不执行来源中的命令。不存在的指定文件记暂时不可访问，局部扫描不推断其他文件被删除。

prepare 输出及 `.wiki/runs/<runId>/prepared.json` 包含：

- `runId`、`baseCommitId`、`scan`：本次身份、起读提交、扫描范围。
- `sources`：稳定 sourceId、当前 path/status、保留原文的 versions；每版包含 revision、sha256、text、parser 和 PDF 页码映射。
- `changedSourceIds`、`affectedPageIds`、`pages`：变化来源、受影响页和旧页上下文。
- `currentMetadata`：既有来源语境、结构化问题和领域导读；不能只读页面列表就覆盖这些信息。

prepared.json 是只读交接，不编辑它；内容和 SHA-256 封条在 apply 再检查。候选、引用和更新可以由 Agent 分阶段另存自己的 JSON/Markdown，最终汇成 draft.json。重复扫描不增加来源版本；文件身份和内容版本分开。

### 指定范围覆盖对账（v7）

用户给整个目录时传入：`{"paths":["materials"],"requestScope":{"mode":"full","paths":["materials"]}}`。full 要求实际扫描范围与请求相同；不能偷偷只选一个文件。仅用户明确选择子集/分批时使用 `mode:subset`，requestScope.paths 仍保留原范围，paths 指本轮读取子集。请求范围先盘点，扫描子集外的文件不会被当作已读；apply 前再核对请求清单，期间增加/移除文件即拒绝旧草稿。

scan.inventory 保留 supported/unsupported/excluded/missing，不支持格式不从分母消失；安全排除的目录记录其根及“子树未检查”，不会深入凭证/依赖/输出。单次支持文件最多256，盘点最多4096项，超过明确失败，不截断。源解析/权限/空文失败保留 failed trace 及 paths/requestScope；该 prepare 未成功，不能报已覆盖。

apply 必须提供 `coverageDecisions`。完整阅读项示例：

```json
{"path":"materials/a.md","status":"read","sourceId":"实际source-id","revision":1,"sha256":"实际原文件hash","reason":"已完整阅读；列明实际边界","readRanges":[{"startByte":0,"endByte":1234}]}
```

readRanges 指解析文本 UTF-8 半开字节区间，可连续分块，但不得有洞、漏尾或中文半字符。只有 source 当前available、实际扫描、ID/revision/hash完全匹配才接受。字节范围仍是 Agent 阅读声明，不是程序证明Agent理解了内容。未读保留 unread，部分阅读用 partial 并给 reason/readRanges；排除支持材料也须明确给 excluded 和理由。源解析不等于 Agent 阅读。

未变复用用 `status:reuse`，同样给ID/revision/hash；仅此前有同版本完整read记录才接受，来源变更不能复用旧证明。readReceipts 与同一快照保存，跨子集维护保留其他来源证明；复用原记录不改时间/commit，实际本轮复用决定在draft/trace可查，不导致无变化版本漂移。覆盖状态以 `coverageStatus` 单独展示请求mode/paths/逐文件状态/原因，未读、不支持、missing或partial使coverage与completion保持partial。read未形成页面时仍需sourceDispositions解释。

旧调用未给requestScope时保持兼容，但coverageStatus为not-audited，不允许据旧completion推断“整个目录已完成”。新自然语言整理应使用明确requestScope。结构覆盖、页面证据支持、科研真实性是三种判断。

同一快照的coverageRequests保留各个已声明范围的覆盖账单；后续单文件feedback不能覆盖掉旧目录的未读待办。coverageStatus.latestStatus只指本轮范围，status与outstandingRequests反映未清偿范围；需重新对原范围完成对账才能清偿，不能以换一个更小范围“完成”。

### 实验/故事产物增量回流（v7）

实际文件保存后，由当前Agent调用同一个wiki助手：

```powershell
node $wikiScript feedback --workspace "F:\my-project" --input feedback.json
```

```json
{"artifacts":[{"path":"STORY-PLAN.md","artifactId":"story-existing-id","kind":"story","relatedIds":["plan-existing-id","task-existing-id"]}]}
```

只允许明确文件路径及 kind：tailor/dag/experiment-plan/run/result/review/story/task/maintenance。沿用实际产物ID、方案/任务/Run关联，缺失就由当前任务确定稳定产物ID，不把路径hash冒充领域Run ID。来源仍按既有path→sourceId版本规则识别；artifactId不能静默换路径，同一路径也不能改artifactId。重命名先用prepare.renames明确处理。story元数据固定标记narrative-not-independent-scientific-evidence；计划标design-not-execution；result/run也仍须核对其实际证据性质，标签不授予真实实验身份。

feedback 读取实际字节、比较当前源版本，只产生 .wiki/runs 中sealed prepared交接与awaiting-agent。Agent须读变化及旧页，提交正常content/summary/evidence/sourceContexts/review与coverageDecisions。它不是另一套状态库；主状态仍是不可变快照，待同步从已有run trace推导。pendingFeedback在status可查。

同一批次拒绝重复规范化路径绑定不同artifactId；写锁冲突也在现有run trace保留待同步产物请求，错误不因拿不到锁而消失。

相同版本已待同步时返回同一handoff；同一身份、相同字节、已有匹配read证明和当前页引用时直接unchanged。合并失败保留原稿/首错，解析阶段失败也保留失败请求；重试只针对这些产物，不重跑实验。过期handoff需重新feedback，旧失败标superseded并保留，不能假装没失败。仅写入文件但没有读完/关联的partial提交不会清除pending。真正apply/recover后满足阅读和当前映射（或有理由no-wiki-needed）才记synced。产物提交、Wiki同步、语义复核及研究判断分别报告；不递归启动研究流程。此入口不在后台监控，也不拦截任意宿主保存事件；Agent在实验/故事保存后需显式执行一次调用。

**重命名**须明确给映射，例如 `"renames":[{"sourceId":"source-已有ID","path":"materials/new-name.md"}]`；旧路径必须已不存在，新路径必须在本次扫描里。仅凭相同 hash 不自动认定身份。复制相同内容会登记独立文件身份，但不构成独立科研证据；Agent 不得双算。

**撤回**用 `"withdrawals":["source-已有ID"]`。撤回与暂时不可访问分开，重复扫描不会自动解除撤回；首版不提供恢复授权操作，需明确后续流程。历史和仍有独立依据的事实都保留，受影响引用显示待核实。

**PDF**复用现有 `RESEARCH_PDFJS_MODULE` 绝对模块路径配置，解析全物理页；未配置就登记 unparsed，不能据文件名补内容。也可提供 `"extractions":[{"path":"materials/paper.pdf","textPath":"paper-pages.json"}]`。提取文件示例：

```json
{"sourceSha256":"PDF原件的SHA256","pages":[{"page":1,"text":"第一页实际提取文本"},{"page":2,"text":"第二页实际提取文本"}]}
```

页码必须连续从 1 开始，原件 hash 必须匹配，提取文件也被固定到 hash。工具验证映射结构，不能证明人工提供的页文与 PDF 视觉内容一致；parser 明确标注 `page-fidelity-unverified`。空文或解析异常失败并保留错误。没有 OCR 时不能声称图片页已理解。

### draft.json（新版页面协议）

新提交使用 schemaVersion 2；旧 schemaVersion 1 快照继续只读兼容，历史从不原地迁移。新整理页面用 `content` 保存唯一自然 Markdown 正文、`summary` 保存一句话摘要；`evidence` 仅映射正文/摘要和原文，不参与生成章节。

Agent 先识别候选身份、读取文档语境，再回原文选实质支持片段；读取旧页和有效链接后编译完整正文。工具不调用模型、不按词频判同一性，也不把 sourceContexts 摘要当引用。候选与判同一性的理由可另存本轮 trace 文件，实际提交草稿完整留存。

```json
{
  "runId":"prepare返回的run-id",
  "baseCommitId":null,
  "draftType":"agent",
  "complete":true,
  "pages":[{
    "pageId":"beam-concrete",
    "title":"方案说明",
    "pageType":"concept",
    "category":["设计方案"],
    "aliases":[],
    "summary":"Plan only.",
    "content":"Plan only.",
    "expectedVersion":0,
    "expectedHash":null,
    "evidence":[{
      "id":"body",
      "target":{"field":"content","startByte":0,"endByte":10,"quote":"Plan only."},
      "citations":[{
        "sourceId":"source-prepare返回的ID",
        "revision":1,
        "startByte":0,
        "endByte":10,
        "quote":"Plan only."
      }]
    },{
      "id":"lead",
      "target":{"field":"summary","startByte":0,"endByte":10,"quote":"Plan only."},
      "citations":[{"sourceId":"source-prepare返回的ID","revision":1,"startByte":0,"endByte":10,"quote":"Plan only."}]
    }],
    "review":{"status":"not-reviewed"}
  }]
}
```

上例仅演示假设原文恰为 `Plan only.` 时的格式，不能作为真实证据或语义验收。实际应从真实 UTF-8 原文和新页面分别计算半开字节区间。每个 evidence 至少一条原文引用；target 固定到本页 content 或 summary 的原样片段，所有非空白正文和摘要字符必须有映射，允许交叠。改正文但漏改映射、摘要没有引用、中文半字符定位均拒绝。覆盖检查只证明映射没有遗漏字符，不能证明原文实质支持该段论断。

原文 citation 的 PDF 另外要求 `page`；JSON 要求 RFC 6901 `jsonPointer`（如 `/metrics/mse`），字段值必须匹配 quote。映射不能引用 sourceContexts 的概述。保存的来源版本含完整文本，可从 startByte 计算真实行号。原始路径/文件名与稳定 sourceId 均保留。

现有页面必须带起读时的 expectedVersion/contentHash（填入 expectedHash）。新版页面按完整 content/summary/evidence 更新：删减旧段落或表格行、把旧 facts 页转换为新版，均须页面级 `changeReason`；未提交的其他页面原样保留。理由存入 provenance，不代表工具判断删除合理。内容、摘要、类型、分类或映射变化才增加内容版本；只补复核记录不会伪造一次正文变化。

`pageType` 为 summary/entity/concept/synthesis/comparison 之一；来源摘要与跨来源主题页要区分。`category` 最多两级，默认复用旧分类，显式改分类须尊重人工归类。标题、别名及 stable ID 不用当正文章节。旧 facts 局部 upsert/removal 仍兼容既有调用，但不作为新整理目标；已迁移页面禁止退回 facts 写入。旧渲染器仅用于旧页，不能把它叫作新版编译成文。

顶层 `sourceContexts` 为增量更新数组，每项必须有 `sourceId, revision, title, documentType, date, summary, attribution`。revision 必须是该来源当前版本；日期/类型未知时明确写“未知”，不得凭文件名猜日期。例如设计稿 attribution 写“方案提出，非运行证据”；进度报告写“该报告记载，本轮未访问原指标”。这些字段帮助控制表述，不替代事实证据。来源版本变化后，旧语境不能为新版本的 reviewed 判定背书。

顶层 `indexIntro:{"title":"领域标题","content":"材料覆盖范围与阅读导读"}` 单独保存。此处禁止页面链接，目录由实际 pages 的标题、摘要、类型和分类确定性生成，Agent 不生成目录条目。

### 语义复核、问题与文件状态

默认 `review.status=not-reviewed`，不自动标已审。实际 Agent 逐条核对映射与原文后，可提交页面 `review:{status,reviewer,scope,checks}`；status 为 reviewed 或 needs-review，checks 对每个 evidence ID 恰好一项，格式为 `{"evidenceId":"body","assessment":"supported","reason":"引用如何覆盖主体、条件与数值"}`。assessment 可为 insufficient；含 insufficient 不允许 reviewed。scope 要写实际已读材料与未读的原实验、图像或仓库。所有引用来源必须提供对应版本 sourceContexts 后才能标 reviewed。

工具保存复核记录并绑定正文/映射与对应文档语境 hash，不自行执行蕴含推理。新正文默认清除旧复核；语境变化也使旧复核失效。引用来源版本过时、撤回或不可用时，状态返回 needs-review。即使 Agent 记录 reviewed，也仅说明其声明的复核范围，不证明实验真实或结论成立；不能用空理由、关键词引用或未读取的摘要自称语义通过。

顶层 `issues` 是按稳定 ID upsert 的独立问题数组：`issueId,type,description,reportedBy,status,pageIds,evidenceRefs,sourceIds`。status 为 open/resolved/dismissed，后两者必须有 resolution。evidenceRefs 形如 `[{"pageId":"beam-concrete","evidenceId":"body"}]`，可为空；其他关联必须存在。一个问题可影响多页仍只计一次，未提交的问题保留。页面改写造成未解决问题的证据引用悬空时拒绝；需同步调整该问题。正文出现几次“矛盾”不会改变问题数。issues 是本地增强，不声称 WeKnora 自动完成科研事实验证。

分别回读以下结果：

- `status:committed|unchanged`、`fileStatus:snapshot-verified`：不可变产物校验和发布结果；pending journals 另查。
- `completion:complete|partial`、`completionScope`：仅结构性的来源映射完整度，兼容旧接口，绝不是语义通过。
- `semanticReview`：页面复核状态、范围及汇总。
- `issueStatus`：结构化问题的 open/total 和唯一 ID；完整记录在 state.issues。

已诚实记录的来源争议可保持 open；证据不足的正文须收窄、补足引用或暂缓。不能把写盘成功当成其事实正确。

作者正文内链接用 `[[其他page-id]]` 或 `[[其他page-id|显示名]]`。死链和自链拒绝；不要为补链接造页面。外部 HTTP(S) Markdown 链接允许；本地链接、引用式链接和 HTML 链接不作为本入口的正文协议。代码块、行内代码和 blockquote 中的字符串不转换。来源引用由工具确定性生成，不走模型补链。

受影响页若暂不能更新，在顶层写 `deferredPages:[{"pageId":"受影响ID","reason":"尚缺哪些证据"}]`；页面保留旧内容，stalePageIds 标记过期引用，semanticReview 需要重审。新版 Markdown 正文不嵌入长引文，完整证据及过期状态读取结构化 state。缺少引用/截断/非法定位会拒绝整批页面提交。`draftType:fixture` 仅用于确定性测试；实际 Agent 草稿用 agent，不把 fixture 当模型输出。

尚未关联到页面当前引用的可读来源列入 `unmappedSourceIds`，整批保持 partial。若 Agent 判断某个来源确实不需要 Wiki（如重复副本或无实质知识），可给顶层 `sourceDispositions:[{"sourceId":"实际ID","revision":1,"disposition":"no-wiki-needed","reason":"具体理由"}]`；解释固定到来源版本，来源变化后须重新判断。不能用它掩盖未解析或失效引用。

## 文件布局与人工内容

| Skill 语义 | 实际位置 |
| --- | --- |
| 原件 | 用户指定的原始路径，只读 |
| 导航 | `wiki/INDEX.md` 指向当前不可变快照的 INDEX.md |
| 页/来源版本/元数据 | `wiki/history/<commitId>/pages/`、`sources/`、`state.json`、`manifest.json` |
| 单一当前指针 | `.wiki/current.json`；不与 Core 双写 |
| 运行与候选交接 | `.wiki/runs/<runId>/prepared.json`、draft-*.json、events/ |
| 提交/恢复记录 | `.wiki/journals/<commitId>.json` |
| 人工笔记 | `wiki/notes/<pageId>.md`，运行助手不改写 |

state.json 和 Markdown 是同一不可变提交的结构与展示，不是另一套独立可写状态。移动时整体携带原始材料、wiki 和 .wiki；PDF parser 外部模块配置仍需目标机器具备。快照保存解析文本，不代表原始 PDF 已复制到历史目录。历史含原文，沿用原件的访问限制，不上传。

不直接编辑 history：任何 hash 不符都会拒绝后续写入。若已有人工修改，先保存原样、核对后另拟合并，不自动采纳。已有非本工具 Wiki 不自动迁移或覆盖；选择独立文件根。原始材料与旧 Core 不修改。

## 中断、锁与回滚

每次单写者锁只覆盖本工具操作；原始材料仍需在提交前重验。新提交完整写入、manifest 回读校验后，写 pending journal，再原子替换当前指针；随后更新展示索引，回读后记 committed。旧提交即提交前快照，不删除。

这是可恢复协议，不是多文件事务，也不保证突然断电时的文件系统持久性。进程中断前若未形成 journal，可能留下不可见的孤立历史目录，保留即可；pending journal 存在时拒绝新工作。指针已发布但展示未更新时，以 journal/pointer 判断；恢复会重建展示索引。

```powershell
node $wikiScript recover --workspace "F:\my-project" --input recovery.json
node $wikiScript rollback --workspace "F:\my-project" --input rollback.json
```

recovery.json：`{"commitId":"pending提交ID","mode":"finish"}`。指针尚未发布时重验源文件；已发布则验证提交后补齐索引/trace。若源已变，保留错误，可在发布前用 `mode:abort` 放弃该提交。发布后不能 abort，先 finish 再回滚。

rollback.json：`{"targetCommitId":"历史ID","expectedCommitId":"当前ID","reason":"明确原因"}`。回滚创建新提交，页面和对应导读/问题/来源语境回到所选快照，变化页面使用递增版本；不回滚来源观察，旧引用可能仍标过期/需要重审。历史记录和曾发生过的更新保留。

锁不按年龄自动抢占。真实进程崩溃后，先检查 `.wiki/writer.lock` 的 PID/token；明确确认进程不存在后，可调用 `recover-lock`，输入 `{"expectedHash":"锁文件原始字节SHA256"}`。活进程、未知存活状态或锁内容变化均拒绝，恢复保留旧锁副本。测试注入异常会正常释放锁，不能替代真实崩溃验收。

## 验证边界

仓库测试：`node --test tests/file-wiki/*.spec.mjs`。分发构建：`node scripts/build-independent-skills.mjs`；只打包四个独立 Skill、独立安装器和清单，旧安装器/API 不改。早期 wiki-v1 三 Skill 包保留为历史分发，当前清单以新包 manifest 为准。

文件测试不证明模型语义正确、不证明 DSH 已发现 Skill。真实宿主发现、原生 slash 菜单、用户实际 PDF/OCR 质量和自然语言完整体验须分别记录；未验不报通过。
