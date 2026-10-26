/* DSH 研究工作台 · 示例数据
   ---------------------------------------------------------------------------
   全部为设计原型用的示例，不是任何真实研究的结果；论文、作者、片段均为虚构。
   对象划分按 UI-DESIGN-BRIEF §5：Wiki 页面 / 来源 / 版本 / 问题、方案 / 假设、
   实验计划、Run / 审查、任务 / Team、故事。每个对象有稳定标识，卡片、图谱、
   DAG、列表都引用同一标识；视图只从这里派生，不在浏览器保存第二套状态。
   正文里的记号：[[W-03]] 或 [[W-03|显示文字]] = 页间链接；{{c:c1}} = 引用；
   {{k:Q-08}} = 问题；{{r:plan:E1}} = 其他对象。 */
window.DSH_DATA = (function () {
  'use strict';

  /* ======================================================================
     项目一：结构损伤检测研究（完整示例）
     ====================================================================== */
  const P = {
    id: 'p-dsh',
    name: '结构损伤检测研究',
    code: 'DSH',
    workspace: 'D:\\research\\dsh-paper',
    readAt: '2026.10.26 09:42',
    sample: true,

    /* 工作台读取的文件：全局上下文与“数据来源”面板 */
    files: [
      { key: 'wiki', path: 'wiki/', label: 'Wiki 已发布快照', detail: '快照 v14 │ 12 页', status: 'ok', at: '2026.10.25 21:14', by: 'wiki-maintain' },
      { key: 'tailor', path: 'TAILOR.md', label: '学术裁缝方案', detail: '3 个方案', status: 'ok', at: '2026.10.23 18:02', by: 'academic-tailor' },
      { key: 'plan', path: 'EXPERIMENT-PLAN.md', label: '实验计划', detail: 'v3 │ 5 个计划', status: 'ok', at: '2026.10.22 15:30', by: 'experiment-design' },
      { key: 'runs', path: 'runs/', label: '运行记录', detail: '11 条记录 │ 1 条缺少 metrics.json', status: 'partial', at: '2026.10.26 09:40', by: '实验执行会话', note: 'R-E2-04 已取消，目录中没有 metrics.json，日志截断在第 9,800 步。其余 10 条正常解析。' },
      { key: 'reviews', path: 'reviews/', label: '审查记录', detail: '2 份', status: 'ok', at: '2026.10.25 18:30', by: '研究者' },
      { key: 'dag', path: 'dag.yaml', label: '任务依赖', detail: '14 个任务 │ 17 条依赖', status: 'ok', at: '2026.10.25 18:40', by: '研究者' },
      { key: 'team', path: 'team/sessions.jsonl', label: '成员与会话', detail: '5 个会话 │ 1 个心跳陈旧', status: 'stale', at: '2026.10.26 09:40', by: '会话记录', note: 'academic-tailor 会话 s-0415 最后心跳 2026.10.23 18:05，已超过 48 小时。只表示状态未知，不判定离线或失败。' },
      { key: 'story', path: 'STORY-PLAN.md', label: '研究叙事', detail: 'v3 │ 4 项贡献', status: 'ok', at: '2026.10.24 16:00', by: 'research-story' },
      { key: 'traces', path: 'traces/', label: '执行 trace', detail: '4 份', status: 'ok', at: '2026.10.26 09:40', by: '各会话' },
    ],

    question: {
      text: '在少标注、强噪声的桥梁巡检图像中，局部细节建模能否改善细裂缝的召回？',
      from: 'STORY-PLAN.md §1',
      stage: '单模块实验与结果审查',
    },

    /* 四个独立 Skill：没有总 Skill，也没有必须按顺序运行的流水线 */
    skills: [
      { id: 'wiki-maintain', name: 'Wiki 整理', file: 'wiki/', output: '快照 v14 │ 12 页 │ 覆盖报告', at: '2026.10.25 21:14', trace: 'tr-0425' },
      { id: 'academic-tailor', name: '学术裁缝', file: 'TAILOR.md', output: '3 个方案 │ 1 个已选', at: '2026.10.23 18:02', trace: 'tr-0423' },
      { id: 'experiment-design', name: '实验设计', file: 'EXPERIMENT-PLAN.md', output: 'v3 │ 5 个计划', at: '2026.10.22 15:30', trace: 'tr-0422' },
      { id: 'research-story', name: '研究叙事', file: 'STORY-PLAN.md', output: 'v3 │ 4 项贡献 │ 4 个缺口', at: '2026.10.24 16:00', trace: null },
    ],

    /* ---------------- Wiki ---------------- */
    wikiSnapshot: { version: 'v14', at: '2026.10.25 21:14', pages: 12, by: 'wiki-maintain', trace: 'tr-0425' },
    wikiGroups: [
      { key: 'concept', name: '概念与问题', en: 'Concepts' },
      { key: 'method', name: '方法与模块', en: 'Methods' },
      { key: 'data', name: '数据、指标与约束', en: 'Data' },
      { key: 'design', name: '实验与叙事', en: 'Design' },
      { key: 'survey', name: '综述', en: 'Survey' },
    ],
    pages: [
      {
        id: 'W-01', title: '局部细节与全局上下文', type: '概念', group: 'concept', review: 'pending',
        summary: '细裂缝检测需要同时看清像素级细节与更大范围的结构上下文；本页整理两类机制的动机、已有证据与待验证边界。',
        version: 'v4', updated: '2026.10.25', words: 1860, file: 'wiki/concepts/local-global-context.md',
        topics: ['细裂缝漏检', '注意力机制', '上下文聚合'],
        citations: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
        body: `
<p>细裂缝（宽度约 1–3 像素）在下采样过程中容易丢失，分割网络在这类目标上的召回明显偏低{{c:c3}}。局部窗口内的自注意力可以在线性复杂度下增强细长结构的边缘响应{{c:c1}}；全局上下文聚合则补充远距离的结构连续性线索{{c:c2}}。两者针对的问题不同：前者针对<strong>细节保真</strong>，后者针对<strong>结构连贯</strong>。</p>
<p>本页只整理机制与证据线索。具体模块见 [[W-03|模块 b：局部窗口注意力]] 与 [[W-04|模块 c：全局上下文聚合]]；问题定义见 [[W-05]]。</p>
<h2 id="s-compare">两类机制对比</h2>
<table>
<thead><tr><th>机制</th><th>作用范围</th><th>典型实现</th><th>额外计算</th><th>来源</th></tr></thead>
<tbody>
<tr><td>局部窗口注意力</td><td>w×w 窗口（w = 7）</td><td>窗口内多头自注意力</td><td>与像素数成线性</td><td>{{c:c1}}</td></tr>
<tr><td>全局上下文聚合</td><td>整幅特征图</td><td>非局部块 / 全局池化注意</td><td>与像素数成二次</td><td>{{c:c2}}</td></tr>
<tr><td>多尺度特征金字塔（基线 A 已有）</td><td>4 个尺度</td><td>自顶向下融合</td><td>较低</td><td>{{c:c4}}</td></tr>
</tbody>
</table>
<h2 id="s-cost">计算代价</h2>
<p>设特征图高、宽为 H、W，通道数为 C，窗口边长为 w。两类机制的注意力计算量级为：</p>
<math display="block"><mrow><msub><mi>Ω</mi><mtext>global</mtext></msub><mo>=</mo><mi>O</mi><mo stretchy="false">(</mo><msup><mrow><mo stretchy="false">(</mo><mi>H</mi><mi>W</mi><mo stretchy="false">)</mo></mrow><mn>2</mn></msup><mi>C</mi><mo stretchy="false">)</mo><mo separator="true">,</mo><mspace width="2em"></mspace><msub><mi>Ω</mi><mtext>local</mtext></msub><mo>=</mo><mi>O</mi><mo stretchy="false">(</mo><mi>H</mi><mi>W</mi><mo>·</mo><msup><mi>w</mi><mn>2</mn></msup><mo>·</mo><mi>C</mi><mo stretchy="false">)</mo></mrow></math>
<p>当 H = W = 128、w = 7 时，局部窗口的注意力计算量约为全局方式的 <math><mfrac><msup><mi>w</mi><mn>2</mn></msup><mrow><mi>H</mi><mi>W</mi></mrow></mfrac></math> ≈ 0.3%。显存能否承受另见 [[W-11]] 与问题 {{k:Q-03}}。</p>
<h2 id="s-config">接入示意</h2>
<pre><code>decoder:
  stages: [d1, d2, d3]
  insert_after: d2        # 模块 b 的候选接入位置（方案 S1）
  module_b:
    window: 7
    heads: 4
    proj: 256 -> 128 -> 256   # 1×1 投影对齐通道，残差相加</code></pre>
<h2 id="s-boundary">证据边界</h2>
<blockquote>设计动机不等于性能收益。模块 b 对细裂缝召回的作用要由成对对照 {{r:plan:E2}} 检验；目前审查结论为证据不足 {{r:review:RV-E2}}。</blockquote>
<p>早期草稿中“全局上下文可以替代多尺度金字塔”的说法{{c:c6}}，其来源文件在当前工作区中缺失，这句说法按待核实处理，不作为依据。会议记录里关于实验顺序的约定见{{c:c5}}。</p>`,
        versions: [
          { v: 'v4', at: '2026.10.25 21:10', by: 'wiki-maintain', trace: 'tr-0425', note: '补充计算代价与证据边界；新增引用 [4]；[1] 的来源版本变化', lines: [
            '## 动机',
            '细裂缝（宽度约 1–3 像素）在下采样过程中容易丢失，分割网络在这类目标上的召回明显偏低。[3]',
            '局部窗口内的自注意力可以在线性复杂度下增强细长结构的边缘响应。[1]',
            '全局上下文聚合补充远距离的结构连续性线索。[2]',
            '两者针对的问题不同：前者针对细节保真，后者针对结构连贯。',
            '## 两类机制对比',
            '| 局部窗口注意力 | w×w 窗口（w = 7） | 窗口内多头自注意力 | 线性 |',
            '| 全局上下文聚合 | 整幅特征图 | 非局部块 / 全局池化注意 | 二次 |',
            '| 多尺度特征金字塔（基线 A 已有） | 4 个尺度 | 自顶向下融合 | 较低 | [4]',
            '## 计算代价',
            'Ω_global = O((HW)²C)，Ω_local = O(HW·w²·C)',
            'H = W = 128、w = 7 时，局部窗口计算量约为全局的 0.3%。',
            '## 接入示意',
            'insert_after: d2',
            '## 证据边界',
            '设计动机不等于性能收益；模块 b 的作用由 E2 成对对照检验。',
            '“全局上下文可以替代多尺度金字塔”按待核实处理。[6]',
          ], sources: [
            { op: 'add', cite: 'c4', text: '新增 [4] notes/method-notes.md 第 40–52 行' },
            { op: 'change', cite: 'c1', text: '[1] p01-window-attention.pdf 来源版本 sha256:9b1e… → 3f2a…（重新导出，文字未变）' },
            { op: 'add', cite: 'c6', text: '新增 [6] notes/old-draft.md（当前工作区中缺失，标记待核实）' },
          ] },
          { v: 'v3', at: '2026.10.18 20:31', by: 'wiki-maintain', trace: null, note: '新增两类机制对比表；接入位置改为 d3', lines: [
            '## 动机',
            '细裂缝在下采样过程中容易丢失，分割网络在这类目标上的召回偏低。[3]',
            '局部窗口内的自注意力可以增强细长结构的边缘响应。[1]',
            '全局上下文聚合补充远距离的结构连续性线索。[2]',
            '## 两类机制对比',
            '| 局部窗口注意力 | w×w 窗口 | 窗口内多头自注意力 | 线性 |',
            '| 全局上下文聚合 | 整幅特征图 | 非局部块 | 二次 |',
            '## 计算代价',
            'Ω_global = O((HW)²C)，Ω_local = O(HW·w²·C)',
            '## 接入示意',
            'insert_after: d3',
          ], sources: [
            { op: 'add', cite: 'c2', text: '新增 [2] p02-global-context.pdf 第 3 页' },
          ] },
          { v: 'v2', at: '2026.10.12 22:05', by: 'wiki-maintain', trace: null, note: '补充计算代价公式', lines: [
            '## 动机',
            '细裂缝在下采样过程中容易丢失，分割网络在这类目标上的召回偏低。[3]',
            '局部窗口内的自注意力可以增强细长结构的边缘响应。[1]',
            '## 计算代价',
            'Ω_global = O((HW)²C)，Ω_local = O(HW·w²·C)',
            '## 接入示意',
            'insert_after: d3',
          ], sources: [] },
          { v: 'v1', at: '2026.10.08 19:40', by: 'wiki-maintain', trace: null, note: '首次整理', lines: [
            '## 动机',
            '细裂缝在下采样过程中容易丢失，分割网络在这类目标上的召回偏低。[3]',
            '局部窗口内的自注意力可以增强细长结构的边缘响应。[1]',
          ], sources: [
            { op: 'add', cite: 'c1', text: '新增 [1] p01-window-attention.pdf 第 4 页' },
            { op: 'add', cite: 'c3', text: '新增 [3] baseline-report-2025.pdf 表 3' },
          ] },
        ],
      },
      {
        id: 'W-02', title: '基线 A：多尺度编码-解码分割网络', type: '方法', group: 'method', review: 'reviewed',
        summary: '本项目的对照基线：ResNet-50 编码器、四级特征金字塔、三阶段解码器，输出裂缝像素掩码。',
        version: 'v3', updated: '2026.10.18', words: 980, file: 'wiki/methods/baseline-a.md',
        topics: ['基线', '编码-解码'],
        citations: ['c7', 'c8'],
        body: `
<p>基线 A 由编码器、特征金字塔、解码器与分割头四部分组成{{c:c8}}。它是所有方案的对照组；每个方案只在它上面改一个位置，便于成对比较。</p>
<h2>结构</h2>
<table>
<thead><tr><th>部分</th><th>输出尺寸（输入 1024²）</th><th>通道</th></tr></thead>
<tbody>
<tr><td>编码器 e1–e4</td><td>256² → 32²</td><td>256 / 512 / 1024 / 2048</td></tr>
<tr><td>特征金字塔</td><td>4 个尺度</td><td>256</td></tr>
<tr><td>解码器 d1–d3</td><td>64² → 256²</td><td>256</td></tr>
<tr><td>分割头</td><td>1024²</td><td>1</td></tr>
</tbody>
</table>
<h2>已知表现</h2>
<p>历史报告给出的细裂缝召回为 0.61{{c:c7}}，但它采用实例级定义和随机划分，与本项目协议不同。本轮在固定划分上的复现见 {{r:plan:E1}}，并按 [[W-07]] 的定义计算。</p>`,
        versions: [
          { v: 'v3', at: '2026.10.18 20:31', by: 'wiki-maintain', note: '补充“已知表现”与协议差异说明', lines: ['## 结构', '编码器 e1–e4；特征金字塔；解码器 d1–d3；分割头', '## 已知表现', '历史报告细裂缝召回 0.61（实例级、随机划分），与本项目协议不同。'], sources: [{ op: 'add', cite: 'c7', text: '新增 [1] baseline-report-2025.pdf 表 2' }] },
          { v: 'v2', at: '2026.10.12 22:05', by: 'wiki-maintain', note: '补充结构表', lines: ['## 结构', '编码器 e1–e4；特征金字塔；解码器 d1–d3；分割头'], sources: [] },
          { v: 'v1', at: '2026.10.08 19:40', by: 'wiki-maintain', note: '首次整理', lines: ['## 结构', '编码器、金字塔、解码器、分割头'], sources: [{ op: 'add', cite: 'c8', text: '新增 [2] p04-multiscale-seg.pdf 第 3 页' }] },
        ],
      },
      {
        id: 'W-03', title: '模块 b：局部窗口注意力', type: '模块', group: 'method', review: 'pending',
        summary: '在 7×7 窗口内做多头自注意力，计算量随像素数线性增长；本项目的候选接入位置是解码器 d2 之后（方案 S1）。',
        version: 'v5', updated: '2026.10.25', words: 1240, file: 'wiki/methods/module-b.md',
        topics: ['注意力机制', '细节保真'],
        citations: ['c9', 'c10', 'c11'],
        body: `
<p>原文把窗口注意力用在编码器的每个阶段，并在细长目标上报告了更强的边缘响应{{c:c9}}。本项目不改编码器，只把它插入解码器 d2 之后，需要先用 1×1 卷积把 256 通道投影到 128{{c:c10}}。</p>
<h2>与原文的差异</h2>
<ul>
<li>位置：原文在编码器内部；本项目在解码器 d2 之后。</li>
<li>任务：原文是通用分割；本项目是裂缝分割。</li>
<li>模块本身与原文一致。换一个位置、换一个名字，不等于新的方法。</li>
</ul>
<h2>已知风险</h2>
<p>原文在 512² 输入下报告推理延迟增加约 8%{{c:c11}}；本项目输入为 1024²，延迟需要实测，见 {{r:run:R-E2-02}}。另有来源指出，在 20% 标注噪声下窗口注意力没有显著增益，与原文结论存在冲突，见问题 {{k:Q-08}}。</p>
<p>与 [[W-04]] 的对比见 [[W-01]]；显存约束见 [[W-11]]。</p>`,
        versions: [
          { v: 'v5', at: '2026.10.25 21:08', by: 'wiki-maintain', note: '补充延迟风险；关联问题 Q-08', lines: ['## 与原文的差异', '位置：解码器 d2 之后', '## 已知风险', '原文 512² 下延迟约 +8%；1024² 需实测。', '20% 标注噪声下可能无增益（Q-08）。'], sources: [{ op: 'add', cite: 'c11', text: '新增 [3] p01 第 9 页表 5' }] },
          { v: 'v4', at: '2026.10.23 18:01', by: 'academic-tailor', note: '修改接入位置描述（与 s-0412 的修改冲突，已记录）', lines: ['## 与原文的差异', '位置：解码器 d2 之后', '## 已知风险', '延迟待实测。'], sources: [] },
        ],
      },
      {
        id: 'W-04', title: '模块 c：全局上下文聚合', type: '模块', group: 'method', review: 'pending',
        summary: '非局部块对每个位置聚合全图特征，可补充长裂缝的连续性线索；显存开销随分辨率二次增长，具体数值待核实（问题 Q-03）。',
        version: 'v3', updated: '2026.10.23', words: 860, file: 'wiki/methods/module-c.md',
        topics: ['上下文聚合', '结构连贯'],
        citations: ['c12', 'c13', 'c14'],
        body: `
<p>非局部块对特征图上的每个位置计算与全部位置的相关性，再加权聚合{{c:c12}}。方案 S2 把它作为并联分支接在瓶颈层。</p>
<h2>显存开销</h2>
<p>原文第 5 页给出：512² 输入下额外显存约 +35%{{c:c13}}。方法笔记记录：1024² 输入、batch 8 时显存溢出{{c:c14}}。两者分辨率和 batch 都不同，不能直接判定谁对，见问题 {{k:Q-03}}。</p>
<p>原文第 6–12 页为扫描图像，Wiki 整理时没能读取，其中的显存表格尚未核对。</p>`,
        versions: [
          { v: 'v3', at: '2026.10.23 18:01', by: 'academic-tailor', note: '补充显存冲突说明', lines: ['## 显存开销', '512² 下 +35%（原文第 5 页）', '1024²、batch 8 时溢出（笔记）', '第 6–12 页为扫描图像，未核对。'], sources: [{ op: 'add', cite: 'c14', text: '新增 [3] notes/method-notes.md 第 88–95 行' }] },
          { v: 'v2', at: '2026.10.18 20:31', by: 'wiki-maintain', note: '补充显存开销', lines: ['## 显存开销', '512² 下 +35%（原文第 5 页）'], sources: [{ op: 'add', cite: 'c13', text: '新增 [2] p02 第 5 页' }] },
        ],
      },
      {
        id: 'W-05', title: '细裂缝漏检问题', type: '问题', group: 'concept', review: 'reviewed',
        summary: '宽度 ≤ 3 像素的裂缝在基线中召回显著偏低，这是本项目的出发问题。',
        version: 'v4', updated: '2026.10.21', words: 1120, file: 'wiki/concepts/thin-crack-miss.md',
        topics: ['细裂缝漏检'],
        citations: ['c15', 'c16', 'c17'],
        body: `
<p>历史报告给出：宽度 ≤ 3 像素的裂缝召回为 0.61，整体召回为 0.83{{c:c15}}。本轮在固定划分上复现，细裂缝召回 0.607 ± 0.012（3 个种子），见 {{r:plan:E1}} 与结论 {{r:concl:K-01}}。</p>
<h2>可能成因</h2>
<ul>
<li>下采样丢失细节：编码器把 1024² 压到 32²，细裂缝在高层特征中几乎消失{{c:c16}}。</li>
<li>标注噪声：细裂缝的标注一致性最差{{c:c17}}，召回偏低可能部分来自标签本身。</li>
</ul>
<h2>还不能下的结论</h2>
<p>两种成因尚未用实验分开。在分开之前，不能把召回提升直接归因于“细节保真”，见 [[W-10]]。评估定义见 [[W-07]]，数据见 [[W-06]]。</p>`,
        versions: [
          { v: 'v4', at: '2026.10.21 10:12', by: 'wiki-maintain', note: '加入本轮复现结论 K-01', lines: ['历史报告：细裂缝 0.61 / 整体 0.83', '本轮复现：0.607 ± 0.012（E1）', '## 可能成因', '下采样丢失细节', '标注噪声'], sources: [] },
          { v: 'v3', at: '2026.10.18 20:31', by: 'wiki-maintain', note: '补充标注噪声成因', lines: ['历史报告：细裂缝 0.61 / 整体 0.83', '## 可能成因', '下采样丢失细节', '标注噪声'], sources: [{ op: 'add', cite: 'c17', text: '新增 [3] p05-label-noise.pdf 第 2 页' }] },
        ],
      },
      {
        id: 'W-06', title: '桥梁裂缝图像集 v2', type: '数据', group: 'data', review: 'reviewed',
        summary: '3,300 张 1024×1024 巡检图像，固定划分 2,400 / 300 / 600，像素级标注。',
        version: 'v2', updated: '2026.10.18', words: 640, file: 'wiki/data/bridge-crack-v2.md',
        topics: ['数据集'],
        citations: ['c18', 'c19'],
        body: `
<table>
<thead><tr><th>划分</th><th class="num">张数</th><th class="num">细裂缝像素占比</th></tr></thead>
<tbody>
<tr><td>训练</td><td class="num">2,400</td><td class="num">0.42%</td></tr>
<tr><td>验证</td><td class="num">300</td><td class="num">0.39%</td></tr>
<tr><td>测试</td><td class="num">600</td><td class="num">0.44%</td></tr>
</tbody>
</table>
<p>数据说明见{{c:c18}}；标注规范见{{c:c19}}。标注噪声比例曾出现 12% 与 20% 两个数字，已确认是像素级与实例级两种口径，见问题 {{k:Q-07}}（已解决）。指标定义见 [[W-07]]。</p>`,
        versions: [
          { v: 'v2', at: '2026.10.18 20:31', by: 'wiki-maintain', note: '补充标注噪声口径', lines: ['划分 2,400 / 300 / 600', '噪声：像素级 12%，实例级 20%'], sources: [{ op: 'add', cite: 'c19', text: '新增 [2] LABELING.md' }] },
          { v: 'v1', at: '2026.10.08 19:40', by: 'wiki-maintain', note: '首次整理', lines: ['划分 2,400 / 300 / 600'], sources: [{ op: 'add', cite: 'c18', text: '新增 [1] README.md' }] },
        ],
      },
      {
        id: 'W-07', title: '评估指标：细裂缝召回率与 mIoU', type: '指标', group: 'data', review: 'reviewed',
        summary: '主指标为宽度 ≤ 3 px 裂缝的像素召回（eval_v2 脚本），mIoU 作为保护指标。',
        version: 'v2', updated: '2026.10.12', words: 520, file: 'wiki/data/metrics.md',
        topics: ['评估'],
        citations: ['c20'],
        body: `
<p>细裂缝召回只统计宽度 ≤ 3 像素的裂缝像素{{c:c20}}：</p>
<math display="block"><mrow><msub><mtext>Recall</mtext><mtext>thin</mtext></msub><mo>=</mo><mfrac><msub><mtext>TP</mtext><mtext>thin</mtext></msub><mrow><msub><mtext>TP</mtext><mtext>thin</mtext></msub><mo>+</mo><msub><mtext>FN</mtext><mtext>thin</mtext></msub></mrow></mfrac></mrow></math>
<p>方向：越高越好。聚合：每个变体 3 个种子取均值 ± 标准差。历史报告用的是“实例 IoU ≥ 0.5 即算召回”，与这里的像素级定义不同，两者不能直接比较。数据见 [[W-06]]。</p>`,
        versions: [
          { v: 'v2', at: '2026.10.12 22:05', by: 'wiki-maintain', note: '补充与历史报告口径的差异', lines: ['像素级细裂缝召回（eval_v2）', '历史报告为实例级 IoU ≥ 0.5，不可直接比较'], sources: [] },
          { v: 'v1', at: '2026.10.08 19:40', by: 'wiki-maintain', note: '首次整理', lines: ['像素级细裂缝召回（eval_v2）'], sources: [{ op: 'add', cite: 'c20', text: '新增 [1] p03-crack-benchmark.pdf 第 5 页' }] },
        ],
      },
      {
        id: 'W-08', title: '对比与消融实验设计', type: '实验设计', group: 'design', review: 'pending',
        summary: '把方法主张拆成可证伪的成对对照：先 A 对 A+b，再视情况加入 A+c 与 A+b+c。',
        version: 'v3', updated: '2026.10.22', words: 900, file: 'wiki/design/ablation.md',
        topics: ['消融', '对照'],
        citations: ['c21', 'c22'],
        body: `
<p>会议约定先做 A 与 A+b 的成对对照，A+c 等显存问题核实后再排{{c:c21}}。每个对照固定数据划分、种子与预算，失败和取消的尝试保留记录{{c:c22}}。</p>
<ul>
<li>{{r:plan:E2}}：A 对 A+b，检验假设 H1。</li>
<li>{{r:plan:E3}}：A 对 A+c，等待方案 S2 的原文核对。</li>
<li>{{r:plan:E4}}：A+b+c，只有在 b、c 都能独立工作时才运行。</li>
</ul>
<p>预算口径（固定步数还是固定时长）尚未决定，见 [[W-09]] 与问题 {{k:Q-05}}。指标定义见 [[W-07]]。</p>`,
        versions: [
          { v: 'v3', at: '2026.10.22 15:40', by: 'wiki-maintain', note: '对齐 EXPERIMENT-PLAN.md v3', lines: ['E2：A 对 A+b', 'E3：A 对 A+c（等待 S2）', 'E4：A+b+c'], sources: [{ op: 'add', cite: 'c22', text: '新增 [2] p13-ablation-practice.pdf 第 2 页' }] },
        ],
      },
      {
        id: 'W-09', title: '预算公平性：固定步数与固定时长', type: '概念', group: 'concept', review: 'pending',
        summary: '固定训练步数与固定 GPU 时长回答的是不同问题；本项目尚未决定采用哪一种（问题 Q-05）。',
        version: 'v1', updated: '2026.10.20', words: 410, file: 'wiki/concepts/budget-fairness.md',
        topics: ['预算', '公平比较'],
        citations: ['c23'],
        body: `
<p>固定步数比较的是“同样的优化步数下谁学得更好”；固定时长比较的是“同样的计算资源下谁更划算”。模块 b 每一步慢约 12%{{c:c23}}，两种口径可能得出不同结论。</p>
<p>当前计划 {{r:plan:E2}} 采用固定步数。是否补做固定时长的对照，由问题 {{k:Q-05}} 的决议决定。</p>`,
        versions: [
          { v: 'v1', at: '2026.10.20 11:02', by: 'wiki-maintain', note: '首次整理', lines: ['固定步数 vs 固定时长', '模块 b 每步慢约 12%'], sources: [{ op: 'add', cite: 'c23', text: '新增 [1] notes/method-notes.md 第 102–110 行' }] },
        ],
      },
      {
        id: 'W-10', title: '证据与叙事边界', type: '叙事', group: 'design', review: 'reviewed',
        summary: '叙事中的每项贡献必须能指向来源或实验；设计动机、实际观察和解释分开写。',
        version: 'v2', updated: '2026.10.20', words: 560, file: 'wiki/design/story-evidence.md',
        topics: ['叙事'],
        citations: ['c24'],
        body: `
<p>会议约定：叙事以一个清楚的问题为主线，每项贡献都要对应来源或实验；没有运行的实验作为待补证据，不填推测的指标{{c:c24}}。</p>
<ul>
<li>设计解释不等于因果证据。</li>
<li>总指标提升不能单独证明某个模块的作用机制。</li>
<li>执行成功不等于假设成立。</li>
</ul>
<p>当前叙事见 {{r:story:main}}；实验安排见 [[W-08]]。</p>`,
        versions: [
          { v: 'v2', at: '2026.10.20 11:02', by: 'wiki-maintain', note: '补充三条边界', lines: ['设计解释 ≠ 因果证据', '总指标提升 ≠ 模块机制', '执行成功 ≠ 假设成立'], sources: [] },
          { v: 'v1', at: '2026.10.12 22:05', by: 'wiki-maintain', note: '首次整理', lines: ['每项贡献对应来源或实验'], sources: [{ op: 'add', cite: 'c24', text: '新增 [1] meeting-2026-10-12.md 第 20–26 行' }] },
        ],
      },
      {
        id: 'W-11', title: '计算成本与显存约束', type: '约束', group: 'data', review: 'pending',
        summary: '单卡 A100 40 GB；1024² 输入下 A+b 在 batch 16 时显存溢出（R-E2-01），改为 batch 8 加梯度累积。',
        version: 'v3', updated: '2026.10.25', words: 480, file: 'wiki/data/compute.md',
        topics: ['资源', '显存'],
        citations: ['c25', 'c26'],
        body: `
<table>
<thead><tr><th>变体</th><th>batch</th><th class="num">峰值显存</th><th>来源</th></tr></thead>
<tbody>
<tr><td>A</td><td>16</td><td class="num">22.4 GB</td><td>{{r:run:R-E1-01}}</td></tr>
<tr><td>A+b</td><td>16</td><td class="num">溢出</td><td>{{r:run:R-E2-01}}</td></tr>
<tr><td>A+b</td><td>8 + 梯度累积 2</td><td class="num">31.2 GB</td><td>{{r:run:R-E2-02}}</td></tr>
<tr><td>A+c</td><td>—</td><td class="num">未知</td><td>没有真实运行</td></tr>
</tbody>
</table>
<p>A+c 的显存只能参考原文与笔记，两者存在冲突{{c:c25}}，见问题 {{k:Q-03}}。原文延迟数据见{{c:c26}}。预算口径见 [[W-09]]。</p>`,
        versions: [
          { v: 'v3', at: '2026.10.25 21:09', by: 'wiki-maintain', note: '加入 R-E2-01 溢出记录', lines: ['A：22.4 GB（b16）', 'A+b：b16 溢出；b8 + 累积 31.2 GB', 'A+c：未知'], sources: [] },
        ],
      },
      {
        id: 'W-12', title: '相关工作：裂缝分割方法综述', type: '综述', group: 'survey', review: 'pending',
        summary: '按“局部细节 / 全局上下文 / 多尺度”三条线整理已读论文；新颖性检索尚未完成（问题 Q-11）。',
        version: 'v2', updated: '2026.10.25', words: 1530, file: 'wiki/survey/crack-seg.md',
        topics: ['相关工作', '新颖性'],
        citations: ['c27', 'c28'],
        body: `
<p>已读论文按三条线归类：局部细节（[[W-03]]）、全局上下文（[[W-04]]）、多尺度（[[W-02]]）。综述类来源只处理了前 30 页{{c:c27}}，第 31–46 页尚未读取。</p>
<p>注意力可视化方法的整理计划写在 [[W-15|注意力可视化方法]]，但该页不在当前快照中。</p>
<p>早期草稿里有一份对比清单{{c:c28}}，其来源文件已不在工作区。新颖性检索未完成，“把窗口注意力放在解码器”是否已有先例，见问题 {{k:Q-11}}。</p>`,
        versions: [
          { v: 'v2', at: '2026.10.25 21:10', by: 'wiki-maintain', note: '标注综述只处理到第 30 页', lines: ['三条线：局部 / 全局 / 多尺度', '综述来源只处理前 30 页'], sources: [{ op: 'add', cite: 'c27', text: '新增 [1] p07-attention-survey.pdf 第 12 页' }] },
          { v: 'v1', at: '2026.10.12 22:05', by: 'wiki-maintain', note: '首次整理', lines: ['三条线：局部 / 全局 / 多尺度'], sources: [{ op: 'add', cite: 'c28', text: '新增 [2] notes/old-draft.md' }] },
        ],
      },
    ],

    /* ---------------- 引用：页码/行号、片段、来源版本；更深层是 ID/hash/字节范围 ---------------- */
    citations: {
      c1: { page: 'W-01', n: 1, source: 'src-01', loc: '第 4 页 │ 第 2 栏 │ 第 12–18 行', excerpt: '在每个 7×7 窗口内计算自注意力，使计算量随像素数线性增长；在细长目标上，窗口注意力的边缘响应高于同等深度的卷积基线。', mark: '边缘响应高于同等深度的卷积基线', srcVersion: 'sha256:3f2a9c…e17b', cid: 'cit-0193', bytes: '18,422–19,107' },
      c2: { page: 'W-01', n: 2, source: 'src-02', loc: '第 3 页 │ 第 1 栏 │ 第 5–11 行', excerpt: '非局部操作对每个位置聚合全图特征，可以捕获远距离依赖，但计算与显存随分辨率二次增长。', mark: '随分辨率二次增长', srcVersion: 'sha256:a71d02…44c0', cid: 'cit-0194', bytes: '9,880–10,412' },
      c3: { page: 'W-01', n: 3, source: 'src-07', loc: '表 3 │ 第 9 页', excerpt: '宽度不超过 3 像素的裂缝召回为 0.61，显著低于整体召回 0.83。', mark: '0.61', srcVersion: 'sha256:5be810…09aa', cid: 'cit-0195', bytes: '41,006–41,288' },
      c4: { page: 'W-01', n: 4, source: 'src-05', loc: '第 40–52 行', excerpt: '基线 A 已包含 4 级特征金字塔；新增模块要避免与金字塔融合层重复建模。', mark: '避免与金字塔融合层重复建模', srcVersion: 'sha256:c90e11…7d21', cid: 'cit-0231', bytes: '2,310–2,902' },
      c5: { page: 'W-01', n: 5, source: 'src-06', loc: '第 8–15 行', excerpt: '先做 A 与 A+b 的成对对照；A+c 等显存问题核实后再排。', mark: '先做 A 与 A+b 的成对对照', srcVersion: 'sha256:0d44b2…a913', cid: 'cit-0232', bytes: '412–860' },
      c6: { page: 'W-01', n: 6, source: 'src-11', loc: '第 3 段（快照 v12 时记录）', excerpt: '全局上下文可以替代多尺度金字塔。', mark: '', srcVersion: 'sha256:77f0a3…（快照 v12）', cid: 'cit-0108', bytes: '1,204–1,251', missing: true },
      c7: { page: 'W-02', n: 1, source: 'src-07', loc: '表 2 │ 第 7 页', excerpt: '基线网络在测试集上的细裂缝召回为 0.61（实例级，IoU ≥ 0.5）。', mark: '实例级，IoU ≥ 0.5', srcVersion: 'sha256:5be810…09aa', cid: 'cit-0150', bytes: '33,120–33,371' },
      c8: { page: 'W-02', n: 2, source: 'src-04', loc: '第 3 页 │ 图 2', excerpt: '编码器输出经四级特征金字塔自顶向下融合，再由三阶段解码器逐级上采样。', mark: '四级特征金字塔', srcVersion: 'sha256:e2c4a8…1f09', cid: 'cit-0101', bytes: '7,744–8,103' },
      c9: { page: 'W-03', n: 1, source: 'src-01', loc: '第 3 页 │ 第 1 栏 │ 第 20–27 行', excerpt: '窗口注意力被放在编码器的每个阶段，窗口之间通过移位交换信息。', mark: '编码器的每个阶段', srcVersion: 'sha256:3f2a9c…e17b', cid: 'cit-0188', bytes: '12,016–12,540' },
      c10: { page: 'W-03', n: 2, source: 'src-05', loc: '第 60–71 行', excerpt: '插入 d2 之后时，d2 输出为 256 通道，需要 1×1 投影到 128 再回到 256，残差相加。', mark: '1×1 投影到 128', srcVersion: 'sha256:c90e11…7d21', cid: 'cit-0240', bytes: '3,511–4,107' },
      c11: { page: 'W-03', n: 3, source: 'src-01', loc: '第 9 页 │ 表 5', excerpt: '512×512 输入下，加入窗口注意力后推理延迟增加约 8%。', mark: '约 8%', srcVersion: 'sha256:3f2a9c…e17b', cid: 'cit-0261', bytes: '44,902–45,130' },
      c12: { page: 'W-04', n: 1, source: 'src-02', loc: '第 3 页 │ 第 2 栏', excerpt: '非局部块计算每个位置与全部位置的相关性，按相关性加权聚合特征。', mark: '与全部位置的相关性', srcVersion: 'sha256:a71d02…44c0', cid: 'cit-0196', bytes: '10,413–10,980' },
      c13: { page: 'W-04', n: 2, source: 'src-02', loc: '第 5 页 │ 表 2', excerpt: '512×512 输入下，非局部块带来的额外显存约为 35%。', mark: '约为 35%', srcVersion: 'sha256:a71d02…44c0', cid: 'cit-0197', bytes: '18,201–18,466' },
      c14: { page: 'W-04', n: 3, source: 'src-05', loc: '第 88–95 行', excerpt: '1024² 输入、batch 8 时 A+c 显存溢出，未能完成一个 epoch。', mark: '显存溢出', srcVersion: 'sha256:c90e11…7d21', cid: 'cit-0262', bytes: '5,980–6,421' },
      c15: { page: 'W-05', n: 1, source: 'src-07', loc: '表 3 │ 第 9 页', excerpt: '宽度不超过 3 像素的裂缝召回为 0.61，显著低于整体召回 0.83。', mark: '0.83', srcVersion: 'sha256:5be810…09aa', cid: 'cit-0151', bytes: '41,006–41,288' },
      c16: { page: 'W-05', n: 2, source: 'src-04', loc: '第 6 页 │ 第 1 栏', excerpt: '经 32 倍下采样后，宽度小于步长的结构在高层特征中几乎不可分辨。', mark: '几乎不可分辨', srcVersion: 'sha256:e2c4a8…1f09', cid: 'cit-0152', bytes: '15,302–15,690' },
      c17: { page: 'W-05', n: 3, source: 'src-10', loc: '第 2 页 │ 第 2 栏', excerpt: '细长目标的标注一致性最低，两名标注者的像素重合率仅为 0.58。', mark: '0.58', srcVersion: 'sha256:19ad7e…c2b4', cid: 'cit-0263', bytes: '4,410–4,733' },
      c18: { page: 'W-06', n: 1, source: 'src-08', loc: '第 1–24 行', excerpt: '共 3,300 张 1024×1024 图像，按固定划分为训练 2,400、验证 300、测试 600。', mark: '固定划分', srcVersion: 'sha256:8c02f1…3e5d', cid: 'cit-0102', bytes: '0–1,180' },
      c19: { page: 'W-06', n: 2, source: 'src-24', loc: '第 30–41 行', excerpt: '像素级噪声按复标注不一致像素占比统计；实例级噪声按缺失或多余实例占比统计。', mark: '像素级', srcVersion: 'sha256:4f9b20…d811', cid: 'cit-0264', bytes: '1,902–2,416' },
      c20: { page: 'W-07', n: 1, source: 'src-03', loc: '第 5 页 │ 第 1 栏', excerpt: '细裂缝召回定义为宽度不超过 3 像素的裂缝像素中被正确检出的比例。', mark: '宽度不超过 3 像素', srcVersion: 'sha256:b3e7c1…6a02', cid: 'cit-0110', bytes: '11,220–11,604' },
      c21: { page: 'W-08', n: 1, source: 'src-06', loc: '第 8–15 行', excerpt: '先做 A 与 A+b 的成对对照；A+c 等显存问题核实后再排。', mark: 'A+c 等显存问题核实后再排', srcVersion: 'sha256:0d44b2…a913', cid: 'cit-0233', bytes: '412–860' },
      c22: { page: 'W-08', n: 2, source: 'src-25', loc: '第 2 页 │ 第 2 栏', excerpt: '消融实验应保留失败与取消的尝试，只报告最佳结果会高估方法收益。', mark: '只报告最佳结果会高估方法收益', srcVersion: 'sha256:6d1a90…b7e3', cid: 'cit-0265', bytes: '5,502–5,940' },
      c23: { page: 'W-09', n: 1, source: 'src-05', loc: '第 102–110 行', excerpt: 'A+b 每步耗时比 A 多约 12%；固定 40k 步时，A+b 实际多用约 40 分钟 GPU 时间。', mark: '约 12%', srcVersion: 'sha256:c90e11…7d21', cid: 'cit-0266', bytes: '7,031–7,566' },
      c24: { page: 'W-10', n: 1, source: 'src-06', loc: '第 20–26 行', excerpt: '每项贡献都要对应来源或实验；未运行的实验作为待补证据，不填推测指标。', mark: '不填推测指标', srcVersion: 'sha256:0d44b2…a913', cid: 'cit-0234', bytes: '1,402–1,880' },
      c25: { page: 'W-11', n: 1, source: 'src-05', loc: '第 88–95 行', excerpt: '1024² 输入、batch 8 时 A+c 显存溢出，未能完成一个 epoch。', mark: 'batch 8', srcVersion: 'sha256:c90e11…7d21', cid: 'cit-0267', bytes: '5,980–6,421' },
      c26: { page: 'W-11', n: 2, source: 'src-01', loc: '第 9 页 │ 表 5', excerpt: '512×512 输入下，加入窗口注意力后推理延迟增加约 8%。', mark: '512×512', srcVersion: 'sha256:3f2a9c…e17b', cid: 'cit-0268', bytes: '44,902–45,130' },
      c27: { page: 'W-12', n: 1, source: 'src-13', loc: '第 12 页', excerpt: '注意力机制在分割中的使用位置可分为编码器内、跳连处与解码器内三类。', mark: '解码器内', srcVersion: 'sha256:2e8f44…90c1', cid: 'cit-0269', bytes: '30,118–30,560' },
      c28: { page: 'W-12', n: 2, source: 'src-11', loc: '第 7 段（快照 v12 时记录）', excerpt: '对比清单：局部 4 篇、全局 3 篇、多尺度 2 篇。', mark: '', srcVersion: 'sha256:77f0a3…（快照 v12）', cid: 'cit-0109', bytes: '3,020–3,101', missing: true },
    },

    /* ---------------- 来源与覆盖：用户指定范围内的全部文件 ---------------- */
    coverage: {
      run: 'tr-0425', by: 'wiki-maintain', at: '2026.10.25 20:58 – 21:14',
      scope: ['papers/', 'notes/', 'reports/', 'data/bridge-crack-v2/*.md'],
      excluded: ['notes/private/（用户在本轮指令中排除）'],
      commit: { ok: true, text: '快照 v14 已写入 wiki/', at: '2026.10.25 21:14' },
      review: { done: 3, total: 12, text: '语义复核：3 / 12 页由研究者确认' },
    },
    sources: [
      { id: 'src-01', path: 'papers/p01-window-attention.pdf', kind: '论文', year: '2023', status: 'processed', size: '14 页', range: '第 1–14 页', note: '本轮重新导出，来源版本变化，文字未变' },
      { id: 'src-02', path: 'papers/p02-global-context.pdf', kind: '论文', year: '2022', status: 'partial', size: '12 页', range: '第 1–5 页', unread: '第 6–12 页', reason: '第 6 页起为扫描图像，没有文字层，本轮未启用 OCR' },
      { id: 'src-03', path: 'papers/p03-crack-benchmark.pdf', kind: '论文', year: '2024', status: 'reused', size: '11 页', range: '第 1–11 页' },
      { id: 'src-04', path: 'papers/p04-multiscale-seg.pdf', kind: '论文', year: '2020', status: 'reused', size: '9 页', range: '第 1–9 页' },
      { id: 'src-10', path: 'papers/p05-label-noise.pdf', kind: '论文', year: '2024', status: 'processed', size: '10 页', range: '第 1–10 页', note: '本轮新增' },
      { id: 'src-12', path: 'papers/p06-thin-structure.pdf', kind: '论文', year: '2021', status: 'reused', size: '8 页', range: '第 1–8 页' },
      { id: 'src-13', path: 'papers/p07-attention-survey.pdf', kind: '综述', year: '2023', status: 'partial', size: '46 页', range: '第 1–30 页', unread: '第 31–46 页', reason: '超过单次处理上限 30 页，剩余部分留待下一轮' },
      { id: 'src-14', path: 'papers/p08-bridge-inspection.pdf', kind: '论文', year: '2022', status: 'reused', size: '12 页', range: '第 1–12 页' },
      { id: 'src-15', path: 'papers/p09-scan-only.pdf', kind: '论文', year: '2019', status: 'failed', size: '8 页', range: '—', unread: '全部 8 页', reason: '扫描件，没有文字层；本轮未启用 OCR' },
      { id: 'src-16', path: 'papers/p10-efficient-attn.pdf', kind: '论文', year: '2023', status: 'reused', size: '10 页', range: '第 1–10 页' },
      { id: 'src-17', path: 'papers/p11-crack-dataset-v1.pdf', kind: '数据论文', year: '2021', status: 'reused', size: '7 页', range: '第 1–7 页' },
      { id: 'src-18', path: 'papers/p12-loss-functions.pdf', kind: '论文', year: '2022', status: 'reused', size: '9 页', range: '第 1–9 页' },
      { id: 'src-25', path: 'papers/p13-ablation-practice.pdf', kind: '论文', year: '2024', status: 'processed', size: '6 页', range: '第 1–6 页', note: '本轮新增' },
      { id: 'src-05', path: 'notes/method-notes.md', kind: '方法笔记', year: '2026.10.24', status: 'processed', size: '131 行', range: '第 1–131 行', note: '新增第 40–52、88–110 行' },
      { id: 'src-06', path: 'notes/meeting-2026-10-12.md', kind: '会议记录', year: '2026.10.12', status: 'processed', size: '38 行', range: '第 1–38 行', note: '本轮新增' },
      { id: 'src-19', path: 'notes/reading-log.md', kind: '阅读记录', year: '2026.10.20', status: 'reused', size: '86 行', range: '第 1–86 行' },
      { id: 'src-20', path: 'notes/ideas.md', kind: '笔记', year: '2026.10.15', status: 'reused', size: '44 行', range: '第 1–44 行' },
      { id: 'src-26', path: 'notes/todo.md', kind: '笔记', year: '2026.10.21', status: 'reused', size: '19 行', range: '第 1–19 行' },
      { id: 'src-21', path: 'notes/private/diary-1.md', kind: '笔记', year: '—', status: 'excluded', size: '—', range: '—', reason: '用户在本轮指令中排除 notes/private/' },
      { id: 'src-22', path: 'notes/private/diary-2.md', kind: '笔记', year: '—', status: 'excluded', size: '—', range: '—', reason: '用户在本轮指令中排除 notes/private/' },
      { id: 'src-07', path: 'reports/baseline-report-2025.pdf', kind: '历史报告', year: '2025', status: 'reused', size: '18 页', range: '第 1–18 页', note: '历史报告：其中的结果不是本轮实验' },
      { id: 'src-23', path: 'reports/group-meeting-slides.pptx', kind: '幻灯片', year: '2026.10.12', status: 'failed', size: '24 页', range: '—', unread: '全部', reason: '格式不支持（.pptx）；需要导出为 PDF 后再处理' },
      { id: 'src-08', path: 'data/bridge-crack-v2/README.md', kind: '数据说明', year: '2026.09', status: 'reused', size: '52 行', range: '第 1–52 行' },
      { id: 'src-24', path: 'data/bridge-crack-v2/LABELING.md', kind: '标注规范', year: '2026.09', status: 'processed', size: '64 行', range: '第 1–64 行', note: '本轮新增' },
      /* 不在磁盘上：只在旧快照的引用记录里出现 */
      { id: 'src-11', path: 'notes/old-draft.md', kind: '笔记', year: '—', status: 'missing', size: '—', range: '—', reason: '快照 v12 时存在，当前工作区中找不到该文件', outside: true },
    ],
    /* 来源片段的上下文（来源抽屉里的内嵌原文）；只给出示例中被引用最多的几份 */
    sourceContext: {
      'src-01': [
        { n: 10, t: '3.2 窗口注意力' },
        { n: 11, t: '为降低全局注意力的二次复杂度，我们把特征图切成互不重叠的窗口。' },
        { n: 12, t: '在每个 7×7 窗口内计算自注意力，使计算量随像素数线性增长；' },
        { n: 13, t: '相邻层之间把窗口平移半个窗口，使信息跨窗口流动。' },
        { n: 14, t: '在细长目标上，窗口注意力的边缘响应高于同等深度的卷积基线' },
        { n: 15, t: '（图 4），尤其是宽度不足 4 像素的结构。' },
        { n: 16, t: '这一现象在高分辨率输入下更明显。' },
        { n: 17, t: '我们没有在带噪标注的数据上评估这一点。' },
        { n: 18, t: '' },
        { n: 19, t: '3.3 复杂度' },
      ],
      'src-02': [
        { n: 3, t: '2 非局部操作' },
        { n: 4, t: '给定输入特征 x，非局部操作对每个位置 i 计算其与所有位置 j 的相关性。' },
        { n: 5, t: '非局部操作对每个位置聚合全图特征，' },
        { n: 6, t: '可以捕获远距离依赖，' },
        { n: 7, t: '但计算与显存随分辨率二次增长。' },
        { n: 8, t: '在 512×512 输入下这一开销尚可接受（见第 5 页表 2）。' },
        { n: 9, t: '更高分辨率的结果见第 6 页表 3。' },
      ],
      'src-07': [
        { n: 1, t: '表 3  按裂缝宽度分组的召回（测试集，随机划分 v1）' },
        { n: 2, t: '宽度 ≤ 3 px    召回 0.61' },
        { n: 3, t: '宽度 4–8 px    召回 0.84' },
        { n: 4, t: '宽度 > 8 px    召回 0.93' },
        { n: 5, t: '全部          召回 0.83' },
        { n: 6, t: '注：召回按实例统计，IoU ≥ 0.5 记为检出。' },
      ],
      'src-05': [
        { n: 38, t: '## 基线 A 结构备忘' },
        { n: 39, t: '' },
        { n: 40, t: '基线 A 已包含 4 级特征金字塔；' },
        { n: 41, t: '新增模块要避免与金字塔融合层重复建模。' },
        { n: 42, t: '- 模块 b 只放在解码器一侧' },
        { n: 43, t: '- 模块 c 接在瓶颈层，作为并联分支' },
      ],
      'src-06': [
        { n: 6, t: '## 实验顺序' },
        { n: 7, t: '' },
        { n: 8, t: '先做 A 与 A+b 的成对对照；' },
        { n: 9, t: 'A+c 等显存问题核实后再排。' },
        { n: 10, t: '固定划分 v2，种子 0/1/2。' },
      ],
    },

    /* ---------------- 问题：同一问题跨多页只计一次 ---------------- */
    issues: [
      {
        id: 'Q-03', title: '模块 c 的显存开销', kind: 'conflict', status: 'verifying',
        summary: '原文与方法笔记给出的显存开销不一致，且原文关键表格在扫描页中，尚未核对。',
        sides: [
          { label: '原文', source: 'src-02', cite: 'c13', claim: '512×512 输入下，额外显存约 +35%。', condition: '输入 512²；batch 未说明' },
          { label: '方法笔记', source: 'src-05', cite: 'c14', claim: '1024² 输入、batch 8 时显存溢出。', condition: '输入 1024²；batch 8；A100 40 GB' },
        ],
        conditions: '两条记录的输入分辨率与 batch 都不同，可能都成立。需要原文第 6 页表 3（1024² 结果）来判断。',
        evidence: '原文第 6–12 页为扫描图像，Wiki 整理没有读取到文字（见覆盖面板）。',
        pages: ['W-04', 'W-11'], affects: ['scheme:S2', 'task:T-03', 'plan:E3'],
        log: [
          { at: '2026.10.18 20:31', by: 'wiki-maintain', text: '在 W-04 记录原文 +35% 的说法' },
          { at: '2026.10.23 17:51', by: 'academic-tailor', text: 'S2 资源检查发现与笔记冲突，登记为问题' },
          { at: '2026.10.23 18:02', by: 'academic-tailor', text: '原文核对失败：第 6 页无法提取文字；T-03 阻塞' },
        ],
      },
      {
        id: 'Q-05', title: '预算按固定步数还是固定时长', kind: 'conflict', status: 'open',
        summary: '会议约定与方法笔记对“公平预算”的口径不同，两种口径回答不同问题。',
        sides: [
          { label: '会议记录', source: 'src-06', cite: 'c21', claim: '按固定 40k 步比较。', condition: '关注同样优化步数下的效果' },
          { label: '方法笔记', source: 'src-05', cite: 'c23', claim: '按固定 GPU 时长比较更公平，因为 A+b 每步慢约 12%。', condition: '关注同样资源下的性价比' },
        ],
        conditions: '两种口径都合理，选择取决于论文要回答的问题；不是事实矛盾，而是待决定的设计选择。',
        evidence: '当前 E2 采用固定步数；E5 计划在决议需要时检验口径敏感性。',
        pages: ['W-08', 'W-09'], affects: ['plan:E2', 'plan:E5'],
        log: [
          { at: '2026.10.20 11:02', by: 'wiki-maintain', text: '在 W-09 记录两种口径' },
        ],
      },
      {
        id: 'Q-07', title: '数据集标注噪声比例', kind: 'conflict', status: 'resolved',
        summary: '数据说明写 12%，基准论文写 20%。',
        sides: [
          { label: '数据说明', source: 'src-08', cite: 'c18', claim: '标注噪声约 12%。', condition: '像素级统计' },
          { label: '基准论文', source: 'src-03', cite: 'c20', claim: '标注噪声约 20%。', condition: '实例级统计' },
        ],
        conditions: '同一数据版本 v2，统计口径不同。',
        evidence: 'LABELING.md 第 30–41 行给出两种口径的定义。',
        resolution: '两个数字都对：12% 为像素级，20% 为实例级。W-06 已分开写明。',
        pages: ['W-06'], affects: [],
        log: [
          { at: '2026.10.18 20:31', by: 'wiki-maintain', text: '合并时发现两个数字，登记问题' },
          { at: '2026.10.18 21:05', by: '研究者', text: '确认口径差异，标记已解决' },
        ],
      },
      {
        id: 'Q-08', title: '窗口注意力在标注噪声下是否有效', kind: 'conflict', status: 'open',
        summary: '原文报告细长目标的边缘响应增强；另一篇论文在 20% 标注噪声下没有观察到增益。',
        sides: [
          { label: '窗口注意力原文', source: 'src-01', cite: 'c9', claim: '细长目标上边缘响应高于卷积基线。', condition: '干净标注；通用分割数据' },
          { label: '标注噪声论文', source: 'src-10', cite: 'c17', claim: '20% 标注噪声下窗口注意力没有显著增益。', condition: '20% 实例级噪声；遥感道路数据' },
        ],
        conditions: '数据与噪声水平不同。本项目像素级噪声约 12%、实例级约 20%，介于两者之间。',
        evidence: 'E2 的结果目前证据不足，尚不能用来裁决。',
        pages: ['W-01', 'W-03', 'W-05'], affects: ['hyp:H1', 'plan:E2'],
        log: [
          { at: '2026.10.25 21:08', by: 'wiki-maintain', text: '新增来源 p05 后登记冲突' },
        ],
      },
      {
        id: 'Q-11', title: '“窗口注意力放在解码器”的新颖性', kind: 'gap', status: 'open',
        summary: '新颖性检索没有完成：综述只读到第 30 页，早期对比清单的来源缺失。',
        sides: [],
        conditions: '这不是两条来源的矛盾，而是一项待补的检索。',
        evidence: '综述第 31–46 页未读取；notes/old-draft.md 缺失；T-12 状态未知。',
        pages: ['W-12'], affects: ['contrib:C4', 'task:T-12'],
        log: [
          { at: '2026.10.25 21:10', by: 'wiki-maintain', text: '在 W-12 标注检索未完成' },
        ],
      },
    ],

    /* ---------------- 知识图谱：来源、Wiki 页、方案/假设、实验、结论 ---------------- */
    graph: {
      nodes: [
        /* Wiki 页由 pages 自动加入；这里补其余节点 */
        { id: 'S1', type: 'scheme', title: '方案 S1：A + b（插入）', ref: 'scheme:S1' },
        { id: 'S2', type: 'scheme', title: '方案 S2：A + c（并联）', ref: 'scheme:S2' },
        { id: 'S3', type: 'scheme', title: '方案 S3：A + b + c', ref: 'scheme:S3' },
        { id: 'H0', type: 'hypothesis', title: 'H0：基线存在细裂缝漏检', ref: 'hyp:H0' },
        { id: 'H1', type: 'hypothesis', title: 'H1：b 提升细裂缝召回', ref: 'hyp:H1' },
        { id: 'H2', type: 'hypothesis', title: 'H2：c 改善长裂缝连续性', ref: 'hyp:H2' },
        { id: 'H3', type: 'hypothesis', title: 'H3：b 与 c 作用互补', ref: 'hyp:H3' },
        { id: 'E1', type: 'experiment', title: 'E1 基线细裂缝召回', ref: 'plan:E1' },
        { id: 'E2', type: 'experiment', title: 'E2 A 对 A+b', ref: 'plan:E2' },
        { id: 'E3', type: 'experiment', title: 'E3 A 对 A+c', ref: 'plan:E3' },
        { id: 'E4', type: 'experiment', title: 'E4 A+b+c 组合', ref: 'plan:E4' },
        { id: 'E5', type: 'experiment', title: 'E5 预算口径敏感性', ref: 'plan:E5' },
        { id: 'K-01', type: 'conclusion', title: 'K-01 基线漏检成立', ref: 'concl:K-01' },
        { id: 'K-02', type: 'conclusion', title: 'K-02 b 的作用证据不足', ref: 'concl:K-02' },
      ],
      /* 来源 → 页面的“支持”边由引用记录自动生成；页间“引用”由正文链接生成 */
      edges: [
        { from: 'W-05', to: 'W-01', type: 'related', note: 'W-05 正文“相关页面”' },
        { from: 'W-09', to: 'W-11', type: 'related', note: '预算与资源约束' },
        { from: 'W-06', to: 'W-07', type: 'related', note: '数据与指标' },
        { from: 'W-03', to: 'W-04', type: 'contrasts', note: '局部细节对全局上下文（W-01 对比表）' },
        { from: 'src-01', to: 'src-10', type: 'conflicts', issue: 'Q-08', note: '标注噪声下是否有效' },
        { from: 'src-02', to: 'src-05', type: 'conflicts', issue: 'Q-03', note: '显存开销' },
        { from: 'src-06', to: 'src-05', type: 'conflicts', issue: 'Q-05', note: '预算口径' },
        { from: 'S1', to: 'W-02', type: 'adopts', note: '基线 A' },
        { from: 'S1', to: 'W-03', type: 'adopts', note: '模块 b，插入 d2 之后' },
        { from: 'S2', to: 'W-02', type: 'adopts', note: '基线 A' },
        { from: 'S2', to: 'W-04', type: 'adopts', note: '模块 c，并联于瓶颈层' },
        { from: 'S3', to: 'W-02', type: 'adopts', note: '基线 A' },
        { from: 'S3', to: 'W-03', type: 'adopts', note: '模块 b' },
        { from: 'S3', to: 'W-04', type: 'adopts', note: '模块 c' },
        { from: 'S1', to: 'H1', type: 'proposes' },
        { from: 'S2', to: 'H2', type: 'proposes' },
        { from: 'S3', to: 'H3', type: 'proposes' },
        { from: 'W-05', to: 'H0', type: 'proposes' },
        { from: 'E1', to: 'H0', type: 'tests' },
        { from: 'E2', to: 'H1', type: 'tests' },
        { from: 'E3', to: 'H2', type: 'tests' },
        { from: 'E4', to: 'H3', type: 'tests' },
        { from: 'E5', to: 'W-09', type: 'tests', note: '检验预算口径的影响' },
        { from: 'E1', to: 'K-01', type: 'yields', note: '审查 RV-E1' },
        { from: 'E2', to: 'K-02', type: 'yields', note: '审查 RV-E2' },
        { from: 'K-01', to: 'H0', type: 'supports', note: '3 个种子，满足成功条件' },
        /* 算法推断的语义相似：不是证据关系，默认隐藏 */
        { from: 'W-03', to: 'W-04', type: 'similar', score: 0.82 },
        { from: 'W-05', to: 'W-07', type: 'similar', score: 0.77 },
        { from: 'W-01', to: 'W-12', type: 'similar', score: 0.74 },
      ],
    },

    /* ---------------- 学术裁缝：方案 / 假设（TAILOR.md） ---------------- */
    schemes: [
      {
        id: 'S1', no: '01', title: '在基线 A 的解码器中插入局部窗口注意力', short: 'A + b（插入）',
        decision: 'selected', readiness: 'pilot', evidence: 'partial',
        source: { file: 'TAILOR.md', section: '§2', lines: '第 34–118 行', at: '2026.10.20 16:40' },
        question: '局部窗口注意力能否在不牺牲 mIoU 的前提下提高细裂缝召回？',
        failure: [
          { text: '历史报告：宽度 ≤ 3 px 的裂缝召回 0.61，整体 0.83', ref: 'cite:c3', prov: 'historical' },
          { text: '本轮复现：细裂缝召回 0.607 ± 0.012（3 个种子）', ref: 'concl:K-01', prov: 'current' },
        ],
        baseline: { name: '基线 A：多尺度编码-解码分割网络', page: 'W-02' },
        modules: [
          { key: 'b', name: '局部窗口注意力', page: 'W-03', op: 'insert', at: 'd2 → d3 之间', origin: '原文把它放在编码器每个阶段（p01 第 3 页）', change: '只插入解码器 d2 之后一处；d2 输出 256 通道经 1×1 投影到 128，窗口 7、4 头，残差相加', cite: 'c9' },
        ],
        changes: [
          '新增 modules/window_attn.py；在 decoder.py 的 d2 之后调用一次',
          '1×1 投影 256 → 128 → 256，残差相加，不改 d3 的输入形状',
          '训练目标不变（Dice + BCE），学习率与调度不变',
        ],
        risks: [
          { text: '推理延迟增加：原文 512² 下约 +8%，1024² 需实测', ref: 'cite:c11' },
          { text: '标注噪声下可能没有增益（两条来源冲突）', ref: 'issue:Q-08' },
          { text: 'batch 16 时显存溢出，已改为 batch 8 加梯度累积', ref: 'run:R-E2-01' },
        ],
        hypotheses: ['H1'],
        checks: {
          interface: { status: 'pass', note: '张量形状核对通过：d2 输出 [B, 256, 64, 64]' },
          data: { status: 'pass', note: '沿用 bridge-crack-v2 固定划分，无需新数据' },
          resources: { status: 'warn', note: 'batch 16 显存溢出；batch 8 + 梯度累积可运行（31.2 GB）', gap: 'run:R-E2-01' },
          origin: { status: 'pass', note: 'p01 第 3–4 页原文与方法笔记一致' },
        },
        novelty: '模块与原文一致，差异只在接入位置（解码器而非编码器）与任务（裂缝分割）。是否已有先例，新颖性检索尚未完成。',
        cost: '低：新增 1 个文件，约 80 行；每步训练慢约 12%',
        materials: '无需新数据；需要 A100 40 GB',
        validation: 'E2：A 对 A+b，3 个种子，固定 40k 步',
        plans: ['E2'], contribs: ['C2', 'C3', 'C4'],
      },
      {
        id: 'S2', no: '02', title: '在瓶颈层并联全局上下文分支', short: 'A + c（并联）',
        decision: 'delegated', readiness: 'design', evidence: 'pending',
        source: { file: 'TAILOR.md', section: '§3', lines: '第 120–196 行', at: '2026.10.23 18:02' },
        question: '全局上下文分支能否改善长裂缝的连续性（减少断裂段）？',
        failure: [
          { text: '历史报告：长裂缝平均断裂 3.4 段（无误差范围）', ref: 'source:src-07', prov: 'historical' },
        ],
        baseline: { name: '基线 A：多尺度编码-解码分割网络', page: 'W-02' },
        modules: [
          { key: 'c', name: '全局上下文聚合', page: 'W-04', op: 'parallel', at: '瓶颈层 e4 旁路，汇入 d1', origin: '原文作为残差块串联在主干中（p02 第 3 页）', change: '改为与 e4 并联的分支，输出与金字塔顶层相加后进入 d1', cite: 'c12' },
        ],
        changes: [
          '新增 modules/nonlocal_branch.py，与 e4 并联',
          '分支输出与金字塔顶层相加，进入 d1',
        ],
        risks: [
          { text: '显存开销：原文与笔记冲突，1024² 下可能溢出', ref: 'issue:Q-03' },
        ],
        hypotheses: ['H2'],
        checks: {
          interface: { status: 'pass', note: 'e4 输出 [B, 2048, 32, 32]，可接入' },
          data: { status: 'pass', note: '需要额外统计断裂段数，评估脚本已有' },
          resources: { status: 'fail', note: '1024² 输入下的显存未知，笔记记录溢出', gap: 'issue:Q-03' },
          origin: { status: 'fail', note: '原文第 6 页（1024² 显存表）为扫描图像，无法核对', gap: 'task:T-03' },
        },
        novelty: '把串联的非局部块改为并联分支。这是常见的工程变体，单独不构成新颖性。',
        cost: '中：新增 1 个文件，约 120 行；显存可能需要降分辨率',
        materials: '需要原文第 6 页可读版本（OCR 或作者提供）',
        validation: 'E3：A 对 A+c，3 个种子；主指标改为断裂段数',
        plans: ['E3'], contribs: [],
      },
      {
        id: 'S3', no: '03', title: '局部窗口注意力与全局上下文组合', short: 'A + b + c（组合）',
        decision: 'suggested', readiness: 'design', evidence: 'none',
        source: { file: 'TAILOR.md', section: '§4', lines: '第 198–240 行', at: '2026.10.20 16:40' },
        question: '局部细节与全局上下文是否互补？组合增益是否大于单模块之和的一半？',
        failure: [],
        baseline: { name: '基线 A：多尺度编码-解码分割网络', page: 'W-02' },
        modules: [
          { key: 'b', name: '局部窗口注意力', page: 'W-03', op: 'insert', at: 'd2 → d3 之间', origin: '同 S1', change: '同 S1' },
          { key: 'c', name: '全局上下文聚合', page: 'W-04', op: 'parallel', at: '瓶颈层 e4 旁路', origin: '同 S2', change: '同 S2' },
          { key: 'g', name: '门控融合', page: null, op: 'replace', at: '跳连融合 concat → 门控', origin: '原方法为通道拼接（基线 A）', change: '替换为逐通道门控加权，避免两种新特征重复叠加' },
        ],
        changes: ['依赖 S1、S2 的实现', '跳连融合由 concat 替换为门控加权'],
        risks: [
          { text: '依赖 S2，而 S2 的原文核对与显存都未通过', ref: 'scheme:S2' },
          { text: '组合实验需要清洗后的数据 v2.1，清洗任务失败', ref: 'task:T-13' },
        ],
        hypotheses: ['H3'],
        checks: {
          interface: { status: 'na', note: '等待 S1、S2 的接口确定' },
          data: { status: 'warn', note: '需要清洗后的数据 v2.1（T-13 失败）', gap: 'task:T-13' },
          resources: { status: 'na', note: '依赖 S2 的显存结论' },
          origin: { status: 'na', note: '门控融合尚未选定参考来源' },
        },
        novelty: '组合本身不构成新颖性；只有在出现单模块之外的互补证据时，才值得作为贡献讨论。',
        cost: '高：依赖两套实现与更大的显存',
        materials: '清洗后的数据 v2.1；S2 的显存结论',
        validation: 'E4：A+b+c，与 E2、E3 共用对照',
        plans: ['E4'], contribs: [],
      },
    ],
    hypotheses: [
      { id: 'H0', scheme: null, text: '基线 A 在细裂缝上存在系统性漏检（细裂缝召回 < 0.65）', verdict: 'supported', by: 'RV-E1' },
      { id: 'H1', scheme: 'S1', text: '加入模块 b 后细裂缝召回提升 ≥ 2.0 个百分点，且 mIoU 下降不超过 1.0', verdict: 'insufficient', by: 'RV-E2' },
      { id: 'H2', scheme: 'S2', text: '加入模块 c 后长裂缝的平均断裂段数减少', verdict: 'pending', by: null },
      { id: 'H3', scheme: 'S3', text: 'b 与 c 作用互补：组合增益大于单模块增益之和的一半', verdict: 'pending', by: null },
    ],

    /* ---------------- 实验计划（EXPERIMENT-PLAN.md v3） ---------------- */
    planFile: { path: 'EXPERIMENT-PLAN.md', version: 'v3', at: '2026.10.22 15:30', change: 'E2 保护指标阈值由 −0.5 调整为 −1.0' },
    plans: [
      {
        id: 'E1', title: '基线 A 的细裂缝召回水平', hypothesis: 'H0', scheme: null, line: '第 12–30 行',
        question: '基线 A 在固定划分 v2 上，细裂缝召回是否明显低于整体召回？',
        variants: [{ key: 'A', role: '对照' }], control: '不设对照（建立后续实验的对照组）',
        split: 'bridge-crack-v2 固定划分（2,400 / 300 / 600）', seeds: '0 / 1 / 2', config: 'configs/a.yaml',
        deps: ['T-04'], primary: { name: '细裂缝召回', key: 'recall_thin', dir: 'up', def: '宽度 ≤ 3 px 裂缝像素召回（eval_v2）', agg: '3 个种子均值 ± 标准差' },
        guards: [{ name: '整体召回', key: 'recall_all', rule: '只记录，不设阈值' }],
        budget: '每次 40k 步 │ 单卡 A100 40 GB │ 约 5 小时', success: '细裂缝召回 < 0.65，且比整体召回低 ≥ 0.15', failure: '细裂缝召回 ≥ 整体召回 − 0.05',
        artifacts: ['runs/E1/*/metrics.json', 'runs/E1/vis/'], review: 'RV-E1', task: 'T-05',
      },
      {
        id: 'E2', title: 'A 对 A+b：局部窗口注意力', hypothesis: 'H1', scheme: 'S1', line: '第 32–58 行',
        question: '加入模块 b 能否提高细裂缝召回，同时不破坏 mIoU？',
        variants: [{ key: 'A', role: '对照' }, { key: 'A+b', role: '变体' }], control: 'A（E1 的 3 次运行）',
        split: 'bridge-crack-v2 固定划分（2,400 / 300 / 600）', seeds: '0 / 1 / 2（补充 3 / 4）', config: 'configs/a_b.yaml',
        deps: ['T-05', 'T-04'], primary: { name: '细裂缝召回', key: 'recall_thin', dir: 'up', def: '宽度 ≤ 3 px 裂缝像素召回（eval_v2）', agg: '3 个种子均值 ± 标准差；差值用 Welch t 区间' },
        guards: [
          { name: 'mIoU', key: 'miou', rule: '平均下降不超过 1.0', threshold: -1.0, unit: '个百分点' },
          { name: '推理延迟', key: 'latency_ms', rule: '增加不超过 15%', thresholdPct: 15 },
        ],
        budget: '每次 40k 步（固定步数，见问题 Q-05）│ 单卡 A100 40 GB', success: 'Δ细裂缝召回 ≥ +2.0 且 95% 区间下界 > 0；保护指标都未破线', failure: 'Δ细裂缝召回的 95% 区间上界 < +1.0，或任一保护指标破线',
        artifacts: ['runs/E2/*/metrics.json', 'reviews/E2-review.md'], review: 'RV-E2', task: 'T-06',
      },
      {
        id: 'E3', title: 'A 对 A+c：全局上下文分支', hypothesis: 'H2', scheme: 'S2', line: '第 60–84 行',
        question: '加入模块 c 能否减少长裂缝的断裂段数？',
        variants: [{ key: 'A', role: '对照' }, { key: 'A+c', role: '变体' }], control: 'A（E1 的 3 次运行）',
        split: 'bridge-crack-v2 固定划分', seeds: '0 / 1 / 2', config: 'configs/a_c.yaml',
        deps: ['T-03', 'T-04'], primary: { name: '长裂缝断裂段数', key: 'breaks', dir: 'down', def: '长度 > 200 px 的裂缝被分成的段数（越少越好）', agg: '3 个种子均值 ± 标准差' },
        guards: [{ name: 'mIoU', key: 'miou', rule: '平均下降不超过 1.0', threshold: -1.0, unit: '个百分点' }],
        budget: '每次 40k 步 │ 显存未知（问题 Q-03）', success: '断裂段数减少且 95% 区间上界 < 0', failure: '断裂段数的 95% 区间下界 > −0.2',
        artifacts: ['runs/E3/*/metrics.json'], review: null, task: 'T-07',
      },
      {
        id: 'E4', title: 'A+b+c 组合', hypothesis: 'H3', scheme: 'S3', line: '第 86–104 行',
        question: 'b 与 c 是否互补？',
        variants: [{ key: 'A+b+c', role: '变体' }], control: 'A、A+b、A+c',
        split: 'bridge-crack-v2 清洗版 v2.1', seeds: '0 / 1 / 2', config: 'configs/a_bc.yaml',
        deps: ['T-06', 'T-07', 'T-13'], primary: { name: '细裂缝召回', key: 'recall_thin', dir: 'up', def: '同 E2', agg: '3 个种子均值 ± 标准差' },
        guards: [{ name: 'mIoU', key: 'miou', rule: '平均下降不超过 1.0', threshold: -1.0, unit: '个百分点' }],
        budget: '每次 40k 步 │ 显存未知', success: '组合增益 > 单模块增益之和的一半', failure: '组合增益 ≤ 较大的单模块增益',
        artifacts: ['runs/E4/*/metrics.json'], review: null, task: 'T-08',
      },
      {
        id: 'E5', title: '预算口径敏感性：固定步数对固定时长', hypothesis: null, scheme: 'S1', line: '第 106–120 行',
        question: '在固定 GPU 时长下，A+b 相对 A 的结论是否改变？',
        variants: [{ key: 'A', role: '对照' }, { key: 'A+b', role: '变体' }], control: 'A（固定 5 小时）',
        split: 'bridge-crack-v2 固定划分', seeds: '0 / 1 / 2', config: 'configs/a_b_time.yaml',
        deps: ['T-06'], primary: { name: '细裂缝召回', key: 'recall_thin', dir: 'up', def: '同 E2', agg: '3 个种子均值 ± 标准差' },
        guards: [],
        budget: '每次固定 5 小时 GPU', success: '结论方向与 E2 一致', failure: '结论方向与 E2 相反',
        artifacts: ['runs/E5/*/metrics.json'], review: null, task: null, conditional: '只在问题 Q-05 的决议需要时运行',
      },
    ],

    /* ---------------- 运行（runs/ 与历史报告） ---------------- */
    runs: [
      { id: 'R-E1-H', plan: 'E1', variant: 'A', seed: '—', prov: 'historical', status: 'na', source: 'src-07', at: '2025.06', dur: '—', metrics: { recall_thin: 0.61, recall_all: 0.83, miou: 71.8 }, note: '历史报告表 3：实例级定义（IoU ≥ 0.5）、随机划分 v1；不是本轮实验', protocol: { metric: 'diff', split: 'diff', budget: 'unknown', agg: 'diff' } },
      { id: 'R-E1-01', plan: 'E1', variant: 'A', seed: 0, prov: 'current', status: 'done', at: '2026.10.19 09:10', dur: '5 小时 08 分', gpu: 'A100 40 GB × 1', code: 'a1c9e04', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a.yaml', metrics: { recall_thin: 0.603, recall_all: 0.826, miou: 72.4, latency_ms: 41.2, peak_mem: 22.4 }, files: ['runs/E1/R-E1-01/metrics.json', 'runs/E1/R-E1-01/train.log', 'runs/E1/R-E1-01/ckpt_40k.pt'] },
      { id: 'R-E1-02', plan: 'E1', variant: 'A', seed: 1, prov: 'current', status: 'done', at: '2026.10.19 14:32', dur: '5 小时 11 分', gpu: 'A100 40 GB × 1', code: 'a1c9e04', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a.yaml', metrics: { recall_thin: 0.621, recall_all: 0.834, miou: 72.9, peak_mem: 22.5 }, files: ['runs/E1/R-E1-02/metrics.json', 'runs/E1/R-E1-02/train.log'] },
      { id: 'R-E1-03', plan: 'E1', variant: 'A', seed: 2, prov: 'current', status: 'done', at: '2026.10.20 08:05', dur: '5 小时 06 分', gpu: 'A100 40 GB × 1', code: 'a1c9e04', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a.yaml', metrics: { recall_thin: 0.598, recall_all: 0.828, miou: 72.1, peak_mem: 22.4 }, files: ['runs/E1/R-E1-03/metrics.json', 'runs/E1/R-E1-03/train.log'] },
      { id: 'R-E2-01', plan: 'E2', variant: 'A+b', seed: 0, prov: 'current', status: 'failed', at: '2026.10.22 18:40', dur: '6 分', gpu: 'A100 40 GB × 1', code: 'b7d2e19', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（batch 16）', metrics: null, firstError: { at: '第 1,240 步', text: 'RuntimeError: CUDA out of memory. Tried to allocate 1.53 GiB (GPU 0; 39.59 GiB total capacity; 37.80 GiB already allocated)' }, files: ['runs/E2/R-E2-01/train.log'] },
      { id: 'R-E2-02', plan: 'E2', variant: 'A+b', seed: 0, prov: 'current', status: 'done', at: '2026.10.22 19:02', dur: '5 小时 46 分', gpu: 'A100 40 GB × 1', code: 'b7d2e19', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（batch 8，梯度累积 2）', metrics: { recall_thin: 0.631, recall_all: 0.835, miou: 72.0, latency_ms: 46.9, peak_mem: 31.2 }, files: ['runs/E2/R-E2-02/metrics.json', 'runs/E2/R-E2-02/train.log', 'runs/E2/R-E2-02/ckpt_40k.pt'] },
      { id: 'R-E2-03', plan: 'E2', variant: 'A+b', seed: 1, prov: 'current', status: 'done', at: '2026.10.23 02:10', dur: '5 小时 44 分', gpu: 'A100 40 GB × 1', code: 'b7d2e19', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（batch 8，梯度累积 2）', metrics: { recall_thin: 0.609, recall_all: 0.829, miou: 72.6, peak_mem: 31.1 }, files: ['runs/E2/R-E2-03/metrics.json', 'runs/E2/R-E2-03/train.log'] },
      { id: 'R-E2-04', plan: 'E2', variant: 'A+b', seed: 2, prov: 'current', status: 'cancelled', at: '2026.10.23 08:20', dur: '1 小时 25 分', gpu: 'A100 40 GB × 1', code: 'b7d2e19', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（batch 8，梯度累积 2）', metrics: null, cancelReason: '研究者取消：发现数据加载顺序未固定种子；修复后重跑为 R-E2-05', readNote: '目录中没有 metrics.json，日志截断在第 9,800 步', files: ['runs/E2/R-E2-04/train.log（截断）'] },
      { id: 'R-E2-05', plan: 'E2', variant: 'A+b', seed: 2, prov: 'current', status: 'done', at: '2026.10.24 21:30', dur: '5 小时 42 分', gpu: 'A100 40 GB × 1', code: 'c03f5a8', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（batch 8，梯度累积 2；加载顺序已固定）', metrics: { recall_thin: 0.638, recall_all: 0.837, miou: 72.3, peak_mem: 31.2 }, files: ['runs/E2/R-E2-05/metrics.json', 'runs/E2/R-E2-05/train.log'] },
      { id: 'R-E2-06', plan: 'E2', variant: 'A+b', seed: 3, prov: 'current', status: 'running', at: '2026.10.26 05:10', dur: '进行中', gpu: 'A100 40 GB × 1', code: 'c03f5a8', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（batch 8，梯度累积 2）', progress: { step: 18000, total: 40000 }, interim: { recall_thin: 0.590, atStep: '15,000' }, metrics: null, files: ['runs/E2/R-E2-06/train.log（写入中）'] },
      { id: 'R-E2-07', plan: 'E2', variant: 'A+b', seed: 0, prov: 'current', status: 'abandoned', at: '2026.10.22 12:15', dur: '5 小时 40 分', gpu: 'A100 40 GB × 1', code: 'b7d2e19', data: 'bridge-crack-v2@7c1e2d', config: 'configs/a_b.yaml（lr = 1e-2）', metrics: { recall_thin: 0.441, recall_all: 0.702, miou: 64.8, peak_mem: 31.0 }, abandonReason: '配置错误：学习率 1e-2 与计划的 1e-3 不符；标记淘汰，保留记录', files: ['runs/E2/R-E2-07/metrics.json'] },
      { id: 'R-E3-S1', plan: 'E3', variant: 'A+c', seed: 0, prov: 'simulated', status: 'done', at: '2026.10.21 16:00', dur: '22 分', gpu: 'A100 40 GB × 1', code: 'b7d2e19', data: '合成裂缝子集（64 张，非 bridge-crack-v2）', config: 'configs/a_c.yaml（2k 步，256²）', metrics: { recall_thin: 0.58, breaks: 2.9 }, note: '试跑：在合成子集上验证代码能跑通。不是真实实验，不参与判定', files: ['runs/E3/R-E3-S1/metrics.json'] },
    ],

    reviews: [
      {
        id: 'RV-E1', plan: 'E1', status: 'passed', verdict: 'supported', hypothesis: 'H0', by: 'M-01', at: '2026.10.21 10:05', file: 'reviews/E1-review.md', conclusion: 'K-01',
        rationale: '3 个种子的细裂缝召回 0.607 ± 0.012，整体召回 0.829 ± 0.004，差距约 0.22，满足成功条件。历史报告的 0.61 采用实例级定义和随机划分，只作背景，不参与判定。',
        next: [],
      },
      {
        id: 'RV-E2', plan: 'E2', status: 'changes', verdict: 'insufficient', hypothesis: 'H1', by: 'M-01', at: '2026.10.25 18:30', file: 'reviews/E2-review.md', conclusion: 'K-02',
        rationale: '细裂缝召回平均提升约 1.9 个百分点，但 95% 区间跨过 0；mIoU 平均下降 0.2，区间下界触及 −1.0 的阈值；推理延迟 +13.8%，接近 15% 的上限。',
        next: ['补充种子 3、4（T-09，运行中）', '确认数据加载顺序修复对 A 组没有影响'],
      },
    ],
    conclusions: [
      { id: 'K-01', text: '基线 A 在固定划分 v2 上存在细裂缝漏检（召回 0.607 ± 0.012）', review: 'RV-E1', verdict: 'supported' },
      { id: 'K-02', text: '模块 b 对细裂缝召回的作用：证据不足（3 个种子，区间跨 0）', review: 'RV-E2', verdict: 'insufficient' },
    ],

    /* ---------------- 任务与依赖（dag.yaml） ---------------- */
    tasks: [
      { id: 'T-01', title: '整理 papers/、notes/、reports/ 为 Wiki 快照 v14', type: 'curate', stage: '材料整理', owner: 'M-02', exec: 'done', review: 'pending', reviewNote: '语义复核 3 / 12 页', at: '2026.10.25 21:14', event: '写入快照 v14', inputs: ['src:papers/', 'src:notes/'], outputs: ['A-wiki14', 'A-cov'], trace: 'tr-0425', line: '第 4–11 行' },
      { id: 'T-02', title: '核验方案 S1（接口、数据、资源、原文）', type: 'verify', stage: '方案核验', owner: 'M-03', exec: 'done', review: 'passed', at: '2026.10.20 16:40', event: 'S1 四项检查完成', inputs: ['A-wiki14'], outputs: ['A-tailor-s1'], links: ['scheme:S1'], line: '第 13–19 行' },
      { id: 'T-03', title: '核验方案 S2（原文核对）', type: 'verify', stage: '方案核验', owner: 'M-03', exec: 'blocked', review: 'none', at: '2026.10.23 18:02', event: '原文核对失败', blocked: '原文核对没有完成：p02 第 6–12 页为扫描图像，无法提取文字（问题 Q-03）', inputs: ['A-wiki14'], outputs: ['A-tailor-s2'], links: ['scheme:S2', 'issue:Q-03'], trace: 'tr-0423', line: '第 21–28 行' },
      { id: 'T-04', title: '编写实验计划 E1–E5', type: 'plan', stage: '实验计划', owner: 'M-05', exec: 'done', review: 'passed', at: '2026.10.22 15:30', event: '写入 EXPERIMENT-PLAN.md v3', inputs: ['A-tailor-s1'], outputs: ['A-plan'], links: ['plan:E1', 'plan:E2'], trace: 'tr-0422', line: '第 30–36 行' },
      { id: 'T-05', title: '基线运行 E1（3 个种子）', type: 'baseline', stage: '基线运行', owner: 'M-04', exec: 'done', review: 'passed', at: '2026.10.20 13:11', event: 'R-E1-03 完成', inputs: ['A-plan'], outputs: ['A-runs-e1'], links: ['plan:E1', 'review:RV-E1'], stale: '使用的是计划 v2；计划已更新为 v3（E2 保护指标阈值调整，E1 行未变）', group: 'exp', line: '第 38–44 行' },
      { id: 'T-06', title: '单模块实验 E2：A 对 A+b', type: 'single', stage: '单模块实验', owner: 'M-04', exec: 'done', review: 'changes', reviewNote: '研究判定：证据不足', at: '2026.10.25 18:30', event: 'E2 审查：需补充', inputs: ['A-runs-e1', 'A-plan'], outputs: ['A-runs-e2', 'A-rv-e2'], links: ['plan:E2', 'review:RV-E2'], group: 'exp', line: '第 46–53 行' },
      { id: 'T-07', title: '单模块实验 E3：A 对 A+c', type: 'single', stage: '单模块实验', owner: 'M-04', exec: 'blocked', review: 'none', at: '2026.10.23 18:02', event: '等待 S2 原文核对', blocked: '等待 T-03：方案 S2 的原文核对没有通过；目前只有一次模拟试跑 R-E3-S1', inputs: ['A-tailor-s2', 'A-plan'], outputs: ['A-runs-e3'], links: ['plan:E3'], group: 'exp', line: '第 55–61 行' },
      { id: 'T-08', title: '组合实验 E4：A+b+c', type: 'combo', stage: '组合实验', owner: 'M-04', exec: 'pending', review: 'none', at: '—', event: '尚未开始', inputs: ['A-rv-e2', 'A-runs-e3', 'A-data21'], outputs: ['A-runs-e4'], links: ['plan:E4'], group: 'exp', line: '第 63–70 行' },
      { id: 'T-09', title: 'E2 补充种子 3、4', type: 'single', stage: '单模块实验', owner: 'M-04', exec: 'running', review: 'none', at: '2026.10.26 09:40', event: 'R-E2-06 第 18,000 / 40,000 步', progress: { done: 18000, total: 40000, label: 'seed 3' }, inputs: ['A-rv-e2'], outputs: ['A-runs-e2b'], links: ['run:R-E2-06'], trace: 'tr-0426', group: 'exp', line: '第 72–77 行' },
      { id: 'T-10', title: 'E2 综合审查（5 个种子）', type: 'review', stage: '结果审查', owner: 'M-01', exec: 'pending', review: 'none', at: '—', event: '等待补充种子', inputs: ['A-runs-e2b'], outputs: ['A-rv-e2b'], links: ['plan:E2'], line: '第 79–84 行' },
      { id: 'T-11', title: '更新叙事 STORY-PLAN.md', type: 'story', stage: '故事更新', owner: null, exec: 'pending', review: 'none', at: '—', event: '尚未开始', inputs: ['A-rv-e2b', 'A-fig', 'A-novelty'], outputs: ['A-story'], links: ['story:main'], line: '第 86–92 行' },
      { id: 'T-12', title: '相关工作新颖性检索', type: 'curate', stage: '材料整理', owner: null, exec: 'unknown', review: 'none', at: '—', event: '记录中没有状态字段', inputs: [], outputs: ['A-novelty'], links: ['issue:Q-11'], line: '第 94–97 行', unknownNote: 'dag.yaml 中该任务没有 status 字段，也没有会话认领记录' },
      { id: 'T-13', title: '数据清洗 v2.1（修正多边形标注）', type: 'data', stage: '材料整理', owner: 'M-04', exec: 'failed', review: 'none', at: '2026.10.24 11:20', event: '解析 annotations_v2.1.json 失败', firstError: 'annotations_v2.1.json 第 18,204 行：多边形顶点数为 2（至少需要 3）', inputs: [], outputs: ['A-data21'], links: [], line: '第 99–104 行' },
      { id: 'T-14', title: 'A+c 预实验（256² 输入）', type: 'single', stage: '单模块实验', owner: 'M-04', exec: 'cancelled', review: 'none', at: '2026.10.21 09:00', event: '取消：被 T-07 的计划取代', inputs: ['A-plan'], outputs: [], links: [], group: 'exp', line: '第 106–110 行' },
    ],
    artifacts: {
      'A-wiki14': { path: 'wiki/（快照 v14）', by: 'T-01', at: '2026.10.25 21:14', state: 'ok' },
      'A-cov': { path: 'wiki/_coverage.json', by: 'T-01', at: '2026.10.25 21:14', state: 'ok' },
      'A-tailor-s1': { path: 'TAILOR.md §2 检查记录', by: 'T-02', at: '2026.10.20 16:40', state: 'ok' },
      'A-tailor-s2': { path: 'TAILOR.md §3 检查记录', by: 'T-03', at: '—', state: 'missing' },
      'A-plan': { path: 'EXPERIMENT-PLAN.md v3', by: 'T-04', at: '2026.10.22 15:30', state: 'ok' },
      'A-runs-e1': { path: 'runs/E1/*/metrics.json', by: 'T-05', at: '2026.10.20 13:11', state: 'ok' },
      'A-runs-e2': { path: 'runs/E2/*/metrics.json', by: 'T-06', at: '2026.10.25 03:12', state: 'ok' },
      'A-rv-e2': { path: 'reviews/E2-review.md', by: 'T-06', at: '2026.10.25 18:30', state: 'ok' },
      'A-runs-e3': { path: 'runs/E3/*/metrics.json', by: 'T-07', at: '—', state: 'missing', note: '只有模拟试跑 R-E3-S1' },
      'A-data21': { path: 'data/bridge-crack-v2.1/', by: 'T-13', at: '—', state: 'missing' },
      'A-runs-e4': { path: 'runs/E4/*/metrics.json', by: 'T-08', at: '—', state: 'missing' },
      'A-runs-e2b': { path: 'runs/E2/R-E2-06、R-E2-07…', by: 'T-09', at: '—', state: 'missing' },
      'A-rv-e2b': { path: 'reviews/E2-review-v2.md', by: 'T-10', at: '—', state: 'missing' },
      'A-fig': { path: 'figures/fig-ablation.pdf', by: null, at: '—', state: 'missing', note: 'T-11 的输入引用了它，但 dag.yaml 里没有任务产出它' },
      'A-novelty': { path: 'wiki/survey/novelty.md', by: 'T-12', at: '—', state: 'missing' },
      'A-story': { path: 'STORY-PLAN.md v4', by: 'T-11', at: '—', state: 'missing' },
    },
    /* 依赖边：等待什么产物或条件 */
    dagEdges: [
      { from: 'T-01', to: 'T-02', wait: 'Wiki 快照 v14', state: 'ok' },
      { from: 'T-01', to: 'T-03', wait: 'Wiki 快照 v14', state: 'ok' },
      { from: 'T-02', to: 'T-04', wait: 'S1 核验通过', state: 'ok' },
      { from: 'T-04', to: 'T-05', wait: '计划 E1 行', state: 'stale', note: '消费的是计划 v2；计划已更新为 v3' },
      { from: 'T-05', to: 'T-06', wait: 'E1 的 metrics.json', state: 'ok' },
      { from: 'T-04', to: 'T-06', wait: '计划 E2 行', state: 'ok' },
      { from: 'T-03', to: 'T-07', wait: 'S2 原文核对通过', state: 'blocked' },
      { from: 'T-04', to: 'T-07', wait: '计划 E3 行', state: 'ok' },
      { from: 'T-06', to: 'T-08', wait: 'E2 审查通过', state: 'blocked', note: 'T-06 执行完成，但审查需补充' },
      { from: 'T-07', to: 'T-08', wait: 'E3 真实运行结果', state: 'wait' },
      { from: 'T-13', to: 'T-08', wait: '清洗后数据 v2.1', state: 'blocked', note: 'T-13 失败' },
      { from: 'T-06', to: 'T-09', wait: 'E2 审查意见', state: 'ok' },
      { from: 'T-09', to: 'T-10', wait: '补充种子 metrics.json', state: 'wait' },
      { from: 'T-10', to: 'T-11', wait: 'E2 综合审查结论', state: 'wait' },
      { from: 'X-fig', to: 'T-11', wait: 'figures/fig-ablation.pdf', state: 'missing' },
      { from: 'T-12', to: 'T-11', wait: '新颖性检索结果', state: 'wait' },
      { from: 'T-04', to: 'T-14', wait: 'E3 预实验配置', state: 'ok' },
    ],
    /* 原型状态“依赖环”时追加的一条边（按文件原样显示，不自动删除） */
    dagCycleEdge: { from: 'T-11', to: 'T-10', wait: '叙事需要的补充分析', state: 'wait', note: 'dag.yaml 第 90 行声明', cycle: true },
    dagMissing: [{ id: 'X-fig', title: 'figures/fig-ablation.pdf', note: 'T-11 的输入引用了它，但 dag.yaml 没有定义产出它的任务' }],

    /* ---------------- 成员与会话（team/sessions.jsonl） ---------------- */
    members: [
      { id: 'M-01', name: '研究者（你）', kind: 'human', role: '方案决策 │ 结果审查', model: null, session: null, state: 'active', heartbeat: null, lastActive: '2026.10.26 09:20', current: 'T-10', delivered: ['reviews/E1-review.md', 'reviews/E2-review.md', 'dag.yaml'] },
      { id: 'M-02', name: 'wiki-maintain', kind: 'agent', role: 'Wiki 整理', model: 'claude-sonnet-5-5', session: 's-0412', link: 'sessions/s-0412.jsonl', state: 'idle', heartbeat: '2026.10.25 21:15', lastActive: '2026.10.25 21:14', current: null, delivered: ['wiki/ 快照 v14', 'wiki/_coverage.json'], trace: 'tr-0425' },
      { id: 'M-03', name: 'academic-tailor', kind: 'agent', role: '方案核验', model: null, session: 's-0415', link: 'sessions/s-0415.jsonl', state: 'unknown', heartbeat: '2026.10.23 18:05', lastActive: '2026.10.23 18:02', current: 'T-03', blocked: '原文核对需要 p02 第 6 页的可读版本', delivered: ['TAILOR.md §2 检查记录'], trace: 'tr-0423', staleNote: '最后心跳距读取时间已超过 48 小时：状态未知，不判定离线或失败' },
      { id: 'M-04', name: '实验执行会话', kind: 'agent', role: '运行实验', model: null, session: 's-0431', link: 'sessions/s-0431.jsonl', state: 'running', heartbeat: '2026.10.26 09:40', lastActive: '2026.10.26 09:40', current: 'T-09', delivered: ['runs/E1/*', 'runs/E2/*'], trace: 'tr-0426' },
      { id: 'M-05', name: 'experiment-design', kind: 'agent', role: '实验设计', model: 'claude-opus-5-5', session: 's-0418', link: 'sessions/s-0418.jsonl', state: 'ended', heartbeat: '2026.10.22 15:31', lastActive: '2026.10.22 15:30', current: null, delivered: ['EXPERIMENT-PLAN.md v3'], trace: 'tr-0422', endNote: '会话已正常结束' },
    ],
    roleTemplates: [
      { id: 'RT-1', name: '叙事整理', skill: 'research-story', text: '维护 STORY-PLAN.md，跟踪贡献与证据缺口。', from: 'STORY-PLAN.md §5 的建议分工' },
      { id: 'RT-2', name: '结果复核', skill: null, text: '在 T-10 之前复核统计口径与数据加载修复。', from: 'reviews/E2-review.md 的建议' },
    ],
    conflicts: [
      { id: 'CF-01', file: 'wiki/methods/module-b.md', status: '未合并，等研究者处理', edits: [
        { member: 'M-02', session: 's-0412', at: '2026.10.23 17:58', text: '补充复杂度说明（第 12–19 行）' },
        { member: 'M-03', session: 's-0415', at: '2026.10.23 18:01', text: '修改接入位置描述（第 14–16 行）' },
      ] },
    ],
    traces: {
      'tr-0425': { title: 'Wiki 整理 │ 快照 v14', member: 'M-02', session: 's-0412', at: '2026.10.25 20:58 – 21:14', events: [
        { at: '20:58', title: '发现来源', text: '范围内 24 个文件（papers/、notes/、reports/、data/）；按指令排除 notes/private/' },
        { at: '21:01', title: '解析来源', text: '本轮处理 6、未变复用 12、部分处理 2' },
        { at: '21:03', title: '失败与不支持', text: 'p09-scan-only.pdf 没有文字层；group-meeting-slides.pptx 格式不支持' },
        { at: '21:07', title: '映射引用', text: '28 条引用，其中 2 条指向缺失的 notes/old-draft.md' },
        { at: '21:10', title: '合并知识', text: '更新 6 页，保留人工笔记；新增问题 Q-08' },
        { at: '21:14', title: '写入快照', text: '快照 v14 写入 wiki/；本轮没有运行语义复核' },
      ] },
      'tr-0423': { title: '方案核验 │ S2', member: 'M-03', session: 's-0415', at: '2026.10.23 17:40 – 18:02', events: [
        { at: '17:40', title: '读取方案', text: '读取 TAILOR.md §3（S2）' },
        { at: '17:46', title: '接口检查', text: 'e4 输出 [B, 2048, 32, 32]，通过' },
        { at: '17:51', title: '资源检查', text: '原文 +35% 与笔记“1024² 溢出”冲突，登记问题 Q-03' },
        { at: '18:01', title: '写入 Wiki', text: '修改 module-b.md 接入位置描述；与 s-0412 的修改冲突，已记录' },
        { at: '18:02', title: '原文核对', text: 'p02 第 6 页无法提取文字；T-03 标记阻塞' },
      ] },
      'tr-0426': { title: '实验执行 │ R-E2-06', member: 'M-04', session: 's-0431', at: '2026.10.26 05:10 – 进行中', events: [
        { at: '05:10', title: '启动运行', text: 'R-E2-06（A+b，seed 3），代码 c03f5a8' },
        { at: '07:32', title: '进度', text: '第 10,000 步' },
        { at: '08:51', title: '中间验证', text: '第 15,000 步：细裂缝召回 0.590（中间值，不参与比较）' },
        { at: '09:40', title: '心跳', text: '第 18,000 步' },
      ] },
      'tr-0422': { title: '实验设计 │ 计划 v3', member: 'M-05', session: 's-0418', at: '2026.10.22 15:02 – 15:30', events: [
        { at: '15:02', title: '读取输入', text: 'TAILOR.md 与 Wiki 快照 v13' },
        { at: '15:20', title: '生成计划', text: 'E1–E5；E5 标为“按 Q-05 决议运行”' },
        { at: '15:30', title: '写入文件', text: 'EXPERIMENT-PLAN.md v3：E2 保护指标阈值 −0.5 → −1.0' },
      ] },
    },

    /* ---------------- 研究叙事（STORY-PLAN.md v3） ---------------- */
    story: {
      file: 'STORY-PLAN.md', version: 'v3', at: '2026.10.24 16:00', by: 'research-story',
      thread: '细裂缝漏检可能主要来自局部细节丢失；我们检验在基线 A 的解码器中加入局部窗口注意力，能否在不牺牲整体精度的前提下改善细裂缝召回。',
      structure: [
        { key: 'problem', zh: '问题', en: 'Problem', text: '基线在细裂缝上召回明显偏低', refs: ['concl:K-01', 'cite:c3'], state: 'supported' },
        { key: 'change', zh: '方法变化', en: 'Change', text: '在解码器 d2 之后插入局部窗口注意力（S1）', refs: ['scheme:S1'], state: 'pending', note: '新颖性未核实' },
        { key: 'verify', zh: '验证', en: 'Evidence', text: 'A 对 A+b：+1.9 个百分点，区间跨 0', refs: ['plan:E2', 'review:RV-E2'], state: 'insufficient' },
        { key: 'boundary', zh: '边界', en: 'Limits', text: '只在桥梁裂缝 v2 上；标注噪声下的效果存疑', refs: ['issue:Q-08'], state: 'pending' },
      ],
      claims: [
        { id: 'CL-1', kind: 'observed', text: '基线 A 细裂缝召回 0.607 ± 0.012（E1，3 个种子）', refs: ['concl:K-01'] },
        { id: 'CL-2', kind: 'observed', text: 'A+b 平均提升 1.9 个百分点，95% 区间跨 0（E2，3 个种子）', refs: ['concl:K-02'] },
        { id: 'CL-3', kind: 'supported', text: '细裂缝漏检与下采样丢失细节有关', refs: ['cite:c16', 'cite:c15'] },
        { id: 'CL-4', kind: 'mechanism', text: '窗口注意力增强细长边缘的响应，从而提升召回', refs: ['cite:c9'], note: '原文在干净标注上观察到；本项目没有直接证据' },
        { id: 'CL-5', kind: 'alternative', text: '提升可能来自额外参数与每步计算，而不是局部建模', refs: [], note: '需要等参数量对照，实验计划中没有对应行' },
      ],
      contributions: [
        { id: 'C1', aspect: 'observation', text: '量化基线在细裂缝上的漏检', refs: ['plan:E1', 'review:RV-E1', 'source:src-07'], state: 'supported', gaps: [] },
        { id: 'C2', aspect: 'performance', text: 'A+b 提升细裂缝召回且不破坏 mIoU', refs: ['scheme:S1', 'plan:E2', 'run:R-E2-02', 'run:R-E2-03', 'run:R-E2-05'], state: 'insufficient', gaps: ['G1'] },
        { id: 'C3', aspect: 'mechanism', text: '提升来自局部细节保真', refs: [], state: 'pending', gaps: ['G3'] },
        { id: 'C4', aspect: 'novelty', text: '在裂缝分割中把窗口注意力放在解码器', refs: ['wiki:W-12', 'issue:Q-11'], state: 'verifying', gaps: ['G4'] },
      ],
      figures: [
        { id: 'F1', title: '细裂缝漏检示例', question: '漏检发生在哪些裂缝上？', materials: 'runs/E1/vis/（120 张预测图）', status: 'ready', refs: ['plan:E1'] },
        { id: 'F2', title: '消融结果：A / A+b / A+c / A+b+c', question: '各模块单独与组合的作用', materials: 'E2 部分（3 个种子）；E3 只有模拟；E4 没有运行', status: 'missing', refs: ['plan:E2', 'plan:E3', 'plan:E4'] },
        { id: 'F3', title: '注意力响应可视化', question: '窗口注意力是否增强了细长边缘？', materials: '没有素材；也没有对应的实验计划', status: 'unplanned', refs: [] },
        { id: 'T1', title: '主结果表', question: '主指标与保护指标汇总', materials: 'E1、E2（E2 仍需补充种子）', status: 'partial', refs: ['plan:E1', 'plan:E2'] },
      ],
      storylines: [
        { id: 'L-A', name: '方法改进型', thread: '局部窗口注意力改善细裂缝召回', needs: 'E2 结果显著；E4 组合结果', risk: '当前 E2 证据不足；新颖性未核实', fits: ['C1', 'C2', 'C4'] },
        { id: 'L-B', name: '问题分析型', thread: '细裂缝漏检的成因诊断与基线分析', needs: 'E1 与成因分离实验（尚未计划）', risk: '贡献偏分析，需要说明与已有诊断工作的差别', fits: ['C1', 'C3'] },
      ],
      choice: 'suggested',
      gaps: [
        { id: 'G1', text: 'A+b 提升的 95% 区间跨 0', next: '补充种子 3、4（T-09 运行中）', refs: ['plan:E2', 'task:T-09'] },
        { id: 'G2', text: 'A+c 没有真实运行，只有模拟试跑', next: '等待 S2 的原文核对（T-03 阻塞）', refs: ['plan:E3', 'task:T-03'] },
        { id: 'G3', text: '机制解释没有直接证据', next: '实验计划中没有对应行', refs: [] },
        { id: 'G4', text: '新颖性检索没有完成', next: 'T-12 状态未知', refs: ['issue:Q-11', 'task:T-12'] },
      ],
    },

    /* ---------------- 概览：最近变更与最近产物 ---------------- */
    changes: [
      { at: '2026.10.26 09:40', by: '实验执行会话', text: 'R-E2-06 进度 18,000 / 40,000 步', ref: 'run:R-E2-06' },
      { at: '2026.10.25 21:14', by: 'wiki-maintain', text: '写入 Wiki 快照 v14：本轮处理 6 个来源', ref: 'view:coverage' },
      { at: '2026.10.25 18:40', by: '研究者', text: 'dag.yaml 新增 T-09、T-10', ref: 'view:dag' },
      { at: '2026.10.25 18:30', by: '研究者', text: 'E2 审查：需补充；判定证据不足', ref: 'review:RV-E2' },
      { at: '2026.10.24 16:00', by: 'research-story', text: 'STORY-PLAN.md v3：新增主线 B', ref: 'story:main' },
      { at: '2026.10.24 11:20', by: '实验执行会话', text: 'T-13 数据清洗失败', ref: 'task:T-13' },
      { at: '2026.10.23 18:02', by: 'academic-tailor', text: 'S2 原文核对失败，T-03 阻塞', ref: 'task:T-03' },
      { at: '2026.10.23 18:01', by: '会话记录', text: 'module-b.md 并发修改冲突（已记录）', ref: 'conflict:CF-01' },
    ],
    recent: [
      { path: 'wiki/（快照 v14）', by: 'wiki-maintain', at: '2026.10.25 21:14', ref: 'view:read' },
      { path: 'reviews/E2-review.md', by: '研究者', at: '2026.10.25 18:30', ref: 'review:RV-E2' },
      { path: 'runs/E2/R-E2-05/metrics.json', by: '实验执行会话', at: '2026.10.25 03:12', ref: 'run:R-E2-05' },
      { path: 'STORY-PLAN.md v3', by: 'research-story', at: '2026.10.24 16:00', ref: 'story:main' },
      { path: 'TAILOR.md', by: 'academic-tailor', at: '2026.10.23 18:02', ref: 'view:schemes' },
      { path: 'EXPERIMENT-PLAN.md v3', by: 'experiment-design', at: '2026.10.22 15:30', ref: 'view:plan' },
    ],
  };

  /* ======================================================================
     项目二：新课题（空工作区）—— 用来展示真实的空状态
     ====================================================================== */
  const EMPTY = {
    id: 'p-new',
    name: '新课题（空工作区）',
    code: 'NEW',
    workspace: 'D:\\research\\new-topic',
    readAt: '2026.10.26 09:45',
    sample: true,
    empty: true,
    files: [
      { key: 'wiki', path: 'wiki/', label: 'Wiki 已发布快照', detail: '没有找到', status: 'missing', at: '—', by: 'wiki-maintain' },
      { key: 'tailor', path: 'TAILOR.md', label: '学术裁缝方案', detail: '没有找到', status: 'missing', at: '—', by: 'academic-tailor' },
      { key: 'plan', path: 'EXPERIMENT-PLAN.md', label: '实验计划', detail: '没有找到', status: 'missing', at: '—', by: 'experiment-design' },
      { key: 'runs', path: 'runs/', label: '运行记录', detail: '没有找到', status: 'missing', at: '—', by: '—' },
      { key: 'reviews', path: 'reviews/', label: '审查记录', detail: '没有找到', status: 'missing', at: '—', by: '—' },
      { key: 'dag', path: 'dag.yaml', label: '任务依赖', detail: '没有找到', status: 'missing', at: '—', by: '—' },
      { key: 'team', path: 'team/sessions.jsonl', label: '成员与会话', detail: '没有找到', status: 'missing', at: '—', by: '—' },
      { key: 'story', path: 'STORY-PLAN.md', label: '研究叙事', detail: '没有找到', status: 'missing', at: '—', by: 'research-story' },
      { key: 'traces', path: 'traces/', label: '执行 trace', detail: '没有找到', status: 'missing', at: '—', by: '—' },
    ],
    question: null,
    skills: [
      { id: 'wiki-maintain', name: 'Wiki 整理', file: 'wiki/', output: null, at: null },
      { id: 'academic-tailor', name: '学术裁缝', file: 'TAILOR.md', output: null, at: null },
      { id: 'experiment-design', name: '实验设计', file: 'EXPERIMENT-PLAN.md', output: null, at: null },
      { id: 'research-story', name: '研究叙事', file: 'STORY-PLAN.md', output: null, at: null },
    ],
    wikiSnapshot: null, wikiGroups: [], pages: [], citations: {}, coverage: null, sources: [], sourceContext: {}, issues: [],
    graph: { nodes: [], edges: [] }, schemes: [], hypotheses: [], planFile: null, plans: [], runs: [], reviews: [], conclusions: [],
    tasks: [], artifacts: {}, dagEdges: [], dagCycleEdge: null, dagMissing: [], members: [], roleTemplates: [], conflicts: [], traces: {},
    story: null, changes: [], recent: [],
  };

  return { projects: [P, EMPTY] };
})();
