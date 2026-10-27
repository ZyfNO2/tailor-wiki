/* 知识库：阅读（阅读页）、图谱、问题、覆盖、来源
   左边目录与搜索，中间一栏自然正文，右边页边放引用、关联、问题与页面信息。
   正文支持标题、列表、表格、代码、公式和页间链接；不按 fact ID 分章节。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon, esc } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  /* ---------- 共用：当前页面、分区栏、目录 ---------- */
  const kbState = () => DSH.vs('kb', { page: null, q: '' });
  function pageId(id) {
    const db = DSH.db();
    const st = kbState();
    const pick = id && db.pages[id] ? id : st.page && db.pages[st.page] ? st.page : (db.p.pages[0] || {}).id;
    if (pick) st.page = pick;
    return pick;
  }
  function kbBar(current) {
    const db = DSH.db();
    const p = db.p;
    const pid = kbState().page || (p.pages[0] || {}).id || '';
    const open = db.stats.issuesOpen.length;
    return html`
      <div class="dsh-sectionbar">
        ${ui.subnav('知识库', [
          { key: 'read', zh: '阅读', en: 'Read', href: '#/knowledge/read' + (pid ? '/' + pid : '') },
          { key: 'graph', zh: '图谱', en: 'Graph', href: '#/knowledge/graph' + (pid ? '/' + pid : '') },
          { key: 'issues', zh: '问题', en: 'Issues', href: '#/knowledge/issues', n: open || null, alert: open > 0 },
          { key: 'coverage', zh: '覆盖', en: 'Coverage', href: '#/knowledge/coverage' },
          { key: 'sources', zh: '来源', en: 'Sources', href: '#/knowledge/sources', n: (p.sources || []).length || null },
        ], current)}
        ${p.wikiSnapshot ? ui.facts([`Wiki 快照 ${p.wikiSnapshot.version}`, p.wikiSnapshot.at, `${p.pages.length} 页`, `由 ${p.wikiSnapshot.by} 整理`]) : ui.facts(['没有 Wiki 快照'])}
      </div>`;
  }
  const WIKI_META = (head, empty = false) => ({
    head, key: 'wiki', file: 'wiki/', skill: 'wiki-maintain', empty,
    emptyTitle: '这个工作区还没有 Wiki 快照。',
    emptyText: 'Wiki 由 wiki-maintain 读取 papers/、notes/ 等材料后写入 wiki/。工作台只读取已发布的快照，不会替你运行 Skill，也不会显示虚构的页面。',
    error: 'wiki/_index.json 第 17 行 JSON 语法错误（缺少逗号）。目录无法建立；单个页面文件仍在磁盘上，可复制路径查看。',
  });
  function issuesByPage() {
    const m = {};
    (DSH.db().p.issues || []).filter((x) => x.status !== 'resolved').forEach((x) => x.pages.forEach((pid) => (m[pid] = (m[pid] || 0) + 1)));
    return m;
  }
  function catList(mode, curId) {
    const db = DSH.db();
    const p = db.p;
    const s = (kbState().q || '').trim().toLowerCase();
    const hit = (pg) => !s || (pg.id + ' ' + pg.title + ' ' + pg.type + ' ' + pg.summary).toLowerCase().includes(s);
    const iss = issuesByPage();
    const groups = p.wikiGroups.map((g) => ({ g, pages: p.pages.filter((pg) => pg.group === g.key && hit(pg)) })).filter((x) => x.pages.length);
    const n = groups.reduce((k, x) => k + x.pages.length, 0);
    const base = mode === 'graph' ? '#/knowledge/graph/' : '#/knowledge/read/';
    return html`
      <p class="dsh-cat-count ef-field" aria-live="polite">${s ? `匹配 ${n} / ${p.pages.length} 页` : `${p.pages.length} 页`}</p>
      ${groups.length ? groups.map(({ g, pages }) => html`
        <h3 class="dsh-cat-g"><span>${g.name}</span><span class="ef-field">${pages.length}</span></h3>
        <ol class="dsh-cat-list">
          ${pages.map((pg) => html`<li><a class="dsh-cat-it" href="${base + pg.id}"${pg.id === curId ? raw(' aria-current="page"') : ''}>
            <span class="dsh-id">${pg.id}</span><span class="t">${pg.title}</span>
            <span class="m ef-field">${pg.type} │ ${pg.version}${iss[pg.id] ? html` │ <b class="warn">问题 ${iss[pg.id]}</b>` : ''}${pg.review === 'pending' ? ' │ 待复核' : pg.review === 'needs' ? html` │ <b class="warn">需复核</b>` : ''}</span>
          </a></li>`)}
        </ol>`) : html`<p class="ef-empty">没有标题、编号或摘要包含“${kbState().q}”的页面。</p>`}`;
  }
  function catalog(mode, curId) {
    return html`
      <aside class="dsh-cat" data-scroll-key="cat" aria-label="页面目录">
        <div class="dsh-cat-head">${ui.pair('Pages', mode === 'graph' ? '选择中心页面' : '页面目录')}</div>
        <label class="ef-search dsh-search"><input type="search" placeholder="搜索标题、编号、摘要" aria-label="搜索页面" data-input="kb-cat-q" data-mode="${mode}" data-cur="${curId || ''}" data-hotkey="search" value="${kbState().q}" /></label>
        <div class="dsh-cat-body" id="kb-cat-body">${catList(mode, curId)}</div>
      </aside>`;
  }
  DSH.on('kb-cat-q', (el) => {
    kbState().q = el.value;
    const box = document.getElementById('kb-cat-body');
    if (box) box.innerHTML = DSH.out(catList(el.dataset.mode, el.dataset.cur));
  });

  /* ---------- 正文：引用、页间链接、问题与对象引用 ---------- */
  function citeBtn(cid) {
    const db = DSH.db();
    const c = db.cites[cid];
    if (!c) return html`<span class="dsh-cite is-missing">?</span>`;
    const s = db.sources[c.source] || { path: c.source };
    return html`<button type="button" class="dsh-cite${c.missing ? ' is-missing' : ''}" id="cite-${cid}" data-act="cite" data-cite="${cid}" aria-haspopup="dialog" aria-expanded="false" aria-label="引用 ${c.n}：${s.path.split('/').pop()}${c.missing ? '，来源缺失' : ''}">${c.n}${c.missing ? html`<span class="dsh-cite-x">来源缺失</span>` : ''}</button>`;
  }
  function renderBody(pg) {
    const db = DSH.db();
    let k = 0;
    let s = pg.body
      .replace(/<h2>/g, () => `<h2 id="s-auto-${++k}">`)
      .replace(/\{\{c:(c\d+)\}\}/g, (m, cid) => DSH.out(citeBtn(cid)))
      .replace(/\{\{k:([A-Za-z0-9][\w.-]*)\}\}/g, (m, id) => DSH.out(ui.ref('issue:' + id)))
      .replace(/\{\{r:([a-z]+):([^}]+)\}\}/g, (m, t, id) => DSH.out(ui.ref(t + ':' + id)))
      .replace(/\[\[([A-Za-z0-9][\w.-]*)(?:\|([^\]]+))?\]\]/g, (m, id, label) => db.pages[id]
        ? `<a class="dsh-plink" href="#/knowledge/read/${id}" title="${esc(id + '：' + db.pages[id].title)}">${esc(label || db.pages[id].title)}</a>`
        : `<span class="dsh-plink is-broken" title="${esc('断链：' + id + ' 不在快照 ' + db.p.wikiSnapshot.version + ' 中')}">${esc(label || id)}<span class="dsh-broken-tag">${DSH.out(icon('g-unlink'))}断链</span></span>`);
    return raw(s);
  }
  function tocOf(body) {
    const out = [];
    let k = 0;
    body.replace(/<h2(?: id="([^"]+)")?>([^<]+)<\/h2>/g, (m, id, t) => { out.push({ id: id || 's-auto-' + ++k, t }); return m; });
    return out;
  }
  DSH.on('toc', (el) => {
    const t = document.getElementById(el.dataset.target);
    if (t) { t.scrollIntoView({ block: 'start', behavior: DSH.still() ? 'auto' : 'smooth' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  });

  /* 关联：来自同一份图谱数据，图谱里的每条关系在这里都查得到 */
  const REL_IN = { cites: '反向链接（被引用）', supports: '来源支持', adopts: '被方案采用', tests: '被实验检验', related: '相关', contrasts: '对比', proposes: '由此提出', yields: '得出', conflicts: '冲突' };
  const REL_OUT = { cites: '引用', related: '相关', contrasts: '对比', proposes: '提出假设', supports: '支持', adopts: '采用', tests: '检验', yields: '得出', conflicts: '冲突' };
  function relGroups(id) {
    const g = DSH.db().graph;
    const groups = {};
    (g.out[id] || []).filter((e) => e.type !== 'similar').forEach((e) => (groups['o:' + e.type] = groups['o:' + e.type] || { label: REL_OUT[e.type], refs: [] }).refs.push(g.nodes[e.to].ref));
    (g.inn[id] || []).filter((e) => e.type !== 'similar').forEach((e) => (groups['i:' + e.type] = groups['i:' + e.type] || { label: REL_IN[e.type], refs: [] }).refs.push(g.nodes[e.from].ref));
    return Object.values(groups);
  }

  /* ---------- 版本差异 ---------- */
  function diffLines(a, b) {
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push({ t: '=', a: a[i], b: b[j] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: '-', a: a[i++] });
      else ops.push({ t: '+', b: b[j++] });
    }
    while (i < n) ops.push({ t: '-', a: a[i++] });
    while (j < m) ops.push({ t: '+', b: b[j++] });
    return ops;
  }
  /* 成对的改动行：标出中间不同的一段（同前缀、同后缀之外） */
  function inline(a, b) {
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const mk = (x) => html`${x.slice(0, p)}<mark>${x.slice(p, x.length - s)}</mark>${x.slice(x.length - s)}`;
    return [mk(a), mk(b)];
  }
  function pairRows(ops) {
    const rows = [];
    for (let k = 0; k < ops.length; k++) {
      const o = ops[k];
      if (o.t === '=') { rows.push({ a: o.a, b: o.b, t: '=' }); continue; }
      const dels = [], adds = [];
      while (k < ops.length && ops[k].t !== '=') { (ops[k].t === '-' ? dels : adds).push(ops[k]); k++; }
      k--;
      const n = Math.max(dels.length, adds.length);
      for (let x = 0; x < n; x++) rows.push({ a: dels[x] && dels[x].a, b: adds[x] && adds[x].b, t: dels[x] && adds[x] ? '~' : dels[x] ? '-' : '+' });
    }
    return rows;
  }
  function historyTab(pg) {
    const st = DSH.vs('kb-diff:' + pg.id, () => ({ base: pg.versions[1] ? pg.versions[1].v : null, target: pg.versions[0].v, mode: 'split' }));
    if (pg.versions.length < 2) {
      const v = pg.versions[0];
      return html`
        <div class="dsh-empty is-inline"><div class="box">
          <p class="ef-eyebrow slash">Single version</p>
          <p class="t">这一页只有一个版本（${v.v}）。</p>
          <p>${v.at} 由 ${v.by} 首次整理：${v.note}。没有可以比较的历史，因此这里不显示差异。</p>
        </div></div>`;
    }
    const vs = pg.versions;
    const bi = vs.findIndex((v) => v.v === st.base), ti = vs.findIndex((v) => v.v === st.target);
    const A = vs[bi], B = vs[ti];
    const rows = bi > ti ? pairRows(diffLines(A.lines, B.lines)) : [];
    const add = rows.filter((r) => r.t === '+').length, del = rows.filter((r) => r.t === '-').length, chg = rows.filter((r) => r.t === '~').length;
    const srcChanges = bi > ti ? vs.slice(ti, bi).flatMap((v) => v.sources.map((s) => ({ ...s, v: v.v }))) : [];
    const sel = (name, value, act) => html`<label class="dsh-select"><span class="ef-eyebrow">${name}</span><select data-change="${act}" data-page="${pg.id}">${vs.map((v) => html`<option value="${v.v}"${v.v === value ? raw(' selected') : ''}>${v.v} │ ${v.at.split(' ')[0]}</option>`)}</select></label>`;
    return html`
      <section class="dsh-history">
        <ol class="ef-records dsh-records">
          ${vs.map((v, i) => html`<li><div class="ef-record dsh-record">${i === 0 ? ui.id(v.v, 'is-here') : ui.id(v.v)}<time class="ef-field">${v.at}</time><span class="name ef-read">${v.note}</span><span class="ef-field">${v.by}${v.trace ? html` │ ${ui.ref('trace:' + v.trace, { idOnly: true })}` : ''}</span></div></li>`)}
        </ol>
        <div class="dsh-diff-bar">
          ${sel('从', st.base, 'kb-diff-base')}${icon('arrow-r')}${sel('到', st.target, 'kb-diff-target')}
          ${ui.seg('差异显示方式', [['split', '并排'], ['unified', '合并']], st.mode, 'kb-diff-mode')}
          ${bi > ti ? html`<span class="ef-field">新增 ${add} 行 │ 删除 ${del} 行 │ 修改 ${chg} 行</span>` : ''}
        </div>
        ${bi <= ti ? ui.notice('注意', html`<p>请选择较早的版本作为“从”，较新的版本作为“到”。</p>`)
          : st.mode === 'split' ? html`
          <table class="dsh-diff is-split" aria-label="${A.v} 与 ${B.v} 的差异">
            <thead><tr><th class="ef-eyebrow">${A.v}（旧）</th><th class="ef-eyebrow">${B.v}（新）</th></tr></thead>
            <tbody>${rows.map((r) => {
              if (r.t === '~') { const [a, b] = inline(r.a, r.b); return html`<tr class="is-chg"><td><span class="mk" aria-label="修改前">−</span>${a}</td><td><span class="mk" aria-label="修改后">+</span>${b}</td></tr>`; }
              return html`<tr class="${r.t === '+' ? 'is-add' : r.t === '-' ? 'is-del' : ''}"><td>${r.a != null ? html`${r.t === '-' ? html`<span class="mk" aria-label="删除">−</span>` : html`<span class="mk"> </span>`}${r.a}` : ''}</td><td>${r.b != null ? html`${r.t === '+' ? html`<span class="mk" aria-label="新增">+</span>` : html`<span class="mk"> </span>`}${r.b}` : ''}</td></tr>`;
            })}</tbody>
          </table>` : html`
          <ol class="dsh-diff is-unified" aria-label="${A.v} 与 ${B.v} 的差异">
            ${rows.flatMap((r) => r.t === '=' ? [html`<li><span class="mk"> </span>${r.a}</li>`]
              : r.t === '~' ? (() => { const [a, b] = inline(r.a, r.b); return [html`<li class="is-del"><span class="mk" aria-label="删除">−</span>${a}</li>`, html`<li class="is-add"><span class="mk" aria-label="新增">+</span>${b}</li>`]; })()
                : r.t === '-' ? [html`<li class="is-del"><span class="mk" aria-label="删除">−</span>${r.a}</li>`] : [html`<li class="is-add"><span class="mk" aria-label="新增">+</span>${r.b}</li>`])}
          </ol>`}
        <h3 class="dsh-sec-h">${ui.pair('Source changes', '来源变化')}</h3>
        ${srcChanges.length ? html`<ul class="dsh-srcchg">${srcChanges.map((s) => html`<li><span class="dsh-id">${s.op === 'add' ? '新增' : s.op === 'change' ? '版本变化' : '移除'}</span><span>${s.text}</span><span class="ef-field">${s.v}</span>${s.cite ? ui.ref('cite:' + s.cite, { idOnly: true }) : ''}</li>`)}</ul>` : html`<p class="dsh-note">这两个版本之间来源没有变化。</p>`}
        <p class="dsh-note">版本由快照读取，只读：这里没有修改、回滚操作。</p>
      </section>`;
  }
  DSH.on('kb-diff-base', (el) => { DSH.vs('kb-diff:' + el.dataset.page, {}).base = el.value; DSH.render(); });
  DSH.on('kb-diff-target', (el) => { DSH.vs('kb-diff:' + el.dataset.page, {}).target = el.value; DSH.render(); });
  DSH.on('kb-diff-mode', (el) => { DSH.vs('kb-diff:' + kbState().page, {}).mode = el.value; DSH.render(); });
  DSH.on('kb-tab', (el) => DSH.go(DSH.href('/knowledge/read/' + kbState().page, { tab: el.value === 'body' ? null : el.value })));

  function pageIssues(pg) {
    const list = (DSH.db().p.issues || []).filter((q) => q.pages.includes(pg.id));
    if (!list.length) return html`<p class="ef-empty">这一页没有登记的问题。</p>`;
    return html`<ul class="ef-rows dsh-rows-flat">${list.map((q) => html`<li><div><div>${ui.id(q.id)} ${q.title} ${ui.st('issue', q.status)}</div><div class="meta"><span>${q.summary}</span><span>涉及 ${q.pages.length} 页（计为 1 个问题）</span></div></div><div class="acts">${ui.btn('查看', { act: 'open', data: { ref: 'issue:' + q.id } })}</div></li>`)}</ul>`;
  }

  /* ---------- 阅读 ---------- */
  DSH.views['kb-read'] = {
    layout: 'fixed',
    title: (r) => { const pg = DSH.db().pages[pageId(r.params.id)]; return pg ? pg.title : '知识库'; },
    render(r) {
      const db = DSH.db();
      const head = kbBar('read');
      return ui.withState(WIKI_META(head, !db.p.pages.length), (banner) => {
        const id = pageId(r.params.id);
        const pg = db.pages[id];
        const tab = r.query.tab || 'body';
        DSH.state.pageLabel = 'Wiki │ ' + pg.title;
        const groupName = (db.p.wikiGroups.find((g) => g.key === pg.group) || {}).name;
        const cites = pg.citations.map((cid) => db.cites[cid]);
        const back = (db.graph.inn[id] || []).filter((e) => e.type === 'cites').length;
        const pIssues = (db.p.issues || []).filter((q) => q.pages.includes(id));
        const rg = relGroups(id);
        const toc = tocOf(pg.body);
        return html`
          ${head}
          <div class="dsh-kb">
            ${catalog('read', id)}
            <article class="dsh-sheet" data-scroll-key="sheet" aria-labelledby="kb-title">
              ${banner}
              <p class="ef-crumb ef-field"><a href="#/knowledge/read">知识库</a><span>${groupName}</span></p>
              <p class="dsh-ids">${ui.id(pg.id, 'is-here')}<span class="dsh-kv-static"><span>类型</span><span>${pg.type}</span></span>${ui.st('page', pg.review, { dim: true })}<span class="dsh-kv-static"><span>版本</span><span>${pg.version}</span></span></p>
              ${ui.facts([pg.updated, DSH.fmt.n(pg.words) + ' 字', cites.length + ' 处引用', back + ' 个反向链接', '由 wiki-maintain 整理'])}
              ${pg.stale ? ui.notice('需复核', html`<p>这一页引用的来源已有新版本或不再可用；正文按快照显示，需要由 wiki-maintain 更新后再作依据。</p>`) : ''}
              <h1 class="dsh-title ef-read" id="kb-title">${pg.title}</h1>
              <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
              <p class="ef-lede ef-read">${pg.summary}</p>
              <p class="dsh-topics">${pg.topics.map((t) => html`<span class="dsh-topic">${t}</span>`)}</p>
              <div class="dsh-tabs">${ui.seg('页面内容', [['body', '正文'], ['history', `版本历史 ${pg.versions.length}`], ['issues', `问题 ${pIssues.length}`]], tab, 'kb-tab')}</div>
              ${tab === 'history' ? historyTab(pg) : tab === 'issues' ? pageIssues(pg) : html`
                <div class="ef-prose dsh-prose">${renderBody(pg)}</div>
                <h2 class="ef-group-head ef-read"><span>相关页面</span><span class="ef-field">${rg.reduce((n, g2) => n + g2.refs.filter((x) => x.startsWith('wiki:')).length, 0)} 页</span></h2>
                <ol class="ef-records">
                  ${[...new Set(rg.flatMap((g2) => g2.refs.filter((x) => x.startsWith('wiki:'))))].map((ref) => {
                    const o = db.pages[ref.slice(5)];
                    const why = rg.filter((g2) => g2.refs.includes(ref)).map((g2) => g2.label).join('、');
                    return html`<li><a class="ef-record" href="#/knowledge/read/${o.id}"><span class="ef-tag">${o.id}</span><span class="ef-field">${o.type}</span><span class="name ef-read">${o.title}</span><span class="ef-field">${why}</span></a></li>`;
                  })}
                </ol>
                <p class="ef-actions dsh-mt">${ui.btn('在图谱中查看这一页', { act: 'go', data: { href: '#/knowledge/graph/' + id }, icon: 'graph' })}</p>`}
            </article>
            <aside class="dsh-margin" data-scroll-key="margin" aria-label="引用、关联与页面信息">
              ${toc.length && tab === 'body' ? html`
                <h2 class="dsh-margin-h">${ui.pair('Contents', '目录')}</h2>
                <ol class="dsh-toc">${toc.map((t) => html`<li><button type="button" data-act="toc" data-target="${t.id}">${t.t}</button></li>`)}</ol>` : ''}
              <h2 class="dsh-margin-h">${ui.pair('Citations', '引用')} <span class="ef-field">${cites.length}</span></h2>
              <ol class="dsh-citelist">
                ${cites.map((c) => { const s = db.sources[c.source] || { path: c.source, kind: '来源', year: '—' }; return html`<li><button type="button" class="dsh-citeit${c.missing ? ' is-missing' : ''}" data-act="open" data-ref="cite:${pg.citations[c.n - 1]}">
                  <span class="n">${c.n}</span><span class="f">${s.path.split('/').pop()}</span>
                  <span class="ef-field">${c.field === 'summary' ? '摘要 │ ' : ''}${s.kind}${s.year && s.year !== '—' ? ' │ ' + s.year : ''} │ ${c.loc}</span>
                  ${c.missing ? ui.evi('missing') : c.stale ? ui.st('fresh', 'stale', { text: '来源已更新' }) : s.kind === '历史报告' ? ui.st('prov', 'historical') : s.status === 'partial' ? ui.st('cov', 'partial') : ''}
                </button></li>`; })}
              </ol>
              <h2 class="dsh-margin-h">${ui.pair('Relations', '关联')} <button type="button" class="dsh-linkbtn" data-act="go" data-href="#/knowledge/graph/${id}">图谱</button></h2>
              ${rg.length ? html`<dl class="dsh-rels">${rg.map((g2) => html`<div><dt>${g2.label}</dt><dd>${ui.refs(g2.refs)}</dd></div>`)}</dl>` : html`<p class="ef-empty">这一页在快照中没有记录任何关系。</p>`}
              <h2 class="dsh-margin-h">${ui.pair('Issues', '问题')} <span class="ef-field">${pIssues.length}</span></h2>
              ${pIssues.length ? html`<ul class="dsh-margin-list">${pIssues.map((q) => html`<li>${ui.ref('issue:' + q.id)}${ui.st('issue', q.status)}</li>`)}</ul>` : html`<p class="ef-empty">没有登记的问题。</p>`}
              <h2 class="dsh-margin-h">${ui.pair('Page', '页面信息')}</h2>
              ${ui.ledger([
                ['稳定标识', pg.id],
                ['文件', ui.path(pg.file)],
                ['所在快照', db.p.wikiSnapshot.version],
                ['页面版本', `${pg.version}（共 ${pg.versions.length} 个）`],
                ['语义复核', ui.label('page', pg.review), pg.review !== 'reviewed'],
                pg.reviewInfo && pg.reviewInfo.reviewer ? ['复核人', pg.reviewInfo.reviewer] : null,
                pg.reviewInfo && pg.reviewInfo.scope ? ['复核范围', pg.reviewInfo.scope] : null,
                ['维护方式', '增量整理'],
                db.p.live ? ['首次整理', pg.created] : ['人工笔记', '独立保留，不被覆盖'],
              ])}
            </aside>
          </div>`;
      });
    },
  };

  /* ---------- 图谱 ---------- */
  const NODE_ORDER = ['source', 'wiki', 'scheme', 'hypothesis', 'experiment', 'conclusion'];
  function graphFocus(id) {
    const db = DSH.db();
    if (id && db.graph.nodes[id]) { if (db.pages[id]) kbState().page = id; return id; }
    return pageId(null);
  }
  function nodeSummary(n) {
    const db = DSH.db();
    const [type, oid] = n.ref.split(':');
    const o = DSH.refInfo(n.ref).o || {};
    switch (n.type) {
      case 'wiki': return html`<p>${o.summary}</p>${ui.facts([o.type, o.version, ui.label('page', o.review)])}`;
      case 'source': return html`${ui.path(o.path)}<p class="dsh-chiprow">${o.status === 'missing' ? ui.evi('missing') : ui.st('cov', o.status, { dim: true })}${o.kind === '历史报告' ? ui.st('prov', 'historical') : ''}</p>${o.unread ? html`<p class="dsh-note">未读：${o.unread}。${o.reason}</p>` : ''}${o.status === 'missing' ? html`<p class="dsh-note">${o.reason}</p>` : ''}`;
      case 'scheme': return html`<p>${o.title}</p>${ui.triad(o)}`;
      case 'hypothesis': return html`<p>${o.text}</p><p class="dsh-chiprow">${ui.st('verdict', o.verdict, { dim: true })}<span class="dsh-note">${o.scheme ? '由方案 ' + o.scheme + ' 提出' : '由问题页提出'}</span></p>`;
      case 'experiment': { const rv = o.review ? db.reviews[o.review] : null; return html`<p>${o.question}</p><p class="dsh-chiprow">${rv ? html`${ui.st('review', rv.status, { dim: true })}${ui.st('verdict', rv.verdict, { dim: true })}` : ui.st('verdict', 'pending', { dim: true })}</p>`; }
      case 'conclusion': return html`<p>${o.text}</p><p class="dsh-chiprow">${ui.st('verdict', o.verdict, { dim: true })}${ui.ref('review:' + o.review)}</p>`;
      default: void type; void oid; return '';
    }
  }
  function graphPanel(st) {
    const db = DSH.db();
    const g = db.graph;
    const id = st.sel;
    if (!id || !g.nodes[id]) return html`<p class="ef-empty">点一个节点查看它的证据状态与关系。</p>`;
    const n = g.nodes[id];
    const T = DSH.graph.TYPES[n.type];
    const nb = DSH.graph.neighbors(id);
    const hidden = DSH.graph.hiddenCount(st, id);
    const groups = {};
    nb.forEach((x) => {
      const R = DSH.graph.RELS[x.e.type];
      const key = x.dir + ':' + x.e.type;
      (groups[key] = groups[key] || { label: x.dir === 'out' ? R.verb + ' →' : '← ' + R.verb, weak: !R.evidence, items: [] }).items.push(x);
    });
    const path = st.path;
    return html`
      <header class="dsh-kg-ph">
        <p class="ef-eyebrow slash">${T.en} / ${id}</p>
        <h2>${raw(DSH.graph.shapeIcon(n.type, 18))}<span>${n.title}</span></h2>
        <p class="dsh-chiprow">${id === st.focus ? ui.id('中心', 'is-here') : ''}${n.flag ? ui.st('fresh', 'stale', { text: n.flag === 'conflict' ? '涉及冲突' : n.flag === 'missing' ? '来源缺失' : '来源部分读取' }) : ''}</p>
      </header>
      ${nodeSummary(n)}
      <p class="ef-actions">
        ${ui.btn('打开原文', { act: 'open', data: { ref: n.ref }, icon: 'arrow-ur' })}
        ${hidden ? ui.btn(`展开邻居 +${hidden}`, { act: 'kg-expand', data: { node: id }, icon: 'unfold' }) : ''}
        ${id !== st.focus ? ui.btn('收起邻居', { act: 'kg-collapse', data: { node: id }, icon: 'fold' }) : ''}
        ${id !== st.focus ? ui.btn('设为中心', { act: 'go', data: { href: '#/knowledge/graph/' + id }, icon: 'target' }) : ''}
        ${id !== st.focus ? ui.btn('从中心到这里的路径', { act: 'kg-path', data: { node: id }, icon: 'route' }) : ''}
      </p>
      ${path && path.nodes[path.nodes.length - 1] === id ? html`
        <div class="dsh-kg-path"><p class="ef-eyebrow slash">Path</p>
          <ol>${path.nodes.map((nid, i) => html`<li>${ui.ref(g.nodes[nid].ref, { label: g.nodes[nid].title })}${i < path.edges.length ? html`<span class="via ef-field">${(() => { const e = path.edges[i]; const R = DSH.graph.RELS[e.type]; return e.from === nid ? R.verb + ' ↓' : '↑ 被' + R.verb; })()}</span>` : ''}</li>`)}</ol>
        </div>` : ''}
      <h3 class="dsh-sec-h">${ui.pair('Relations', '关系')} <span class="ef-field">${nb.length}</span></h3>
      ${nb.length ? html`<dl class="dsh-rels">${Object.values(groups).map((gr) => html`<div><dt>${gr.label}${gr.weak ? html` <span class="ef-field">非证据</span>` : ''}</dt><dd>${gr.items.map((x) => {
        const o = g.nodes[x.other];
        const vis = st.visible.has(x.other) && !st.hideTypes.has(o.type) && !st.hideRels.has(x.e.type);
        return html`<button type="button" class="oref${vis ? '' : ' is-off'}" data-act="kg-select" data-node="${x.other}" title="${vis ? '在图中选中' : '加入视图并选中'}">${raw(DSH.graph.shapeIcon(o.type, 12))}<span class="oref-id">${x.other}</span><span class="oref-t">${o.title}</span></button>`;
      })}${gr.items.some((x) => x.e.cites) ? html`<span class="ef-field">依据：${gr.items.flatMap((x) => (x.e.cites || []).map((c) => '[' + db.cites[c].n + ']')).join(' ')}</span>` : ''}${gr.items.some((x) => x.e.issue) ? gr.items.filter((x) => x.e.issue).map((x) => ui.ref('issue:' + x.e.issue)) : ''}</dd></div>`)}</dl>` : html`<p class="ef-empty">尚无关系证据：这个节点在快照中没有记录任何关系。不会根据相似度自动生成连线。</p>`}`;
  }
  function graphList(st) {
    const db = DSH.db();
    const g = db.graph;
    const { nodes, edges } = DSH.graph.shown(st);
    return html`
      <div class="dsh-kg-list">
        <table class="ef-table">
          <caption class="dsh-cap">${ui.pair('Nodes', '节点')} <span class="ef-field">${nodes.length} 个</span></caption>
          <thead><tr><th>类型</th><th>节点</th><th>状态</th><th class="num">关系</th><th>操作</th></tr></thead>
          <tbody>${NODE_ORDER.flatMap((t) => nodes.filter((id) => g.nodes[id].type === t)).map((id) => {
            const n = g.nodes[id];
            const hid = DSH.graph.hiddenCount(st, id);
            return html`<tr${id === st.sel ? raw(' class="is-sel"') : ''}><td>${raw(DSH.graph.shapeIcon(n.type, 14))} ${DSH.graph.TYPES[n.type].zh}</td><td>${ui.ref(n.ref, { label: n.title })}${id === st.focus ? ui.id('中心', 'is-here') : ''}</td><td>${n.flag ? ui.st('fresh', 'stale', { text: n.flag === 'conflict' ? '涉及冲突' : n.flag === 'missing' ? '来源缺失' : '部分读取' }) : n.verdict ? ui.st('verdict', n.verdict) : html`<span class="muted">—</span>`}</td><td class="num">${DSH.graph.neighbors(id).length}</td><td>${hid ? ui.btn('展开 +' + hid, { act: 'kg-expand', data: { node: id } }) : html`<span class="ef-field">已全部显示</span>`}</td></tr>`;
          })}</tbody>
        </table>
        <table class="ef-table">
          <caption class="dsh-cap">${ui.pair('Relations', '关系')} <span class="ef-field">${edges.length} 条</span></caption>
          <thead><tr><th>起点</th><th>关系</th><th>终点</th><th>依据</th></tr></thead>
          <tbody>${edges.map((e) => html`<tr><td>${ui.ref(g.nodes[e.from].ref, { idOnly: true })}</td><td>${DSH.graph.RELS[e.type].zh}${DSH.graph.RELS[e.type].evidence ? '' : html` <span class="ef-field">非证据</span>`}</td><td>${ui.ref(g.nodes[e.to].ref, { idOnly: true })}</td><td>${e.cites ? e.cites.map((c) => ui.ref('cite:' + c, { idOnly: true })) : e.issue ? ui.ref('issue:' + e.issue) : html`<span class="ef-field">${e.note || '正文链接'}</span>`}</td></tr>`)}</tbody>
        </table>
      </div>`;
  }
  function legend(st) {
    const g = DSH.db().graph;
    const { nodes } = DSH.graph.shown(st);
    const all = Object.values(g.nodes);
    return html`
      <div class="dsh-kg-legend" aria-label="图例">
        <div>
          <p class="ef-eyebrow">Node types / 节点类型</p>
          <ul>${NODE_ORDER.map((t) => html`<li>${raw(DSH.graph.shapeIcon(t, 14))}<span>${DSH.graph.TYPES[t].zh}</span><span class="ef-field">${nodes.filter((id) => g.nodes[id].type === t).length} / ${all.filter((n) => n.type === t).length}</span></li>`)}</ul>
        </div>
        <div>
          <p class="ef-eyebrow">Relations / 关系</p>
          <ul class="is-lines">
            <li><i class="ln ln--solid"></i><span>证据关系（有方向）</span></li>
            <li><i class="ln ln--dot"></i><span>相关（非证据）</span></li>
            <li><i class="ln ln--conflict"></i><span>冲突</span></li>
            <li><i class="ln ln--weak"></i><span>算法相似${st.hideRels.has('similar') ? '（已隐藏）' : ''}</span></li>
          </ul>
          <p class="ef-eyebrow">Marks / 标记</p>
          <ul><li><i class="mk mk--focus"></i><span>中心页面</span></li><li><i class="mk mk--flag"></i><span>需要看一眼</span></li><li><i class="mk mk--more">+n</i><span>未展开的邻居</span></li></ul>
        </div>
      </div>`;
  }
  function relMenu(st) {
    const g = DSH.db().graph;
    return html`<div class="dsh-menu" role="group" aria-label="关系类型">
      <p class="ef-eyebrow slash">Relation types</p>
      ${Object.entries(DSH.graph.RELS).map(([k, R]) => html`<label class="dsh-check"><input type="checkbox" data-change="kg-rel" value="${k}"${!st.hideRels.has(k) ? raw(' checked') : ''} /><span>${R.zh}</span><span class="ef-field">${g.edges.filter((e) => e.type === k).length}</span></label>`)}
      <p class="dsh-menu-note">算法相似只是浏览线索，不是证据关系，默认隐藏。</p>
    </div>`;
  }
  DSH.views['kb-graph'] = {
    layout: 'fixed',
    title: () => '知识图谱',
    render(r) {
      const db = DSH.db();
      const head = kbBar('graph');
      return ui.withState(WIKI_META(head, !db.p.pages.length), (banner) => {
        const focus = graphFocus(r.params.id);
        const st = DSH.graph.state(focus);
        const g = db.graph;
        const { nodes, edges } = DSH.graph.shown(st);
        DSH.state.pageLabel = '图谱 │ ' + g.nodes[focus].title;
        const all = Object.values(g.nodes);
        const pathOpts = all.filter((n) => n.id !== focus).sort((a, b) => NODE_ORDER.indexOf(a.type) - NODE_ORDER.indexOf(b.type) || a.id.localeCompare(b.id));
        return html`
          ${head}
          <div class="dsh-kg">
            ${catalog('graph', db.pages[focus] ? focus : null)}
            <section class="dsh-kg-main" aria-label="局部知识图谱">
              ${banner}
              <div class="dsh-toolbar">
                <div class="dsh-kg-find">
                  <label class="ef-search dsh-search"><input type="search" placeholder="定位节点：编号或标题" aria-label="定位节点" data-input="kg-find" autocomplete="off" /></label>
                  <ul class="dsh-suggest" id="kg-suggest" hidden></ul>
                </div>
                ${ui.chips(NODE_ORDER.map((t) => ({ key: t, label: DSH.graph.TYPES[t].zh, on: !st.hideTypes.has(t), glyph: raw(DSH.graph.shapeIcon(t, 12)), title: '显示或隐藏' + DSH.graph.TYPES[t].zh })), 'kg-type', { label: '节点类型：显示或隐藏', toggle: true })}
                <button type="button" class="ef-btn small" data-act="kg-relmenu" aria-haspopup="dialog" aria-expanded="false">${icon('filter')}关系类型 <span class="sub">${Object.keys(DSH.graph.RELS).length - st.hideRels.size} / ${Object.keys(DSH.graph.RELS).length}</span></button>
                <label class="dsh-select is-inline"><span class="ef-eyebrow">Path</span><select data-change="kg-pathto" aria-label="高亮从中心到某个节点的路径"><option value="">从中心到…</option>${pathOpts.map((n) => html`<option value="${n.id}"${st.pathTo === n.id ? raw(' selected') : ''}>${n.id} │ ${n.title}</option>`)}</select></label>
                ${ui.btn(st.labels ? '隐藏关系名' : '显示关系名', { act: 'kg-labels', pressed: st.labels })}
                <span class="dsh-toolbar-r">${ui.seg('视图', [['graph', '图', 'graph'], ['list', '列表', 'list']], st.mode, 'kg-mode')}</span>
              </div>
              ${st.mode === 'list' ? graphList(st) : html`
              <div class="dsh-kg-canvas">
                <svg class="kg-svg" id="kg-svg" role="group" aria-label="局部知识图谱：中心 ${focus}，显示 ${nodes.length} 个节点、${edges.length} 条关系。可用 Tab 走过节点，Enter 选中，加号展开。"></svg>
                <div class="dsh-kg-info ef-field" aria-live="polite" id="kg-info">${ui.pair('Local graph', '局部图谱')}<span>中心 ${focus}</span><span>显示 ${nodes.length} / ${all.length} 节点</span><span>${edges.length} / ${g.edges.length} 关系</span></div>
                <div class="dsh-zoom" role="group" aria-label="画布缩放">
                  <button type="button" class="dsh-zbtn" data-act="kg-zoom" data-k="1.2" aria-label="放大">${icon('plus')}</button>
                  <button type="button" class="dsh-zbtn" data-act="kg-zoom" data-k="0.83" aria-label="缩小">${icon('minus')}</button>
                  <button type="button" class="dsh-zbtn" data-act="kg-fit" aria-label="适配画布">${icon('fit')}</button>
                  <button type="button" class="dsh-zbtn" data-act="kg-reset" aria-label="重置为一跳邻居">${icon('refresh')}</button>
                </div>
                ${legend(st)}
                ${edges.length === 0 ? html`<div class="dsh-kg-none">${ui.notice('尚无关系证据', html`<p>${focus} 在快照中没有记录任何关系。不会根据相似度自动生成看似真实的连线。</p>`)}</div>` : ''}
              </div>`}
            </section>
            <aside class="dsh-kg-panel" data-scroll-key="kgpanel" aria-label="节点详情" id="kg-panel">${graphPanel(st)}</aside>
          </div>`;
      });
    },
    mount(el, r) {
      const svg = el.querySelector('#kg-svg');
      if (!svg) return;
      const st = DSH.graph.state(graphFocus(r.params.id));
      const box = svg.getBoundingClientRect();
      const redraw = () => {
        svg.innerHTML = DSH.graph.render(st);
        const { nodes, edges } = DSH.graph.shown(st);
        const info = el.querySelector('#kg-info');
        if (info) info.innerHTML = DSH.out(html`${ui.pair('Local graph', '局部图谱')}<span>中心 ${st.focus}</span><span>显示 ${nodes.length} / ${Object.keys(DSH.db().graph.nodes).length} 节点</span><span>${edges.length} / ${DSH.db().graph.edges.length} 关系</span>`);
        const panel = el.querySelector('#kg-panel');
        if (panel) panel.innerHTML = DSH.out(graphPanel(st));
        const lg = el.querySelector('.dsh-kg-legend');
        if (lg) lg.outerHTML = DSH.out(legend(st));
      };
      const refit = () => { const b = svg.getBoundingClientRect(); DSH.graph.fit(st, b.width, b.height); };
      if (!st.fitted) { DSH.graph.fit(st, box.width, box.height); st.fitted = true; }
      svg.innerHTML = DSH.graph.render(st);
      const api = DSH.graph.bind(svg, st, {
        redraw,
        select: (id) => { st.sel = id; redraw(); },
        expand: (id) => { const n = DSH.graph.expand(st, id); st.sel = id; refit(); redraw(); DSH.toast(n ? `已展开 ${id} 的 ${n} 个邻居` : `${id} 的邻居都已显示`); },
        collapse: (id) => { const n = DSH.graph.collapse(st, id); redraw(); DSH.toast(n ? `已收起 ${n} 个节点` : '没有可以收起的节点'); },
      });
      DSH.views['kb-graph']._api = { st, svg, redraw, refit, apply: api.apply };
    },
    unmount() { DSH.views['kb-graph']._api = null; },
  };
  const kg = () => DSH.views['kb-graph']._api;
  const kgSt = () => DSH.graph.state(null);
  DSH.on('kg-select', (el) => {
    const st = kgSt();
    const id = el.dataset.node;
    let added = false;
    if (!st.visible.has(id)) { st.visible.add(id); DSH.graph.layout(st, { around: st.sel || st.focus, added: [id] }); added = true; }
    const t = DSH.db().graph.nodes[id].type;
    const hiddenType = st.hideTypes.delete(t);
    st.sel = id;
    const box = document.getElementById('kg-suggest');
    if (box) { box.hidden = true; box.innerHTML = ''; const q = document.querySelector('[data-input="kg-find"]'); if (q) q.value = ''; }
    if (hiddenType) return DSH.render();
    if (kg()) { if (added) kg().refit(); kg().redraw(); } else DSH.render();
  });
  DSH.on('kg-expand', (el) => {
    const st = kgSt();
    const n = DSH.graph.expand(st, el.dataset.node);
    st.sel = el.dataset.node;
    if (kg()) { kg().refit(); kg().redraw(); } else DSH.render();
    DSH.toast(n ? `已展开 ${el.dataset.node} 的 ${n} 个邻居` : '邻居都已显示');
  });
  DSH.on('kg-collapse', (el) => {
    const st = kgSt();
    const n = DSH.graph.collapse(st, el.dataset.node);
    if (kg()) kg().redraw(); else DSH.render();
    DSH.toast(n ? `已收起 ${n} 个节点` : '没有可以收起的节点（它们还连着别的节点）');
  });
  const setPath = (to) => {
    const st = kgSt();
    st.pathTo = to;
    if (!to) { st.path = null; return true; }
    const p = DSH.graph.findPath(st.focus, to);
    if (!p) { st.path = null; DSH.toast('在已记录的关系中找不到从中心到 ' + to + ' 的路径'); return false; }
    p.nodes.forEach((id) => { if (!st.visible.has(id)) { st.visible.add(id); } st.hideTypes.delete(DSH.db().graph.nodes[id].type); });
    DSH.graph.layout(st);
    st.path = p;
    st.sel = to;
    st.fitted = false;
    return true;
  };
  DSH.on('kg-path', (el) => { setPath(el.dataset.node); DSH.render(); });
  DSH.on('kg-pathto', (el) => { setPath(el.value); DSH.render(); });
  DSH.on('kg-type', (el) => {
    const st = kgSt();
    const t = el.dataset.key;
    if (st.hideTypes.has(t)) st.hideTypes.delete(t); else st.hideTypes.add(t);
    DSH.render();
  });
  DSH.on('kg-rel', (el) => {
    const st = kgSt();
    if (el.checked) st.hideRels.delete(el.value); else st.hideRels.add(el.value);
    if (kg()) kg().redraw();
    const b = document.querySelector('[data-act="kg-relmenu"] .sub');
    if (b) b.textContent = `${Object.keys(DSH.graph.RELS).length - st.hideRels.size} / ${Object.keys(DSH.graph.RELS).length}`;
  });
  DSH.on('kg-relmenu', (el) => DSH.pop.open(el, relMenu(kgSt()), { label: '关系类型' }));
  DSH.on('kg-labels', () => { const st = kgSt(); st.labels = !st.labels; DSH.render(); });
  DSH.on('kg-mode', (el) => { kgSt().mode = el.value; DSH.render(); });
  DSH.on('kg-zoom', (el) => {
    const a = kg();
    if (!a) return;
    const r = a.svg.getBoundingClientRect();
    const st = a.st;
    const k2 = Math.min(3, Math.max(0.3, st.k * +el.dataset.k));
    st.tx = r.width / 2 - ((r.width / 2 - st.tx) / st.k) * k2;
    st.ty = r.height / 2 - ((r.height / 2 - st.ty) / st.k) * k2;
    st.k = k2;
    a.apply();
  });
  DSH.on('kg-fit', () => { const a = kg(); if (!a) return; const r = a.svg.getBoundingClientRect(); DSH.graph.fit(a.st, r.width, r.height); a.apply(); });
  DSH.on('kg-reset', () => { const st = kgSt(); DSH.graph.reset(st, st.focus); DSH.render(); DSH.toast('已回到一跳邻居'); });
  DSH.on('kg-find', (el) => {
    const q = el.value.trim().toLowerCase();
    const box = document.getElementById('kg-suggest');
    if (!box) return;
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const g = DSH.db().graph;
    const st = kgSt();
    const hits = Object.values(g.nodes).filter((n) => (n.id + ' ' + n.title).toLowerCase().includes(q)).slice(0, 8);
    box.hidden = false;
    box.innerHTML = hits.length ? DSH.out(hits.map((n) => html`<li><button type="button" data-act="kg-select" data-node="${n.id}">${raw(DSH.graph.shapeIcon(n.type, 12))}<span class="dsh-id">${n.id}</span><span>${n.title}</span><span class="ef-field">${st.visible.has(n.id) ? '已在图中' : '加入视图'}</span></button></li>`)) : DSH.out(html`<li class="dsh-pal-none">没有匹配的节点</li>`);
  });

  /* ---------- 问题 ---------- */
  DSH.views['kb-issues'] = {
    layout: 'fixed',
    title: () => '问题',
    render(r) {
      const db = DSH.db();
      const head = kbBar('issues');
      return ui.withState(WIKI_META(head), (banner) => {
        const list = db.p.issues || [];
        if (!list.length) return html`${head}<div class="dsh-pad">${ui.empty({ title: '快照中没有登记的问题。', text: '问题由 wiki-maintain 在整理时登记（矛盾、待补检索等）；没有登记时这里不会生成问题。' })}</div>`;
        const fst = DSH.vs('kb-issues', { status: 'all' });
        const shown = list.filter((q) => fst.status === 'all' || q.status === fst.status);
        const id = r.params.id && db.issues[r.params.id] ? r.params.id : (shown[0] || list[0]).id;
        const kindZh = (k) => ({ gap: '待补检索', conflict: '来源之间的矛盾', contradiction: '来源之间的矛盾' }[k] || k || '问题');
        const q = db.issues[id];
        DSH.state.pageLabel = '问题 │ ' + q.title;
        const count = (s) => list.filter((x) => x.status === s).length;
        return html`
          ${head}
          <div class="dsh-split">
            <aside class="dsh-split-list" data-scroll-key="ilist" aria-label="问题列表">
              <div class="dsh-cat-head">${ui.pair('Issues', '问题')}<span class="ef-field">${list.length} 个 │ 跨页只计一次</span></div>
              ${ui.chips([
                { key: 'all', label: '全部', n: list.length, on: fst.status === 'all' },
                { key: 'open', label: '未解决', n: count('open'), on: fst.status === 'open' },
                { key: 'verifying', label: '待核实', n: count('verifying'), on: fst.status === 'verifying' },
                { key: 'resolved', label: '已解决', n: count('resolved'), on: fst.status === 'resolved' },
              ].concat(count('dismissed') ? [{ key: 'dismissed', label: '已驳回', n: count('dismissed'), on: fst.status === 'dismissed' }] : []), 'kb-issue-filter', { label: '按状态筛选' })}
              <ol class="ef-records dsh-records">
                ${shown.map((x) => html`<li><a class="ef-record dsh-record" href="#/knowledge/issues/${x.id}"${x.id === id ? raw(' aria-current="true"') : ''}>${ui.id(x.id, x.id === id ? 'is-here' : '')}<span class="name ef-read">${x.title}</span>${ui.st('issue', x.status)}<span class="ef-field">${kindZh(x.kind)} │ ${x.pages.length} 页</span></a></li>`)}
              </ol>
              ${shown.length ? '' : html`<p class="ef-empty">没有这个状态的问题。</p>`}
            </aside>
            <article class="dsh-split-main dsh-sheetlike" data-scroll-key="imain" aria-labelledby="iss-title">
              ${banner}
              <p class="dsh-ids">${ui.id(q.id, 'is-here')}<span class="dsh-kv-static"><span>类型</span><span>${kindZh(q.kind)}</span></span>${ui.st('issue', q.status, { dim: true })}</p>
              <h1 class="dsh-title ef-read" id="iss-title">${q.title}</h1>
              <p class="ef-lede ef-read">${q.summary}</p>
              ${q.sides.length ? html`
                <h2 class="dsh-sec-h">${ui.pair('Two sides', '矛盾双方')}</h2>
                <div class="dsh-sides">${q.sides.map((s, i) => html`
                  <section class="dsh-side-card">
                    <p class="ef-eyebrow">${i === 0 ? 'Side A' : 'Side B'} / ${s.label}</p>
                    <blockquote class="dsh-quote is-lg">${s.claim}</blockquote>
                    ${ui.ledger([['来源', ui.ref('source:' + s.source)], ['引用位置', ui.ref('cite:' + s.cite)], ['适用条件', s.condition]])}
                  </section>`)}</div>` : q.conditions ? ui.notice('注意', html`<p>${q.conditions}</p>`) : ''}
              ${q.sides.length ? html`<h2 class="dsh-sec-h">${ui.pair('Conditions', '适用条件')}</h2><p class="ef-read">${q.conditions}</p>` : ''}
              <h2 class="dsh-sec-h">${ui.pair('Evidence', '证据')}</h2><p class="ef-read">${q.evidence}</p>
              ${q.resolution ? html`<h2 class="dsh-sec-h">${ui.pair('Resolution', '解决结论')}</h2>${ui.notice('已解决', html`<p>${q.resolution}</p>`)}` : ''}
              <h2 class="dsh-sec-h">${ui.pair('Log', '解决记录')}</h2>
              ${ui.timeline(q.log.map((l) => ({ at: l.at, title: l.by, text: l.text })))}
              <h2 class="dsh-sec-h">${ui.pair('Where', '涉及页面')} <span class="ef-field">${q.pages.length} 页，计为 1 个问题</span></h2>
              <p>${ui.refs(q.pages.map((p2) => 'wiki:' + p2))}</p>
              ${q.affects.length ? html`<h2 class="dsh-sec-h">${ui.pair('Affects', '可能受影响')}</h2><p>${ui.refs(q.affects)}</p>` : ''}
            </article>
          </div>`;
      });
    },
  };
  DSH.on('kb-issue-filter', (el) => { DSH.vs('kb-issues', {}).status = el.dataset.key; DSH.render(); });

  /* ---------- 覆盖 ---------- */
  const COV = ['processed', 'reused', 'partial', 'failed', 'excluded'];
  const COV_KIND = { processed: 'ink', reused: 'run', partial: 'alert', failed: 'alert-x', excluded: 'off', unread: 'alert', unaudited: 'unknown', withdrawn: 'off', missing: 'alert-x' };
  DSH.views['kb-coverage'] = {
    layout: 'scroll',
    title: () => 'Wiki 覆盖',
    render(r) {
      const db = DSH.db();
      const head = kbBar('coverage');
      return ui.withState(WIKI_META(head, !db.p.coverage), (banner) => {
        const p = db.p;
        const cv = p.coverage;
        const st = db.stats;
        DSH.state.pageLabel = 'Wiki 覆盖';
        const want = r.query.status ? r.query.status.split(',') : [];
        const files = p.sources.filter((s) => !s.outside && (!want.length || want.includes(s.status)));
        const complete = (st.coverage.processed || 0) + (st.coverage.reused || 0);
        const covKeys = COV.concat(['unread', 'unaudited', 'withdrawn', 'missing'].filter((k) => st.coverage[k]));
        const covState = !p.live ? ['partial', '未完成'] : cv.status === 'complete' ? ['ok', '已完成'] : cv.status === 'partial' ? ['partial', '未完成'] : ['missing', '未对账'];
        return html`
          ${head}
          <div class="dsh-page">
            ${banner}
            ${ui.head({ zh: '覆盖面板', en: 'Coverage', desc: '这一轮 Wiki 整理读到了什么、没读到什么、为什么。文件提交、全量覆盖、语义复核分开显示，不用一个“完成”代替三者。', facts: [`由 ${cv.by} 执行`, cv.at, cv.run ? html`trace ${ui.ref('trace:' + cv.run, { idOnly: true })}` : null] })}
            <section class="dsh-scope">
              <p class="ef-eyebrow slash">Scope / 用户指定范围${cv.mode && cv.mode !== 'legacy-unattested' ? html` <span class="ef-field">${cv.mode === 'full' ? '全量' : '子集分批'}</span>` : ''}</p>
              <p>${cv.scope.length ? cv.scope.map((s) => ui.path(s, { copy: false })) : html`<span class="muted">这次整理没有声明请求范围（旧格式整理，未做覆盖对账）。</span>`}</p>
              <p class="ef-field">明确排除：${cv.excluded.length ? cv.excluded.join('；') : '无'}</p>
              ${cv.outstanding && cv.outstanding.length ? html`<p class="ef-field">尚未完成的请求范围：${cv.outstanding.map((o) => o.paths.join('、')).join('；')}</p>` : ''}
            </section>
            <div class="dsh-three">
              <section class="ef-panel">
                <h2>${ui.pair('Commit', '文件提交')}</h2>
                <p class="dsh-chiprow">${ui.st('fresh', 'ok', { text: '已写入' })}</p>
                <p>${cv.commit.text}</p>
                <p class="ef-field">${cv.commit.at}</p>
              </section>
              <section class="ef-panel">
                <h2>${ui.pair('Full coverage', '全量覆盖')}</h2>
                <p class="dsh-chiprow">${ui.st('fresh', covState[0], { text: covState[1] })}</p>
                <p>${p.counts ? html`扫描 ${st.scanned} 项，明确排除 ${st.excludedTotal} 项；范围内 ${st.coverageTotal} 项中` : html`${st.coverageTotal} 个来源中`} <b>${complete}</b> 个完整处理；${st.coverage.partial || 0} 个部分处理，${st.coverage.failed || 0} 个失败或不支持${p.counts ? '' : html`，${st.coverage.excluded || 0} 个按指令排除`}。</p>
                <p class="ef-field">完整 = 本轮处理 ${st.coverage.processed || 0} + 未变复用 ${st.coverage.reused || 0}</p>
              </section>
              <section class="ef-panel">
                <h2>${ui.pair('Semantic review', '语义复核')}</h2>
                <p class="dsh-chiprow">${ui.st('review', cv.review.done === cv.review.total && cv.review.total ? 'passed' : 'pending', { text: `已复核 ${cv.review.done} / ${cv.review.total} 页` })}</p>
                <div class="ef-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${cv.review.total}" aria-valuenow="${cv.review.done}" style="--p:${(cv.review.total ? cv.review.done / cv.review.total : 0).toFixed(3)}"><span class="ef-eyebrow">Reviewed / 已复核</span><span class="ef-field">${DSH.fmt.pad(cv.review.done)} / ${cv.review.total}</span><i></i></div>
                <p class="dsh-note">${p.live ? '复核记录写在每页的 review 字段：只统计明确标为已复核的页面；结构映射完成不等于语义复核。' : '复核由研究者确认；本轮 wiki-maintain 没有运行语义复核。'}</p>
              </section>
            </div>
            <section class="ef-panel dsh-mt" id="cov-files">
              <h2>${ui.pair('Sources in scope', '范围内来源')} <small>点图例筛选文件</small></h2>
              ${DSH.charts.stack({
                label: '来源处理状态', unit: '个',
                items: covKeys.map((k) => ({ key: k, kind: COV_KIND[k] || 'alert', label: ui.label('cov', k), n: st.coverage[k] || 0, on: want.includes(k) })),
                act: 'cov-filter',
                note: '部分处理与失败 / 不支持的文件，在下表写明未读范围和原因。',
              })}
              <div class="ef-table-wrap">
                <table class="ef-table">
                  <thead><tr><th>文件</th><th>性质</th><th>状态</th><th>已处理</th><th>未读范围</th><th>原因 / 说明</th></tr></thead>
                  <tbody>${files.map((s) => html`<tr id="cov-row-${s.id}"><td>${ui.path(s.path)}</td><td>${s.kind}</td><td>${ui.st('cov', s.status)}</td><td class="ef-field">${s.range}</td><td>${s.unread ? html`<b>${s.unread}</b>` : html`<span class="muted">—</span>`}</td><td>${s.reason || s.note || ''}</td></tr>`)}</tbody>
                </table>
              </div>
              ${files.length ? '' : html`<p class="ef-empty">没有符合筛选条件的文件。</p>`}
              ${want.length ? html`<p class="ef-actions">${ui.btn('清除筛选', { act: 'go', data: { href: '#/knowledge/coverage' } })}</p>` : ''}
            </section>
            ${st.missingSources.length ? html`<div class="dsh-mt">${ui.notice('来源缺失', html`<p>另有 ${st.missingSources.length} 个来源不在磁盘上：${st.missingSources.map((s) => ui.ref('source:' + s.id))}。${p.live ? '' : '它不属于本轮范围，'}引用它的说法按待核实处理。</p>`)}</div>` : ''}
          </div>`;
      });
    },
  };
  DSH.on('cov-filter', (el) => {
    const r = DSH.parse();
    const cur = r.query.status ? r.query.status.split(',') : [];
    const k = el.dataset.key;
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : cur.concat(k);
    DSH.go(DSH.href('/knowledge/coverage', { status: next.join(',') }), { replace: true });
  });

  /* ---------- 来源 ---------- */
  DSH.views['kb-sources'] = {
    layout: 'scroll',
    title: () => '来源',
    render(r) {
      const db = DSH.db();
      const head = kbBar('sources');
      return ui.withState(WIKI_META(head), (banner) => {
        const p = db.p;
        DSH.state.pageLabel = '来源列表';
        const cnt = {};
        Object.values(db.cites).forEach((c) => (cnt[c.source] = (cnt[c.source] || 0) + 1));
        const fs = DSH.vs('kb-src', { q: '', kind: 'all' });
        const q = fs.q.trim().toLowerCase();
        const inKind = (s) => fs.kind === 'registered' ? !s.inventoryOnly : fs.kind === 'excluded' ? s.inventoryOnly && s.status === 'excluded' : fs.kind === 'other' ? s.inventoryOnly && s.status !== 'excluded' : true;
        const rows = p.sources.filter((s) => inKind(s) && (!q || (s.id + ' ' + s.path + ' ' + s.kind).toLowerCase().includes(q)));
        return html`
          ${head}
          <div class="dsh-page">
            ${banner}
            ${ui.head({ zh: '来源', en: 'Sources', desc: '原始材料是事实来源。这里列出范围内的全部文件和被引用的缺失文件；点一行查看引用片段与原文上下文。', facts: p.counts ? [`登记来源 ${p.counts.registered}`, `扫描项 ${p.counts.scanned}（明确排除 ${p.counts.excluded}）`, `${Object.keys(db.cites).length} 处引用`] : [`${p.sources.length} 个文件`, `${Object.keys(db.cites).length} 处引用`] })}
            ${p.counts ? html`<div class="dsh-toolbar">${ui.chips([
              { key: 'all', label: '全部', n: p.sources.length, on: fs.kind === 'all' },
              { key: 'registered', label: '登记来源', n: p.counts.registered, on: fs.kind === 'registered' },
              { key: 'excluded', label: '明确排除', n: p.sources.filter((s) => s.inventoryOnly && s.status === 'excluded').length, on: fs.kind === 'excluded' },
              { key: 'other', label: '未登记（不支持 / 不可用）', n: p.sources.filter((s) => s.inventoryOnly && s.status !== 'excluded').length, on: fs.kind === 'other' },
            ], 'src-kind', { label: '按口径筛选' })}</div>` : ''}
            <div class="dsh-toolbar">${ui.search('搜索路径、编号、性质', 'src-q', fs.q)}</div>
            <div class="ef-table-wrap">
              <table class="ef-table">
                <thead><tr><th>文件</th><th>性质</th><th>日期</th><th class="num">被引用</th><th>覆盖状态</th><th></th></tr></thead>
                <tbody>${rows.map((s) => html`<tr id="src-row-${s.id}"><td>${ui.path(s.path, { copy: s.status !== 'missing' })}</td><td>${s.kind}</td><td class="ef-field">${s.year}</td><td class="num">${cnt[s.id] || 0}</td><td>${ui.st('cov', s.status)}</td><td>${ui.btn('预览', { act: 'open', data: { ref: 'source:' + s.id } })}</td></tr>`)}</tbody>
              </table>
            </div>
            ${rows.length ? '' : html`<p class="ef-empty">没有匹配“${fs.q}”的来源。</p>`}
          </div>`;
      });
    },
    mount(el, r) {
      if (r.query.focus) DSH.flash(r.query.focus);
    },
  };
  DSH.on('src-q', (el) => { DSH.vs('kb-src', {}).q = el.value; DSH.render(); });
  DSH.on('src-kind', (el) => { DSH.vs('kb-src', {}).kind = el.dataset.key; DSH.render(); });
})();
