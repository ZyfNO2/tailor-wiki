# WeKnora 参考与改动

核查日期：2026-10-25；仓库 Tencent/WeKnora；固定 commit：e1f9a6166a593a4804a2f99f1d942919c9cc8ea7。这是源码阅读结论，未在此 Skill 内运行或部署上游服务。

| 机制 | 官方来源 |
| --- | --- |
| Wiki 全流程、来源与工具分工 | [Wiki 文档](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/website-docs/03-features/14-wiki.md) |
| 候选、引用、增量正文及冲突规则 | [prompts_wiki.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/agent/prompts_wiki.go) |
| 分块与句柄映射 | [wiki_ingest_cite.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/application/service/wiki_ingest_cite.go) |
| 去重候选边界与身份复用 | [wiki_ingest_dedup.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/application/service/wiki_ingest_dedup.go) |
| 合并与 finalize | [wiki_ingest_batch.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/application/service/wiki_ingest_batch.go) |
| 页历史、回滚与更新 | [wiki_page.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/application/service/wiki_page.go) |
| 缺失表格行保护 | [wiki_write_row_guard.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/application/service/wiki_write_row_guard.go) |
| 恢复持久待办 | [recover_pending_wiki_tasks.go](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/container/recover_pending_wiki_tasks.go) |

本 Skill 按上游实际链路适配：候选身份 → 文档摘要和原文块映射 → 页面级编译合并 → 独立摘要/正文/来源关联 → 导读与真实目录 → 阅读及证据追溯。不要求移植 Go 服务或整套 RAG。

关键对应：WikiSummaryPrompt 提供文档语境；WikiPageModifySystemPrompt/UserPrompt 明确禁止内部 chunk ID 出现在正文、限制无依据扩写、保留来源归属；WikiTaxonomyPlanPrompt 批次规划浅目录；WikiIndexIntroPrompt 仅生成导读。上游 WikiPage 将 Content、Summary、SourceRefs 和 ChunkRefs 分开；WikiBrowser 展示摘要和正文，来源放在可打开的页脚，而不是按事实 ID 拼正文。

- [页面数据模型](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/types/wiki_page.go)
- [阅读与索引组件](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/frontend/src/views/knowledge/wiki/WikiBrowser.vue)
- [索引导读实现](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/internal/application/service/wiki_ingest.go#L2245)

有意调整：

- 上游将 chunk 关联单独存储；本地保留精确到版本/位置的证据映射，并让读者按需打开，不将内部句柄与长字节区间强塞进正文。
- 上游部分引用失败可降级到摘要 Details；本地缺引用保留未完成，不将其视为已验证知识。
- 上游对规范化同名页有跨类型复用捷径；本地同名仍检查身份、版本和范围。
- 上游文档称 finalize 不调用模型，但该 commit 的索引简介路径实际调用模型。本地恢复“Agent 简短导读 + 确定性真实目录”；旧版纯文件列表不再作为目标阅读效果。
- 文件提交、hash 校验、人工笔记保护、范围内增量判断和实验状态区分，是适配本项目的要求，不声称上游已经完全提供相同保证。

上游 [LICENSE](https://github.com/Tencent/WeKnora/blob/e1f9a6166a593a4804a2f99f1d942919c9cc8ea7/LICENSE) 标示主项目 MIT，并保留第三方许可说明。本 Skill 未复制上游代码或大段提示词；工程移植代码时应另行保留其来源与适用声明。
