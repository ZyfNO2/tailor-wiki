# Reader 验证记录

日期：2026-10-26。使用 Node.js 24、Windows、本地 Chromium/Playwright。

- `npm ci --prefix apps/wiki-reader` 安装锁定依赖；`npm run build --prefix apps/wiki-reader` 通过。
- `npm test --prefix apps/wiki-reader`：2/2。核对固定上游 hash、剔除写/图谱 imports、已配置工作区的快照验证/祖先历史、POST 拒绝、任意文件访问拒绝、篡改快照显式报错。
- 已在新的隔离真实材料工作区读取 Agent 发布的自然 Markdown 快照。浏览器操作了分类目录、索引、关键词搜索及空结果、页间链接/反链、结构化问题、来源展开及原文行高亮、GFM 四行指标表、KaTeX 公式。
- 两个实际内容版本：历史视图显示 v1→v2 的维护说明新增；选旧版查看原文确认不含后来维护段落。版本与来源来自提交 ancestry，不使用演示 fixture 填充。
- 键盘聚焦目录项目后 Enter 可打开页面；320 CSS px 实测 document/body scrollWidth 均为320；当前浏览器读流程 console error 为0。没有屏幕阅读器或多浏览器验收，不声称完整无障碍合规。

修复的首错：直接下载上游文件遇 ECONNRESET，改用 GitHub CLI 读取同一固定 commit 并保存 hash；SFC 剪枝遗留 v-else 导致编译错误，修正 AST 删除条件；去掉 v-else 后的纯 template 隐藏历史按钮，改为可编译的只读 template 条件；API 先发200 header再读坏快照导致 ERR_HTTP_HEADERS_SENT，改为完整读取/验证后再发header，篡改测试现通过。首错未隐瞒为通过。

保留的限制：TDesign/离线图标总入口导致大包警告仍存在（JS约2.1MB，gzip约618KB）；不是完整WK服务、大库分页树、图谱、DAG或Team。UI不自动证明引用语义或科研结果成立。真实原件、完整快照、浏览器截图和实际试验回执仅保存在本地隔离目录/ignored artifacts，不进入公开源码。
