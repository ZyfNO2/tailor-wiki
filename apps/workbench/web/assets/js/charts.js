/* DSH 研究工作台 · charts.js
   ---------------------------------------------------------------------------
   图表按 endfield-ui 的规则：灰色的标记、当前或被强调的用墨色（深色主题里用黄色）、
   越过阈值的地方挂一个黄色小方块；不用红绿、不用渐变。
   按 dataviz 的规则：一个图一个轴；细标记；2px 间隙；图例在 ≥ 2 个系列时出现；
   悬停说明“值在前”；每个图都有表格视图；没有真实数据时显示空状态，不画估计的曲线。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon, esc } = DSH;
  const C = (DSH.charts = {});
  const NS = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs = {}, text) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
    if (text !== undefined) el.textContent = String(text);
    return el;
  };

  /* ---------- 1. 圆形导航（改写自 endfield-ui 的 dial.js，经典脚本版） ----------
     每段是一个分区链接；悬停或聚焦时括住该段、引一束线到中心、中心换成该段的读数。
     需要处理的段边框加粗并挂黄色小方块。内圈是四分之三圈的读数弧（真实比例）。 */
  C.dial = (svg, { sections, gauges = [], idle }) => {
    const W = 300;
    const [R1, R2, GAP] = [228, 288, 1.6];
    const step = 360 / sections.length;
    const at = (r, deg) => {
      const a = (deg * Math.PI) / 180;
      return [+(W + r * Math.sin(a)).toFixed(1), +(W - r * Math.cos(a)).toFixed(1)];
    };
    svg.setAttribute('viewBox', '0 0 600 600');
    svg.replaceChildren();
    svg.append(node('circle', { class: 'orbit', cx: W, cy: W, r: 296 }));
    const tag = node('polygon', { class: 'core-tag', points: `${W - 50},${W - 32} ${W + 50},${W - 32} ${W + 50},${W - 19} ${W + 44},${W - 13} ${W - 50},${W - 13}` });
    const label = node('text', { class: 'core-label on-tag', x: W, y: W - 18, 'text-anchor': 'middle' });
    const big = node('text', { class: 'core', x: W, y: W + 30, 'text-anchor': 'middle' });
    const sub = node('text', { class: 'core-label', x: W, y: W + 54, 'text-anchor': 'middle' });
    const show = (s) => {
      label.textContent = s.label || s.zh;
      big.textContent = s.big;
      if (s.unit) big.append(node('tspan', { class: 'unit', dx: 5 }, s.unit));
      sub.textContent = s.sub || '';
    };
    gauges.forEach((g, i) => {
      const r = 150 - i * 21;
      const group = node('g', { class: 'gauge' + (g.alert ? ' is-alert' : '') });
      const arc = (cls, len) => node('circle', { class: cls, cx: W, cy: W, r, pathLength: 100, 'stroke-dasharray': `${len} 100`, transform: `rotate(-90 ${W} ${W})` });
      group.append(arc('track', 75), arc('arc', (75 * Math.max(0.004, Math.min(1, g.share))).toFixed(2)));
      if (g.alert) group.append(node('rect', { class: 'flag', x: W - 118, y: W - r - 8, width: 112, height: 16 }));
      group.append(node('text', { x: W - 10, y: W - r, 'text-anchor': 'end', 'dominant-baseline': 'central' }, `${g.label} ${g.value}`));
      const t = node('title', {}, `${g.label}：${g.value}`);
      group.append(t);
      svg.append(group);
    });
    sections.forEach((s, i) => {
      const mid = i * step;
      const [a0, a1] = [mid - step / 2 + GAP, mid + step / 2 - GAP];
      const o0 = at(R2, a0), o1 = at(R2, a1), i1 = at(R1, a1), i0 = at(R1, a0);
      const l0 = at(R2 + 8, a0), l1 = at(R2 + 8, a1);
      const [bx0, by0] = at(R1 - 3, mid);
      const [bx1, by1] = at(160, mid);
      const [tx, ty] = at((R1 + R2) / 2, mid);
      const a = node('a', { href: s.href || '#', class: `seg${s.here ? ' is-here' : ''}${s.alert ? ' is-alert' : ''}`, style: `--i:${i}` });
      a.setAttribute('aria-label', `${s.zh}：${s.big}${s.unit || ''}${s.sub ? '，' + s.sub : ''}${s.here ? '（当前）' : ''}`);
      if (s.here) a.setAttribute('aria-current', 'page');
      a.append(
        node('path', { class: 'lock', d: `M${l0}A${R2 + 8} ${R2 + 8} 0 0 1 ${l1}`, pathLength: 100 }),
        node('line', { class: 'beam', x1: bx0, y1: by0, x2: bx1, y2: by1, pathLength: 100 }),
        node('path', { class: 'plate', d: `M${o0}A${R2} ${R2} 0 0 1 ${o1}L${i1}A${R1} ${R1} 0 0 0 ${i0}Z` }),
        node('text', { class: 'zh', x: tx, y: ty - 4, 'text-anchor': 'middle' }, s.zh),
        node('text', { class: 'en', x: tx, y: ty + 13, 'text-anchor': 'middle' }, s.en || ''),
      );
      if (s.alert) {
        const [fx, fy] = at(R2 - 14, mid + step / 3);
        a.append(node('rect', { class: 'flag', x: fx - 7, y: fy - 7, width: 14, height: 14 }));
      }
      a.addEventListener('pointerenter', () => show(s));
      a.addEventListener('focus', () => show(s));
      a.addEventListener('pointerleave', () => show(idle || sections[0]));
      a.addEventListener('blur', () => show(idle || sections[0]));
      svg.append(a);
    });
    svg.append(tag, label, big, sub);
    show(idle || sections[0]);
  };

  /* ---------- 2. 堆叠条：部分与整体（任务执行状态、来源覆盖） ----------
     每段之间 2px 间隙；图例逐项写出名称与计数，所以不悬停也能读到每个值。 */
  C.stack = ({ label, items, total, act, unit = '项', note }) => {
    const sum = total != null ? total : items.reduce((s, x) => s + x.n, 0);
    const shown = items.filter((x) => x.n > 0);
    return html`
      <figure class="dsh-stack">
        <div class="dsh-stack-bar" role="img" aria-label="${label}：${shown.map((x) => `${x.label} ${x.n}`).join('，')}，共 ${sum} ${unit}">
          ${shown.map((x) => html`<span class="seg seg--${x.kind}" style="flex:${x.n}" data-tip="${x.n} ${unit}\n${x.label}"></span>`)}
        </div>
        <ul class="dsh-stack-legend">
          ${items.map((x) => html`<li>${act
            ? html`<button type="button" class="ef-chip" data-act="${act}" data-key="${x.key}" aria-pressed="${!!x.on}"><i class="sw sw--${x.kind}" aria-hidden="true"></i>${x.label}<span class="n">${x.n}</span></button>`
            : html`<span class="dsh-legend-it"><i class="sw sw--${x.kind}" aria-hidden="true"></i>${x.label}<b class="ef-field">${x.n}</b></span>`}</li>`)}
        </ul>
        ${note ? html`<figcaption class="dsh-note">${note}</figcaption>` : ''}
      </figure>`;
  };

  /* ---------- 3. 差值图（森林图）：变体减对照，点 = 均值差，线 = 95% 区间 ----------
     同一单位的指标放在一张图里共用一个轴；不同单位的另起一张，不用双轴。
     区间越过保护阈值的一端挂黄色小方块。 */
  C.forest = ({ title, unit, rows, domain, ticks, caption, id }) => {
    const [d0, d1] = domain;
    const x = (v) => ((v - d0) / (d1 - d0)) * 100;
    const fmt = (v) => DSH.fmt.signed(v, 1);
    const f2 = (v) => DSH.fmt.signed(v, 2);
    const plot = (r) => {
      const lo = Math.max(d0, r.lo), hi = Math.min(d1, r.hi);
      const parts = [];
      parts.push(`<line class="zero" x1="${x(0)}%" x2="${x(0)}%" y1="0" y2="100%"/>`);
      if (r.threshold != null) parts.push(`<line class="thr" x1="${x(r.threshold)}%" x2="${x(r.threshold)}%" y1="2" y2="26"/>`);
      if (r.lo != null && r.hi != null) parts.push(`<line class="ci" x1="${x(lo)}%" x2="${x(hi)}%" y1="14" y2="14"/>`);
      parts.push(`<rect class="pt" x="${x(r.diff)}%" y="10" width="8" height="8" transform="translate(-4 0)"/>`);
      if (r.flagAt != null) parts.push(`<rect class="flag" x="${x(Math.max(d0, Math.min(d1, r.flagAt)))}%" y="1" width="8" height="8" transform="translate(-4 0)"/>`);
      return parts.join('');
    };
    return html`
      <figure class="dsh-chart dsh-forest"${id ? raw(` id="${esc(id)}"`) : ''}>
        <figcaption class="dsh-chart-h"><b>${title}</b><span class="ef-field">单位：${unit} │ 点 = 均值差（变体 − 对照） │ 线 = 95% 区间 │ 虚线 = 保护阈值</span></figcaption>
        <div class="dsh-forest-grid" role="img" aria-label="${title}">
          ${rows.map((r) => html`
            <div class="row" tabindex="0" data-tip="${f2(r.diff)} ${unit}（95% 区间 ${f2(r.lo)} 至 ${f2(r.hi)}）\n${r.label}${r.tipExtra ? '\n' + r.tipExtra : ''}">
              <div class="lab"><b>${r.label}</b><span class="ef-field">${r.sub}</span></div>
              <svg class="plot" preserveAspectRatio="none" aria-hidden="true">${raw(plot(r))}</svg>
              <div class="val ef-field"><b>${f2(r.diff)}</b><span>${f2(r.lo)} ~ ${f2(r.hi)}</span>${r.verdict ? html`<em>${r.verdict}</em>` : ''}</div>
            </div>`)}
          <div class="axis" aria-hidden="true"><span></span><div class="ticks">${ticks.map((t) => html`<span style="left:${x(t)}%">${t === 0 ? '0（无差异）' : fmt(t)}</span>`)}</div><span></span></div>
        </div>
        ${caption ? html`<p class="dsh-note">${caption}</p>` : ''}
        <details class="dsh-tableview"><summary>${icon('table')}表格视图</summary>
          <table class="ef-table dsh-table-tight"><thead><tr><th>指标</th><th class="num">均值差</th><th class="num">95% 区间下界</th><th class="num">上界</th><th>说明</th></tr></thead>
          <tbody>${rows.map((r) => html`<tr><td>${r.label}</td><td class="num">${f2(r.diff)}</td><td class="num">${f2(r.lo)}</td><td class="num">${f2(r.hi)}</td><td>${r.verdict || ''}</td></tr>`)}</tbody></table>
        </details>
      </figure>`;
  };

  /* ---------- 4. 每个种子的值：对照灰、变体墨色；短竖线 = 均值，横线 = ±1 标准差 ---------- */
  C.seeds = ({ title, unit, groups, domain, ticks, digits = 3, caption }) => {
    const [d0, d1] = domain;
    const x = (v) => ((v - d0) / (d1 - d0)) * 100;
    const S = DSH.stat;
    return html`
      <figure class="dsh-chart dsh-seeds">
        <figcaption class="dsh-chart-h"><b>${title}</b><span class="ef-field">单位：${unit} │ 方块 = 每个种子 │ 竖线 = 均值 │ 横线 = ±1 标准差</span></figcaption>
        <ul class="dsh-legend" aria-label="图例">${groups.map((g) => html`<li><i class="sw sw--${g.emph ? 'emph' : 'base'}" aria-hidden="true"></i>${g.label}<span class="ef-field">n = ${g.values.length}</span></li>`)}</ul>
        <div class="dsh-seeds-grid" role="img" aria-label="${title}">
          ${groups.map((g) => {
            const vals = g.values.map((v) => v.v);
            const m = S.mean(vals), s = S.sd(vals);
            return html`
              <div class="row ${g.emph ? 'is-emph' : ''}">
                <div class="lab"><b>${g.label}</b><span class="ef-field">均值 ${m.toFixed(digits)} │ 标准差 ${s.toFixed(digits)}</span></div>
                <svg class="plot" preserveAspectRatio="none" aria-hidden="true">
                  ${raw(`<line class="sdl" x1="${x(m - s)}%" x2="${x(m + s)}%" y1="16" y2="16"/><line class="mean" x1="${x(m)}%" x2="${x(m)}%" y1="5" y2="27"/>`)}
                  ${g.values.map((v) => raw(`<rect class="dot" x="${x(v.v)}%" y="11" width="10" height="10" transform="translate(-5 0)" tabindex="0" data-tip="${esc(v.v.toFixed(digits))}&#10;${esc(v.run)} │ seed ${esc(String(v.seed))}"><title>${esc(v.run)}：${esc(v.v.toFixed(digits))}</title></rect>`))}
                </svg>
                <div class="val ef-field"><b>${m.toFixed(digits)}</b><span>± ${s.toFixed(digits)}</span></div>
              </div>`;
          })}
          <div class="axis" aria-hidden="true"><span></span><div class="ticks">${ticks.map((t) => html`<span style="left:${x(t)}%">${t.toFixed(digits === 1 ? 1 : 2)}</span>`)}</div><span></span></div>
        </div>
        ${caption ? html`<p class="dsh-note">${caption}</p>` : ''}
        <details class="dsh-tableview"><summary>${icon('table')}表格视图</summary>
          <table class="ef-table dsh-table-tight"><thead><tr><th>变体</th><th>运行</th><th>种子</th><th class="num">${unit}</th></tr></thead>
          <tbody>${groups.flatMap((g) => g.values.map((v) => html`<tr><td>${g.label}</td><td>${v.run}</td><td>${v.seed}</td><td class="num">${v.v.toFixed(digits)}</td></tr>`))}</tbody></table>
        </details>
      </figure>`;
  };

  /* ---------- 5. 单点对比：只有一次测量时，不画误差范围，并写明“单次测量” ---------- */
  C.single = ({ title, unit, rows, limit, limitLabel }) => html`
    <figure class="dsh-chart dsh-single">
      <figcaption class="dsh-chart-h"><b>${title}</b><span class="ef-field">单位：${unit} │ 单次测量，没有误差范围</span></figcaption>
      <table class="ef-table dsh-table-tight">
        <thead><tr><th>变体</th><th>运行</th><th class="num">${unit}</th><th class="num">相对对照</th><th>${limitLabel || '阈值'}</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr><td>${r.label}</td><td>${r.run ? DSH.ui.ref('run:' + r.run, { idOnly: true }) : '—'}</td><td class="num">${DSH.fmt.n(r.v, 1)}</td><td class="num">${r.rel != null ? DSH.fmt.signed(r.rel * 100, 1) + '%' : '—'}</td><td>${r.limitNote ? r.over ? html`<span class="ef-field warn">${r.limitNote}</span>` : html`<span class="ef-field">${r.limitNote}</span>` : ''}</td></tr>`)}</tbody>
      </table>
    </figure>`;
})();
