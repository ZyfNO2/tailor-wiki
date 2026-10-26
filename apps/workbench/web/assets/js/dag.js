/* DSH 研究工作台 · dag.js —— 任务与产物依赖的分层布局
   ---------------------------------------------------------------------------
   DAG 表达“任务 / 产物依赖”，和知识图谱分开。边写明“等待什么产物或条件”。
   依赖环、缺失节点、失效产物作为错误状态如实画出来：不自动删边让图看起来正确。
   布局只决定画在哪里，不改变 dag.yaml。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const D = (DSH.dag = {});
  D.NW = 220; D.NH = 122; D.GX = 136; D.GY = 30;

  /* 模型：任务 + 缺失节点 + 依赖边（原型状态“依赖环”时追加文件里声明的那条边） */
  D.model = ({ cycle = false, collapsed = new Set() } = {}) => {
    const p = DSH.db().p;
    let nodes = p.tasks.map((t) => ({ id: t.id, kind: 'task', t, group: t.group || null }));
    (p.dagMissing || []).forEach((m) => nodes.push({ id: m.id, kind: 'missing', m }));
    let edges = p.dagEdges.map((e, i) => ({ ...e, id: 'e' + i }));
    if (cycle && p.dagCycleEdge) edges.push({ ...p.dagCycleEdge, id: 'ec' });
    /* 折叠子图：成员换成一个分组节点；组内的边不画，组外的边接到分组上 */
    if (collapsed.has('exp')) {
      const members = nodes.filter((n) => n.group === 'exp');
      const ids = new Set(members.map((n) => n.id));
      const count = members.reduce((m, n) => ((m[n.t.exec] = (m[n.t.exec] || 0) + 1), m), {});
      nodes = nodes.filter((n) => !ids.has(n.id)).concat([{ id: 'G-exp', kind: 'group', title: '实验组', members: members.map((n) => n.id), count }]);
      const seen = new Map();
      edges.forEach((e) => {
        const from = ids.has(e.from) ? 'G-exp' : e.from, to = ids.has(e.to) ? 'G-exp' : e.to;
        if (from === to) return;
        const k = from + '>' + to;
        if (seen.has(k)) { const x = seen.get(k); x.waits.push(e.wait); if (rank(e.state) > rank(x.state)) x.state = e.state; return; }
        seen.set(k, { ...e, from, to, waits: [e.wait], id: 'g' + seen.size });
      });
      edges = [...seen.values()].map((e) => ({ ...e, wait: e.waits.length > 1 ? `${e.waits[0]} 等 ${e.waits.length} 项` : e.wait }));
    }
    return { nodes, edges };
  };
  const SEV = ['ok', 'wait', 'stale', 'missing', 'blocked'];
  const rank = (s) => SEV.indexOf(s);

  /* 依赖环：Tarjan 强连通分量；环上的边单独标出 */
  D.cycles = (m) => {
    const adj = {};
    m.edges.forEach((e) => (adj[e.from] = adj[e.from] || []).push(e.to));
    let idx = 0;
    const st = [], on = new Set(), index = {}, low = {}, sccs = [];
    const strong = (v) => {
      index[v] = low[v] = idx++;
      st.push(v); on.add(v);
      (adj[v] || []).forEach((w) => {
        if (index[w] == null) { strong(w); low[v] = Math.min(low[v], low[w]); }
        else if (on.has(w)) low[v] = Math.min(low[v], index[w]);
      });
      if (low[v] === index[v]) {
        const comp = [];
        let w;
        do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1) sccs.push(comp);
      }
    };
    m.nodes.forEach((n) => { if (index[n.id] == null) strong(n.id); });
    const inCycle = new Set(sccs.flat());
    const comp = {};
    sccs.forEach((c, i) => c.forEach((v) => (comp[v] = i)));
    const cycleEdges = new Set(m.edges.filter((e) => comp[e.from] != null && comp[e.from] === comp[e.to]).map((e) => e.id));
    return { sccs, inCycle, cycleEdges };
  };

  /* 分层：最长路径定层（环上的回边不参与），层内按重心法排几轮，减少交叉 */
  D.layout = (m, cyc) => {
    const ids = m.nodes.map((n) => n.id);
    const order0 = Object.fromEntries(ids.map((id, i) => [id, i]));
    /* 去掉一条回边：DFS 访问顺序里指回栈上节点的边 */
    const adj = {};
    m.edges.forEach((e) => (adj[e.from] = adj[e.from] || []).push(e));
    const back = new Set();
    const state = {};
    const dfs = (v) => {
      state[v] = 1;
      (adj[v] || []).forEach((e) => {
        if (state[e.to] === 1) back.add(e.id);
        else if (!state[e.to]) dfs(e.to);
      });
      state[v] = 2;
    };
    ids.forEach((id) => { if (!state[id]) dfs(id); });
    const fwd = m.edges.filter((e) => !back.has(e.id));
    const preds = {};
    fwd.forEach((e) => (preds[e.to] = preds[e.to] || []).push(e.from));
    const lvl = {};
    const L = (v, seen = new Set()) => {
      if (lvl[v] != null) return lvl[v];
      if (seen.has(v)) return 0;
      seen.add(v);
      const ps = preds[v] || [];
      lvl[v] = ps.length ? Math.max(...ps.map((u) => L(u, seen) + 1)) : 0;
      return lvl[v];
    };
    ids.forEach((id) => L(id));
    /* 缺失节点放在它指向的任务的前一层 */
    m.nodes.filter((n) => n.kind === 'missing').forEach((n) => {
      const outs = fwd.filter((e) => e.from === n.id).map((e) => lvl[e.to]);
      if (outs.length) lvl[n.id] = Math.max(0, Math.min(...outs) - 1);
    });
    const nl = Math.max(0, ...Object.values(lvl)) + 1;
    const layers = Array.from({ length: nl }, () => []);
    ids.forEach((id) => layers[lvl[id]].push(id));
    layers.forEach((l) => l.sort((a, b) => order0[a] - order0[b]));
    const succ = {};
    fwd.forEach((e) => (succ[e.from] = succ[e.from] || []).push(e.to));
    const pos = (id) => layers[lvl[id]].indexOf(id);
    for (let it = 0; it < 6; it++) {
      const down = it % 2 === 0;
      const seq = down ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).reverse().slice(1);
      seq.forEach((i) => {
        const bc = {};
        layers[i].forEach((id) => {
          const nb = down ? preds[id] || [] : succ[id] || [];
          bc[id] = nb.length ? nb.reduce((s, u) => s + pos(u), 0) / nb.length : pos(id);
        });
        layers[i].sort((a, b) => bc[a] - bc[b] || order0[a] - order0[b]);
      });
    }
    const maxN = Math.max(...layers.map((l) => l.length));
    const P = {};
    layers.forEach((l, i) => {
      const off = ((maxN - l.length) * (D.NH + D.GY)) / 2;
      l.forEach((id, j) => (P[id] = { x: 40 + i * (D.NW + D.GX), y: 40 + off + j * (D.NH + D.GY), w: D.NW, h: D.NH, layer: i }));
    });
    const width = 80 + nl * D.NW + (nl - 1) * D.GX;
    const height = 80 + maxN * D.NH + (maxN - 1) * D.GY + 90;
    /* 边与标签 */
    const E = m.edges.map((e) => {
      const a = P[e.from], b = P[e.to];
      if (!a || !b) return null;
      const isBack = back.has(e.id) || b.layer <= a.layer;
      let d, lx, ly;
      if (!isBack) {
        const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x - 4, y2 = b.y + b.h / 2;
        const c = (x2 - x1) * 0.5;
        d = `M${x1} ${y1}C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`;
        lx = (x1 + 3 * (x1 + c) + 3 * (x2 - c) + x2) / 8;
        ly = (y1 + 3 * y1 + 3 * y2 + y2) / 8;
      } else {
        const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y + b.h + 4;
        const dip = Math.max(y1, y2) + 70;
        d = `M${x1} ${y1}C${x1} ${dip} ${x2} ${dip} ${x2} ${y2}`;
        lx = (x1 + x2) / 2;
        ly = dip - 18;
      }
      return { e, d, lx, ly, back: isBack, cyc: cyc.cycleEdges.has(e.id) };
    }).filter(Boolean);
    /* 标签避让：同一列里相互重叠的往下挪 */
    const placed = [];
    E.sort((p, q) => p.lx - q.lx || p.ly - q.ly).forEach((x) => {
      const w = Math.min(124, 30 + x.e.wait.length * 11), h = 22;
      let y = x.ly - h / 2;
      let guard = 0;
      while (placed.some((r) => Math.abs(r.x - (x.lx - w / 2)) < (r.w + w) / 2 && Math.abs(r.y - y) < h + 2) && guard++ < 12) y += h + 4;
      x.lbl = { x: x.lx - w / 2, y, w, h };
      placed.push({ x: x.lx - w / 2, y, w, h });
    });
    return { P, E, width, height, layers };
  };

  /* 上游 / 下游：用于“查看影响” */
  D.reach = (m, id) => {
    const up = new Set(), down = new Set();
    const walk = (start, dir, set) => {
      const q = [start];
      while (q.length) {
        const v = q.shift();
        m.edges.forEach((e) => {
          const nxt = dir === 'up' ? (e.to === v ? e.from : null) : (e.from === v ? e.to : null);
          if (nxt && !set.has(nxt) && nxt !== id) { set.add(nxt); q.push(nxt); }
        });
      }
    };
    walk(id, 'up', up);
    walk(id, 'down', down);
    return { up, down };
  };
})();
