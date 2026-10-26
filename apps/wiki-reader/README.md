# WeKnora 文件 Wiki 只读 reader

这是从 Tencent/WeKnora 固定 commit `e1f9a6166a593a4804a2f99f1d942919c9cc8ea7` 的实际 Vue 组件剪出的阅读子集。不是旧 HTML mock，也没有连接 WeKnora 后端。只读服务仅访问启动时明确配置的 FileWiki 工作区，按 manifest 校验快照，跟随已发布祖先读取历史；不接收任意磁盘路径查询。

从仓库根执行（Node.js 24+）：

```powershell
npm ci --prefix apps/wiki-reader
npm run build --prefix apps/wiki-reader
node apps/wiki-reader/server.mjs --workspace "C:\your-project\wiki-workspace" --port 8771
```

打开 http://127.0.0.1:8771 。首次需要先由 Skill 发布新版自然 Markdown 页面。没有快照、文件校验失败或旧 facts 页面尚未迁移时会明确报错，不填示例内容。只读预览不提供上传、编辑、删除、回滚或训练操作；旧 8769 mock 不属于本工程。

## 保留、删除与适配

| 部分 | 处理 |
|---|---|
| WikiBrowser.vue | 直接保留原搜索结果列表、页面标题/摘要/正文/来源反链/索引 template，以及显示函数、去重标题、目录构造和原 Less 组织 |
| WikiRevisionDrawer.vue | 保留版本列表、异步请求序号保护、历史缓存、两版差异/原文视图与原 scoped 样式；删除回滚写请求和控件 |
| SettingDrawer.vue | 原组件保留（TDesign drawer、resize、fullscreen） |
| wikiRevisionDiff/wikiLineDiff | 原差异工具保留 |
| Markdown | 保留 marked、原 literal tilde 修正、原 DOMPurify 配置/hooks；移除生产资源凭证/代理/图片 hydration，严格限制本地预览链接协议。用真实 marked-katex-extension/KaTeX 补公式显示 |
| 样式/语言 | 固定版 theme.css 和中文 locale；TDesign、离线图标组件与 Vue 实际依赖，版本见 package-lock |
| 删除 | 图谱全部计算、聊天/Assistant、路由/账号/租户、模型配置、上传、页面/目录增删改/拖放、问题写操作、生产 API imports；没有只隐藏按钮却保留写请求 |
| 本地新增 | `adapter.ts` 把唯一已校验 snapshot 映射到原组件字段；`EvidencePanel.vue` 按需展开正文/摘要片段、来源语境、精确字节/行号及结构化问题；shell 独立显示文件、覆盖与语义状态 |

`prune-upstream.mjs` 可复现剪枝，读取原 SFC AST 选取模板/函数/样式，输出本地组件；会覆盖生成文件，修改前请先核对。`provenance/*.diff` 为原文件与剪后文件实际逐行 diff。所有原文件与 hash 在 upstream/SOURCE-MANIFEST.json；主项目 MIT 及上游第三方说明保留于 LICENSE.WeKnora。直接依赖许可证记录在 provenance/THIRD-PARTY.json；依赖包自带完整声明与字体许可，不得去除。

## 最少联合试用

1. 先用 Wiki Skill 整理指定材料并发布快照；确认状态区的文件、范围覆盖、语义复核和问题数量分别可见。
2. 打开索引和分类页面，输入不存在词并按 Enter，核对空结果；清空后恢复目录。
3. 打开含表格/公式的正文，核对换行、表格行和公式；点击页内链接，再从反链返回。
4. 展开“证据与复核”，点击可读来源文件名，核对选中原文行和版本；精确字节放在二级详情。
5. 在有两次实际内容提交的页点“历史”，对照新增/删除行，选旧版“查看原文”；未有旧版时如实显示。
6. 打开问题列表，核对独立 issue 数量而非正文关键词计数。reader 不会把 reviewed 解释成实验结论成立。

工程验证：`npm test --prefix apps/wiki-reader`。测试是明确的合成 fixture，验证 hash、禁写、路径边界与篡改拒绝，不代替真实资料语义复核。真实工作区和截图仅用于本地验收，不随公开源码发布。

已知限制：这是必要 reader 接线，未实现完整知识树大库分页/图谱/DAG/Team。保留原只读列表的浅分类导航。构建仍报告 TDesign/图标总包较大（约 2.1 MB JS、gzip约618 KB），没有隐瞒该警告；本轮未以新框架重写来消除它。没有屏幕阅读器和跨浏览器测试，不能宣称完整无障碍合规。
