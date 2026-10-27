/* 研究方案（学术裁缝 / TAILOR.md）
   首页是少量方案；详情展示研究问题、失败证据、基线 A、模块、来源、接入位置、
   具体改动、风险与待证假设。用户决策、技术就绪、证据状态分开显示；
   不生成“创新评分”，创新主张一律写成待证假设或证据支持范围。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon, esc } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const CHECKS = [['interface', '接口'], ['data', '数据'], ['resources', '资源'], ['origin', '原文核对']];
  const OP = { insert: '插入', parallel: '并联', replace: '替换' };
  const cmp = () => DSH.vs('sc-cmp', () => ({ ids: ['S1', 'S2'] }));
  const META = (head) => ({
    head, key: 'tailor', file: 'TAILOR.md', skill: 'academic-tailor',
    emptyTitle: '还没有学术裁缝方案。',
    emptyText: '方案由 academic-tailor 从 Wiki 中的方法与证据组合而来，写入 TAILOR.md。没有方案时，这里不会生成示例方案或评分。',
    error: 'TAILOR.md 第 121 行：方案 S2 的“模块”表格缺少“接入位置”列。S2 无法解析；S1、S3 仍可读取（选“部分读取”查看）。',
    partial: 'TAILOR.md 中方案 S2 的“风险”小节格式不对，已跳过该小节；其余内容正常显示。原文位置：第 168–175 行。',
  });

  function checksRow(s) {
    if (!s.checks) return '';
    return html`<ul class="dsh-checks" aria-label="四项检查">${CHECKS.map(([k, zh]) => {
      const c = s.checks[k];
      return html`<li>${ui.st('check', c.status, { text: zh + ' ' + ui.label('check', c.status) })}</li>`;
    })}</ul>`;
  }
  function chainOf(s) {
    const db = DSH.db();
    const steps = [];
    steps.push({ zh: '方案', ref: 'scheme:' + s.id, ok: true });
    s.plans.forEach((pid) => {
      const pl = db.plans[pid];
      const runs = db.p.runs.filter((r) => r.plan === pid);
      const real = runs.filter((r) => r.prov === 'current' && r.status === 'done');
      const sim = runs.filter((r) => r.prov === 'simulated');
      steps.push({ zh: '实验计划', ref: 'plan:' + pid, ok: true });
      steps.push({ zh: '运行', text: runs.length ? `${runs.length} 次（真实完成 ${real.length}${sim.length ? '，模拟 ' + sim.length : ''}）` : '尚无运行', ok: real.length > 0, warn: !real.length, refs: real.slice(0, 3).map((r) => 'run:' + r.id), go: DSH.href('/experiments/runs', { plan: pid }) });
      const rv = pl.review ? db.reviews[pl.review] : null;
      steps.push({ zh: '审查', ref: rv ? 'review:' + rv.id : null, text: rv ? null : '尚无审查', ok: !!rv, warn: !rv, extra: rv ? html`${ui.st('review', rv.status)}${ui.st('verdict', rv.verdict, { dim: true })}` : '' });
    });
    steps.push({ zh: '叙事', refs: s.contribs.map((c) => 'contrib:' + c), text: s.contribs.length ? null : '没有对应的贡献', ok: s.contribs.length > 0, warn: !s.contribs.length });
    return html`<ol class="dsh-chainv">${steps.map((x) => html`<li class="${x.warn ? 'is-gap' : ''}">
      <span class="ef-eyebrow">${x.zh}</span>
      <div>${x.ref ? ui.ref(x.ref) : ''}${x.refs && x.refs.length ? ui.refs(x.refs, { idOnly: true }) : ''}${x.text ? html`<span class="${x.warn ? 'dsh-gap-t' : ''}">${x.text}</span>` : ''}${x.extra || ''}${x.go ? html` <button type="button" class="dsh-linkbtn" data-act="go" data-href="${x.go}">全部运行</button>` : ''}</div>
    </li>`)}</ol>`;
  }

  /* ---------- 数据流图：原方法（细框）与本项目改动（墨块 / 斜线纹） ---------- */
  function flowSVG(s) {
    const base = [['in', '输入图像'], ['enc', '编码器 e1–e4'], ['fpn', '特征金字塔'], ['d1', '解码器 d1'], ['d2', '解码器 d2'], ['d3', '解码器 d3'], ['head', '分割头']];
    const ins = s.modules.filter((m) => m.op === 'insert');
    const par = s.modules.filter((m) => m.op === 'parallel');
    const rep = s.modules.filter((m) => m.op === 'replace');
    const blocks = [];
    base.forEach(([k, t]) => {
      blocks.push({ k, t, kind: k === 'fpn' && rep.length ? 'replace' : 'base', m: k === 'fpn' && rep.length ? rep[0] : null });
      if (k === 'd2') ins.forEach((m) => blocks.push({ k: 'ins-' + m.key, t: '模块 ' + m.key + '：' + m.name, kind: 'insert', m }));
    });
    /* 块宽按文字算：中文约 11.5px，其余约 6.8px */
    const tw = (t) => [...String(t)].reduce((s, c) => s + (/[　-鿿＀-￯]/.test(c) ? 11.5 : 6.8), 0);
    const H = 46, GX = 22, Y = par.length ? 96 : 30;
    let x = 10;
    blocks.forEach((b) => {
      const lines = b.kind === 'insert' ? ['+ ' + b.t, '插入 │ ' + b.m.at] : b.kind === 'replace' ? [b.t + '（concat）', '→ ' + b.m.name] : [b.t];
      b.x = x;
      b.w = Math.max(b.kind === 'base' ? 74 : 110, Math.ceil(Math.max(...lines.map(tw)) + 26));
      x += b.w + GX;
    });
    const width = x - GX + 10;
    const height = Y + H + 46;
    const W = Math.max(110, ...par.map((m) => Math.ceil(Math.max(tw('模块 ' + m.key + '：' + m.name), tw('并联 │ ' + m.at)) + 26 - 40)));
    const parts = [];
    blocks.forEach((b, i) => {
      if (i > 0) { const a = blocks[i - 1]; parts.push(`<line class="fl-ln" x1="${a.x + a.w}" y1="${Y + H / 2}" x2="${b.x - 6}" y2="${Y + H / 2}" marker-end="url(#fl-arrow)"/>`); }
    });
    const enc = blocks.find((b) => b.k === 'enc'), d1 = blocks.find((b) => b.k === 'd1');
    par.forEach((m) => {
      const bx = enc.x + enc.w / 2, ex = d1.x + d1.w / 2;
      const px = (bx + ex) / 2 - (W + 40) / 2;
      parts.push(`<path class="fl-ln is-branch" d="M${bx} ${Y}V${30 + H / 2}H${px}" />`);
      parts.push(`<path class="fl-ln is-branch" d="M${px + W + 40} ${30 + H / 2}H${ex}V${Y - 6}" marker-end="url(#fl-arrow)"/>`);
      parts.push(`<g class="fl-b is-parallel" data-act="open" data-ref="wiki:${esc(m.page)}" tabindex="0" role="button" aria-label="${esc('并联分支：模块 ' + m.key + ' ' + m.name + '，位置 ' + m.at)}"><path d="M${px} 30h${W + 40}v${H - 9}l-9 9h${-(W + 31)}z"/><text x="${px + 12}" y="${30 + 19}">模块 ${esc(m.key)}：${esc(m.name)}</text><text class="sub" x="${px + 12}" y="${30 + 36}">并联 │ ${esc(m.at)}</text></g>`);
    });
    blocks.forEach((b) => {
      if (b.kind === 'base') {
        parts.push(`<g class="fl-b is-base"><rect x="${b.x}" y="${Y}" width="${b.w}" height="${H}"/><text x="${b.x + b.w / 2}" y="${Y + H / 2 + 5}" text-anchor="middle">${esc(b.t)}</text></g>`);
      } else if (b.kind === 'insert') {
        parts.push(`<g class="fl-b is-insert" data-act="open" data-ref="wiki:${esc(b.m.page)}" tabindex="0" role="button" aria-label="${esc('插入：' + b.t + '，位置 ' + b.m.at)}"><path d="M${b.x} ${Y}h${b.w}v${H - 9}l-9 9h${-(b.w - 9)}z"/><text x="${b.x + 12}" y="${Y + 19}">+ ${esc(b.t)}</text><text class="sub" x="${b.x + 12}" y="${Y + 36}">插入 │ ${esc(b.m.at)}</text></g>`);
      } else {
        parts.push(`<g class="fl-b is-replace" tabindex="0" role="img" aria-label="${esc('替换：' + b.m.change)}"><rect x="${b.x}" y="${Y}" width="${b.w}" height="${H}" fill="url(#fl-hatch)"/><text class="old" x="${b.x + 12}" y="${Y + 19}">${esc(b.t)}（concat）</text><text x="${b.x + 12}" y="${Y + 36}">→ ${esc(b.m.name)}</text></g>`);
      }
    });
    return html`
      <figure class="dsh-flow">
        <div class="dsh-flow-scroll">
          <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="group" aria-label="${s.id} 的数据流：基线 A 与本方案的改动位置">
            <defs>
              <marker id="fl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="fl-ah" d="M0 1L9 5L0 9z"/></marker>
              <pattern id="fl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect class="fl-hb" width="6" height="6"/><line class="fl-hl" x1="0" y1="0" x2="0" y2="6"/></pattern>
            </defs>
            ${raw(parts.join(''))}
          </svg>
        </div>
        <figcaption>
          <ul class="dsh-flow-legend">
            <li><i class="fl-sw is-base"></i>基线 A 原有部分</li>
            <li><i class="fl-sw is-insert"></i>插入的模块</li>
            <li><i class="fl-sw is-parallel"></i>并联分支</li>
            <li><i class="fl-sw is-replace"></i>替换（斜线纹 = 原做法被换掉）</li>
          </ul>
        </figcaption>
      </figure>`;
  }

  /* ---------- 实时模式：方案来自 TAILOR.md 的方案小节；状态只取文件里写明的字段 ---------- */
  const said = (text) => (text ? html`<span class="ef-field">文件写明：${text}</span>` : html`<span class="ef-field">文件中未写明</span>`);
  function liveHead(p) {
    const t = p.schemeTables || {};
    return html`<div class="dsh-howto">
      <p class="ef-eyebrow slash">From TAILOR.md</p>
      <p>方案按 TAILOR.md 中的方案小节列出${p.docs.tailor && p.schemes.length === 1 && p.schemes[0].source.section === '全文' ? '（文件没有分方案小节，全文作为一个方案）' : ''}。用户决策、技术就绪、证据状态只取文件里写明的“决策状态：”“技术就绪：”“证据状态：”，没写就显示未标注。</p>
      ${t.decisionText ? html`<p>文件中的决策记录：<b>${t.decisionText}</b></p>` : ''}
      ${t.alignment ? html`<p>目标对齐表 ${t.alignment.rows.length} 行：${GAPS.map(([k]) => ({ k, n: t.alignment.rows.filter((r) => r.category === k).length })).filter((x) => x.n).map((x) => ui.label('gap', x.k) + ' ' + x.n).join(' │ ') || '没有分类'} <a href="#sc-align" data-act="toc" data-target="sc-align">查看</a></p>` : ''}
    </div>`;
  }
  const GAPS = [['expression'], ['evidence'], ['experiment'], ['method'], ['pending'], ['supported'], ['unknown']];
  /* 目标对齐：目标—现有依据—缺口—下一步；缺口类别只取文件写的类别列或缺口原文 */
  function alignment(t) {
    if (!t.alignment) return '';
    return html`
      <h2 class="dsh-h2" id="sc-align" tabindex="-1">${ui.pair('Goal alignment', '目标对齐与缺口')}</h2>
      <div class="ef-table-wrap">
        <table class="ef-table dsh-table-tight dsh-align">
          <thead><tr><th>目标</th><th>现有依据</th><th>缺口</th><th>缺口类别</th><th>下一步</th><th>关联材料</th></tr></thead>
          <tbody>${t.alignment.rows.map((r) => html`<tr>
            <td class="ef-read">${ui.val(r.goal)}</td><td>${ui.val(r.basis)}</td><td>${ui.val(r.gap)}</td>
            <td>${ui.st('gap', r.category)}${r.categoryText ? html`<div class="ef-field">${r.categoryText}</div>` : ''}</td>
            <td>${ui.val(r.next)}</td>
            <td>${(r.refs || []).length ? ui.refs(r.refs, { idOnly: true }) : html`<span class="muted">无</span>`}</td>
          </tr>`)}</tbody>
        </table>
      </div>
      <p class="dsh-note">TAILOR.md 第 ${t.alignment.line} 行。表达、证据、实验、方法缺口分开显示；关联材料只在方案、实验或 Wiki 页 ID 实际出现时连上。</p>`;
  }
  function liveTail(p) {
    const t = p.schemeTables || {};
    const doc = p.docs.tailor;
    return html`
      ${alignment(t)}
      ${t.check ? html`<h2 class="dsh-h2">${ui.pair('Checks', '证据与就绪检查表（原文）')}</h2>${ui.table(t.check)}<p class="dsh-note">表格按原文列出，不把文字判成通过或失败。TAILOR.md 第 ${t.check.line} 行。</p>` : ''}
      ${t.module ? html`<h2 class="dsh-h2">${ui.pair('Modules', '模块来源表（原文）')}</h2>${ui.table(t.module)}` : ''}
      ${doc && doc.html ? html`<details class="dsh-docbox"><summary>${icon('file')}TAILOR.md 原文</summary>${ui.md(doc.html)}</details>` : ''}`;
  }
  function liveCard(s, sel, runs) {
    return html`
      <li class="dsh-scheme ef-host" id="sc-${s.id}">
        <a class="dsh-scheme-no" href="#/schemes/${s.id}" aria-label="查看方案 ${s.id}"><span class="ef-hollow-no" aria-hidden="true">${s.no}</span></a>
        <div class="dsh-scheme-main">
          <p class="dsh-ids">${ui.tag(s.id, { ref: 'scheme:' + s.id })}${ui.facts([s.source.file + ' │ ' + s.source.section, s.source.lines, s.source.at])}</p>
          <h2 class="dsh-scheme-t"><a href="#/schemes/${s.id}">${s.title}</a></h2>
          ${s.question ? html`<p class="dsh-scheme-q ef-read">${s.question}</p>` : ''}
          ${ui.triad(s)}
          <div class="dsh-scheme-row"><span class="ef-eyebrow">Linked</span>${s.plans.length ? ui.refs(s.plans.map((x) => 'plan:' + x)) : html`<span class="muted">实验计划中没有提到 ${s.id}</span>`}<span class="ef-field">${runs.length} 条运行记录</span></div>
        </div>
        <div class="dsh-scheme-acts">
          ${ui.btn('查看详情', { act: 'go', data: { href: '#/schemes/' + s.id } })}
          <button type="button" class="ef-chip" data-act="sc-pick" data-key="${s.id}" aria-pressed="${sel.includes(s.id)}">${sel.includes(s.id) ? '已加入比较' : '加入比较'}</button>
        </div>
      </li>`;
  }
  function liveCompare(S, row) {
    return html`
      ${row('研究问题', 'Question', (s) => (s.question ? html`<span class="ef-read">${s.question}</span>` : ui.val(null)))}
      ${row('用户决策', 'Decision', (s) => html`${ui.st('decision', s.decision)}<div>${said(s.decisionText)}</div>`)}
      ${row('技术就绪', 'Readiness', (s) => html`${ui.ready(s.readiness)}<div>${said(s.readinessText)}</div>`)}
      ${row('证据状态', 'Evidence', (s) => html`${ui.evi(s.evidence)}<div>${said(s.evidenceText)}</div>`)}
      ${row('关联实验', 'Plans', (s) => (s.plans.length ? ui.refs(s.plans.map((x) => 'plan:' + x), { idOnly: true }) : ui.val(null, '没有')))}
      ${row('出处', 'Source', (s) => html`${s.source.section}<div class="ef-field">${s.source.lines}</div>`)}`;
  }
  function liveDetail(s, banner) {
    return html`
      <div class="dsh-doc">
        <article class="dsh-sheet" data-scroll-key="sheet" aria-labelledby="sc-title">
          ${banner}
          <p class="ef-crumb ef-field"><a href="#/schemes">研究方案</a><span>${s.id}</span></p>
          <p class="dsh-ids">${ui.id(s.id, 'is-here')}${ui.st('decision', s.decision, { dim: true })}</p>
          ${ui.facts([html`${s.source.file} │ ${s.source.section}`, s.source.lines, s.source.at, 'academic-tailor'])}
          <h1 class="dsh-title ef-read" id="sc-title">${s.title}</h1>
          <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
          ${s.question ? html`<p class="ef-lede ef-read"><b>${s.questionFrom === 'field' ? '研究问题：' : '小节首段：'}</b>${s.question}</p>` : ''}
          ${ui.triad(s)}
          <ul class="dsh-said">
            <li><span class="ef-eyebrow">Decision</span>${said(s.decisionText)}</li>
            <li><span class="ef-eyebrow">Readiness</span>${said(s.readinessText)}</li>
            <li><span class="ef-eyebrow">Evidence</span>${said(s.evidenceText)}</li>
          </ul>
          <h2 class="dsh-h2">${ui.pair('From TAILOR.md', '方案原文')}</h2>
          ${ui.md(s.html)}
          ${s.checkTable ? html`<h2 class="dsh-h2">${ui.pair('Checks', '检查表（原文）')}</h2>${ui.table(s.checkTable)}` : ''}
          ${s.moduleTable ? html`<h2 class="dsh-h2">${ui.pair('Modules', '模块来源表（原文）')}</h2>${ui.table(s.moduleTable)}` : ''}
        </article>
        <aside class="dsh-margin" data-scroll-key="margin" aria-label="目录与关联">
          ${s.toc.length ? html`<h2 class="dsh-margin-h">${ui.pair('Contents', '目录')}</h2>${ui.toc(s.toc)}` : ''}
          <h2 class="dsh-margin-h">${ui.pair('Chain', '方案 → 计划 → 运行 → 审查 → 叙事')}</h2>
          ${chainOf(s)}
          <p class="dsh-note">关联只按 ID 在文件中实际出现来连，不按名称猜。</p>
          <h2 class="dsh-margin-h">${ui.pair('Source', '来源文件')}</h2>
          <p>${ui.path(s.source.file)}</p>
          <p class="ef-field">${s.source.section} │ ${s.source.lines}</p>
          <p class="ef-actions dsh-mt">${ui.btn('与其他方案并排比较', { act: 'go', data: { href: DSH.href('/schemes/compare', { ids: [...new Set([s.id].concat(cmp().ids.filter((x) => x !== s.id)))].slice(0, 3).join(',') }) } })}</p>
        </aside>
      </div>`;
  }

  /* ---------- 方案首页 ---------- */
  DSH.views.schemes = {
    title: () => '研究方案',
    render() {
      const db = DSH.db();
      const p = db.p;
      const head = ui.head({ zh: '研究方案', en: 'Schemes', desc: '学术裁缝从 Wiki 中的方法与证据组合出候选方案。这里的“创新点”只以待证假设和方法差异呈现，不打分、不排名。', facts: p.schemes.length ? ['TAILOR.md', `解析于 ${p.readAt}`, `${p.schemes.length} 个方案`, 'academic-tailor'] : ['TAILOR.md'] });
      return ui.withState({ ...META(html`<div class="dsh-page">${head}</div>`) }, (banner) => {
        DSH.state.pageLabel = '研究方案';
        const sel = cmp().ids;
        return html`
        <div class="dsh-page">
          ${head}
          ${banner}
          <div class="dsh-howto">
            <p class="ef-eyebrow slash">How to read</p>
            <p>每个方案有三个互不替代的状态：<b>用户决策</b>（建议中 / 已选 / 授权代选）、<b>技术就绪</b>（可设计 → 可试跑 → 可完整执行）、<b>证据状态</b>（无 → 待核实 → 部分支持 → 有来源支持）。</p>
          </div>
          <div class="dsh-toolbar">
            <span class="ef-field">并排比较：已选 ${sel.length} 个（2–3 个）</span>
            ${ui.btn(`并排比较 ${sel.length} 个方案`, { act: 'go', data: { href: DSH.href('/schemes/compare', { ids: sel.join(',') }) }, go: true, disabled: sel.length < 2, icon: 'table' })}
          </div>
          ${p.live ? liveHead(p) : ''}
          <ol class="dsh-schemes">
            ${p.schemes.map((s) => {
              const h = db.hyps[s.hypotheses[0]];
              const runs = p.runs.filter((r) => s.plans.includes(r.plan));
              if (s.live) return liveCard(s, sel, runs);
              return html`
              <li class="dsh-scheme ef-host" id="sc-${s.id}">
                <a class="dsh-scheme-no" href="#/schemes/${s.id}" aria-label="查看方案 ${s.id}"><span class="ef-hollow-no" aria-hidden="true">${s.no}</span></a>
                <div class="dsh-scheme-main">
                  <p class="dsh-ids">${ui.tag(s.id, { ref: 'scheme:' + s.id })}<span class="dsh-kv-static"><span>组合</span><span>${s.short}</span></span>${ui.facts([s.source.file + ' ' + s.source.section, s.source.at])}</p>
                  <h2 class="dsh-scheme-t"><a href="#/schemes/${s.id}">${s.title}</a></h2>
                  <p class="dsh-scheme-q ef-read">${s.question}</p>
                  ${ui.triad(s)}
                  <div class="dsh-scheme-row"><span class="ef-eyebrow">Checks</span>${checksRow(s)}</div>
                  <div class="dsh-scheme-row"><span class="ef-eyebrow">Hypothesis</span><span class="dsh-hyp">${ui.id('待证假设')} ${h.id}：${h.text} ${ui.st('verdict', h.verdict, { dim: true })}</span></div>
                  <div class="dsh-scheme-row"><span class="ef-eyebrow">Linked</span>${ui.refs(s.plans.map((x) => 'plan:' + x))}<span class="ef-field">${runs.length} 次运行</span></div>
                </div>
                <div class="dsh-scheme-acts">
                  ${ui.btn('查看详情', { act: 'go', data: { href: '#/schemes/' + s.id } })}
                  <button type="button" class="ef-chip" data-act="sc-pick" data-key="${s.id}" aria-pressed="${sel.includes(s.id)}">${sel.includes(s.id) ? '已加入比较' : '加入比较'}</button>
                </div>
              </li>`;
            })}
          </ol>
          ${p.live ? liveTail(p) : ''}
        </div>`;
      });
    },
  };
  DSH.on('sc-pick', (el) => {
    const c = cmp();
    const id = el.dataset.key;
    if (c.ids.includes(id)) c.ids = c.ids.filter((x) => x !== id);
    else if (c.ids.length >= 3) { DSH.toast('最多并排比较 3 个方案'); return; }
    else c.ids = c.ids.concat(id).sort();
    DSH.render();
  });

  /* ---------- 并排比较：不排名，不打分 ---------- */
  DSH.views['scheme-compare'] = {
    title: () => '方案比较',
    render(r) {
      const db = DSH.db();
      const head = ui.head({ zh: '方案并排比较', en: 'Compare', desc: '按依据、实现成本、风险、所需材料与预期验证逐行对照。表格不排序、不给总分。' });
      return ui.withState(META(html`<div class="dsh-page">${head}</div>`), (banner) => {
        const ids = (r.query.ids || cmp().ids.join(',')).split(',').filter((x) => db.schemes[x]);
        const S = ids.map((x) => db.schemes[x]);
        DSH.state.pageLabel = '方案比较 │ ' + ids.join('、');
        const row = (zh, en, fn) => html`<tr><th scope="row"><span class="ef-pair"><span class="ef-eyebrow">${en}</span><span>${zh}</span></span></th>${S.map((s) => html`<td>${fn(s)}</td>`)}</tr>`;
        return html`
        <div class="dsh-page">
          <p class="ef-crumb ef-field"><a href="#/schemes">研究方案</a><span>并排比较</span></p>
          ${head}
          ${banner}
          ${S.length < 2 ? ui.notice('注意', html`<p>至少选择 2 个方案才能比较。</p>`, html`<p class="ef-actions">${ui.btn('回到方案', { act: 'go', data: { href: '#/schemes' } })}</p>`) : html`
          <div class="ef-table-wrap">
            <table class="ef-table dsh-compare">
              <thead><tr><th></th>${S.map((s) => html`<th scope="col">${ui.ref('scheme:' + s.id)}</th>`)}</tr></thead>
              <tbody>${db.p.live ? liveCompare(S, row) : html`
                ${row('研究问题', 'Question', (s) => html`<span class="ef-read">${s.question}</span>`)}
                ${row('依据', 'Basis', (s) => s.failure.length ? html`<ul class="dsh-ul">${s.failure.map((f) => html`<li>${f.text} ${ui.st('prov', f.prov)}</li>`)}</ul>` : html`<span class="muted">没有记录现有失败证据</span>`)}
                ${row('改动位置', 'Where', (s) => html`<ul class="dsh-ul">${s.modules.map((m) => html`<li><b>${OP[m.op]}</b> 模块 ${m.key}：${m.at}</li>`)}</ul>`)}
                ${row('实现成本', 'Cost', (s) => s.cost)}
                ${row('风险', 'Risks', (s) => html`<ul class="dsh-ul">${s.risks.map((x) => html`<li>${x.text}</li>`)}</ul>`)}
                ${row('所需材料', 'Materials', (s) => s.materials)}
                ${row('预期验证', 'Validation', (s) => html`${s.validation}<div>${ui.refs(s.plans.map((x) => 'plan:' + x), { idOnly: true })}</div>`)}
                ${row('用户决策', 'Decision', (s) => ui.st('decision', s.decision))}
                ${row('技术就绪', 'Readiness', (s) => ui.ready(s.readiness))}
                ${row('证据状态', 'Evidence', (s) => ui.evi(s.evidence))}
                ${row('四项检查', 'Checks', (s) => checksRow(s))}
                ${row('新颖性边界', 'Novelty', (s) => html`<span class="ef-read">${s.novelty}</span>`)}`}
              </tbody>
            </table>
          </div>`}
        </div>`;
      });
    },
  };

  /* ---------- 方案详情 ---------- */
  DSH.views.scheme = {
    layout: 'fixed',
    title: (r) => { const s = DSH.db().schemes[r.params.id]; return s ? s.id + ' ' + s.short : '方案'; },
    render(r) {
      const db = DSH.db();
      const s = db.schemes[r.params.id];
      if (!s && !db.p.empty && DSH.state.proto === 'normal') return html`<div class="dsh-page">${ui.notice('断链', html`<p>TAILOR.md 中没有方案 ${r.params.id}。</p>`, html`<p class="ef-actions">${ui.btn('回到方案', { act: 'go', data: { href: '#/schemes' } })}</p>`)}</div>`;
      return ui.withState(META(html`<div class="dsh-page">${ui.head({ zh: '研究方案', en: 'Scheme' })}</div>`), (banner) => {
        DSH.state.pageLabel = '方案 │ ' + s.id + ' ' + s.short;
        if (s.live) return liveDetail(s, banner);
        return html`
        <div class="dsh-doc">
          <article class="dsh-sheet" data-scroll-key="sheet" aria-labelledby="sc-title">
            ${banner}
            <p class="ef-crumb ef-field"><a href="#/schemes">研究方案</a><span>${s.id}</span></p>
            <p class="dsh-ids">${ui.id(s.id, 'is-here')}<span class="dsh-kv-static"><span>组合</span><span>${s.short}</span></span>${ui.st('decision', s.decision, { dim: true })}</p>
            ${ui.facts([html`${s.source.file} ${s.source.section}`, s.source.lines, s.source.at, 'academic-tailor'])}
            <h1 class="dsh-title ef-read" id="sc-title">${s.title}</h1>
            <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
            <p class="ef-lede ef-read"><b>研究问题：</b>${s.question}</p>
            ${ui.triad(s)}

            <h2 class="dsh-h2">${ui.pair('Failure evidence', '现有失败证据')}</h2>
            ${s.failure.length ? html`<ul class="dsh-evid">${s.failure.map((f) => html`<li>${ui.st('prov', f.prov)}<span class="ef-read">${f.text}</span>${ui.ref(f.ref, { idOnly: true })}</li>`)}</ul>` : html`<p class="ef-empty">TAILOR.md 没有为这个方案记录现有方法的失败证据。组合方案的动机来自 S1、S2 各自的证据。</p>`}

            <h2 class="dsh-h2">${ui.pair('Composition', '基线与模块')}</h2>
            <p class="ef-read">基线：${ui.ref('wiki:' + s.baseline.page, { label: s.baseline.name })}</p>
            <div class="ef-table-wrap">
              <table class="ef-table dsh-modtable">
                <thead><tr><th>模块</th><th>做法</th><th>原方法（来源）</th><th>本项目改动</th></tr></thead>
                <tbody>${s.modules.map((m) => html`<tr>
                  <td><b>${m.key}</b> ${m.page ? ui.ref('wiki:' + m.page, { label: m.name }) : html`${m.name} <span class="ef-field">无 Wiki 页</span>`}</td>
                  <td>${ui.id(OP[m.op])}<div class="ef-field">${m.at}</div></td>
                  <td class="ef-read">${m.origin}${m.cite ? html` ${ui.ref('cite:' + m.cite, { idOnly: true })}` : ''}</td>
                  <td class="ef-read">${m.change}</td>
                </tr>`)}</tbody>
              </table>
            </div>

            <h2 class="dsh-h2">${ui.pair('Data flow', '接入位置')}</h2>
            ${flowSVG(s)}

            <h2 class="dsh-h2">${ui.pair('Changes', '具体改动')}</h2>
            <ol class="dsh-ol ef-read">${s.changes.map((c) => html`<li>${c}</li>`)}</ol>

            <h2 class="dsh-h2">${ui.pair('Risks', '风险')}</h2>
            <ul class="dsh-evid">${s.risks.map((x) => html`<li>${ui.st('check', 'warn', { text: '风险' })}<span class="ef-read">${x.text}</span>${ui.ref(x.ref, { idOnly: true })}</li>`)}</ul>

            <h2 class="dsh-h2">${ui.pair('Hypotheses', '待证假设')}</h2>
            ${s.hypotheses.map((hid) => { const h = db.hyps[hid]; return html`
              <section class="dsh-hypcard" id="hyp-${hid}">
                <p class="dsh-chiprow">${ui.id('待证假设')}${ui.id(hid)}${ui.st('verdict', h.verdict, { dim: true })}</p>
                <p class="ef-read dsh-hyp-t">${h.text}</p>
                <p class="dsh-note">证据支持范围：${h.by ? html`由审查 ${ui.ref('review:' + h.by)} 判定；` : '尚无审查；'}检验计划 ${ui.refs(s.plans.map((x) => 'plan:' + x), { idOnly: true })}</p>
              </section>`; })}

            <h2 class="dsh-h2">${ui.pair('Novelty boundary', '新颖性边界')}</h2>
            ${ui.notice('边界', html`<p>${s.novelty}</p>`)}
          </article>
          <aside class="dsh-margin" data-scroll-key="margin" aria-label="检查与关联">
            <h2 class="dsh-margin-h">${ui.pair('Checks', '四项检查')}</h2>
            <ul class="dsh-checklist">${CHECKS.map(([k, zh]) => { const c = s.checks[k]; return html`<li class="is-${c.status}">
              <div class="dsh-checklist-h"><b>${zh}</b>${ui.st('check', c.status)}</div>
              <p>${c.note}</p>
              ${c.gap ? html`<p class="dsh-gap">${icon('arrow-r')}缺口连到受阻步骤：${ui.ref(c.gap)}</p>` : ''}
            </li>`; })}</ul>
            <h2 class="dsh-margin-h">${ui.pair('Chain', '方案 → 计划 → 运行 → 审查 → 叙事')}</h2>
            ${chainOf(s)}
            <h2 class="dsh-margin-h">${ui.pair('For comparison', '比较信息')}</h2>
            ${ui.ledger([['实现成本', s.cost], ['所需材料', s.materials], ['预期验证', s.validation]])}
            <p class="ef-actions dsh-mt">${ui.btn('与其他方案并排比较', { act: 'go', data: { href: DSH.href('/schemes/compare', { ids: [...new Set([s.id].concat(cmp().ids.filter((x) => x !== s.id)))].slice(0, 3).join(',') }) } })}</p>
            <h2 class="dsh-margin-h">${ui.pair('Source', '来源文件')}</h2>
            <p>${ui.path(s.source.file)}</p>
            <p class="ef-field">${s.source.section} │ ${s.source.lines}</p>
          </aside>
        </div>`;
      });
    },
    mount(el, r) { if (r.query.focus) DSH.flash(r.query.focus); },
  };
})();
