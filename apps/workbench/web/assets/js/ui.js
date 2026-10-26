/* DSH 研究工作台 · ui.js
   ---------------------------------------------------------------------------
   共用部件。外观全部来自 endfield.css 的 ef- 部件，加上 dsh.css 里按同一套规则
   推出来的新部件。核心是“状态语法”：每个维度有自己的符号形状和名字，
   执行、审查、研究判定、用户决策、技术就绪、证据、数据来源性质互不合并。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon, esc } = DSH;
  const ui = (DSH.ui = {});

  /* ---------- 1. 状态语法 ----------
     框的样子：solid 实线 = 生效中；dash 虚线 = 在后台 / 未发生 / 未知；
     ink 墨色实心 = 完成、选中；alert 黄块 = 需要看一眼；hatch 斜线纹 = 非真实（模拟）。
     符号的形状区分维度：圆 = 执行，方 = 审查，菱形 = 研究判定，书签 = 用户决策。 */
  const ST = {
    exec: { dim: '执行', items: {
      pending: ['待执行', 'g-pending', 'dash'], notrun: ['未运行', 'g-pending', 'dash'],
      running: ['运行中', 'g-running', 'solid'], blocked: ['阻塞', 'g-blocked', 'alert'],
      failed: ['失败', 'g-failed', 'alert'], cancelled: ['取消', 'g-cancelled', 'dash mute'],
      abandoned: ['淘汰', 'g-cancelled', 'dash mute'], done: ['完成', 'g-done', 'ink'],
      unknown: ['未知', 'g-unknown', 'dash mute'], na: ['历史记录', 'g-pv-historical', 'dash mute'] } },
    review: { dim: '审查', items: {
      none: ['未审', 'g-rv-none', 'dash mute'], pending: ['待审', 'g-rv-pending', 'alert'],
      passed: ['通过', 'g-rv-pass', 'ink'], changes: ['需补充', 'g-rv-changes', 'alert'],
      rejected: ['未通过', 'g-rv-fail', 'alert'], unknown: ['未记录', 'g-unknown', 'dash mute'] } },
    verdict: { dim: '判定', items: {
      supported: ['支持', 'g-vd-supported', 'solid'], refuted: ['反驳', 'g-vd-refuted', 'solid'],
      insufficient: ['证据不足', 'g-vd-insufficient', 'dash'], pending: ['待验证', 'g-vd-pending', 'dash mute'],
      verifying: ['待核实', 'g-vd-pending', 'dash'], na: ['不判定', 'g-vd-na', 'dash mute'], unknown: ['未标注', 'g-unknown', 'dash mute'] } },
    decision: { dim: '决策', items: {
      suggested: ['建议中', 'g-dc-suggested', 'dash'], selected: ['已选', 'g-dc-selected', 'ink'],
      delegated: ['授权代选', 'g-dc-delegated', 'solid'], unknown: ['未标注', 'g-unknown', 'dash mute'] } },
    check: { dim: '检查', items: {
      pass: ['通过', 'g-ck-pass', 'ink'], warn: ['有风险', 'g-ck-warn', 'alert'],
      fail: ['未通过', 'g-ck-fail', 'alert'], na: ['未检查', 'g-ck-na', 'dash mute'] } },
    prov: { dim: '性质', items: {
      current: ['本轮执行', 'g-pv-current', 'solid'], historical: ['历史报告', 'g-pv-historical', 'dash'],
      simulated: ['模拟', 'g-pv-simulated', 'hatch'], example: ['示例', 'g-pv-example', 'chip'], unknown: ['未标注性质', 'g-unknown', 'dash mute'] } },
    fresh: { dim: '读取', items: {
      ok: ['已读取', 'g-fr-ok', 'solid'], stale: ['可能陈旧', 'g-fr-stale', 'alert'],
      error: ['读取失败', 'g-fr-error', 'alert'], partial: ['部分读取', 'g-fr-partial', 'alert'],
      missing: ['没有找到', 'g-fr-missing', 'dash mute'], loading: ['读取中', 'g-pending', 'dash'] } },
    issue: { dim: '问题', items: {
      open: ['未解决', 'g-open', 'alert'], verifying: ['待核实', 'g-q', 'dash'], resolved: ['已解决', 'g-resolved', 'ink'], dismissed: ['已驳回', 'g-cancelled', 'dash mute'] } },
    cov: { dim: '覆盖', items: {
      processed: ['本轮处理', 'g-done', 'ink'], reused: ['未变复用', 'g-fr-ok', 'solid'],
      partial: ['部分处理', 'g-fr-partial', 'alert'], failed: ['失败 / 不支持', 'g-failed', 'alert'],
      excluded: ['明确排除', 'g-cancelled', 'dash mute'], missing: ['来源缺失', 'g-unlink', 'alert'],
      unread: ['未读', 'g-pending', 'alert'], unaudited: ['未对账', 'g-unknown', 'dash mute'], withdrawn: ['已撤回', 'g-cancelled', 'dash mute'] } },
    member: { dim: '状态', items: {
      active: ['活动中', 'g-running', 'solid'], running: ['运行中', 'g-running', 'solid'],
      idle: ['空闲', 'g-pending', 'dash'], unknown: ['未知 │ 心跳陈旧', 'g-unknown', 'alert'],
      ended: ['会话已结束', 'g-cancelled', 'dash mute'] } },
    page: { dim: '复核', items: {
      reviewed: ['已复核', 'g-rv-pass', 'ink'], pending: ['待复核', 'g-rv-none', 'dash'], needs: ['需复核', 'g-rv-changes', 'alert'] } },
    edge: { dim: '依赖', items: {
      ok: ['已满足', 'g-ck-pass', 'solid'], wait: ['等待中', 'g-pending', 'dash'],
      blocked: ['受阻', 'g-blocked', 'alert'], stale: ['产物已更新', 'g-fr-stale', 'alert'],
      missing: ['缺失节点', 'g-fr-missing', 'alert'] } },
    fig: { dim: '图表', items: {
      ready: ['素材已备 │ 未制作', 'g-pending', 'dash'], partial: ['部分素材', 'g-fr-partial', 'dash'],
      missing: ['缺数据', 'g-fr-missing', 'alert'], unplanned: ['未计划', 'g-ck-na', 'alert'], unknown: ['状态未标注', 'g-unknown', 'dash mute'] } },
    claim: { dim: '论断', items: {
      observed: ['实际观察', 'g-pv-current', 'solid'], supported: ['已有支持的解释', 'g-vd-supported', 'solid'],
      mechanism: ['待验证机制', 'g-vd-pending', 'dash'], alternative: ['备选解释', 'g-vd-na', 'dash'] } },
    aspect: { dim: '方面', items: {
      observation: ['问题观察', 'g-pv-current', 'solid'], performance: ['性能收益', 'g-ck-pass', 'solid'],
      mechanism: ['机制解释', 'g-vd-pending', 'dash'], novelty: ['文献新颖性', 'g-q', 'dash'] } },
  };
  ui.ST = ST;
  ui.label = (dim, key) => ((ST[dim] && ST[dim].items[key]) || [key])[0];

  /* st('exec','done') → 状态块；{ dim: true } 时带上维度名（执行 │ 完成） */
  ui.st = (dim, key, opt = {}) => {
    const D = ST[dim];
    const it = (D && D.items[key]) || [key || '未知', 'g-unknown', 'dash mute'];
    const [text, glyph, frame] = it;
    const label = opt.text || text;
    return html`<span class="st ${frame.split(' ').map((f) => 'st--' + f).join(' ')}${opt.cls ? ' ' + opt.cls : ''}" title="${(D ? D.dim : '') + '：' + label}">${icon(glyph, 'st-g')}${opt.dim ? html`<b class="st-k">${D.dim}</b>` : ''}<span class="st-v">${label}</span></span>`;
  };

  /* 证据状态：4 格有序刻度；冲突与来源缺失是特殊状态，用黄块 */
  const EVI = { none: [0, '无证据'], pending: [1, '待核实'], partial: [2, '部分支持'], supported: [3, '有来源支持'] };
  ui.evi = (key, opt = {}) => {
    if (key == null || key === 'unknown') return html`<span class="st st--dash st--mute" title="证据：文件中未标注">${icon('g-unknown', 'st-g')}${opt.dim ? html`<b class="st-k">证据</b>` : ''}<span class="st-v">未标注</span></span>`;
    if (key === 'conflict') return html`<span class="st st--alert" title="证据：存在冲突">${icon('g-zap', 'st-g')}${opt.dim ? html`<b class="st-k">证据</b>` : ''}<span class="st-v">存在冲突</span></span>`;
    if (key === 'missing') return html`<span class="st st--alert" title="证据：来源缺失">${icon('g-unlink', 'st-g')}${opt.dim ? html`<b class="st-k">证据</b>` : ''}<span class="st-v">来源缺失</span></span>`;
    const [lv, text] = EVI[key] || EVI.none;
    return html`<span class="evi" title="证据：${text}（${lv} / 3）"><span class="evi-cells" aria-hidden="true">${[1, 2, 3].map((n) => html`<i class="${n <= lv ? 'on' : ''}"></i>`)}</span>${opt.dim ? html`<b class="st-k">证据</b>` : ''}<span>${text}</span></span>`;
  };
  ui.EVI = EVI;

  /* 技术就绪：三步刻度。走过的步是墨色，当前步是黄色，没到的是浅灰 */
  const READY = [['design', '可设计'], ['pilot', '可试跑'], ['full', '可完整执行']];
  ui.ready = (key) => {
    const at = READY.findIndex(([k]) => k === key);
    if (at < 0) return html`<span class="steps is-unknown" title="技术就绪：文件中未标注">${READY.map(([, t], i) => html`<span><b>${DSH.fmt.pad(i + 1)}</b>${t}</span>`)}<span class="steps-note">未标注</span></span>`;
    return html`<span class="steps" title="技术就绪：${(READY[at] || ['', '未知'])[1]}">${READY.map(([, t], i) => html`<span class="${i < at ? 'is-past' : i === at ? 'is-here' : ''}"${i === at ? raw(' aria-current="step"') : ''}><b>${DSH.fmt.pad(i + 1)}</b>${t}</span>`)}</span>`;
  };

  /* 方案的三个独立维度：用户决策 / 技术就绪 / 证据状态，同时可辨认 */
  ui.triad = (s) => html`
    <dl class="triad">
      <div><dt><span class="ef-eyebrow">Decision</span>用户决策</dt><dd>${ui.st('decision', s.decision)}</dd></div>
      <div><dt><span class="ef-eyebrow">Readiness</span>技术就绪</dt><dd>${ui.ready(s.readiness)}</dd></div>
      <div><dt><span class="ef-eyebrow">Evidence</span>证据状态</dt><dd>${ui.evi(s.evidence)}</dd></div>
    </dl>`;

  /* ---------- 2. 对象引用：能点 = 切角；找不到 = 断链 ---------- */
  ui.ref = (ref, opt = {}) => {
    const r = DSH.refInfo(ref);
    const glyph = r.T.icon;
    if (!r.exists) {
      return html`<span class="oref is-broken" title="断链：${ref} 在当前工作区中找不到">${icon('unlink')}<span class="oref-id">${r.id}</span><span class="oref-t">未找到</span></span>`;
    }
    const label = opt.label != null ? opt.label : r.title;
    const id = r.type === 'view' || r.type === 'artifact' || r.type === 'story' ? '' : r.short;
    /* 运行助手生成的 UUID 式标识太长：芯片里截短，完整值留在提示里 */
    const shown = id && id.length > 18 ? id.slice(0, 14) + '…' : id;
    return html`<button type="button" class="oref${opt.cls ? ' ' + opt.cls : ''}" data-act="open" data-ref="${ref}" title="${r.T.zh}${id ? ' ' + id : ''}：${r.title}">${icon(glyph)}${shown ? html`<span class="oref-id">${shown}</span>` : ''}${opt.idOnly ? '' : html`<span class="oref-t">${label}</span>`}</button>`;
  };
  ui.refs = (list, opt) => (list && list.length ? html`<span class="orefs">${list.map((r) => ui.ref(r, opt))}</span>` : html`<span class="muted">无</span>`);

  /* 不可点的编号：直角 */
  ui.id = (text, cls = '') => html`<span class="dsh-id ${cls}">${text}</span>`;
  /* 可点的编号：切角，黄色 = 当前 */
  ui.tag = (text, opt = {}) => opt.act || opt.ref
    ? html`<button type="button" class="ef-tag${opt.current ? ' is-current' : ''}" ${opt.ref ? raw(`data-act="open" data-ref="${esc(opt.ref)}"`) : raw(`data-act="${esc(opt.act)}"`)}>${text}</button>`
    : html`<span class="ef-tag${opt.current ? ' is-current' : ''}">${text}</span>`;

  /* ---------- 3. 文字结构 ---------- */
  ui.facts = (items) => html`<ul class="ef-facts ef-field">${items.filter((x) => x != null && x !== '').map((x) => html`<li>${x}</li>`)}</ul>`;
  ui.pair = (en, zh, tag = 'span') => raw(`<${tag} class="ef-pair"><span class="ef-eyebrow">${esc(en)}</span><span>${esc(zh)}</span></${tag}>`);
  ui.head = ({ zh, en, desc, facts, aside }) => html`
    <header class="ef-head dsh-head">
      <h1>${zh} <small>${en}</small></h1>
      ${desc ? html`<p>${desc}</p>` : ''}
    </header>
    ${facts || aside ? html`<div class="dsh-head-row">${facts ? ui.facts(facts) : ''}${aside ? html`<div class="dsh-head-aside">${aside}</div>` : ''}</div>` : ''}`;
  ui.subnav = (label, items, current) => html`
    <nav class="dsh-subnav" aria-label="${label}">
      ${items.map((it) => html`<a href="${it.href}"${it.key === current ? raw(' aria-current="page"') : ''}><span>${it.zh}</span><small>${it.en}</small>${it.n ? html`<span class="n${it.alert ? ' is-alert' : ''}">${it.n}</span>` : ''}</a>`)}
    </nav>`;
  ui.ledger = (rows) => html`<ul class="ef-ledger">${rows.filter(Boolean).map(([k, v, warn]) => html`<li><span>${k}</span><span class="ef-field${warn ? ' warn' : ''}">${v}</span></li>`)}</ul>`;
  ui.kv = (rows) => html`<dl class="dsh-kv">${rows.filter(Boolean).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
  ui.path = (rel, opt = {}) => {
    const ws = DSH.project().workspace, sep = ws.includes('\\') ? '\\' : '/';
    const abs = ws + sep + String(rel).replace(/[\\/]/g, sep).replace(/（.*$/, '').replace(/[\\/]\*.*$/, '').replace(/[\\/]+$/, '');
    return html`<span class="dsh-path"><code>${rel}</code>${opt.copy === false ? '' : html`<button type="button" class="dsh-copy" data-act="copy" data-text="${abs}" title="复制完整路径：${abs}" aria-label="复制路径 ${rel}">${icon('copy')}</button>`}</span>`;
  };
  ui.notice = (flag, body, extra) => html`<div class="ef-notice dsh-notice" data-flag="${flag}"><div>${body}${extra ? html`<div class="dsh-notice-x">${extra}</div>` : ''}</div></div>`;
  ui.timeline = (events) => html`<ol class="dsh-tl">${events.map((e) => html`<li><time class="ef-field">${e.at}</time><div><b>${e.title}</b>${e.text ? html`<span>${e.text}</span>` : ''}${e.extra || ''}</div></li>`)}</ol>`;

  /* ---------- 4. 控件 ---------- */
  ui.btn = (label, opt = {}) => {
    const cls = ['ef-btn', opt.go && 'go', opt.small !== false && 'small', opt.cls].filter(Boolean).join(' ');
    const data = Object.entries(opt.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    return raw(`<button type="button" class="${cls}"${opt.act ? ` data-act="${esc(opt.act)}"` : ''}${data}${opt.disabled ? ' disabled' : ''}${opt.title ? ` title="${esc(opt.title)}"` : ''}${opt.pressed != null ? ` aria-pressed="${opt.pressed}"` : ''}>${opt.icon ? DSH.out(icon(opt.icon)) : ''}${esc(label)}${opt.sub ? `<span class="sub">${esc(opt.sub)}</span>` : ''}</button>`);
  };
  /* 筛选块：选中 = 黄。opt.toggle 用于“显示 / 隐藏”开关（默认全部显示）：
     显示时是普通浅灰块，隐藏时是虚线框加删除线，免得默认状态满屏黄色 */
  ui.chips = (items, act, opt = {}) => html`<div class="dsh-chips${opt.toggle ? ' is-toggle' : ''}" role="group"${opt.label ? raw(` aria-label="${esc(opt.label)}"`) : ''}>${items.map((it) => html`<button type="button" class="ef-chip" data-act="${act}" data-key="${it.key}" aria-pressed="${!!it.on}"${it.title ? raw(` title="${esc(it.title)}"`) : ''}>${it.glyph ? it.glyph : ''}${it.label}${it.n != null ? html` <span class="n">${it.n}</span>` : ''}</button>`)}</div>`;
  let segN = 0;
  ui.seg = (label, options, value, act) => {
    const name = 'seg' + ++segN;
    return html`<div class="ef-seg dsh-seg" role="radiogroup" aria-label="${label}">${options.map(([v, t, ic]) => html`<label><input type="radio" name="${name}" value="${v}" data-change="${act}"${v === value ? raw(' checked') : ''} /><span>${ic ? icon(ic) : ''}${t}</span></label>`)}</div>`;
  };
  ui.search = (placeholder, act, value = '', id = '') => html`<label class="ef-search dsh-search"><input type="search" placeholder="${placeholder}" aria-label="${placeholder}" data-input="${act}" value="${value}"${id ? raw(` id="${esc(id)}"`) : ''} /></label>`;

  /* ---------- 5. 页面状态：正常、空、加载、失败、部分完成、数据陈旧 ---------- */
  ui.empty = ({ title, text, file, skill, actions }) => html`
    <div class="dsh-empty">
      <div class="box">
        <p class="ef-eyebrow slash">Nothing yet</p>
        <p class="t">${title}</p>
        ${text ? html`<p>${text}</p>` : ''}
        ${file ? html`<p class="ef-field">预期文件：${ui.path(file)}${skill ? html` │ 由 ${skill} 提供` : ''}</p>` : ''}
        ${actions ? html`<p class="ef-actions">${actions}</p>` : ''}
      </div>
    </div>`;
  ui.loading = (label = '读取中', lines = 6) => html`
    <div class="dsh-loading" aria-busy="true">
      <div class="ef-progress is-unknown" role="progressbar" aria-label="${label}"><span class="ef-eyebrow">Reading / ${label}</span><span class="ef-field">— / —</span><i></i></div>
      <div class="dsh-skel">${Array.from({ length: lines }, (_, i) => html`<span class="ef-skeleton line" style="width:${[92, 76, 84, 58, 88, 64, 72][i % 7]}%"></span>`)}</div>
    </div>`;
  ui.readError = ({ file, error, last }) => ui.notice('读取失败', html`
      <p><b>没有读到 ${file}。</b>${error}</p>
      <p class="ef-field">文件：${ui.path(file)}</p>`,
    DSH.live() ? html`<p class="ef-actions">${ui.btn('重新读取', { act: 'refresh', icon: 'refresh' })}</p>`
      : html`<p class="ef-actions">${last ? ui.btn('显示上次成功读取（' + last + '）', { act: 'proto', data: { state: 'stale' } }) : ''}${ui.btn('重新读取', { act: 'proto', data: { state: 'normal' } })}</p>`);
  /* 服务端已转义的 Markdown 正文（只含服务端生成的标签与链接） */
  ui.md = (s) => html`<div class="ef-prose dsh-prose dsh-md">${raw(s || '')}</div>`;
  ui.toc = (toc, act = 'toc') => (toc && toc.length ? html`<ol class="dsh-toc">${toc.map((t) => html`<li><button type="button" data-act="${act}" data-target="${t.id}">${t.t}</button></li>`)}</ol>` : '');
  /* 文件里的表格原样列出（单元格是纯文本），不把文字判断成通过 / 失败 */
  ui.table = (t, caption) => (t ? html`<div class="ef-table-wrap"><table class="ef-table dsh-table-tight">${caption ? html`<caption class="dsh-cap">${caption}</caption>` : ''}<thead><tr>${t.headers.map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${t.rows.map((r) => html`<tr>${r.map((c) => html`<td>${c || html`<span class="muted">—</span>`}</td>`)}</tr>`)}</tbody></table></div>` : '');
  /* 文件里没写的字段：明确写“未记录”，不留空、不猜 */
  ui.val = (v, text = '文件中未记录') => (v == null || v === '' ? html`<span class="muted">${text}</span>` : v);

  /* 原型状态演示：把同一页切到 加载 / 空 / 失败 / 陈旧 / 部分完成 来审阅 */
  ui.withState = (meta, render) => {
    const db = DSH.db();
    if (db.p.live) {
      const f = meta.key ? (db.p.files || []).find((x) => x.key === meta.key) : null;
      const file = f && f.path && !/^（/.test(f.path) ? f.path : meta.file;
      if (f && f.status === 'error') return html`${meta.head || ''}<div class="dsh-pad">${ui.readError({ file, error: f.note || '读取失败。' })}</div>`;
      if (db.p.empty || meta.empty || (f && f.status === 'missing')) return html`${meta.head || ''}<div class="dsh-pad">${ui.empty({ title: meta.emptyTitle, text: meta.emptyText, file: meta.liveFile === null ? null : file, skill: meta.skill })}</div>`;
      return render(f && f.status === 'partial' && f.note ? ui.notice('部分读取', html`<p>${f.note}</p>`) : '');
    }
    const s = DSH.state.proto;
    if (s === 'loading') return html`${meta.head || ''}<div class="dsh-pad">${ui.loading('读取 ' + meta.file)}</div>`;
    if (s === 'error') return html`${meta.head || ''}<div class="dsh-pad">${ui.readError({ file: meta.file, error: meta.error || '第 42 行解析错误：表格列数与表头不一致（表头 11 列，该行 9 列）。工作台不会猜测缺失的列。', last: '2026.10.25 18:40' })}</div>`;
    if (s === 'empty' || db.p.empty) return html`${meta.head || ''}<div class="dsh-pad">${ui.empty({ title: meta.emptyTitle, text: meta.emptyText, file: meta.file, skill: meta.skill })}</div>`;
    const banner = s === 'stale'
      ? ui.notice('可能陈旧', html`<p>${meta.file} 在读取之后被修改过（文件时间 2026.10.26 10:05，读取时间 ${db.p.readAt}）。下面显示的是读取时的内容。</p>`, html`<p class="ef-actions">${ui.btn('重新读取', { act: 'proto', data: { state: 'normal' } })}</p>`)
      : s === 'partial'
        ? ui.notice('部分读取', html`<p>${meta.partial || meta.file + ' 中有 2 条记录无法解析，已跳过；其余内容正常显示。跳过的记录在下方列出原文位置。'}</p>`)
        : '';
    return render(banner);
  };

  /* ---------- 6. 小工具 ---------- */
  ui.member = (id) => {
    if (!id) return html`<span class="muted">未指派</span>`;
    return ui.ref('member:' + id);
  };
  ui.time = (t) => html`<time class="ef-field">${t}</time>`;
  ui.provNote = (run) => (run.prov === 'historical' ? '历史报告：不是本轮实验' : run.prov === 'simulated' ? '模拟：不参与判定' : '');
})();
