/* 设计规范（阅读页）：变体卡、原则、颜色、字体、状态语法、部件、页面状态、
   图表与画布、响应式、交互边界、无障碍、验收清单映射。样张都由真实部件渲染。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const SECTIONS = [
    ['variant', '外观设置', 'Appearance'], ['principles', '原则', 'Principles'], ['color', '颜色', 'Color'], ['type', '字体', 'Type'],
    ['status', '状态语法', 'Status'], ['parts', '部件', 'Components'], ['states', '页面状态', 'States'], ['charts', '图表与画布', 'Charts'],
    ['responsive', '响应式', 'Responsive'], ['boundary', '交互边界', 'Boundary'], ['a11y', '无障碍', 'Access'], ['accept', '验收清单', 'Acceptance'],
  ];
  const sec = (id, body) => {
    const s = SECTIONS.find((x) => x[0] === id);
    return html`<section class="dsh-spec-sec" id="spec-${id}" aria-labelledby="spec-${id}-h"><h2 class="ef-bar-title" id="spec-${id}-h">${s[1]} <small class="ef-eyebrow">${s[2]}</small></h2>${body}</section>`;
  };
  const swatch = (v, zh, use, cls = '') => html`<div class="dsh-sw ${cls}"><i style="background:var(${v})"></i><b>${zh}</b><code>${v}</code><span>${use}</span></div>`;

  DSH.views.spec = {
    layout: 'fixed',
    title: () => '设计规范',
    render() {
      DSH.state.pageLabel = '设计规范';
      if (DSH.live()) return html`<div class="dsh-page">${ui.head({ zh: '设计规范', en: 'Spec' })}${ui.notice('注意', html`<p>设计规范页用示例数据演示各个部件，只在示例模式提供：直接双击 <code>apps/workbench/web/index.html</code> 打开。实时模式只显示工作区里真实存在的内容。</p>`, html`<p class="ef-actions">${ui.btn('回到概览', { act: 'go', data: { href: '#/overview' } })}</p>`)}</div>`;
      const dims = [
        ['exec', '执行状态', '圆', '任务与运行的进程：跑没跑、跑完没有'],
        ['review', '审查状态', '方', '结果能不能当证据用'],
        ['verdict', '研究判定', '菱形', '假设是否成立；独立于进程'],
        ['decision', '用户决策', '书签', '方案是否被选中、由谁选'],
        ['prov', '数据性质', '方块 / 档案 / 虚线', '本轮执行、历史报告、模拟、示例'],
        ['fresh', '读取状态', '勾 / 钟 / 三角', '文件是否读到、是否陈旧'],
        ['cov', '覆盖状态', '—', 'Wiki 整理对每个来源的处理结果'],
        ['check', '方案检查', '勾 / 三角 / 叉', '接口、数据、资源、原文核对'],
        ['edge', '依赖状态', '—', 'DAG 里每条依赖等待的产物是否就绪'],
        ['member', '成员状态', '—', '会话是否在运行；没有心跳 = 未知'],
      ];
      return html`
      <div class="dsh-spec">
        <nav class="dsh-spec-toc" aria-label="规范目录" data-scroll-key="spectoc">
          <p class="ef-eyebrow slash">Spec</p>
          <ol>${SECTIONS.map(([id, zh, en]) => html`<li><button type="button" data-act="toc" data-target="spec-${id}"><span>${zh}</span><small>${en}</small></button></li>`)}</ol>
        </nav>
        <article class="dsh-spec-main" data-scroll-key="spec">
          <p class="ef-eyebrow slash">Design spec / 2026.10.26</p>
          <h1 class="dsh-title">DSH 研究工作台 设计规范</h1>
          <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
          <p class="ef-lede ef-read">这一页是可交接的设计说明：所有样张都由工作台里同一套部件实时渲染。视觉语言基于 endfield-ui（终末地风味工业界面）的固定规则，信息结构以 UI-DESIGN-BRIEF 为准。</p>

          ${sec('variant', html`
            <pre class="dsh-code is-card"><code>外观：自定义（yellow / cool / tight / contours / compact / calm）
首页主图：概览中央的“研究链路”圆形导航——七个分区的真实计数与待处理标记
页面类型：概览为控制台；Wiki 阅读、方案详情、研究叙事为阅读页；实验、DAG、任务、图谱为控制台子页</code></pre>
            ${ui.kv([
              ['强调色', '黄 #FFFA00：只表示当前位置、可点击内容、醒目提醒；只做填充，上面写墨字'],
              ['纸色', '冷灰（cool）：适合数据与实验室工具，和黄色的对比更干净'],
              ['切角', '窄（×0.6）：信息密集，切角小一点，字不压切角'],
              ['底纹', '两角极淡的等高线，只此一处'],
              ['密度', '紧凑（0.94）：工作台整天在用，一屏多放一些；触控区域仍 ≥ 44px'],
              ['动效', '安静（calm）：去掉打开页面时的入场，保留悬停、按下、面板进出'],
            ])}
            <p class="dsh-note">与最接近的模板（console / reading）相比的三处不同：主视觉换成研究链路圆盘；阅读页加了引用与关联的页边；所有状态改成多维状态语法，执行、审查、判定互不合并。</p>`)}

          ${sec('principles', html`
            <ol class="dsh-principles">
              <li><b>文件是事实来源。</b>工作台只展示读取结果，不维护另一套研究状态；每个数字都能追到文件和读取时间。</li>
              <li><b>自然语言在前。</b>标题、摘要、一句话说明先出现；ID、hash、字节范围、原始 trace 收进“技术信息”。</li>
              <li><b>状态不合并。</b>执行完成、审查通过、假设成立是三件事，用三种形状、三个名字分开显示。</li>
              <li><b>未知就写未知。</b>未运行、未记录、心跳陈旧、来源缺失都照实写；缺失指标写“缺失”并说明原因，不填 0。</li>
              <li><b>真实性可辨认。</b>本轮执行、历史报告、模拟、示例各有标记；模拟与历史结果不进同一张比较图。</li>
              <li><b>证据可以追到原文，也能回来。</b>引用就地展开；去看来源后，有“返回阅读位置”。</li>
              <li><b>只读。</b>不启动训练、不派发、不改结果；拖动布局只改视图。后置操作只画出位置并标明。</li>
              <li><b>一种强调色。</b>黄色只给当前、可点、要看一眼；红色只给删除，所以这个只读工作台里没有红色。</li>
            </ol>`)}

          ${sec('color', html`
            <div class="dsh-sws">
              ${swatch('--ef-paper', '纸', '页面底色')}
              ${swatch('--ef-panel', '板', '阅读页白纸、看板、输入框')}
              ${swatch('--ef-ink', '墨', '正文、标题、一切有意义的线')}
              ${swatch('--ef-ink-2', '次要墨', '字段、说明、日期')}
              ${swatch('--ef-rule', '细线', '1px 分隔')}
              ${swatch('--ef-chip', '浅填充', '安静的块、骨架、未到的步')}
              ${swatch('--ef-signal', '黄', '当前 / 可点 / 注意；只做填充')}
              ${swatch('--ef-trace', '高亮线', '浅色时是墨，深色时是黄')}
            </div>
            <div class="dsh-sws is-2">
              <div class="dsh-sw"><i class="is-hatch"></i><b>斜线纹</b><code>--ef-hatch</code><span>模拟、未处理、替换掉的原做法、禁用</span></div>
              <div class="dsh-sw"><i class="is-tri"></i><b>三色细条</b><code>--ef-tri-*</code><span>只在页面最顶上与详情标题下方</span></div>
            </div>
            <p class="dsh-note">图表和画布里不用红绿；对照为灰，强调为墨（深色主题为黄），越过阈值挂黄色小方块。节点类型靠形状区分，不靠颜色。</p>`)}

          ${sec('type', html`
            <div class="dsh-typespec">
              <p class="t1">研究链路 <span class="ef-eyebrow">Saira 800 / 宽 125%</span></p>
              <p class="t2">二级标题 22px <span class="ef-eyebrow">界面字体 700</span></p>
              <p class="ef-read t3">正文用黑体常规字重 17px，行高 1.85，一行约 38 个汉字。链接是墨字压在黄色笔划上。</p>
              ${ui.facts(['字段 13px 宽 112%', '2026.10.26', '1,860 字', '3 / 12'])}
              <p class="ef-eyebrow slash">Eyebrow 11px / 宽 125% / 大写 / 字距 0.14em</p>
              ${ui.pair('Knowledge', '中英成对标题', 'p')}
            </div>
            <p class="dsh-note">拉丁字体 Saira（SIL OFL，随原型附带于 assets/fonts/）；中文落到系统黑体（Noto Sans SC / 思源黑体 / 微软雅黑）。上线时自托管 Noto Sans SC 子集。</p>`)}

          ${sec('status', html`
            <p class="ef-read">每个维度有自己的符号形状和名字；框的样子表达“生效 / 在后台 / 需要看一眼”：实线 = 生效中，虚线 = 未发生或未知，墨色实心 = 完成或选中，黄块 = 需要看一眼，斜线纹 = 不是真实执行。</p>
            <div class="ef-table-wrap"><table class="ef-table dsh-statusspec">
              <thead><tr><th>维度</th><th>符号</th><th>含义</th><th>取值</th></tr></thead>
              <tbody>${dims.map(([k, zh, shape, d]) => html`<tr><td><b>${zh}</b></td><td class="ef-field">${shape}</td><td class="dsh-note">${d}</td><td><span class="dsh-chiprow is-wrap">${Object.keys(ui.ST[k].items).map((v) => ui.st(k, v))}</span></td></tr>`)}
              <tr><td><b>技术就绪</b></td><td class="ef-field">三步刻度</td><td class="dsh-note">可设计 → 可试跑 → 可完整执行</td><td><span class="dsh-chiprow is-wrap">${ui.ready('design')}${ui.ready('pilot')}${ui.ready('full')}</span></td></tr>
              <tr><td><b>证据状态</b></td><td class="ef-field">四格刻度</td><td class="dsh-note">无 → 待核实 → 部分支持 → 有来源支持；冲突与缺失用黄块</td><td><span class="dsh-chiprow is-wrap">${['none', 'pending', 'partial', 'supported', 'conflict', 'missing'].map((k) => ui.evi(k))}</span></td></tr>
              </tbody>
            </table></div>
            <p class="dsh-note">同一行里出现多个维度时，写上维度名：${ui.st('exec', 'done', { dim: true })}${ui.st('review', 'changes', { dim: true })}${ui.st('verdict', 'insufficient', { dim: true })}——这是同一个任务的三个独立状态。</p>`)}

          ${sec('parts', html`
            <div class="dsh-parts">
              <div class="dsh-part"><p class="ef-eyebrow">Buttons</p><p class="ef-actions">${ui.btn('主要操作', { go: true, small: false })}${ui.btn('次要操作', { small: false })}${ui.btn('小按钮')}${ui.btn('后置操作', { disabled: true })}</p><p class="dsh-note">切角 = 可以点；悬停时黄色从左擦入。每组最多一个主要操作。</p></div>
              <div class="dsh-part"><p class="ef-eyebrow">Identifiers</p><p class="dsh-chiprow">${ui.tag('W-01', { ref: 'wiki:W-01' })}${ui.tag('T-06', { ref: 'task:T-06', current: true })}${ui.id('S1')}${ui.id('中心', 'is-here')}</p><p class="dsh-note">能点的编号切角；不能点的直角；黄色 = 当前。</p></div>
              <div class="dsh-part"><p class="ef-eyebrow">Object refs</p><p>${ui.refs(['wiki:W-03', 'run:R-E2-02', 'task:T-03', 'issue:Q-08', 'run:R-E9-01'])}</p><p class="dsh-note">同一对象在卡片、图谱、DAG、列表中用同一标识；找不到的显示为断链。</p></div>
              <div class="dsh-part"><p class="ef-eyebrow">Filters / segmented</p>${ui.chips([{ key: 'a', label: '全部', n: 14, on: true }, { key: 'b', label: '阻塞', n: 2 }, { key: 'c', label: '失败', n: 1 }], 'noop')}<div class="dsh-mt-s">${ui.seg('示例', [['a', '正文'], ['b', '版本历史'], ['c', '问题']], 'a', 'noop')}</div><p class="dsh-note">筛选块选中为黄；分段选择当前段为墨底反白，不用黄。</p></div>
              <div class="dsh-part"><p class="ef-eyebrow">Notice</p>${ui.notice('注意', html`<p>需要读的说明前面插一面黄色小旗；出错也用它，不变红、不抖动。</p>`)}</div>
              <div class="dsh-part"><p class="ef-eyebrow">Ledger / fields</p>${ui.ledger([['已读取', '7 / 9'], ['部分读取', 'runs/', true], ['读取时间', '2026.10.26 09:42']])}</div>
              <div class="dsh-part"><p class="ef-eyebrow">Triad</p>${ui.triad({ decision: 'selected', readiness: 'pilot', evidence: 'partial' })}</div>
              <div class="dsh-part"><p class="ef-eyebrow">Progress</p><div class="ef-progress" role="progressbar" aria-valuenow="45" aria-valuemin="0" aria-valuemax="100" style="--p:0.45"><span class="ef-eyebrow">Running / seed 3</span><span class="ef-field">18,000 / 40,000 步</span><i></i></div><div class="dsh-mt-s">${ui.loading('读取中', 2)}</div><p class="dsh-note">分段进度按格跳；不知道进度时一段黄格从左往右走；骨架屏不闪光。</p></div>
              <div class="dsh-part"><p class="ef-eyebrow">Panels & popovers</p><p class="ef-actions">${ui.btn('打开详情面板', { act: 'open', data: { ref: 'run:R-E2-01' } })}<button type="button" class="dsh-cite" data-act="cite" data-cite="c1" aria-haspopup="dialog" aria-expanded="false">1</button><span class="dsh-note">← 引用就地展开</span></p><p class="dsh-note">面板左上切角、顶部斜线纹带；Esc 关闭，焦点回到打开它的位置。</p></div>
            </div>`)}

          ${sec('states', html`
            <div class="dsh-statespecs">
              <div><p class="ef-eyebrow">Normal / 正常</p>${ui.ledger([['Wiki 快照 v14', '已读取'], ['页面', '12 页']])}</div>
              <div><p class="ef-eyebrow">Empty / 空</p>${ui.empty({ title: '还没有实验计划。', text: '由 experiment-design 写入 EXPERIMENT-PLAN.md。' })}</div>
              <div><p class="ef-eyebrow">Loading / 加载</p>${ui.loading('读取 runs/', 3)}</div>
              <div><p class="ef-eyebrow">Failed / 读取失败</p>${ui.notice('读取失败', html`<p>EXPERIMENT-PLAN.md 第 42 行列数不一致。提供文件入口与上次成功读取。</p>`)}</div>
              <div><p class="ef-eyebrow">Partial / 部分完成</p>${ui.notice('部分读取', html`<p>runs/ 中 1 条记录缺少 metrics.json，已列出；其余正常显示。</p>`)}</div>
              <div><p class="ef-eyebrow">Stale / 数据陈旧</p>${ui.notice('可能陈旧', html`<p>文件在读取之后被修改；显示的是读取时的内容。</p>`)}</div>
              <div><p class="ef-eyebrow">Source missing / 来源缺失</p><p class="dsh-chiprow">${ui.evi('missing')}<button type="button" class="dsh-cite is-missing" data-act="cite" data-cite="c6" aria-haspopup="dialog" aria-expanded="false">6<span class="dsh-cite-x">来源缺失</span></button></p></div>
              <div><p class="ef-eyebrow">Pending verification / 待核实</p><p class="dsh-chiprow">${ui.st('issue', 'verifying')}${ui.evi('pending')}${ui.st('verdict', 'verifying')}</p></div>
            </div>
            <p class="dsh-note">右上角“原型 │ 状态”可以把任意页面切到加载、空、失败、陈旧、部分读取；“依赖环”只影响 DAG。切换项目到“新课题（空工作区）”可看到真实的空状态。</p>`)}

          ${sec('charts', html`
            <div class="dsh-chartspec">
              ${DSH.charts.stack({ label: '示例', items: [{ key: 'a', kind: 'ink', label: '完成', n: 5 }, { key: 'b', kind: 'run', label: '运行中', n: 1 }, { key: 'c', kind: 'alert', label: '阻塞', n: 2 }, { key: 'd', kind: 'alert-x', label: '失败', n: 1 }, { key: 'e', kind: 'idle', label: '待执行', n: 3 }, { key: 'f', kind: 'off', label: '取消', n: 1 }, { key: 'g', kind: 'unknown', label: '未知', n: 1 }], note: '部分与整体用堆叠条；每段之间 2px 间隙；图例逐项写出计数。' })}
              <div class="dsh-graphspec">
                <p class="ef-eyebrow">Graph node types / 知识图谱节点</p>
                <ul>${['source', 'wiki', 'scheme', 'hypothesis', 'experiment', 'conclusion'].map((t) => html`<li>${raw(DSH.graph.shapeIcon(t, 22))}<span>${DSH.graph.TYPES[t].zh}</span></li>`)}</ul>
                <p class="dsh-note">形状区分类型；黄色只给中心页面与选中；需要看一眼的节点挂黄色小方块；算法相似默认隐藏，显示时为点线并标“非证据”。</p>
              </div>
            </div>
            <ul class="dsh-ul">
              <li>一个图只有一个纵轴；不同单位的指标分开画（差值图用个百分点，延迟单独列表）。</li>
              <li>差值图画均值差与 95% 区间，负的差值照样画在 0 的左边；保护阈值是虚线。</li>
              <li>每个图都有“表格视图”；悬停说明只是补充，值在前、名字在后。</li>
              <li>没有真实数据时显示空状态，不画估计曲线；模拟与历史结果不进同一张比较图。</li>
            </ul>`)}

          ${sec('responsive', html`
            <div class="dsh-wires">
              <figure><div class="dsh-wire is-1440"><i class="b-top"></i><i class="b-ctx"></i><div class="row"><i class="c-cat">目录</i><i class="c-sheet">正文</i><i class="c-margin">页边</i></div></div><figcaption><b>1440</b> 主稿：顶栏 + 上下文行；阅读页三栏；图谱 / DAG 右侧固定详情。</figcaption></figure>
              <figure><div class="dsh-wire is-1024"><i class="b-top"></i><i class="b-ctx"></i><div class="row"><i class="c-cat">目录</i><i class="c-sheet">正文 + 页边在下</i></div></div><figcaption><b>1024</b>：页边移到正文下方；图谱与 DAG 的详情改为下方区域。</figcaption></figure>
              <figure><div class="dsh-wire is-768"><i class="b-top"></i><div class="row is-col"><i class="c-cat">目录（可折叠）</i><i class="c-sheet">正文</i><i class="c-margin">页边</i></div></div><figcaption><b>768</b>：顶栏导航可横向滑动；目录折叠在正文上方。</figcaption></figure>
              <figure><div class="dsh-wire is-375"><i class="b-top"></i><div class="row is-col"><i class="c-sheet">单栏</i><i class="c-list">图谱 / DAG 默认用清单视图</i></div></div><figcaption><b>375</b>：单栏；详情面板变成底部面板；表格在自身容器内横向滚动，页面不横向滚动。</figcaption></figure>
            </div>`)}

          ${sec('boundary', html`
            <div class="dsh-two">
              <div><p class="ef-eyebrow">Allowed / 可以交互</p><ul class="dsh-ul"><li>导航、搜索、筛选、展开与收起</li><li>画布缩放、平移、本地布局（拖动节点只改视图）</li><li>引用展开、版本比较、复制路径</li><li>原型状态演示、深浅切换、项目切换</li></ul></div>
              <div><p class="ef-eyebrow">Later / 后置（本轮不提供）</p><ul class="dsh-ul"><li>启动训练、重试、暂停、停止运行</li><li>派发任务、邀请成员、聊天</li><li>修改实验结果、合并冲突、改写 DAG 依赖</li><li>生成或修改论文正文</li></ul></div>
            </div>`)}

          ${sec('a11y', html`
            <ul class="dsh-ul">
              <li>键盘：Tab 走过全部可点元素，焦点框 2px 跟随文字颜色；Ctrl K 打开对象搜索；/ 聚焦本页搜索；Esc 关闭弹出层与面板。</li>
              <li>图谱节点可以 Tab 到达：Enter 选中，加号展开，减号收起；每个画布都有等价的清单视图。</li>
              <li>状态不只靠颜色：形状 + 名字 + 框的样式；黄色上的字一律是墨色（16.3:1）。</li>
              <li>系统“减少动态效果”打开时，所有动效直接跳到结束状态。</li>
            </ul>`)}

          ${sec('accept', html`
            <div class="ef-table-wrap"><table class="ef-table">
              <thead><tr><th>验收项（UI-DESIGN-BRIEF §7）</th><th>在哪里看</th></tr></thead>
              <tbody>
                <tr><td>从 Wiki 正文定位具体原文，并返回阅读位置；表格和公式不丢失</td><td>${ui.ref('wiki:W-01')} 点引用 [1] → 查看原文上下文 → 在来源列表中定位 → 底部“返回”</td></tr>
                <tr><td>未处理材料、失败原因与明确排除可逐项查看；局部完成不显示全量成功</td><td>${ui.ref('view:coverage')}（三项指标分开）</td></tr>
                <tr><td>历史报告的结果不显示成本轮真实实验</td><td>${ui.ref('run:R-E1-H')}、${ui.ref('view:runs')}</td></tr>
                <tr><td>方案的用户决策、就绪程度与证据状态同时可辨认</td><td>${ui.ref('view:schemes')}</td></tr>
                <tr><td>方案 → 计划 → 多个 Run → 审查 → 故事双向定位，缺失环节明确提示</td><td>${ui.ref('scheme:S1')}、${ui.ref('scheme:S2')}（页边的链路）</td></tr>
                <tr><td>图谱与 DAG 各自表达关系和依赖，图上信息能在列表中查到</td><td>图谱与 DAG 的“列表 / 清单”视图</td></tr>
                <tr><td>任务完成、研究审查和假设成立不合并为同一个成功状态</td><td>${ui.ref('review:RV-E2')}（三个独立状态）</td></tr>
                <tr><td>Team 不存在或状态陈旧时正确显示，成员产物能追溯真实记录</td><td>${ui.ref('view:team')}、切换到空工作区</td></tr>
                <tr><td>只读点击不修改来源、启动训练或派发；视图布局不修改 DAG 文件</td><td>所有后置操作均为禁用并标明</td></tr>
                <tr><td>空库、无历史、断链、读取错误、部分运行、负结果都有可用界面</td><td>原型状态演示；${ui.ref('wiki:W-09')}（只有一个版本）；${ui.ref('wiki:W-12')}（断链）</td></tr>
                <tr><td>键盘可达、焦点可见，状态不只靠颜色，正文可读、详情可收起</td><td>见“无障碍”</td></tr>
              </tbody>
            </table></div>`)}
        </article>
      </div>`;
    },
  };
  DSH.on('noop', () => {});
})();
