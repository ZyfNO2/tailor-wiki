/* DSH 研究工作台 · derive.js
   ---------------------------------------------------------------------------
   从文件投影派生出视图需要的索引与统计。只派生，不保存第二套研究状态；
   切换项目时整套重建，不同工作区的成员、运行与结果不会混用。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  let RAW = { projects: [] };
  const cache = {};

  /* 数据入口：实时模式来自 /api/workbench，示例模式来自 data.js。
     换数据时整套重建索引，不保留上一份数据派生出的任何东西。 */
  DSH.setData = (raw) => {
    RAW = raw;
    DSH.projects = raw.projects;
    Object.keys(cache).forEach((k) => delete cache[k]);
    DSH.resetViewState();
  };
  DSH.projects = [];
  DSH.project = () => RAW.projects.find((p) => p.id === DSH.state.projectId) || RAW.projects[0];
  DSH.live = () => !!(DSH.project() && DSH.project().live);
  DSH.db = () => {
    const p = DSH.project();
    if (!cache[p.id]) cache[p.id] = build(p);
    return cache[p.id];
  };

  const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  const LINK = /\[\[([A-Za-z0-9][\w.-]*)(?:\|([^\]]+))?\]\]/g;

  function build(p) {
    const s = p.story || {};
    const db = {
      p,
      pages: byId(p.pages), sources: byId(p.sources), issues: byId(p.issues), schemes: byId(p.schemes),
      hyps: byId(p.hypotheses), plans: byId(p.plans), runs: byId(p.runs), reviews: byId(p.reviews),
      concls: byId(p.conclusions), tasks: byId(p.tasks), members: byId(p.members), conflicts: byId(p.conflicts),
      templates: byId(p.roleTemplates), contribs: byId(s.contributions), figures: byId(s.figures), gaps: byId(s.gaps),
      claims: byId(s.claims), traces: p.traces || {}, cites: p.citations || {}, artifacts: p.artifacts || {},
    };
    db.graph = buildGraph(p, db);
    db.stats = stats(p, db);
    return db;
  }

  /* ---------- 知识图谱：节点 = 来源 / Wiki 页 / 方案与假设 / 实验 / 结论 ---------- */
  function buildGraph(p, db) {
    const nodes = {};
    const add = (n) => (nodes[n.id] = n);
    (p.pages || []).forEach((pg) => add({ id: pg.id, type: 'wiki', title: pg.title, sub: pg.type, ref: 'wiki:' + pg.id }));
    const edges = [];
    const seen = new Set();
    const push = (e) => {
      const id = `${e.from}>${e.to}:${e.type}`;
      if (seen.has(id)) return;
      seen.add(id);
      edges.push({ id, ...e });
    };
    /* 来源支持：由引用记录生成，一对来源—页面只算一条，附上全部引用 */
    const pairs = {};
    Object.entries(p.citations || {}).forEach(([cid, c]) => {
      const k = c.source + '>' + c.page;
      (pairs[k] = pairs[k] || { from: c.source, to: c.page, cites: [] }).cites.push(cid);
    });
    Object.values(pairs).forEach((x) => {
      const src = db.sources[x.from];
      if (src && !nodes[src.id]) add({ id: src.id, type: 'source', title: src.path.split('/').pop(), sub: src.kind, ref: 'source:' + src.id, missing: src.status === 'missing' });
      push({ from: x.from, to: x.to, type: 'supports', cites: x.cites });
    });
    /* 页间引用：由正文里的 [[W-xx]] 生成；目标不在快照中的记为断链，不进图 */
    db.broken = [];
    (p.pages || []).forEach((pg) => {
      let m;
      LINK.lastIndex = 0;
      while ((m = LINK.exec(pg.body || ''))) {
        if (m[1] === pg.id) continue;
        if (!db.pages[m[1]]) { db.broken.push({ from: pg.id, to: m[1], label: m[2] || m[1] }); continue; }
        push({ from: pg.id, to: m[1], type: 'cites' });
      }
    });
    (p.graph.nodes || []).forEach(add);
    (p.graph.edges || []).forEach((e) => {
      if (e.type === 'conflicts') [e.from, e.to].forEach((id) => {
        const src = db.sources[id];
        if (src && !nodes[id]) add({ id, type: 'source', title: src.path.split('/').pop(), sub: src.kind, ref: 'source:' + id });
      });
      push({ ...e });
    });
    /* 节点上的“需要看一眼”：冲突、来源缺失、部分读取、证据不足 */
    const flag = {};
    edges.forEach((e) => { if (e.type === 'conflicts') flag[e.from] = flag[e.to] = 'conflict'; });
    Object.values(nodes).forEach((n) => {
      if (n.type === 'source') {
        const st = db.sources[n.id] && db.sources[n.id].status;
        if (st === 'missing') n.flag = 'missing';
        else if (st === 'partial' || st === 'failed') n.flag = 'partial';
      }
      if (flag[n.id] && !n.flag) n.flag = flag[n.id];
      if (n.type === 'hypothesis') n.verdict = (db.hyps[n.id] || {}).verdict;
      if (n.type === 'conclusion') n.verdict = (db.concls[n.id] || {}).verdict;
    });
    const out = {}, inn = {};
    edges.forEach((e) => {
      (out[e.from] = out[e.from] || []).push(e);
      (inn[e.to] = inn[e.to] || []).push(e);
    });
    return { nodes, edges, out, inn };
  }

  /* ---------- 统计：一律是实际计数，不生成没有依据的总体百分比 ---------- */
  function stats(p, db) {
    const count = (arr, key) => (arr || []).reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {});
    const covered = (p.sources || []).filter((s) => !s.outside);
    const issuesOpen = (p.issues || []).filter((q) => q.status !== 'resolved');
    const realRuns = (p.runs || []).filter((r) => r.prov !== 'historical');
    return {
      exec: count(p.tasks, 'exec'),
      review: count(p.tasks, 'review'),
      coverage: count(covered, 'status'),
      /* 扫描项、登记来源、排除项是不同口径：实时数据给出 counts 时一律用它 */
      coverageTotal: p.counts ? p.counts.inScope : covered.length,
      scanned: p.counts ? p.counts.scanned : covered.length,
      registered: p.counts ? p.counts.registered : covered.filter((s) => !s.inventoryOnly).length,
      excludedTotal: p.counts ? p.counts.excluded : covered.filter((s) => s.status === 'excluded').length,
      missingSources: (p.sources || []).filter((s) => s.status === 'missing'),
      issuesOpen,
      runs: count(realRuns, 'status'),
      runsTotal: realRuns.length,
      runsByProv: count(p.runs, 'prov'),
      pendingReview: (p.tasks || []).filter((t) => t.type === 'review' && t.exec !== 'done'),
      reviewChanges: (p.reviews || []).filter((r) => r.status === 'changes' || r.status === 'rejected'),
      blocked: (p.tasks || []).filter((t) => t.exec === 'blocked' || t.exec === 'failed'),
      unprocessed: covered.filter((s) => s.status === 'partial' || s.status === 'failed'),
      staleFiles: (p.files || []).filter((f) => f.status !== 'ok'),
      gaps: (p.story && p.story.gaps) || [],
    };
  }

  /* ---------- 小统计：均值、标准差、Welch t 区间（种子少时区间很宽，这正是要看见的） ---------- */
  const T975 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
  const tcrit = (df) => {
    if (df >= 30) return 1.96 + (2.042 - 1.96) * (30 / df);
    const lo = Math.max(1, Math.floor(df)), hi = Math.min(30, lo + 1);
    return T975[lo] + (T975[hi] - T975[lo]) * (df - lo);
  };
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const sd = (a) => {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  };
  function welch(a, b) {
    const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
    const se = Math.sqrt(va + vb);
    const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
    const diff = mean(b) - mean(a);
    const h = tcrit(df) * se;
    return { diff, lo: diff - h, hi: diff + h, df, se, na: a.length, nb: b.length };
  }
  DSH.stat = { mean, sd, welch, tcrit };

  /* ---------- 数字格式：日期 2026.10.25；计数带单位；缺失用“—”并说明原因，不填 0 ---------- */
  DSH.fmt = {
    n: (x, d = 0) => (x == null || Number.isNaN(x) ? '—' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })),
    signed: (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toFixed(d)),
    pct: (x, d = 1) => (x == null ? '—' : (x * 100).toFixed(d) + '%'),
    pad: (x, w = 2) => String(x).padStart(w, '0'),
  };

  /* ---------- 对象引用：同一标识在卡片、图谱、DAG、列表中通用 ---------- */
  const TYPE = {
    wiki: { zh: 'Wiki 页', icon: 'book' },
    source: { zh: '来源', icon: 'file' },
    cite: { zh: '引用', icon: 'quote' },
    issue: { zh: '问题', icon: 'alert' },
    scheme: { zh: '方案', icon: 'scissors' },
    hyp: { zh: '假设', icon: 'g-hyp' },
    plan: { zh: '实验计划', icon: 'flask' },
    run: { zh: '运行', icon: 'terminal' },
    review: { zh: '审查', icon: 'g-rv-pass' },
    concl: { zh: '结论', icon: 'flag' },
    task: { zh: '任务', icon: 'tasks' },
    member: { zh: '成员', icon: 'user' },
    trace: { zh: 'trace', icon: 'history' },
    story: { zh: '叙事', icon: 'story' },
    contrib: { zh: '贡献', icon: 'story' },
    fig: { zh: '图表', icon: 'table' },
    gap: { zh: '缺口', icon: 'alert' },
    conflict: { zh: '冲突', icon: 'zap' },
    artifact: { zh: '产物', icon: 'box' },
    view: { zh: '页面', icon: 'arrow-r' },
  };
  DSH.TYPE = TYPE;
  const VIEWS = {
    coverage: { title: 'Wiki 覆盖面板', hash: '#/knowledge/coverage' },
    read: { title: 'Wiki 阅读', hash: '#/knowledge/read' },
    dag: { title: 'DAG 白板', hash: '#/dag' },
    schemes: { title: '研究方案', hash: '#/schemes' },
    plan: { title: '实验计划', hash: '#/experiments/plan' },
    runs: { title: '运行记录', hash: '#/experiments/runs' },
    tasks: { title: '任务', hash: '#/tasks/list' },
    team: { title: 'Team', hash: '#/tasks/team' },
    story: { title: '研究叙事', hash: '#/story' },
    issues: { title: '问题', hash: '#/knowledge/issues' },
    sources: { title: '来源', hash: '#/knowledge/sources' },
  };
  DSH.refInfo = (ref) => {
    const db = DSH.db();
    const i = ref.indexOf(':');
    const type = ref.slice(0, i), id = ref.slice(i + 1);
    const T = TYPE[type] || { zh: type, icon: 'link' };
    let o = null, title = '', short = id;
    switch (type) {
      case 'wiki': o = db.pages[id]; title = o && o.title; break;
      case 'source': o = db.sources[id]; title = o && o.path.split('/').pop(); break;
      case 'cite': o = db.cites[id]; title = o && `[${o.n}] ${(db.sources[o.source] || {}).path || ''}`.trim(); short = o ? `[${o.n}]` : id; break;
      case 'issue': o = db.issues[id]; title = o && o.title; break;
      case 'scheme': o = db.schemes[id]; title = o && o.short; break;
      case 'hyp': o = db.hyps[id]; title = o && o.text; break;
      case 'plan': o = db.plans[id]; title = o && o.title; break;
      case 'run': o = db.runs[id]; title = o && `${o.variant}${o.seed !== '—' ? ' │ seed ' + o.seed : ''}`; break;
      case 'review': o = db.reviews[id]; title = o && `${(db.plans[o.plan] || {}).id || ''} 审查`; break;
      case 'concl': o = db.concls[id]; title = o && o.text; break;
      case 'task': o = db.tasks[id]; title = o && o.title; break;
      case 'member': o = db.members[id]; title = o && o.name; break;
      case 'trace': o = db.traces[id]; title = o && o.title; break;
      case 'story': o = db.p.story; title = '研究叙事'; short = 'STORY'; break;
      case 'contrib': o = db.contribs[id]; title = o && o.text; break;
      case 'fig': o = db.figures[id]; title = o && o.title; break;
      case 'gap': o = db.gaps[id]; title = o && o.text; break;
      case 'conflict': o = db.conflicts[id]; title = o && o.file; break;
      case 'artifact': o = db.artifacts[id]; title = o && o.path; short = o ? o.path : id; break;
      case 'view': o = VIEWS[id]; title = o && o.title; short = o ? o.title : id; break;
      default: break;
    }
    return { ref, type, id, T, o, exists: !!o, title: title || '', short };
  };
  DSH.VIEWS = VIEWS;
})();
