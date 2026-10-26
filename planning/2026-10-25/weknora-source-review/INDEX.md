# WeKnora Wiki 源码阅读索引

阅读日期：2026-10-25。固定版本：`e1f9a6166a593a4804a2f99f1d942919c9cc8ea7`。本次重读 Wiki 主链路，不宣称读完 WeKnora 全仓，也没有部署运行上游。以下结论来自实际提示词、调用代码、数据模型和前端；运行效果尚需后续验收。

本地 upstream/ 保存 13 份原始文件（包含 LICENSE），用于复核，不是业务依赖。版权与第三方许可保留于 [上游 LICENSE](upstream/LICENSE)。后续复制组件或提示词时须继续保留许可和来源；本轮只增加研究文件。

先读 [链路与差异](FINDINGS.md)，再读 [基于源码的设计](DESIGN.md)。

## 阅读顺序与定位

| 环节 | 已读源码 / 关键位置 | 需要回答的问题 |
| --- | --- | --- |
| 产品约定 | [Wiki 文档](upstream/website-docs/03-features/14-wiki.md)，页面模型、生成流程、版本历史 | 文档声称如何工作？必须再核对实现 |
| 数据模型 | [wiki_page.go](upstream/internal/types/wiki_page.go)，WikiPage、PageType 常量 | content、summary、source_refs、chunk_refs 如何分离？哪些页面由 ingest 创建？ |
| 提示词全貌 | [prompts_wiki.go](upstream/internal/agent/prompts_wiki.go) | 不把提示词只压缩为“抽取→合并”四个词 |
| 候选抽取 | 同文件 WikiCandidateSlugPrompt，第 172 行；[cite](upstream/internal/application/service/wiki_ingest_cite.go) extractCandidateSlugs | 名称、别名、描述和已有 slug 连续性；不是直接生成最终正文 |
| 来源概述 | WikiSummaryPrompt，第 60 行；[batch](upstream/internal/application/service/wiki_ingest_batch.go) mapOneDocument，第 1322 行起，摘要调用第 1510 行 | 文档摘要与跨文档主题页不同；文档类型用来约束语气 |
| 引用映射 | WikiChunkCitationPrompt，第 260 行；cite 的 classifyChunkCitations，第 257 行；resolveCitedChunks，第 368 行 | 选择实质讨论候选的原文块；不是从全文任意找一个词即可 |
| 身份去重 | WikiDeduplicationPrompt，第 470 行；[dedup](upstream/internal/application/service/wiki_ingest_dedup.go) exactIdentityTarget，第 228 行 | 完全相同对象与相关对象的区别；同标题快捷路径的限制 |
| 目录规划 | WikiTaxonomyPlanPrompt，第 10 行；batch 的 PlannedFolderID 应用 | 按整批条目统一规划浅目录；尊重已有归类和人工移动 |
| 正文合并 | WikiPageModifySystemPrompt，第 321 行；UserPrompt，第 345 行；batch 的 reduceSlugUpdates，第 1890 行 | 原正文 + 新原文证据 + 来源语境 + 有效链接 → 摘要与完整 Markdown |
| 引用与正文分离 | batch 第 2112–2177 行、2239–2315 行；WikiPage 的 Content/Summary/SourceRefs/ChunkRefs | 上下文不是证据；chunk IDs 不进入正文；来源关联另存 |
| 保存与保护 | [page service](upstream/internal/application/service/wiki_page.go) UpdatePage，第 129 行；ListRevisions/GetRevision/RevertPageToVersion | 截断保护、内容版本和历史；不能把成功写入当语义正确 |
| 索引生成 | [ingest](upstream/internal/application/service/wiki_ingest.go) rebuildIndexPage，第 2245 行；page service GetIndexView，第 560 行 | LLM 只生成标题与导读；目录从已存页面确定性读取 |
| 链接维护 | ingest 的 cleanDeadLinks/injectCrossLinks；page service RebuildLinks | 链接修复与知识成文是不同工作 |
| 结构检查 | [wiki_lint.go](upstream/internal/application/service/wiki_lint.go) RunLint | 孤页、死链、过时来源等；不等于科学事实验证 |
| 前端接口 | [api/wiki/index.ts](upstream/frontend/src/api/wiki/index.ts)，WikiPage、WikiIndexResponse、getWikiPage/getWikiIndex | 前端读页面正文、摘要及独立来源；不是读取 facts 后逐块拼审计报告 |
| 阅读视图 | [WikiBrowser.vue](upstream/frontend/src/views/knowledge/wiki/WikiBrowser.vue)，第 417–640 行、renderedContent 第 2089 行 | 标题、摘要 lead、Markdown 正文、反链和来源页脚；去重复标题 |
| 前端索引 | WikiBrowser.vue 第 2700–2777 行 | 导读与真实目录分离，条目展示标题和 summary，保留中文显示名 |
| 问题与版本 | WikiBrowser.vue 第 700–752 行；[WikiRevisionDrawer.vue](upstream/frontend/src/views/knowledge/wiki/WikiRevisionDrawer.vue) | 问题是结构化记录；版本可阅读原文/差异，不能靠关键词统计 |

所有本地文件对应的在线地址均为 `https://github.com/Tencent/WeKnora/blob/<固定版本>/<upstream 下相对路径>`。SHA256 清单见 SOURCE-MANIFEST.json。

## 覆盖边界

精读：提示词、map/reduce 成文、引用失败路径、索引生成、页面字段、阅读视图、版本视图的关键逻辑。

定位并参考：去重、链接维护、版本保存、结构 lint；未对数据库事务、权限、队列恢复、图谱算法及所有测试做逐行完整审计。未核实模型在这些提示词下的实际质量。

本次 API 路径先尝试 frontend/src/api/wiki.ts 返回 404，随后根据组件 import 和目录查询确认实际是 frontend/src/api/wiki/index.ts；索引只列已成功读取的资源。
