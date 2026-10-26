/* DSH 研究工作台 · app.js
   ---------------------------------------------------------------------------
   外框：三色细条、深色顶栏（唯一的一级导航）、工作区上下文行、视图容器；
   路由、对象跳转与“返回”、命令面板、项目切换、原型状态演示。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon, esc, $, $$ } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  /* ---------- 一级导航（UI-DESIGN-BRIEF §3 建议的七项） ---------- */
  const NAV = [
    { key: 'overview', zh: '概览', en: 'Overview', href: '#/overview' },
    { key: 'knowledge', zh: '知识库', en: 'Knowledge', href: '#/knowledge/read' },
    { key: 'schemes', zh: '研究方案', en: 'Schemes', href: '#/schemes' },
    { key: 'experiments', zh: '实验', en: 'Experiments', href: '#/experiments/plan' },
    { key: 'dag', zh: 'DAG 白板', en: 'Dependencies', href: '#/dag' },
    { key: 'tasks', zh: '任务与 Team', en: 'Tasks', href: '#/tasks/list' },
    { key: 'story', zh: '研究叙事', en: 'Story', href: '#/story' },
  ];
  DSH.NAV = NAV;

  /* ---------- 路由表 ---------- */
  const R = DSH.route;
  R('/overview', 'overview', { section: 'overview' });
  R('/knowledge', 'kb-read', { section: 'knowledge' });
  R('/knowledge/read', 'kb-read', { section: 'knowledge' });
  R('/knowledge/read/:id', 'kb-read', { section: 'knowledge' });
  R('/knowledge/graph', 'kb-graph', { section: 'knowledge' });
  R('/knowledge/graph/:id', 'kb-graph', { section: 'knowledge' });
  R('/knowledge/issues', 'kb-issues', { section: 'knowledge' });
  R('/knowledge/issues/:id', 'kb-issues', { section: 'knowledge' });
  R('/knowledge/coverage', 'kb-coverage', { section: 'knowledge' });
  R('/knowledge/sources', 'kb-sources', { section: 'knowledge' });
  R('/schemes', 'schemes', { section: 'schemes' });
  R('/schemes/compare', 'scheme-compare', { section: 'schemes' });
  R('/schemes/:id', 'scheme', { section: 'schemes' });
  R('/experiments', 'exp-plan', { section: 'experiments' });
  R('/experiments/plan', 'exp-plan', { section: 'experiments' });
  R('/experiments/runs', 'exp-runs', { section: 'experiments' });
  R('/experiments/review', 'exp-review', { section: 'experiments' });
  R('/experiments/review/:id', 'exp-review', { section: 'experiments' });
  R('/dag', 'dag', { section: 'dag' });
  R('/tasks', 'tasks-list', { section: 'tasks' });
  R('/tasks/list', 'tasks-list', { section: 'tasks' });
  R('/tasks/board', 'tasks-board', { section: 'tasks' });
  R('/tasks/team', 'team', { section: 'tasks' });
  R('/story', 'story', { section: 'story' });
  R('/spec', 'spec', { section: 'spec' });

  /* ---------- 原型状态演示（只属于原型，不是产品功能） ---------- */
  const PROTO = [
    ['normal', '正常'], ['loading', '加载中'], ['empty', '空数据'], ['error', '读取失败'],
    ['stale', '数据陈旧'], ['partial', '部分读取'], ['cycle', '依赖环（DAG）'],
  ];

  /* ---------- 外框 ---------- */
  function navCounts(db) {
    const st = db.stats;
    return {
      experiments: st.reviewChanges.length || null,
      tasks: st.blocked.length || null,
    };
  }
  function paintShell(r) {
    const db = DSH.db();
    const p = db.p;
    const counts = navCounts(db);
    const files = p.files || [];
    const bad = files.filter((f) => f.status !== 'ok');
    const okN = files.length - bad.length;
    const proto = PROTO.find(([k]) => k === DSH.state.proto) || PROTO[0];
    $('#shell-cmd').innerHTML = DSH.out(html`
      <a class="brand" href="#/overview" aria-label="DSH 研究工作台 │ 概览"><span class="seal" aria-hidden="true">D</span><span>DSH</span><span class="brand-zh">研究工作台</span></a>
      <nav aria-label="主导航" class="dsh-nav">
        ${NAV.map((n) => html`<a href="${n.href}"${r.section === n.key ? raw(' aria-current="page"') : ''}>${n.zh}<small>${n.en}</small>${counts[n.key] ? html`<span class="count" title="需要处理 ${counts[n.key]} 项">${counts[n.key]}</span>` : ''}</a>`)}
      </nav>
      <div class="util">
        <button type="button" class="dsh-find" data-act="palette" aria-keyshortcuts="Control+K">${icon('search')}<span>搜索编号或标题</span><kbd>Ctrl K</kbd></button>
        ${p.live ? '' : html`<a href="#/spec"${r.section === 'spec' ? raw(' aria-current="page"') : ''} class="dsh-speclink">设计规范</a>`}
        <button type="button" class="ef-btn small" data-act="theme" aria-pressed="${DSH.theme.get() === 'dark'}" title="切换浅色 / 深色">深浅</button>
      </div>`);
    $('#shell-ctx').innerHTML = DSH.out(html`
      <span class="ef-eyebrow slash dsh-ctx-eb">Workspace</span>
      <button type="button" class="ef-kv dsh-proj" data-act="project-menu" aria-haspopup="menu" aria-expanded="false"><span>项目</span><span>${p.name} ${icon('chev-d')}</span></button>
      <ul class="ef-facts ef-field dsh-ctx-facts">
        <li title="数据来自这个工作区">${p.workspace}</li>
        ${p.wikiSnapshot ? html`<li>Wiki 快照 ${p.wikiSnapshot.version}</li>` : html`<li>无 Wiki 快照</li>`}
        <li>读取 ${p.readAt}</li>
      </ul>
      <button type="button" class="dsh-fresh" data-act="files-pop" aria-haspopup="dialog" aria-expanded="false" title="查看每个文件的读取状态">
        ${p.live ? (bad.some((f) => f.status === 'error') ? ui.st('fresh', 'error', { text: `${bad.filter((f) => f.status === 'error').length} 个读取失败 │ ${okN} / ${files.length} 正常` }) : bad.length ? ui.st('fresh', bad.some((f) => f.status === 'partial') ? 'partial' : 'missing', { text: `${okN} / ${files.length} 已读取 │ ${bad.length} 项没有或不完整` }) : ui.st('fresh', 'ok', { text: `${files.length} 项已读取` }))
          : DSH.state.proto === 'loading' ? ui.st('fresh', 'loading', { text: '正在读取 9 个文件' })
          : DSH.state.proto === 'error' ? ui.st('fresh', 'error', { text: '1 个文件读取失败' })
          : DSH.state.proto === 'stale' ? ui.st('fresh', 'stale', { text: '文件在读取后被修改' })
          : bad.some((f) => f.status === 'missing') && okN === 0
          ? ui.st('fresh', 'missing', { text: '没有找到研究文件' })
          : bad.length
            ? ui.st('fresh', bad.some((f) => f.status === 'error') ? 'error' : 'stale', { text: `${okN} / ${files.length} 正常 │ ${bad.length} 项需注意` })
            : ui.st('fresh', 'ok', { text: `${files.length} 个文件已读取` })}
      </button>
      <div class="dsh-ctx-r">
        <span class="st st--solid" title="工作台只展示文件内容，不修改来源、不启动训练、不派发任务；不持有写锁，不影响 Skill 运行">${icon('g-lock', 'st-g')}<span class="st-v">只读</span></span>
        ${p.live ? html`<button type="button" class="ef-btn small" data-act="refresh" title="立即重新读取工作区文件（文件变化时也会每 5 秒自动检查）">${icon('refresh')}重新读取</button>` : html`
        <span class="st st--chip" title="全部内容为设计原型的示例数据">${icon('g-pv-example', 'st-g')}<span class="st-v">示例数据</span></span>
        <button type="button" class="dsh-proto${DSH.state.proto !== 'normal' ? ' is-on' : ''}" data-act="proto-menu" aria-haspopup="menu" aria-expanded="false" title="仅原型：把页面切到不同状态来审阅">
          <span class="ef-eyebrow">Prototype</span><span>状态：${proto[1]}</span>${icon('chev-d')}
        </button>`}
      </div>`);
  }

  /* ---------- 渲染 ---------- */
  let lastHash = null;
  DSH.render = () => {
    const r = DSH.parse();
    if (r.view === 'kb-read' && r.path === '/knowledge') return DSH.go('#/knowledge/read', { replace: true });
    const v = DSH.views[r.view] || DSH.views.notfound;
    const main = $('#view');
    /* 记住滚动位置与焦点 */
    if (lastHash) saveScroll(lastHash);
    const sameRoute = lastHash === r.hash;
    const focusKey = sameRoute ? keyOf(document.activeElement) : null;
    DSH.pop.close(false);
    DSH.state.pageLabel = null;
    paintShell(r);
    if (DSH.views.__current && DSH.views.__current.unmount) DSH.views.__current.unmount();
    main.className = 'dsh-view ' + (v.layout ? 'is-' + v.layout : 'is-scroll');
    main.innerHTML = DSH.out(v.render(r));
    DSH.views.__current = v;
    restoreScroll(r.hash);
    v.mount && v.mount(main, r);
    document.title = (v.title ? v.title(r) + ' │ ' : '') + 'DSH 研究工作台';
    if (focusKey) refocus(focusKey);
    else if (!sameRoute && lastHash) main.focus({ preventScroll: true });
    paintReturn(r);
    lastHash = r.hash;
    if (DSH.state.flash) { flash(DSH.state.flash); DSH.state.flash = null; }
  };
  const keyOf = (el) => {
    if (!el || !$('#view').contains(el)) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    const a = ['act', 'key', 'ref', 'change', 'input', 'node', 'edge', 'cite', 'state'].map((k) => el.dataset && el.dataset[k] ? `[data-${k}="${CSS.escape(el.dataset[k])}"]` : '').join('');
    return a || null;
  };
  const refocus = (sel) => { const el = $('#view').querySelector(sel); el && el.focus({ preventScroll: true }); };
  function saveScroll(hash) {
    const pos = {};
    $$('[data-scroll-key]', $('#view')).forEach((el) => (pos[el.dataset.scrollKey] = el.scrollTop));
    pos.__main = $('#view').scrollTop;
    DSH.state.scroll[hash] = pos;
  }
  function restoreScroll(hash) {
    const pos = DSH.state.scroll[hash];
    if (!pos) { $('#view').scrollTop = 0; return; }
    $$('[data-scroll-key]', $('#view')).forEach((el) => { if (pos[el.dataset.scrollKey] != null) el.scrollTop = pos[el.dataset.scrollKey]; });
    $('#view').scrollTop = pos.__main || 0;
  }
  function flash(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: DSH.still() ? 'auto' : 'smooth' });
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1600);
  }
  DSH.flash = flash;

  /* ---------- 对象跳转与“返回” ---------- */
  const DRAWER = new Set(['run', 'task', 'member', 'source', 'cite', 'trace', 'conflict', 'artifact']);
  function target(ref) {
    const db = DSH.db();
    const { type, id, o } = ref;
    switch (type) {
      case 'wiki': return '#/knowledge/read/' + id;
      case 'issue': return '#/knowledge/issues/' + id;
      case 'scheme': return '#/schemes/' + id;
      case 'hyp': return o.scheme ? DSH.href('/schemes/' + o.scheme, { focus: 'hyp-' + id }) : DSH.href('/experiments/plan', { open: 'E1', focus: 'plan-E1' });
      case 'plan': return DSH.href('/experiments/plan', { open: id, focus: 'plan-' + id });
      case 'review': return '#/experiments/review/' + o.plan;
      case 'concl': return '#/experiments/review/' + (db.reviews[o.review] || {}).plan;
      case 'story': return '#/story';
      case 'contrib': case 'fig': case 'gap': return DSH.href('/story', { focus: type + '-' + id });
      case 'view': return o.hash;
      default: return null;
    }
  }
  DSH.open = (refStr, fromEl) => {
    const r = DSH.refInfo(refStr);
    if (!r.exists) return DSH.toast('断链：' + refStr + ' 在当前工作区中找不到');
    DSH.pop.close(false);
    if (DRAWER.has(r.type)) return DSH.drawers[r.type](r.id, fromEl);
    const t = target(r);
    if (!t) return;
    const cur = DSH.parse();
    if (t.split('?')[0] !== cur.hash.split('?')[0]) {
      const anchor = fromEl && fromEl.closest('[id]');
      DSH.state.returnTo = { label: DSH.state.pageLabel || document.title.split(' │ ')[0], hash: cur.hash, anchor: anchor ? anchor.id : null };
    }
    DSH.side.el.open && DSH.side.close();
    DSH.go(t);
  };
  DSH.on('open', (el) => DSH.open(el.dataset.ref, el));
  DSH.on('go', (el) => DSH.go(el.dataset.href));
  function paintReturn(r) {
    const box = $('#shell-return');
    const rt = DSH.state.returnTo;
    if (!rt || rt.hash === r.hash) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = DSH.out(html`<button type="button" class="ef-btn small go" data-act="return">${icon('arrow-l')}返回：${rt.label}</button><button type="button" class="dsh-copy" data-act="return-dismiss" aria-label="不再显示返回">${icon('x')}</button>`);
  }
  DSH.on('return', () => {
    const rt = DSH.state.returnTo;
    if (!rt) return;
    DSH.state.returnTo = null;
    if (rt.anchor) DSH.state.flash = rt.anchor;
    DSH.go(rt.hash);
  });
  DSH.on('return-dismiss', () => { DSH.state.returnTo = null; paintReturn(DSH.parse()); });

  /* ---------- 菜单：项目、原型状态、数据来源 ---------- */
  DSH.on('project-menu', (el) => {
    DSH.pop.open(el, html`
      <div class="dsh-menu" role="menu" aria-label="切换项目">
        <p class="ef-eyebrow slash">Projects</p>
        ${DSH.projects.map((p) => html`<button type="button" role="menuitemradio" aria-checked="${p.id === DSH.state.projectId}" class="dsh-menu-it" data-act="project" data-key="${p.id}"><b>${p.name}</b><span class="ef-field">${p.workspace}</span></button>`)}
        <p class="dsh-menu-note">切换后，成员、运行和结果只来自新工作区；不会与当前项目混用。</p>
      </div>`, { label: '切换项目' });
  });
  DSH.on('project', (el) => {
    const id = el.dataset.key;
    DSH.pop.close(false);
    if (id === DSH.state.projectId) return;
    DSH.state.projectId = id;
    DSH.LS.set('project', id);
    DSH.state.returnTo = null;
    DSH.state.scroll = {};
    DSH.side.el.open && DSH.side.close();
    const p = DSH.project();
    DSH.toast(`已切换到 ${p.name}：数据只来自 ${p.workspace}`);
    DSH.go('#/overview');
  });
  DSH.on('proto-menu', (el) => {
    DSH.pop.open(el, html`
      <div class="dsh-menu" role="menu" aria-label="原型状态演示">
        <p class="ef-eyebrow slash">Prototype only</p>
        ${PROTO.map(([k, t]) => html`<button type="button" role="menuitemradio" aria-checked="${k === DSH.state.proto}" class="dsh-menu-it" data-act="proto" data-state="${k}"><b>${t}</b></button>`)}
        <p class="dsh-menu-note">只属于原型：把当前工作区切到不同读取状态，用来审阅每一页的空、加载、失败、陈旧与部分完成。</p>
      </div>`, { label: '原型状态演示' });
  });
  DSH.on('proto', (el) => {
    DSH.state.proto = el.dataset.state;
    DSH.pop.close(false);
    DSH.render();
  });
  DSH.on('files-pop', (el) => {
    const p = DSH.project();
    DSH.pop.open(el, html`
      <div class="dsh-files" role="dialog" aria-label="数据来源">
        <header><span class="ef-pair"><span class="ef-eyebrow">Sources of truth</span><span>工作台读取的文件</span></span>${p.live ? html`<span class="ef-field">读取于 ${p.readAt}</span>` : ''}</header>
        <p class="dsh-menu-note">原始材料、Wiki 快照、方案、实验结果和 trace 是事实来源；工作台只展示，不维护另一套研究状态。</p>
        <table class="ef-table dsh-table-tight">
          <thead><tr><th>文件</th><th>读取</th><th>时间</th></tr></thead>
          <tbody>${p.files.map((f) => html`<tr><td><b>${f.label}</b><br />${/^（/.test(f.path) ? html`<span class="ef-field">${f.path}</span>` : ui.path(f.path)}<div class="ef-field">${f.detail}${f.by && f.by !== '—' ? ' │ ' + f.by : ''}</div>${f.note ? html`<div class="dsh-files-note">${f.note}</div>` : ''}</td><td>${ui.st('fresh', f.status)}</td><td class="ef-field">${f.at}</td></tr>`)}</tbody>
        </table>
      </div>`, { label: '数据来源', cls: 'is-wide' });
  });

  /* ---------- 命令面板：按编号或标题找任何对象 ---------- */
  function paletteIndex() {
    const db = DSH.db();
    const p = db.p;
    const items = [];
    const add = (ref, id, title, sub) => items.push({ ref, id, title, sub, zh: DSH.refInfo(ref).T.zh });
    (p.pages || []).forEach((x) => add('wiki:' + x.id, x.id, x.title, x.type));
    (p.sources || []).forEach((x) => add('source:' + x.id, x.id, x.path, x.kind));
    (p.issues || []).forEach((x) => add('issue:' + x.id, x.id, x.title, ui.label('issue', x.status)));
    (p.schemes || []).forEach((x) => add('scheme:' + x.id, x.id, x.title, x.short));
    (p.hypotheses || []).forEach((x) => add('hyp:' + x.id, x.id, x.text, ui.label('verdict', x.verdict)));
    (p.plans || []).forEach((x) => add('plan:' + x.id, x.id, x.title, x.question));
    (p.runs || []).forEach((x) => add('run:' + x.id, x.id, `${x.plan} │ ${x.variant}${x.seed !== '—' ? ' │ seed ' + x.seed : ''}`, ui.label('exec', x.status) + ' │ ' + ui.label('prov', x.prov)));
    (p.reviews || []).forEach((x) => add('review:' + x.id, x.id, `${x.plan} 审查`, ui.label('review', x.status)));
    (p.tasks || []).forEach((x) => add('task:' + x.id, x.id, x.title, ui.label('exec', x.exec)));
    (p.members || []).forEach((x) => add('member:' + x.id, x.id, x.name, x.role));
    if (p.story) {
      (p.story.contributions || []).forEach((x) => add('contrib:' + x.id, x.id, x.text, '贡献'));
      (p.story.figures || []).forEach((x) => add('fig:' + x.id, x.id, x.title, '图表计划'));
      (p.story.gaps || []).forEach((x) => add('gap:' + x.id, x.id, x.text, '证据缺口'));
    }
    return items;
  }
  const palette = {
    el: null, items: [], hits: [], at: 0,
    init() {
      this.el = $('#dsh-palette');
      this.el.addEventListener('cancel', (e) => { e.preventDefault(); this.close(); });
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el) this.close();
        const b = e.target.closest('[data-pal]');
        if (b) this.pick(+b.dataset.pal);
      });
      const input = $('#dsh-palette-q');
      input.addEventListener('input', () => { this.at = 0; this.paint(input.value); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
        if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
        if (e.key === 'Enter') { e.preventDefault(); this.pick(this.at); }
      });
    },
    open() {
      this.items = paletteIndex();
      const input = $('#dsh-palette-q');
      input.value = '';
      this.at = 0;
      this.paint('');
      this.el.showModal();
      input.focus();
    },
    async close() {
      if (!this.el.open) return;
      this.el.classList.add('is-closing');
      await DSH.settled(this.el);
      this.el.classList.remove('is-closing');
      this.el.close();
    },
    paint(q) {
      const s = q.trim().toLowerCase();
      this.hits = (s ? this.items.filter((x) => (x.id + ' ' + x.title + ' ' + (x.sub || '')).toLowerCase().includes(s)) : this.items).slice(0, 40);
      const list = $('#dsh-palette-list');
      list.innerHTML = this.hits.length
        ? DSH.out(this.hits.map((x, i) => html`<li role="option" aria-selected="${i === this.at}"><button type="button" data-pal="${i}" tabindex="-1"><span class="dsh-id">${x.id}</span><span class="t">${x.title}</span><span class="ef-field">${x.zh}${x.sub ? ' │ ' + x.sub : ''}</span></button></li>`))
        : DSH.out(html`<li class="dsh-pal-none">当前工作区里没有匹配“${q}”的对象。</li>`);
      $('#dsh-palette-n').textContent = `${this.hits.length} / ${this.items.length}`;
    },
    move(d) {
      if (!this.hits.length) return;
      this.at = (this.at + d + this.hits.length) % this.hits.length;
      $$('#dsh-palette-list [role="option"]').forEach((li, i) => li.setAttribute('aria-selected', String(i === this.at)));
      const cur = $$('#dsh-palette-list [role="option"]')[this.at];
      cur && cur.scrollIntoView({ block: 'nearest' });
    },
    async pick(i) {
      const x = this.hits[i];
      if (!x) return;
      await this.close();
      DSH.open(x.ref);
    },
  };
  DSH.on('palette', () => palette.open());

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.el.open ? palette.close() : palette.open(); return; }
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (!typing && e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const s = $('#view [data-hotkey="search"]');
      if (s) { e.preventDefault(); s.focus(); }
    }
  });

  /* ---------- 找不到的页面 ---------- */
  DSH.views.notfound = {
    title: () => '找不到页面',
    render: (r) => html`<div class="dsh-page">${ui.head({ zh: '找不到页面', en: 'Not found' })}${ui.notice('注意', html`<p>地址 <code>${r.hash}</code> 不对应任何页面。</p>`, html`<p class="ef-actions">${ui.btn('回到概览', { act: 'go', data: { href: '#/overview' } })}</p>`)}</div>`,
  };

  /* ---------- 启动 ---------- */
  DSH.boot = () => {
    DSH.bootCore();
    palette.init();
    window.addEventListener('hashchange', DSH.render);
    DSH.listen('theme', () => DSH.views.__current && DSH.views.__current.onTheme && DSH.views.__current.onTheme());
    DSH.render();
  };
})();
