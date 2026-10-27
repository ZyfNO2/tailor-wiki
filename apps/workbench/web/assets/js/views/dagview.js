/* DAG 白板（控制台子页）
   节点摘要：任务名、类型、执行状态、负责人、输入输出、阻塞原因；边写明等待什么。
   只读：缩放、平移、折叠子图、按状态 / 成员筛选、定位、查看上下游影响。
   不提供会被误认为真实派发或重排执行的操作。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const TYPE = { curate: '材料整理', verify: '方案核验', plan: '实验计划', baseline: '基线运行', single: '单模块实验', combo: '组合实验', review: '结果审查', story: '故事更新', data: '数据准备' };
  const EDGE_GLYPH = { ok: 'g-ck-pass', wait: 'g-pending', blocked: 'g-blocked', stale: 'g-fr-stale', missing: 'g-fr-missing' };
  const EXEC = ['done', 'running', 'blocked', 'failed', 'pending', 'cancelled', 'unknown'];
  const dst = () => DSH.vs('dag', () => ({ sel: null, k: 1, tx: 0, ty: 0, fitted: false, collapsed: new Set(), impact: true, status: new Set(), owner: '', mode: innerWidth < 720 ? 'list' : 'board', center: null }));

  function sectionBar(p) {
    return html`
      <div class="dsh-sectionbar">
        <span class="dsh-sectionbar-t">${ui.pair('Dependencies', 'DAG 白板')}</span>
        ${p.live ? ui.facts(['RESEARCH-DAG.md', `${p.tasks.length} 个任务`, `${p.dagEdges.length} 条依赖${p.dagMissing.length ? `（${p.dagMissing.length} 个缺失节点）` : ''}`, p.docs.dag ? p.docs.dag.at : null, '布局只改视图，不改文件'])
          : p.tasks.length ? ui.facts(['dag.yaml', `${p.tasks.length} 个任务`, `${p.dagEdges.length} 条依赖（含 1 条指向缺失节点）`, '2026.10.25 18:40', '布局只改视图，不改文件']) : ui.facts(['dag.yaml'])}
      </div>`;
  }

  function nodeCard(n, P, st, reach, cyc) {
    const pos = P[n.id];
    const style = `left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px`;
    const db = DSH.db();
    const cls = ['dag-n'];
    if (st.sel === n.id) cls.push('is-sel');
    if (cyc.inCycle.has(n.id)) cls.push('is-cyc');
    if (st.sel && st.impact && reach) {
      if (reach.up.has(n.id)) cls.push('is-up');
      else if (reach.down.has(n.id)) cls.push('is-down');
      else if (st.sel !== n.id) cls.push('is-dim');
    }
    if (n.kind === 'missing') {
      return html`<button type="button" class="${cls.concat('is-missing').join(' ')}" style="${style}" data-act="dag-sel" data-node="${n.id}" aria-pressed="${st.sel === n.id}" aria-label="缺失节点：${n.m.title}">
        <span class="dag-n-h">${ui.st('edge', 'missing', { text: '缺失节点' })}</span>
        <span class="dag-n-t">${n.m.title}</span>
        <span class="dag-n-w">${n.m.note}</span>
      </button>`;
    }
    if (n.kind === 'group') {
      return html`<button type="button" class="${cls.concat('is-group').join(' ')}" style="${style}" data-act="dag-sel" data-node="${n.id}" aria-pressed="${st.sel === n.id}" aria-label="已折叠的子图：${n.title}，${n.members.length} 个任务">
        <span class="dag-n-h">${ui.id('子图')}<span class="ef-field">已折叠 │ ${n.members.length} 个任务</span></span>
        <span class="dag-n-t">${n.title}</span>
        <span class="dag-n-s">${Object.entries(n.count).map(([k, v]) => ui.st('exec', k, { text: ui.label('exec', k) + ' ' + v }))}</span>
      </button>`;
    }
    const t = n.t;
    const dim = (st.status.size && !st.status.has(t.exec)) || (st.owner && t.owner !== st.owner);
    if (dim && !cls.includes('is-dim')) cls.push('is-dim', 'is-filtered');
    cls.push('is-' + t.exec);
    const owner = t.owner ? (db.members[t.owner] || { name: t.owner }).name : t.live ? null : '未指派';
    let warn = '';
    if (t.exec === 'done' && (t.review === 'changes' || t.review === 'rejected')) warn = html`<span class="dag-n-w is-alert">审查${ui.label('review', t.review)}：下游仍可能受阻</span>`;
    else if (t.exec === 'blocked') warn = html`<span class="dag-n-w is-alert">${t.blocked}</span>`;
    else if (t.exec === 'failed') warn = html`<span class="dag-n-w is-alert">首个错误：${t.firstError}</span>`;
    else if (t.exec === 'unknown') warn = html`<span class="dag-n-w">${t.unknownNote || (t.statusText ? '状态：' + t.statusText : '状态列为空')}</span>`;
    else if (t.stale) warn = html`<span class="dag-n-w is-alert">输入已更新：计划 v2 → v3</span>`;
    else if (t.progress) warn = html`<span class="ef-progress dag-n-p" style="--p:${(t.progress.done / t.progress.total).toFixed(3)}" aria-hidden="true"><span class="ef-field">${t.progress.label}</span><span class="ef-field">${DSH.fmt.n(t.progress.done)} / ${DSH.fmt.n(t.progress.total)}</span><i></i></span>`;
    return html`<button type="button" class="${cls.join(' ')}" style="${style}" data-act="dag-sel" data-node="${t.id}" aria-pressed="${st.sel === t.id}" aria-label="${t.id} ${t.title}：执行${ui.label('exec', t.exec)}，审查${ui.label('review', t.review)}">
      <span class="dag-n-h"><span class="dsh-id">${t.id}</span><span class="ef-field">${TYPE[t.type] || t.stage || '任务'}</span></span>
      <span class="dag-n-t">${t.title}</span>
      <span class="dag-n-s">${ui.st('exec', t.exec)}${t.review !== 'unknown' ? ui.st('review', t.review) : ''}</span>
      <span class="dag-n-f ef-field">${owner ? owner + ' │ ' : ''}入 ${t.inputs.length} │ 出 ${t.outputs.length}</span>
      ${warn}
    </button>`;
  }

  function board(m, L, st, cyc) {
    const reach = st.sel && L.P[st.sel] ? DSH.dag.reach(m, st.sel) : null;
    const paths = L.E.map((x) => {
      const hi = st.sel && (x.e.from === st.sel || x.e.to === st.sel);
      const dim = st.sel && st.impact && reach && !hi && !((reach.up.has(x.e.from) || x.e.from === st.sel) && (reach.up.has(x.e.to) || x.e.to === st.sel)) && !((reach.down.has(x.e.to) || x.e.to === st.sel) && (reach.down.has(x.e.from) || x.e.from === st.sel));
      return `<path class="dag-e is-${x.e.state}${x.cyc ? ' is-cyc' : ''}${hi ? ' is-hi' : ''}${dim ? ' is-dim' : ''}" d="${x.d}" marker-end="url(#dag-arrow${hi || x.cyc ? '-hi' : ''})"/>`;
    }).join('');
    return html`
      <div class="dag-world" id="dag-world" style="width:${L.width}px;height:${L.height}px">
        <svg class="dag-edges" width="${L.width}" height="${L.height}" aria-hidden="true">
          <defs>
            <marker id="dag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="dag-ah" d="M0 1L9 5L0 9z"/></marker>
            <marker id="dag-arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="dag-ah is-hi" d="M0 1L9 5L0 9z"/></marker>
          </defs>
          ${raw(paths)}
        </svg>
        ${L.E.map((x) => html`<button type="button" class="dag-el is-${x.e.state}${x.cyc ? ' is-cyc' : ''}" style="left:${x.lbl.x.toFixed(0)}px;top:${x.lbl.y.toFixed(0)}px;max-width:${x.lbl.w}px" data-act="dag-edge" data-edge="${x.e.id}" title="${x.e.from} → ${x.e.to}：等待 ${x.e.wait}（${ui.label('edge', x.e.state)}）">${icon(x.cyc ? 'cycle' : EDGE_GLYPH[x.e.state])}<span>${x.e.wait}</span></button>`)}
        ${m.nodes.map((n) => nodeCard(n, L.P, st, reach, cyc))}
      </div>`;
  }

  function panel(m, L, st, cyc) {
    const db = DSH.db();
    const id = st.sel;
    if (id && db.tasks[id] && L.P[id]) {
      const t = db.tasks[id];
      const reach = DSH.dag.reach(m, id);
      return html`
        <header class="dsh-kg-ph"><p class="ef-eyebrow slash">Task / ${id}</p><h2><span>${t.title}</span></h2>
          <p class="dsh-chiprow"><span class="ef-field">上游 ${reach.up.size} │ 下游 ${reach.down.size}</span>${ui.btn(st.impact ? '隐藏影响范围' : '查看影响范围', { act: 'dag-impact', pressed: st.impact, icon: 'impact' })}</p>
        </header>
        ${DSH.drawers.taskBody(id)}`;
    }
    const mm = id ? (db.p.dagMissing || []).find((x) => x.id === id) : null;
    if (mm) {
      const users = m.edges.filter((e) => e.from === id || e.to === id).map((e) => (e.from === id ? e.to : e.from)).filter((x) => db.tasks[x]);
      return html`<header class="dsh-kg-ph"><p class="ef-eyebrow slash">Missing / ${id}</p><h2><span>${mm.title}</span></h2></header>
        ${ui.notice('缺失节点', html`<p>${mm.note}。工作台按文件原样显示这条依赖，不会自动删除它，也不会猜测由谁产出。</p>`)}
        <p>被引用于：${users.length ? ui.refs([...new Set(users)].map((x) => 'task:' + x)) : html`<span class="muted">—</span>`}</p>`;
    }
    if (id === 'G-exp') {
      const g = m.nodes.find((n) => n.id === 'G-exp');
      return html`<header class="dsh-kg-ph"><p class="ef-eyebrow slash">Subgraph</p><h2><span>实验组（已折叠）</span></h2></header>
        <ul class="dsh-deps">${g.members.map((x) => html`<li><span class="dsh-deps-n">${ui.ref('task:' + x)}</span>${ui.st('exec', db.tasks[x].exec)}${ui.st('review', db.tasks[x].review)}</li>`)}</ul>
        <p class="ef-actions">${ui.btn('展开实验组', { act: 'dag-fold', icon: 'unfold' })}</p>`;
    }
    const states = m.edges.reduce((o, e) => ((o[e.state] = (o[e.state] || 0) + 1), o), {});
    return html`
      <header class="dsh-kg-ph"><p class="ef-eyebrow slash">Health</p><h2><span>依赖状况</span></h2></header>
      ${ui.ledger([
        ['依赖环', cyc.sccs.length ? `${cyc.sccs.length} 个（${cyc.sccs.map((c) => c.join(' → ')).join('；')}）` : '没有', cyc.sccs.length > 0],
        ['自依赖', `${cyc.selfLoops.length} 条${cyc.selfLoops.length ? '（' + cyc.selfLoops.map((e) => e.from).join('、') + '）' : ''}`, cyc.selfLoops.length > 0],
        ['缺失节点', `${(db.p.dagMissing || []).length} 个`, (db.p.dagMissing || []).length > 0],
        db.p.live ? ['主张关联', `${(db.p.dagClaimLinks || []).length} 条（不是任务依赖）`, (db.p.dagClaimLinks || []).length > 0] : null,
        ['产物已更新', `${states.stale || 0} 条依赖`, (states.stale || 0) > 0],
        ['受阻依赖', `${states.blocked || 0} 条`, (states.blocked || 0) > 0],
        ['等待中', `${states.wait || 0} 条`],
        ['已满足', `${states.ok || 0} 条`],
      ])}
      <p class="dsh-note">${db.p.live ? '点一个任务查看输入输出、受阻原因与上下游。依赖状态按上游任务“状态”列推断：已完成 = 已满足，阻塞 / 失败 = 受阻，其余 = 等待中。' : '点一个任务查看输入输出、受阻原因、上下游与 trace。节点完成但审查没通过时，下游仍可能受阻。'}</p>
      ${(db.p.dagClaimLinks || []).length ? html`<h3 class="dsh-sec-h">${ui.pair('Claim links', '指向主张的依赖行')}</h3>
        <ul class="dsh-deps">${db.p.dagClaimLinks.map((e) => html`<li><span class="dsh-deps-n">${e.from} → ${e.to}</span><span class="dsh-deps-w">${e.claim} 是主张或贡献，不是任务</span><span class="ef-field">${e.note}</span></li>`)}</ul>
        <p class="dsh-note">按文件原样列出，没有画进依赖图，也没有删除；主张与任务的关联应写在节点关联或叙事贡献表里。</p>` : ''}
      ${(db.p.dagWarnings || []).length ? html`<h3 class="dsh-sec-h">${ui.pair('Rows without a dependency', '没有画成依赖的行')}</h3><ul class="dsh-ul">${db.p.dagWarnings.map((w) => html`<li class="dsh-note">${w}</li>`)}</ul>` : ''}
      <h3 class="dsh-sec-h">${ui.pair('Legend', '依赖的状态')}</h3>
      <ul class="dsh-edge-legend">
        ${['ok', 'wait', 'blocked', 'stale', 'missing'].map((k) => html`<li><i class="ln-dag is-${k}" aria-hidden="true"></i>${ui.st('edge', k)}</li>`)}
        <li><i class="ln-dag is-cyc" aria-hidden="true"></i>${ui.st('edge', 'blocked', { text: '依赖环' })}</li>
      </ul>`;
  }

  function listView(m) {
    const db = DSH.db();
    const name = (id) => (db.tasks[id] ? ui.ref('task:' + id) : html`<span class="oref is-broken">${icon('ghost')}<span class="oref-id">缺失</span><span class="oref-t">${(db.p.dagMissing.find((x) => x.id === id) || {}).title || id}</span></span>`);
    const byTo = {};
    m.edges.forEach((e) => (byTo[e.to] = byTo[e.to] || []).push(e));
    return html`
      <div class="ef-table-wrap dsh-dag-list">
        <table class="ef-table">
          <caption class="dsh-cap">${ui.pair('Dependencies', '依赖清单')} <span class="ef-field">${m.edges.length} 条 │ 与白板一一对应</span></caption>
          <thead><tr><th>下游任务</th><th>等待（产物 / 条件）</th><th>上游</th><th>依赖状态</th><th>说明</th></tr></thead>
          <tbody>${Object.entries(byTo).flatMap(([to, es]) => es.map((e, i) => html`<tr>${i === 0 ? html`<td rowspan="${es.length}">${name(to)}</td>` : ''}<td>${e.wait}</td><td>${name(e.from)}</td><td>${e.cycle ? ui.st('edge', 'blocked', { text: '依赖环' }) : ui.st('edge', e.state)}</td><td class="dsh-note">${e.note || ''}</td></tr>`))}</tbody>
        </table>
      </div>`;
  }

  DSH.views.dag = {
    layout: 'fixed',
    title: () => 'DAG 白板',
    render(r) {
      const db = DSH.db();
      const p = db.p;
      const head = sectionBar(p);
      const meta = {
        head, key: 'dag', file: p.live ? 'RESEARCH-DAG.md' : 'dag.yaml', skill: p.live ? 'academic-tailor' : '研究者与各会话',
        emptyTitle: '还没有任务依赖文件。',
        emptyText: p.live ? 'RESEARCH-DAG.md 由 academic-tailor 交付：任务节点表与依赖边表。没有它时，这里不会根据任务名猜测依赖。' : 'dag.yaml 记录任务之间“等待什么产物或条件”。没有它时，这里不会根据任务名猜测依赖。',
        empty: p.live && !p.tasks.length && !p.dagEdges.length,
        error: 'dag.yaml 第 88 行缩进错误：T-11 的 inputs 无法解析。工作台不会删掉解析失败的依赖来让图看起来完整。',
        partial: 'dag.yaml 中 T-12 缺少 status 字段，已按“未知”显示；其余任务正常解析。',
      };
      return ui.withState(meta, (banner) => {
        const st = dst();
        DSH.state.pageLabel = 'DAG 白板';
        if (r.query.focus && db.tasks[r.query.focus]) { st.sel = r.query.focus; st.center = r.query.focus; if (db.tasks[r.query.focus].group === 'exp') st.collapsed.delete('exp'); }
        const cycleOn = DSH.state.proto === 'cycle';
        const m = DSH.dag.model({ cycle: cycleOn, collapsed: st.collapsed });
        const cyc = DSH.dag.cycles(m);
        const L = DSH.dag.layout(m, cyc);
        DSH.views.dag._m = { m, L, cyc };
        const owners = [...new Set(p.tasks.map((t) => t.owner).filter(Boolean))];
        return html`
          ${head}
          <div class="dsh-dag">
            <section class="dsh-dag-main" aria-label="任务依赖白板">
              ${banner}
              ${cyc.sccs.length ? ui.notice('依赖环', html`<p>检测到依赖环：${cyc.sccs.map((c) => c.concat(c[0]).join(' → ')).join('；')}。按 ${p.live ? 'RESEARCH-DAG.md' : 'dag.yaml'} 原样显示，没有自动删除任何边；环上的任务无法确定先后，需要在文件中修正。</p>`) : ''}
              <div class="dsh-toolbar">
                <label class="dsh-select is-inline"><span class="ef-eyebrow">Locate</span><select data-change="dag-locate" aria-label="定位任务"><option value="">定位任务…</option>${p.tasks.map((t) => html`<option value="${t.id}"${st.sel === t.id ? raw(' selected') : ''}>${t.id} │ ${t.title}</option>`)}</select></label>
                ${ui.chips(EXEC.map((k) => ({ key: k, label: ui.label('exec', k), n: p.tasks.filter((t) => t.exec === k).length, on: st.status.has(k), glyph: icon(ui.ST.exec.items[k][1]) })), 'dag-status', { label: '按执行状态筛选' })}
                ${owners.length ? html`<label class="dsh-select is-inline"><span class="ef-eyebrow">Owner</span><select data-change="dag-owner" aria-label="按负责人筛选"><option value="">全部成员</option>${owners.map((o) => html`<option value="${o}"${st.owner === o ? raw(' selected') : ''}>${(db.members[o] || { name: o }).name}</option>`)}</select></label>` : ''}
                ${p.tasks.some((t) => t.group === 'exp') ? ui.btn(st.collapsed.has('exp') ? '展开实验组' : '折叠实验组', { act: 'dag-fold', icon: st.collapsed.has('exp') ? 'unfold' : 'fold', pressed: st.collapsed.has('exp') }) : ''}
                <span class="dsh-toolbar-r">${ui.seg('视图', [['board', '白板', 'dag'], ['list', '清单', 'list']], st.mode, 'dag-mode')}</span>
              </div>
              ${st.mode === 'list' ? listView(m) : html`
              <div class="dsh-dag-canvas" id="dag-canvas">
                ${board(m, L, st, cyc)}
                <div class="dsh-zoom" role="group" aria-label="画布缩放">
                  <button type="button" class="dsh-zbtn" data-act="dag-zoom" data-k="1.2" aria-label="放大">${icon('plus')}</button>
                  <button type="button" class="dsh-zbtn" data-act="dag-zoom" data-k="0.83" aria-label="缩小">${icon('minus')}</button>
                  <button type="button" class="dsh-zbtn" data-act="dag-fit" aria-label="适配画布">${icon('fit')}</button>
                </div>
                <p class="dsh-dag-hint ef-field">拖动空白处平移 │ 滚轮缩放 │ 点任务看详情</p>
                <div class="dsh-minimap" aria-label="小地图：点击跳到对应位置">
                  <svg viewBox="0 0 ${L.width} ${L.height}" preserveAspectRatio="xMidYMid meet" id="dag-mini">
                    ${raw(m.nodes.map((n) => { const p = L.P[n.id]; const k = n.kind === 'task' ? n.t.exec : n.kind; return `<rect class="mm-n is-${k}${st.sel === n.id ? ' is-sel' : ''}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`; }).join(''))}
                    <rect class="mm-view" id="dag-mini-view" x="0" y="0" width="0" height="0"/>
                  </svg>
                </div>
              </div>`}
            </section>
            <aside class="dsh-dag-panel" data-scroll-key="dagpanel" id="dag-panel" aria-label="任务详情">${panel(m, L, st, cyc)}</aside>
          </div>`;
      });
    },
    mount(el) {
      const canvas = el.querySelector('#dag-canvas');
      if (!canvas) return;
      const st = dst();
      const world = el.querySelector('#dag-world');
      const { L } = DSH.views.dag._m;
      const mini = el.querySelector('#dag-mini-view');
      const apply = () => {
        world.style.transform = `translate(${st.tx.toFixed(1)}px, ${st.ty.toFixed(1)}px) scale(${st.k.toFixed(3)})`;
        if (!mini) return;
        const r = canvas.getBoundingClientRect();
        mini.setAttribute('x', (-st.tx / st.k).toFixed(0));
        mini.setAttribute('y', (-st.ty / st.k).toFixed(0));
        mini.setAttribute('width', (r.width / st.k).toFixed(0));
        mini.setAttribute('height', (r.height / st.k).toFixed(0));
      };
      /* 适配：看全貌；初次打开：用可读的比例从起点开始，靠小地图知道自己在哪 */
      const fit = () => {
        const r = canvas.getBoundingClientRect();
        st.k = Math.max(0.25, Math.min(1, Math.min((r.width - 24) / L.width, (r.height - 24) / L.height)));
        st.tx = Math.max(12, (r.width - L.width * st.k) / 2);
        st.ty = Math.max(12, (r.height - L.height * st.k) / 2);
      };
      const start = () => {
        const r = canvas.getBoundingClientRect();
        st.k = Math.min(1, Math.max(0.8, Math.min((r.width - 24) / L.width, (r.height - 24) / L.height)));
        st.tx = 8;
        st.ty = Math.max(8, (r.height - L.height * st.k) / 2);
      };
      if (!st.fitted) { start(); st.fitted = true; }
      const mm = el.querySelector('#dag-mini');
      if (mm) mm.addEventListener('click', (e) => {
        const b = mm.getBoundingClientRect();
        const s = Math.min(b.width / L.width, b.height / L.height);
        const ox = (b.width - L.width * s) / 2, oy = (b.height - L.height * s) / 2;
        const wx = (e.clientX - b.left - ox) / s, wy = (e.clientY - b.top - oy) / s;
        const r = canvas.getBoundingClientRect();
        st.tx = r.width / 2 - wx * st.k;
        st.ty = r.height / 2 - wy * st.k;
        apply();
      });
      if (st.center && L.P[st.center]) {
        const r = canvas.getBoundingClientRect();
        const p = L.P[st.center];
        st.k = Math.max(st.k, 0.8);
        st.tx = r.width / 2 - (p.x + p.w / 2) * st.k;
        st.ty = r.height / 2 - (p.y + p.h / 2) * st.k;
        st.center = null;
        const b = el.querySelector(`[data-node="${CSS.escape(st.sel)}"]`);
        b && b.focus({ preventScroll: true });
      }
      apply();
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, tx: st.tx, ty: st.ty };
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add('is-dragging');
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        st.tx = drag.tx + e.clientX - drag.x;
        st.ty = drag.ty + e.clientY - drag.y;
        apply();
      });
      const end = () => { drag = null; canvas.classList.remove('is-dragging'); };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const k2 = Math.min(1.8, Math.max(0.3, st.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        st.tx = mx - ((mx - st.tx) / st.k) * k2;
        st.ty = my - ((my - st.ty) / st.k) * k2;
        st.k = k2;
        apply();
      }, { passive: false });
      DSH.views.dag._api = { apply, fit, canvas };
    },
    unmount() { DSH.views.dag._api = null; },
  };
  DSH.on('dag-sel', (el) => {
    const st = dst();
    st.sel = st.sel === el.dataset.node ? null : el.dataset.node;
    DSH.render();
  });
  DSH.on('dag-locate', (el) => {
    const st = dst();
    if (!el.value) return;
    if (DSH.db().tasks[el.value].group === 'exp') st.collapsed.delete('exp');
    st.sel = el.value;
    st.center = el.value;
    DSH.render();
  });
  DSH.on('dag-status', (el) => { const st = dst(); const k = el.dataset.key; st.status.has(k) ? st.status.delete(k) : st.status.add(k); DSH.render(); });
  DSH.on('dag-owner', (el) => { dst().owner = el.value; DSH.render(); });
  DSH.on('dag-fold', () => { const st = dst(); st.collapsed.has('exp') ? st.collapsed.delete('exp') : st.collapsed.add('exp'); if (st.collapsed.has('exp') && DSH.db().tasks[st.sel] && DSH.db().tasks[st.sel].group === 'exp') st.sel = 'G-exp'; st.fitted = false; DSH.render(); });
  DSH.on('dag-impact', () => { const st = dst(); st.impact = !st.impact; DSH.render(); });
  DSH.on('dag-mode', (el) => { dst().mode = el.value; DSH.render(); });
  DSH.on('dag-zoom', (el) => {
    const a = DSH.views.dag._api;
    if (!a) return;
    const st = dst();
    const r = a.canvas.getBoundingClientRect();
    const k2 = Math.min(1.8, Math.max(0.3, st.k * +el.dataset.k));
    st.tx = r.width / 2 - ((r.width / 2 - st.tx) / st.k) * k2;
    st.ty = r.height / 2 - ((r.height / 2 - st.ty) / st.k) * k2;
    st.k = k2;
    a.apply();
  });
  DSH.on('dag-fit', () => { const a = DSH.views.dag._api; if (!a) return; a.fit(); a.apply(); });
  DSH.on('dag-edge', (el) => {
    const { m } = DSH.views.dag._m;
    const e = m.edges.find((x) => x.id === el.dataset.edge);
    const db = DSH.db();
    const nm = (id) => (db.tasks[id] ? ui.ref('task:' + id) : html`<span class="oref is-broken">${icon('ghost')}<span class="oref-id">缺失</span><span class="oref-t">${id}</span></span>`);
    DSH.pop.open(el, html`
      <div class="dsh-menu" role="dialog" aria-label="依赖说明">
        <p class="ef-eyebrow slash">Dependency</p>
        <p class="dsh-dep-line">${nm(e.from)}${icon('arrow-r')}${nm(e.to)}</p>
        ${ui.ledger([['等待', e.wait], ['状态', e.cycle ? '依赖环' : ui.label('edge', e.state), e.state !== 'ok' && e.state !== 'wait']])}
        ${e.note ? html`<p class="dsh-menu-note">${e.note}</p>` : ''}
        ${e.cycle ? html`<p class="dsh-menu-note">这条边与其他依赖构成环；工作台按文件原样显示。</p>` : ''}
      </div>`, { label: '依赖说明' });
  });
})();
