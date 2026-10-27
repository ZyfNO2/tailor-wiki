/* 项目概览（控制台页）
   研究问题、当前选定方案、需要处理的入口、实际任务计数、最近产物、最近变更、四个 Skill。
   中央圆形导航是主视觉：每一段的数字都来自工作区文件，需要处理的段挂黄色小方块。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const EXEC_ORDER = [
    ['done', 'ink'], ['running', 'run'], ['blocked', 'alert'], ['failed', 'alert-x'],
    ['pending', 'idle'], ['cancelled', 'off'], ['unknown', 'unknown'],
  ];

  function emptyOverview(p) {
    return html`
      <div class="dsh-page is-console">
        ${ui.head({ zh: '项目概览', en: 'Overview', desc: '这个工作区里还没有任何研究文件。下面列出工作台会读取的文件，以及应由谁产出它们。' })}
        ${ui.empty({ title: '没有可以展示的研究进度。', text: '工作台不会自动运行 Skill，也不会用示例成绩填充空位。等下面的文件出现后，这一页会显示研究问题、选定方案、任务计数和最近变更。' })}
        <section class="ef-panel dsh-mt">
          <h2>${ui.pair('Expected files', '预期文件')}</h2>
          <table class="ef-table">
            <thead><tr><th>内容</th><th>文件</th><th>由谁提供</th><th>读取</th></tr></thead>
            <tbody>${p.files.map((f) => html`<tr><td>${f.label}</td><td>${ui.path(f.path)}</td><td>${f.by}</td><td>${ui.st('fresh', f.status)}</td></tr>`)}</tbody>
          </table>
          <p class="dsh-note">四个 Skill 各自独立运行，没有总 Skill，也不需要按顺序运行：wiki-maintain、academic-tailor、experiment-design、research-story。</p>
        </section>
      </div>`;
  }

  /* ---------- 实时模式：同一版式，每个数字都从读取到的文件计算，不写死任何对象 ---------- */
  const share = (a, b) => (b ? a / b : 0);
  function liveOverview(db) {
    const p = db.p;
    const st = db.stats;
    const exec = st.exec;
    const total = (p.tasks || []).length;
    const blockedN = (exec.blocked || 0) + (exec.failed || 0);
    const covOk = (st.coverage.processed || 0) + (st.coverage.reused || 0);
    const runsDone = (p.runs || []).filter((r) => r.status === 'done');
    const plansRun = (p.plans || []).filter((pl) => runsDone.some((r) => r.plan === pl.id)).length;
    const selected = (p.schemes || []).filter((s) => s.decision === 'selected');
    const unmarked = (p.schemes || []).filter((s) => s.decision === 'unknown').length;
    const story = p.story;
    const sel = selected[0] || null;
    const reviewDone = p.coverage ? p.coverage.review.done : 0;
    const reviewTotal = p.coverage ? p.coverage.review.total : 0;
    const problems = (p.files || []).filter((f) => f.status === 'error' || f.status === 'partial');
    const ws = p.wikiState || {};
    DSH.views.overview._dial = {
      idle: total
        ? { label: '研究任务', big: total, unit: '项', sub: `完成 ${exec.done || 0} │ 运行中 ${exec.running || 0} │ 受阻 ${blockedN}` }
        : { label: 'Wiki 页面', big: p.pages.length, unit: '页', sub: `登记来源 ${st.registered} │ 未解决问题 ${st.issuesOpen.length}` },
      gauges: [
        { label: '全量覆盖', value: `${covOk} / ${st.coverageTotal}`, share: share(covOk, st.coverageTotal) },
        { label: '语义复核', value: `${reviewDone} / ${reviewTotal}`, share: share(reviewDone, reviewTotal) },
        { label: '计划有完成的运行', value: `${plansRun} / ${p.plans.length}`, share: share(plansRun, p.plans.length) },
      ],
      sections: [
        { zh: '概览', en: 'Overview', href: '#/overview', big: total, unit: '项任务', sub: `受阻 ${blockedN}`, here: true },
        { zh: '知识库', en: 'Knowledge', href: '#/knowledge/read', big: p.pages.length, unit: '页', sub: `未解决问题 ${st.issuesOpen.length}`, alert: st.issuesOpen.length > 0 },
        { zh: '方案', en: 'Schemes', href: '#/schemes', big: p.schemes.length, unit: '个', sub: `已选 ${selected.length} │ 未标注决策 ${unmarked}` },
        { zh: '实验', en: 'Experiments', href: '#/experiments/plan', big: p.plans.length, unit: '个计划', sub: `运行记录 ${(p.runs || []).length}` },
        { zh: 'DAG', en: 'Dependencies', href: '#/dag', big: p.dagEdges.length, unit: '条依赖', sub: `缺失节点 ${p.dagMissing.length}`, alert: p.dagMissing.length > 0 },
        { zh: '任务', en: 'Tasks', href: '#/tasks/list', big: total, unit: '项', sub: `阻塞 ${exec.blocked || 0} │ 失败 ${exec.failed || 0}`, alert: blockedN > 0 },
        { zh: '叙事', en: 'Story', href: '#/story', big: story ? story.contributions.length : 0, unit: '项贡献', sub: story ? `补证事项 ${story.gaps.length}` : '没有 STORY-PLAN.md' },
      ],
    };
    const attn = [
      ...problems.map((f) => ({ t: html`${f.label} ${ui.st('fresh', f.status)}`, m: f.note || f.detail, b: ui.btn('数据来源', { act: 'files-pop' }) })),
      ...(st.unprocessed.length ? [{ t: html`${st.unprocessed.length} 个来源没有完整处理 ${ui.st('cov', 'partial', { text: '部分 ' + (st.coverage.partial || 0) })} ${ui.st('cov', 'failed', { text: '失败 / 不支持 ' + (st.coverage.failed || 0) })}`, m: st.unprocessed.map((s) => s.path.split('/').pop()).join('、'), b: ui.btn('查看覆盖', { act: 'go', data: { href: DSH.href('/knowledge/coverage', { status: 'partial,failed' }) } }) }] : []),
      ...(ws.journals || []).map((j) => ({ t: html`Wiki 有未完成的写入 #${j.commit} ${ui.st('fresh', 'error', { text: '需要恢复' })}`, m: '由 wiki-maintain 运行 recover 处理；工作台不替你恢复。', b: '' })),
      ...(ws.pendingFeedback || []).map((f) => ({ t: html`待同步到 Wiki 的产物 ${ui.st('fresh', 'stale', { text: f.status === 'failed-awaiting-agent' ? '上次同步失败' : '等待合并' })}`, m: f.paths.join('、') + (f.error ? '；' + f.error : ''), b: '' })),
      ...st.blocked.map((t) => ({ t: html`${t.id} ${t.title} ${ui.st('exec', t.exec)}`, m: t.blocked || t.statusText || '', b: ui.btn('详情', { act: 'open', data: { ref: 'task:' + t.id } }) })),
      ...(st.issuesOpen.length ? [{ t: html`${st.issuesOpen.length} 个问题尚未解决 ${ui.st('issue', 'open', { text: '未解决 ' + st.issuesOpen.filter((q) => q.status === 'open').length })}`, m: st.issuesOpen.map((q) => q.id + ' ' + q.title).join('；'), b: ui.btn('问题列表', { act: 'go', data: { href: '#/knowledge/issues' } }) }] : []),
      ...(p.dagMissing.length ? [{ t: html`DAG 引用了 ${p.dagMissing.length} 个节点表中没有的任务 ${ui.st('edge', 'missing')}`, m: p.dagMissing.map((m) => m.id).join('、'), b: ui.btn('DAG 白板', { act: 'go', data: { href: '#/dag' } }) }] : []),
    ];
    const firstPlan = sel && sel.plans[0] ? sel.plans[0] : null;
    return html`
      <div class="dsh-page is-console">
        <header class="dsh-ov-head">
          <p class="ef-eyebrow slash">Overview / ${p.readAt.split(' ')[0]}</p>
          <h1 class="dsh-ov-title">${p.name}</h1>
          ${p.question
            ? html`<p class="dsh-ov-q"><span class="ef-marker">${p.question.text}</span></p>${ui.facts([`研究问题来自 ${p.question.from}`, `工作区 ${p.workspace}`])}`
            : html`<p class="dsh-ov-q is-none">工作区文件里还没有写明研究问题或主线（STORY-PLAN.md 的一句话主线，或 TAILOR.md 的“研究问题：”）。</p>${ui.facts([`工作区 ${p.workspace}`])}`}
        </header>
        <div class="board">
          <div class="orbit">
            <figure class="hub"><svg class="ef-dial" data-dial role="group" aria-label="研究链路：七个分区"></svg></figure>
            <section class="ef-panel cut-br l1">
              <h2>${ui.pair('Knowledge', '知识库')} <a href="#/knowledge/read">阅读</a></h2>
              <div class="ef-figs">
                <a href="#/knowledge/read"><b>${p.pages.length}</b><span>Wiki 页</span></a>
                <a href="#/knowledge/sources" title="扫描 ${st.scanned} 项，其中明确排除 ${st.excludedTotal} 项"><b>${st.registered}</b><span>登记来源</span></a>
                <a href="${DSH.href('/knowledge/coverage', { status: 'partial,failed' })}" class="${st.unprocessed.length ? 'is-alert' : ''}"><b>${st.unprocessed.length}</b><span>未完整处理</span></a>
              </div>
            </section>
            <section class="ef-panel lead-right l2">
              <h2>${ui.pair('Schemes', '研究方案')} <a href="#/schemes">全部</a></h2>
              <div class="ef-figs">
                <a href="#/schemes"><b>${p.schemes.length}</b><span>方案</span></a>
                <a href="${sel ? '#/schemes/' + sel.id : '#/schemes'}"><b>${selected.length}</b><span>已选</span></a>
                <a href="#/schemes" class="${unmarked ? 'is-alert' : ''}"><b>${unmarked}</b><span>未标注决策</span></a>
              </div>
            </section>
            <section class="ef-panel cut-tr l3">
              <h2>${ui.pair('Files', '数据来源')} <button type="button" class="dsh-linkbtn" data-act="files-pop" aria-haspopup="dialog" aria-expanded="false">全部 ${p.files.length} 项</button></h2>
              ${ui.ledger(p.files.filter((f) => f.status !== 'ok').map((f) => [f.label, ui.label('fresh', f.status), f.status === 'error' || f.status === 'partial']).concat([[`其余 ${p.files.filter((f) => f.status === 'ok').length} 项`, '已读取']]))}
            </section>
            <section class="ef-panel cut-bl tab-right r1">
              <h2>${ui.pair('Experiments', '实验')} <a href="#/experiments/plan">计划</a></h2>
              <div class="ef-figs">
                <a href="#/experiments/plan"><b>${p.plans.length}</b><span>计划</span></a>
                <a href="#/experiments/runs"><b>${(p.runs || []).length}</b><span>运行记录</span></a>
                <a href="#/experiments/plan"><b>${plansRun}</b><span>有完成运行</span></a>
              </div>
            </section>
            <section class="ef-panel lead-left tab-right r2">
              <h2>${ui.pair('Tasks / Team', '任务与成员')} <a href="#/tasks/list">任务</a></h2>
              <div class="ef-figs">
                <a href="#/tasks/list"><b>${total}</b><span>任务</span></a>
                <a href="#/tasks/team"><b>${p.members.length}</b><span>成员与会话</span></a>
                <a href="${DSH.href('/tasks/list', { exec: 'blocked,failed' })}" class="${blockedN ? 'is-alert' : ''}"><b>${blockedN}</b><span>阻塞或失败</span></a>
              </div>
            </section>
            <section class="ef-panel cut-tl tab-right r3">
              <h2>${ui.pair('Story', '研究叙事')} <a href="#/story">主线</a></h2>
              ${story ? ui.ledger([['贡献', story.contributions.length + ' 项'], ['补证事项', story.gaps.length + ' 个', story.gaps.length > 0], ['图表安排', story.figures.length + ' 项']]) : html`<p class="ef-empty">没有 STORY-PLAN.md。</p>`}
            </section>
          </div>
        </div>
        <div class="dsh-cols">
          <div class="dsh-stackcol">
            <section class="ef-panel" id="ov-attn">
              <h2>${ui.pair('Needs attention', '需要处理')} <small>只列文件里实际记录的问题</small></h2>
              ${attn.length ? html`<ul class="ef-rows">${attn.map((a) => html`<li><div><div>${a.t}</div>${a.m ? html`<div class="meta"><span>${a.m}</span></div>` : ''}</div>${a.b ? html`<div class="acts">${a.b}</div>` : ''}</li>`)}</ul>` : html`<p class="ef-empty">读取的文件里没有需要处理的事项。</p>`}
            </section>
            <section class="ef-panel" id="ov-progress">
              <h2>${ui.pair('Task counts', '任务进度')} <small>RESEARCH-DAG.md │ ${total} 项任务</small></h2>
              ${total ? DSH.charts.stack({
                label: '任务执行状态',
                items: EXEC_ORDER.map(([k, kind]) => ({ key: k, kind, label: ui.label('exec', k), n: exec[k] || 0 })),
                note: '按 RESEARCH-DAG.md 节点表的“状态”列计数；无法识别的状态计为未知。不计算总体完成百分比。',
              }) : html`<p class="ef-empty">没有任务节点表（RESEARCH-DAG.md）。</p>`}
              <p class="ef-actions">${ui.btn('任务列表', { act: 'go', data: { href: '#/tasks/list' } })}${ui.btn('依赖白板', { act: 'go', data: { href: '#/dag' } })}</p>
            </section>
            <section class="ef-panel" id="ov-changes">
              <h2>${ui.pair('Recent changes', '最近变更')} <small>来自文件修改时间与 Wiki trace</small></h2>
              ${p.changes.length ? html`<ol class="ef-records dsh-records">${p.changes.map((c) => html`<li><div class="ef-record dsh-record"><time class="ef-field">${c.at}</time><span class="name ef-read">${c.text}</span><span class="ef-field">${c.by}</span><span>${ui.ref(c.ref, { idOnly: !c.ref.startsWith('view:') })}</span></div></li>`)}</ol>` : html`<p class="ef-empty">没有可显示的变更。</p>`}
            </section>
          </div>
          <div class="dsh-stackcol">
            ${sel ? html`
            <section class="ef-panel" id="ov-scheme">
              <h2>${ui.pair('Selected scheme', '当前选定方案')} <a href="#/schemes/${sel.id}">详情</a></h2>
              <p class="dsh-ov-scheme"><span class="dsh-id">${sel.id}</span>${sel.title}</p>
              ${ui.triad(sel)}
              <div class="dsh-chain">${ui.ref('scheme:' + sel.id)}${firstPlan ? html`${icon('arrow-r', 'dsh-chain-a')}${ui.ref('plan:' + firstPlan)}` : ''}${sel.contribs[0] ? html`${icon('arrow-r', 'dsh-chain-a')}${ui.ref('contrib:' + sel.contribs[0])}` : ''}</div>
            </section>` : ''}
            <section class="ef-panel" id="ov-recent">
              <h2>${ui.pair('Recent artifacts', '最近产物')}</h2>
              ${p.recent.length ? html`<ul class="ef-rows">${p.recent.map((a) => html`<li><div><div>${ui.path(a.path, { copy: false })}</div><div class="meta"><span>${a.by}</span><span>${a.at}</span></div></div><div class="acts">${ui.btn('打开', { act: 'open', data: { ref: a.ref } })}</div></li>`)}</ul>` : html`<p class="ef-empty">还没有产物。</p>`}
            </section>
            <section class="ef-panel" id="ov-skills">
              <h2>${ui.pair('Skills', '四个独立 Skill')} <small>没有总 Skill │ 不要求顺序 │ 与工作台互不依赖</small></h2>
              <ul class="ef-rows">
                ${p.skills.map((s) => html`<li><div><div><b>${s.name}</b> <code class="dsh-code-inline">${s.id}</code></div><div class="meta"><span>${s.file}</span><span>${s.output || '尚无产物'}</span><span>${s.at || '—'}</span><span>${s.installed && s.installed.length ? '已安装到 ' + s.installed.join('、') : '未安装到此工作区'}</span></div></div><div class="acts">${s.trace ? ui.btn('trace', { act: 'open', data: { ref: 'trace:' + s.trace } }) : html`<span class="ef-field">无 trace</span>`}</div></li>`)}
              </ul>
              <p class="dsh-note">工作台只读文件、不持有写锁；Skill 运行时它可以照常打开，关掉它也不影响 Skill。</p>
            </section>
          </div>
        </div>
      </div>`;
  }

  DSH.views.overview = {
    title: () => '项目概览',
    render() {
      const db = DSH.db();
      const p = db.p;
      const st = db.stats;
      DSH.state.pageLabel = '项目概览';
      if (p.empty || DSH.state.proto === 'empty') return emptyOverview(p);
      if (p.live) return liveOverview(db);
      if (DSH.state.proto === 'loading') return html`<div class="dsh-page is-console">${ui.head({ zh: '项目概览', en: 'Overview' })}${ui.loading('读取 9 个研究文件')}</div>`;
      if (DSH.state.proto === 'error') return html`<div class="dsh-page is-console">${ui.head({ zh: '项目概览', en: 'Overview' })}${ui.readError({ file: 'dag.yaml', error: '第 88 行缩进错误，任务列表无法解析。概览不显示任务计数，以免用不完整的数字冒充全貌。', last: '2026.10.25 18:40' })}</div>`;

      const sel = (p.schemes || []).find((s) => s.decision === 'selected');
      const exec = st.exec;
      const total = (p.tasks || []).length;
      const blockedN = (exec.blocked || 0) + (exec.failed || 0);
      const covOk = (st.coverage.processed || 0) + (st.coverage.reused || 0);
      const plansRun = (p.plans || []).filter((pl) => (p.runs || []).some((r) => r.plan === pl.id && r.prov === 'current' && r.status === 'done')).length;
      const reviewNeeds = st.reviewChanges;
      const banner = DSH.state.proto === 'stale'
        ? ui.notice('可能陈旧', html`<p>team/sessions.jsonl 在读取之后被修改过（2026.10.26 10:05）。成员状态显示的是读取时的内容。</p>`)
        : DSH.state.proto === 'partial'
          ? ui.notice('部分读取', html`<p>runs/ 中 1 条记录缺少 metrics.json（R-E2-04，已取消）。其余 10 条正常计入。</p>`)
          : '';
      DSH.views.overview._dial = {
        idle: { label: '研究任务', big: total, unit: '项', sub: `完成 ${exec.done || 0} │ 运行中 ${exec.running || 0} │ 受阻 ${blockedN}` },
        gauges: [
          { label: '全量覆盖', value: `${covOk} / ${st.coverageTotal}`, share: covOk / st.coverageTotal },
          { label: '语义复核', value: `${p.coverage.review.done} / ${p.coverage.review.total}`, share: p.coverage.review.done / p.coverage.review.total },
          { label: '计划有真实运行', value: `${plansRun} / ${p.plans.length}`, share: plansRun / p.plans.length },
        ],
        sections: [
          { zh: '概览', en: 'Overview', href: '#/overview', big: total, unit: '项任务', sub: `受阻 ${blockedN}`, here: true },
          { zh: '知识库', en: 'Knowledge', href: '#/knowledge/read', big: p.pages.length, unit: '页', sub: `未解决问题 ${st.issuesOpen.length}`, alert: st.issuesOpen.length > 0 },
          { zh: '方案', en: 'Schemes', href: '#/schemes', big: p.schemes.length, unit: '个', sub: '已选 1 │ 原文待核 1', alert: p.schemes.some((s) => Object.values(s.checks).some((c) => c.status === 'fail')) },
          { zh: '实验', en: 'Experiments', href: '#/experiments/plan', big: p.plans.length, unit: '个计划', sub: `运行 ${st.runsTotal} │ 需补充审查 ${reviewNeeds.length}`, alert: reviewNeeds.length > 0 },
          { zh: 'DAG', en: 'Dependencies', href: '#/dag', big: p.dagEdges.length, unit: '条依赖', sub: '缺失节点 1' },
          { zh: '任务', en: 'Tasks', href: '#/tasks/list', big: total, unit: '项', sub: `阻塞 ${exec.blocked || 0} │ 失败 ${exec.failed || 0}`, alert: blockedN > 0 },
          { zh: '叙事', en: 'Story', href: '#/story', big: p.story.contributions.length, unit: '项贡献', sub: `证据缺口 ${p.story.gaps.length}` },
        ],
      };

      return html`
      <div class="dsh-page is-console">
        <header class="dsh-ov-head">
          <p class="ef-eyebrow slash">Overview / ${p.readAt.split(' ')[0]}</p>
          <h1 class="dsh-ov-title">${p.name}</h1>
          <p class="dsh-ov-q"><span class="ef-marker">${p.question.text}</span></p>
          ${ui.facts([`研究问题来自 ${p.question.from}`, `当前阶段：${p.question.stage}`, `工作区 ${p.workspace}`])}
        </header>
        ${banner}
        <div class="board">
          <div class="orbit">
            <figure class="hub"><svg class="ef-dial" data-dial role="group" aria-label="研究链路：七个分区"></svg></figure>

            <section class="ef-panel cut-br l1">
              <h2>${ui.pair('Knowledge', '知识库')} <a href="#/knowledge/read">阅读</a></h2>
              <div class="ef-figs">
                <a href="#/knowledge/read"><b>${p.pages.length}</b><span>Wiki 页</span></a>
                <a href="#/knowledge/sources"><b>${st.coverageTotal}</b><span>范围内来源</span></a>
                <a href="${DSH.href('/knowledge/coverage', { status: 'partial,failed' })}" class="${st.unprocessed.length ? 'is-alert' : ''}"><b>${st.unprocessed.length}</b><span>未完整处理</span></a>
              </div>
            </section>
            <section class="ef-panel lead-right l2">
              <h2>${ui.pair('Schemes', '研究方案')} <a href="#/schemes">全部</a></h2>
              <div class="ef-figs">
                <a href="#/schemes"><b>${p.schemes.length}</b><span>方案</span></a>
                <a href="#/schemes/S1"><b>${p.schemes.filter((s) => s.decision === 'selected').length}</b><span>已选</span></a>
                <a href="#/schemes/S2" class="is-alert"><b>${p.schemes.filter((s) => s.checks.origin.status === 'fail').length}</b><span>原文未核对</span></a>
              </div>
            </section>
            <section class="ef-panel cut-tr l3">
              <h2>${ui.pair('Files', '数据来源')} <button type="button" class="dsh-linkbtn" data-act="files-pop" aria-haspopup="dialog" aria-expanded="false">全部 ${p.files.length} 个</button></h2>
              ${ui.ledger(p.files.filter((f) => f.status !== 'ok').map((f) => [f.label, ui.label('fresh', f.status), true]).concat([[`其余 ${p.files.filter((f) => f.status === 'ok').length} 个文件`, '已读取']]))}
            </section>
            <section class="ef-panel cut-bl tab-right r1">
              <h2>${ui.pair('Experiments', '实验')} <a href="#/experiments/runs">运行</a></h2>
              <div class="ef-figs">
                <a href="#/experiments/plan"><b>${p.plans.length}</b><span>计划</span></a>
                <a href="#/experiments/runs"><b>${st.runsTotal}</b><span>运行记录</span></a>
                <a href="#/experiments/review/E2" class="${reviewNeeds.length ? 'is-alert' : ''}"><b>${reviewNeeds.length}</b><span>审查需补充</span></a>
              </div>
            </section>
            <section class="ef-panel lead-left tab-right r2">
              <h2>${ui.pair('Tasks / Team', '任务与成员')} <a href="#/tasks/team">Team</a></h2>
              <div class="ef-figs">
                <a href="#/tasks/list"><b>${total}</b><span>任务</span></a>
                <a href="#/tasks/team"><b>${p.members.length}</b><span>成员与会话</span></a>
                <a href="${DSH.href('/tasks/list', { exec: 'blocked,failed' })}" class="${blockedN ? 'is-alert' : ''}"><b>${blockedN}</b><span>阻塞或失败</span></a>
              </div>
            </section>
            <section class="ef-panel cut-tl tab-right r3">
              <h2>${ui.pair('Story', '研究叙事')} <a href="#/story">主线</a></h2>
              ${ui.ledger([
                ['贡献', p.story.contributions.length + ' 项'],
                ['证据缺口', p.story.gaps.length + ' 个', true],
                ['已完成的图表', `0 / ${p.story.figures.length}`],
              ])}
            </section>
          </div>
        </div>

        <div class="dsh-cols">
          <div class="dsh-stackcol">
            <section class="ef-panel" id="ov-attn">
              <h2>${ui.pair('Needs attention', '需要处理')} <small>入口直接定位到对应条目</small></h2>
              <ul class="ef-rows">
                <li>
                  <div><div>${st.unprocessed.length} 个来源没有完整处理 ${ui.st('cov', 'partial', { text: '部分 ' + (st.coverage.partial || 0) })} ${ui.st('cov', 'failed', { text: '失败 / 不支持 ' + (st.coverage.failed || 0) })}</div>
                  <div class="meta"><span>${st.unprocessed.map((s) => s.path.split('/').pop()).join('、')}</span></div></div>
                  <div class="acts">${ui.btn('查看覆盖', { act: 'go', data: { href: DSH.href('/knowledge/coverage', { status: 'partial,failed' }) } })}</div>
                </li>
                ${st.blocked.map((t) => html`
                <li>
                  <div><div>${t.id} ${t.title} ${ui.st('exec', t.exec)}</div>
                  <div class="meta"><span>${t.blocked || t.firstError || ''}</span></div></div>
                  <div class="acts">${ui.btn('详情', { act: 'open', data: { ref: 'task:' + t.id } })}</div>
                </li>`)}
                ${reviewNeeds.map((rv) => html`
                <li>
                  <div><div>${rv.plan} 的审查需要补充 ${ui.st('review', rv.status)} ${ui.st('verdict', rv.verdict, { dim: true })}</div>
                  <div class="meta"><span>${rv.next.join('；')}</span></div></div>
                  <div class="acts">${ui.btn('看审查', { act: 'go', data: { href: '#/experiments/review/' + rv.plan } })}</div>
                </li>`)}
                ${p.members.filter((m) => m.state === 'unknown').map((m) => html`
                <li>
                  <div><div>${m.name} 会话状态未知 ${ui.st('member', 'unknown')}</div>
                  <div class="meta"><span>最后心跳 ${m.heartbeat}</span><span>当前任务 ${m.current}</span></div></div>
                  <div class="acts">${ui.btn('成员', { act: 'open', data: { ref: 'member:' + m.id } })}</div>
                </li>`)}
                <li>
                  <div><div>${st.issuesOpen.length} 个问题尚未解决 ${ui.st('issue', 'open', { text: '未解决 ' + st.issuesOpen.filter((q) => q.status === 'open').length })} ${ui.st('issue', 'verifying', { text: '待核实 ' + st.issuesOpen.filter((q) => q.status === 'verifying').length })}</div>
                  <div class="meta"><span>${st.issuesOpen.map((q) => q.id + ' ' + q.title).join('；')}</span></div></div>
                  <div class="acts">${ui.btn('问题列表', { act: 'go', data: { href: '#/knowledge/issues' } })}</div>
                </li>
              </ul>
            </section>

            <section class="ef-panel" id="ov-progress">
              <h2>${ui.pair('Task counts', '任务进度')} <small>dag.yaml │ ${total} 项任务</small></h2>
              ${DSH.charts.stack({
                label: '任务执行状态',
                items: EXEC_ORDER.map(([k, kind]) => ({ key: k, kind, label: ui.label('exec', k), n: exec[k] || 0 })),
                note: '只按实际任务计数，不计算总体完成百分比。执行状态与审查状态分开统计：执行完成的 5 项中，审查通过 3 项、需补充 1 项、待审 1 项。',
              })}
              <p class="ef-actions">${ui.btn('任务列表', { act: 'go', data: { href: '#/tasks/list' } })}${ui.btn('依赖白板', { act: 'go', data: { href: '#/dag' } })}</p>
            </section>

            <section class="ef-panel" id="ov-changes">
              <h2>${ui.pair('Recent changes', '最近变更')} <small>来自各文件的修改时间与 trace</small></h2>
              <ol class="ef-records dsh-records">
                ${p.changes.map((c) => html`<li><div class="ef-record dsh-record"><time class="ef-field">${c.at}</time><span class="name ef-read">${c.text}</span><span class="ef-field">${c.by}</span><span>${ui.ref(c.ref, { idOnly: c.ref.startsWith('view:') ? false : true })}</span></div></li>`)}
              </ol>
            </section>
          </div>

          <div class="dsh-stackcol">
            ${sel ? html`
            <section class="ef-panel" id="ov-scheme">
              <h2>${ui.pair('Selected scheme', '当前选定方案')} <a href="#/schemes/${sel.id}">详情</a></h2>
              <p class="dsh-ov-scheme"><span class="dsh-id">${sel.id}</span>${sel.title}</p>
              ${ui.triad(sel)}
              <p class="dsh-note">假设 ${sel.hypotheses.map((h) => h).join('、')}：${db.hyps[sel.hypotheses[0]].text}。这是待证假设，不是已证明的贡献。</p>
              <div class="dsh-chain">
                ${ui.ref('scheme:' + sel.id)}${icon('arrow-r', 'dsh-chain-a')}${ui.ref('plan:E2')}${icon('arrow-r', 'dsh-chain-a')}${ui.ref('review:RV-E2')}${icon('arrow-r', 'dsh-chain-a')}${ui.ref('contrib:C2')}
              </div>
            </section>` : ''}

            <section class="ef-panel" id="ov-recent">
              <h2>${ui.pair('Recent artifacts', '最近产物')}</h2>
              <ul class="ef-rows">
                ${p.recent.map((a) => html`<li><div><div>${ui.path(a.path, { copy: false })}</div><div class="meta"><span>${a.by}</span><span>${a.at}</span></div></div><div class="acts">${ui.btn('打开', { act: 'open', data: { ref: a.ref } })}</div></li>`)}
              </ul>
            </section>

            <section class="ef-panel" id="ov-skills">
              <h2>${ui.pair('Skills', '四个独立 Skill')} <small>没有总 Skill │ 不要求顺序</small></h2>
              <ul class="ef-rows">
                ${p.skills.map((s) => html`<li><div><div><b>${s.name}</b> <code class="dsh-code-inline">${s.id}</code></div><div class="meta"><span>${s.file}</span><span>${s.output || '尚无产物'}</span><span>${s.at || '—'}</span></div></div><div class="acts">${s.trace ? ui.btn('trace', { act: 'open', data: { ref: 'trace:' + s.trace } }) : html`<span class="ef-field" title="research-story 由研究者直接运行，没有会话 trace">无 trace</span>`}</div></li>`)}
              </ul>
            </section>
          </div>
        </div>
      </div>`;
    },
    mount(el) {
      const svg = el.querySelector('[data-dial]');
      if (svg && DSH.views.overview._dial) DSH.charts.dial(svg, DSH.views.overview._dial);
    },
  };
})();
