/* DSH 研究工作台 · graph.js —— 局部知识图谱
   ---------------------------------------------------------------------------
   图谱表达“知识与证据的关系”，不是任务顺序。默认只显示中心页面的一跳邻居，
   用户再逐个展开，避免整库毛线团。边有方向、有类型；共现或语义相似只是
   算法推断，默认隐藏，显示时画成最弱的点线并标“非证据”，未知关系不画。
   节点类型靠形状区分（圆 / 文档 / 菱形 / 六边形 / 书签），颜色只有墨与黄：
   黄 = 当前中心与选中；需要看一眼的节点挂黄色小方块。
   拖动节点、平移、缩放只改变本地视图，不改变任何文件。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { esc } = DSH;
  const G = (DSH.graph = {});

  G.TYPES = {
    source: { zh: '来源', en: 'Source', r: 13 },
    wiki: { zh: 'Wiki 页', en: 'Wiki', r: 12 },
    scheme: { zh: '方案', en: 'Scheme', r: 15 },
    hypothesis: { zh: '假设', en: 'Hypothesis', r: 14 },
    experiment: { zh: '实验', en: 'Experiment', r: 14 },
    conclusion: { zh: '结论', en: 'Conclusion', r: 13 },
  };
  G.RELS = {
    supports: { zh: '来源支持', verb: '支持', dir: true, evidence: true },
    cites: { zh: '引用', verb: '引用', dir: true, evidence: true },
    related: { zh: '相关', verb: '相关', dir: true, evidence: false, style: 'dot' },
    contrasts: { zh: '对比', verb: '对比', dir: true, evidence: true, style: 'dash' },
    conflicts: { zh: '冲突', verb: '冲突', dir: false, evidence: true, style: 'conflict' },
    adopts: { zh: '方案采用模块', verb: '采用', dir: true, evidence: true },
    proposes: { zh: '提出假设', verb: '提出', dir: true, evidence: true },
    tests: { zh: '实验检验', verb: '检验', dir: true, evidence: true },
    yields: { zh: '得出结论', verb: '得出', dir: true, evidence: true },
    similar: { zh: '语义相似（算法推断，非证据）', verb: '相似', dir: false, evidence: false, style: 'weak' },
  };

  /* ---------- 视图状态 ---------- */
  G.state = (focus) => {
    const st = DSH.vs('kg', () => ({ focus: null, visible: new Set(), pos: {}, pinned: new Set(), sel: null, path: null, hideTypes: new Set(), hideRels: new Set(['similar']), k: 1, tx: 0, ty: 0, mode: innerWidth < 720 ? 'list' : 'graph', labels: false, pathTo: '' }));
    if (focus && st.focus !== focus) G.reset(st, focus);
    return st;
  };
  G.reset = (st, focus) => {
    st.focus = focus;
    st.visible = new Set([focus]);
    st.pos = {};
    st.pinned = new Set();
    st.sel = focus;
    st.path = null;
    st.pathTo = '';
    st.k = 1; st.tx = 0; st.ty = 0;
    st.fitted = false;
    G.neighbors(focus, st.hideRels).forEach((n) => st.visible.add(n.other));
    G.layout(st);
  };

  /* 一跳邻居（按当前隐藏的关系类型过滤） */
  G.neighbors = (id, hideRels) => {
    const g = DSH.db().graph;
    const out = (g.out[id] || []).map((e) => ({ e, other: e.to, dir: 'out' }));
    const inn = (g.inn[id] || []).map((e) => ({ e, other: e.from, dir: 'in' }));
    return out.concat(inn).filter((x) => g.nodes[x.other] && !(hideRels && hideRels.has(x.e.type)));
  };
  G.hiddenCount = (st, id) => {
    const seen = new Set();
    G.neighbors(id, st.hideRels).forEach((n) => { if (!st.visible.has(n.other) && !st.hideTypes.has(DSH.db().graph.nodes[n.other].type)) seen.add(n.other); });
    return seen.size;
  };
  G.shown = (st) => {
    const g = DSH.db().graph;
    const nodes = [...st.visible].filter((id) => g.nodes[id] && !st.hideTypes.has(g.nodes[id].type));
    const set = new Set(nodes);
    const edges = g.edges.filter((e) => set.has(e.from) && set.has(e.to) && !st.hideRels.has(e.type));
    return { nodes, edges, set };
  };

  G.expand = (st, id) => {
    const added = [];
    G.neighbors(id, st.hideRels).forEach((n) => {
      if (!st.visible.has(n.other)) { st.visible.add(n.other); added.push(n.other); }
    });
    G.layout(st, { around: id, added });
    return added.length;
  };
  G.collapse = (st, id) => {
    const g = DSH.db().graph;
    let removed = 0;
    G.neighbors(id).forEach((n) => {
      const o = n.other;
      if (o === st.focus || !st.visible.has(o)) return;
      const others = G.neighbors(o).filter((m) => m.other !== id && st.visible.has(m.other));
      if (!others.length && !(st.path && st.path.nodes.includes(o))) { st.visible.delete(o); delete st.pos[o]; removed++; }
    });
    if (st.sel && !st.visible.has(st.sel)) st.sel = id;
    void g;
    return removed;
  };

  /* 最短关系链（不看方向；不经过算法相似边） */
  G.findPath = (a, b) => {
    const g = DSH.db().graph;
    if (a === b) return { nodes: [a], edges: [] };
    const prev = { [a]: null };
    const q = [a];
    while (q.length) {
      const cur = q.shift();
      for (const n of G.neighbors(cur, new Set(['similar']))) {
        if (n.other in prev) continue;
        prev[n.other] = { from: cur, e: n.e };
        if (n.other === b) {
          const nodes = [b], edges = [];
          let x = b;
          while (prev[x]) { edges.unshift(prev[x].e); x = prev[x].from; nodes.unshift(x); }
          return { nodes, edges };
        }
        q.push(n.other);
      }
    }
    void g;
    return null;
  };

  /* ---------- 力导布局：确定性的初始位置，已有节点被轻轻拉回原位，保持心智地图 ---------- */
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
  G.layout = (st, opt = {}) => {
    const g = DSH.db().graph;
    const ids = [...st.visible].filter((id) => g.nodes[id]);
    const old = { ...st.pos };
    if (!st.pos[st.focus]) st.pos[st.focus] = { x: 0, y: 0 };
    const around = opt.around && st.pos[opt.around] ? st.pos[opt.around] : { x: 0, y: 0 };
    let i = 0;
    /* 新节点按类型排在扇区里：同类的邻居挨在一起，读图时一眼分得出来源、页面、方案 */
    const ORDER = ['source', 'wiki', 'scheme', 'hypothesis', 'experiment', 'conclusion'];
    const fresh = ids.filter((id) => !st.pos[id]).sort((a, b) => ORDER.indexOf(g.nodes[a].type) - ORDER.indexOf(g.nodes[b].type) || a.localeCompare(b));
    const start = opt.around ? Math.atan2(around.y, around.x) - Math.PI / 2 : -Math.PI / 2;
    fresh.forEach((id) => {
      const a = start + (i++ / Math.max(1, fresh.length)) * Math.PI * 2;
      const r = (opt.around ? 170 : 200) + hash(id + "r") * 30;
      st.pos[id] = { x: around.x + Math.cos(a) * r, y: around.y + Math.sin(a) * r };
    });
    const P = ids.map((id) => ({ id, x: st.pos[id].x, y: st.pos[id].y, vx: 0, vy: 0, fixed: id === st.focus || st.pinned.has(id), home: old[id] }));
    const idx = Object.fromEntries(P.map((p, k) => [p.id, k]));
    const E = g.edges.filter((e) => e.type !== 'similar' && idx[e.from] != null && idx[e.to] != null);
    const N = P.length;
    for (let it = 0; it < 360; it++) {
      const cool = 1 - it / 360;
      for (let a = 0; a < N; a++) {
        for (let b = a + 1; b < N; b++) {
          const pa = P[a], pb = P[b];
          let dx = pb.x - pa.x, dy = pb.y - pa.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = hash(pa.id + pb.id) - 0.5; dy = 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          /* 标签横向更占地方：水平方向的排斥更强一些 */
          let f = 19000 / d2;
          if (d < 96) f += (96 - d) * 0.8;
          if (Math.abs(dy) < 34 && Math.abs(dx) < 150) f += (150 - Math.abs(dx)) * 0.06;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          pa.vx -= fx; pa.vy -= fy; pb.vx += fx; pb.vy += fy;
        }
      }
      E.forEach((e) => {
        const pa = P[idx[e.from]], pb = P[idx[e.to]];
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const L = e.from === st.focus || e.to === st.focus ? 175 : 140;
        const f = 0.03 * (d - L);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        pa.vx += fx; pa.vy += fy; pb.vx -= fx; pb.vy -= fy;
      });
      P.forEach((p) => {
        p.vx -= p.x * 0.006; p.vy -= p.y * 0.006;
        if (p.home) { p.vx += (p.home.x - p.x) * 0.05; p.vy += (p.home.y - p.y) * 0.05; }
        if (p.fixed) { p.vx = 0; p.vy = 0; return; }
        const step = Math.min(28 * cool + 2, Math.hypot(p.vx, p.vy));
        const sp = Math.hypot(p.vx, p.vy) || 1;
        p.x += (p.vx / sp) * step; p.y += (p.vy / sp) * step;
        p.vx *= 0.55; p.vy *= 0.55;
      });
    }
    P.forEach((p) => (st.pos[p.id] = { x: p.x, y: p.y }));
  };

  /* ---------- 形状 ---------- */
  const shape = (n, r, cls) => {
    switch (n.type) {
      case 'source': return `<path class="${cls}" d="M${-r * 0.8} ${-r}h${r * 1.05}l${r * 0.55} ${r * 0.55}v${r * 1.45}h${-r * 1.6}z"/>`;
      case 'wiki': return `<circle class="${cls}" r="${r}"/>`;
      case 'scheme': return `<path class="${cls}" d="M0 ${-r}L${r} 0L0 ${r}L${-r} 0z"/>`;
      case 'hypothesis': return `<path class="${cls}" d="M0 ${-r}L${r} 0L0 ${r}L${-r} 0z"/>`;
      case 'experiment': { const a = r, b = r * 0.866; return `<path class="${cls}" d="M${-a} 0L${-a / 2} ${-b}L${a / 2} ${-b}L${a} 0L${a / 2} ${b}L${-a / 2} ${b}z"/>`; }
      case 'conclusion': return `<path class="${cls}" d="M${-r * 0.75} ${-r}h${r * 1.5}v${r * 2}l${-r * 0.75} ${-r * 0.55}l${-r * 0.75} ${r * 0.55}z"/>`;
      default: return `<circle class="${cls}" r="${r}"/>`;
    }
  };
  G.shapeIcon = (type, size = 16) => {
    const r = size * 0.42;
    return `<svg class="kg-sw kg-sw--${type}" width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" aria-hidden="true">${shape({ type }, r, 'kg-shape')}</svg>`;
  };
  const clip = (s, n = 13) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  /* ---------- 渲染 ---------- */
  G.render = (st) => {
    const g = DSH.db().graph;
    const { nodes, edges } = G.shown(st);
    const P = st.pos;
    const near = new Set();
    if (st.sel) G.neighbors(st.sel, st.hideRels).forEach((n) => near.add(n.other));
    const onPath = new Set(st.path ? st.path.nodes : []);
    const pathEdges = new Set(st.path ? st.path.edges.map((e) => e.id) : []);
    /* 同一对节点之间的多条边：向两侧弯开 */
    const pairCount = {}, pairIdx = {};
    edges.forEach((e) => { const k = [e.from, e.to].sort().join('|'); pairCount[k] = (pairCount[k] || 0) + 1; });
    const parts = [];
    edges.forEach((e) => {
      const a = P[e.from], b = P[e.to];
      if (!a || !b) return;
      const k = [e.from, e.to].sort().join('|');
      const ix = (pairIdx[k] = (pairIdx[k] || 0) + 1) - 1;
      const cnt = pairCount[k];
      const off = cnt > 1 ? (ix - (cnt - 1) / 2) * 26 : 0;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const ra = G.TYPES[g.nodes[e.from].type].r + 5, rb = G.TYPES[g.nodes[e.to].type].r + 7;
      const ux = dx / d, uy = dy / d;
      const x1 = a.x + ux * ra, y1 = a.y + uy * ra, x2 = b.x - ux * rb, y2 = b.y - uy * rb;
      const mx = (x1 + x2) / 2 - uy * off, my = (y1 + y2) / 2 + ux * off;
      const R = G.RELS[e.type];
      /* 选中中心页时不逐条加粗、不逐条标注，免得一跳邻居全部变成“支持 →” */
      const hi = pathEdges.has(e.id) || (st.sel && st.sel !== st.focus && (e.from === st.sel || e.to === st.sel));
      const cls = ['kg-e', 'kg-e--' + e.type, hi ? 'is-hi' : '', pathEdges.has(e.id) ? 'is-path' : ''].join(' ');
      const marker = R.dir ? ` marker-end="url(#kg-arrow${hi ? '-hi' : ''})"` : '';
      parts.push(`<path class="${cls}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${(2 * mx - (x1 + x2) / 2).toFixed(1)} ${(2 * my - (y1 + y2) / 2).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"${marker} data-edge="${esc(e.id)}"><title>${esc(g.nodes[e.from].title)} ${esc(R.verb)} ${esc(g.nodes[e.to].title)}</title></path>`);
      if (e.type === 'conflicts') parts.push(`<g class="kg-mid is-conflict" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})"><rect x="-6" y="-6" width="12" height="12"/><text y="4" text-anchor="middle">!</text></g>`);
      if (e.type === 'similar') parts.push(`<g class="kg-mid is-weak" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})"><text y="4" text-anchor="middle">≈</text></g>`);
      if (hi || st.labels) {
        const t = e.type === 'similar' ? `相似 ${e.score}（非证据）` : R.verb + (R.dir ? ' →' : '');
        parts.push(`<text class="kg-elabel${hi ? ' is-hi' : ''}" x="${mx.toFixed(1)}" y="${(my - 8).toFixed(1)}" text-anchor="middle">${esc(t)}</text>`);
      }
    });
    const nparts = nodes.map((id) => {
      const n = g.nodes[id];
      const p = P[id];
      const T = G.TYPES[n.type];
      const isFocus = id === st.focus, isSel = id === st.sel;
      const dim = st.sel && !isSel && !near.has(id) && !onPath.has(id) ? ' is-dim' : '';
      const hid = G.hiddenCount(st, id);
      const lbl = clip(n.title, 14);
      const fl = n.flag ? `<rect class="kg-flag" x="${T.r - 2}" y="${-T.r - 6}" width="8" height="8"><title>${n.flag === 'conflict' ? '涉及冲突' : n.flag === 'missing' ? '来源缺失' : '部分读取'}</title></rect>` : '';
      const tw = Math.max(lbl.length * 12, 24);
      return `<g class="kg-n kg-n--${n.type}${isFocus ? ' is-focus' : ''}${isSel ? ' is-sel' : ''}${onPath.has(id) ? ' is-path' : ''}${dim}${n.missing ? ' is-missing' : ''}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" data-node="${esc(id)}" tabindex="0" role="button" aria-label="${esc(T.zh + '：' + n.title + (isFocus ? '（中心）' : '') + (hid ? '，还有 ' + hid + ' 个未展开的邻居' : ''))}" aria-pressed="${isSel}">
        <circle class="kg-hit" r="${T.r + 10}"/>
        ${isSel || onPath.has(id) ? `<circle class="kg-ring" r="${T.r + 6}"/>` : ''}
        ${shape(n, T.r, 'kg-shape')}
        ${fl}
        <rect class="kg-lblbg" x="${-tw / 2 - 4}" y="${T.r + 5}" width="${tw + 8}" height="18"/>
        <text class="kg-lbl" y="${T.r + 18}" text-anchor="middle">${esc(lbl)}</text>
        ${hid ? `<g class="kg-more" data-expand="${esc(id)}" transform="translate(${T.r + 4} ${T.r - 2})"><rect x="0" y="-8" width="${String(hid).length * 8 + 14}" height="15"/><text x="5" y="3">+${hid}</text><title>展开 ${hid} 个邻居</title></g>` : ''}
        <title>${esc(n.title)}</title>
      </g>`;
    });
    return `<defs>
        <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="kg-ah" d="M0 1L9 5L0 9z"/></marker>
        <marker id="kg-arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="kg-ah is-hi" d="M0 1L9 5L0 9z"/></marker>
        <pattern id="kg-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect class="kg-hatch-bg" width="5" height="5"/><line class="kg-hatch-ln" x1="0" y1="0" x2="0" y2="5"/></pattern>
      </defs>
      <g class="kg-world" transform="translate(${st.tx.toFixed(1)} ${st.ty.toFixed(1)}) scale(${st.k.toFixed(3)})">
        <g class="kg-edges">${parts.join('')}</g>
        <g class="kg-nodes">${nparts.join('')}</g>
      </g>`;
  };

  /* 适配视图：把可见节点放进画布 */
  /* 适配：给顶部信息条和底部图例各让出位置 */
  G.fit = (st, w, h, pad = { t: 76, r: 70, b: 185, l: 80 }) => {
    const { nodes } = G.shown(st);
    if (!nodes.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    nodes.forEach((id) => { const p = st.pos[id]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    const bw = w - pad.l - pad.r, bh = h - pad.t - pad.b;
    const k = Math.min(1.25, Math.max(0.8, Math.min(bw / Math.max(1, x1 - x0 + 120), bh / Math.max(1, y1 - y0 + 50))));
    st.k = k;
    st.tx = pad.l + bw / 2 - ((x0 + x1) / 2) * k;
    st.ty = pad.t + bh / 2 - ((y0 + y1) / 2) * k;
  };

  /* ---------- 画布交互：平移、缩放、拖动节点（仅视图） ---------- */
  G.bind = (svg, st, on) => {
    const world = () => svg.querySelector('.kg-world');
    const apply = () => world() && world().setAttribute('transform', `translate(${st.tx.toFixed(1)} ${st.ty.toFixed(1)}) scale(${st.k.toFixed(3)})`);
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const more = e.target.closest('[data-expand]');
      if (more) return;
      const n = e.target.closest('[data-node]');
      drag = { id: n ? n.dataset.node : null, x: e.clientX, y: e.clientY, tx: st.tx, ty: st.ty, moved: false, start: n && st.pos[n.dataset.node] ? { ...st.pos[n.dataset.node] } : null };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      svg.classList.add('is-dragging');
      if (drag.id && drag.start) {
        st.pos[drag.id] = { x: drag.start.x + dx / st.k, y: drag.start.y + dy / st.k };
        st.pinned.add(drag.id);
        on.redraw();
      } else {
        st.tx = drag.tx + dx;
        st.ty = drag.ty + dy;
        apply();
      }
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      svg.classList.remove('is-dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch {}
      if (!d.moved) {
        const more = e.target.closest && e.target.closest('[data-expand]');
        if (more) return;
        if (d.id) on.select(d.id);
        else on.select(null);
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('click', (e) => {
      const more = e.target.closest('[data-expand]');
      if (more) { e.stopPropagation(); on.expand(more.dataset.expand); }
    });
    svg.addEventListener('dblclick', (e) => {
      const n = e.target.closest('[data-node]');
      if (n) on.expand(n.dataset.node);
    });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const k2 = Math.min(3, Math.max(0.3, st.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      st.tx = mx - ((mx - st.tx) / st.k) * k2;
      st.ty = my - ((my - st.ty) / st.k) * k2;
      st.k = k2;
      apply();
    }, { passive: false });
    svg.addEventListener('keydown', (e) => {
      const n = e.target.closest('[data-node]');
      if (!n) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.select(n.dataset.node); }
      if (e.key === '+' || e.key === '=' || e.key.toLowerCase() === 'e') { e.preventDefault(); on.expand(n.dataset.node); }
      if (e.key === '-') { e.preventDefault(); on.collapse(n.dataset.node); }
    });
    svg.addEventListener('pointerover', (e) => {
      const n = e.target.closest('[data-node]');
      svg.querySelectorAll('.is-hover-nb').forEach((x) => x.classList.remove('is-hover-nb'));
      if (!n) { svg.classList.remove('is-hovering'); return; }
      svg.classList.add('is-hovering');
      const id = n.dataset.node;
      n.classList.add('is-hover-nb');
      G.neighbors(id, st.hideRels).forEach((m) => {
        const el = svg.querySelector(`[data-node="${CSS.escape(m.other)}"]`);
        el && el.classList.add('is-hover-nb');
        const ed = svg.querySelector(`[data-edge="${CSS.escape(m.e.id)}"]`);
        ed && ed.classList.add('is-hover-nb');
      });
    });
    svg.addEventListener('pointerleave', () => {
      svg.classList.remove('is-hovering');
      svg.querySelectorAll('.is-hover-nb').forEach((x) => x.classList.remove('is-hover-nb'));
    });
    return { apply };
  };
})();
