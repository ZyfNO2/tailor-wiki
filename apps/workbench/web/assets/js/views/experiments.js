/* 实验：计划（EXPERIMENT-PLAN.md）、运行（runs/）、对比与审查
   计划与实际运行分标签；一个计划可以有多次 Run，失败、取消、淘汰的尝试都保留。
   对比前先看协议是否可比；不可比就写原因，不排名。缺失指标写“缺失”，不填 0；
   模拟结果单独标识。研究判定（支持 / 反驳 / 证据不足）独立于进程状态。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const META = (head, which) => ({
    head, key: which === 'runs' ? 'runs' : 'plan',
    file: which === 'runs' ? 'runs/' : 'EXPERIMENT-PLAN.md',
    skill: which === 'runs' ? '实验执行记录' : 'experiment-design',
    emptyTitle: which === 'runs' ? '还没有运行记录。' : '还没有实验计划。',
    emptyText: which === 'runs'
      ? '运行记录来自 runs/ 下每次运行的 metrics.json、日志和配置。没有运行时不显示任何指标或曲线。'
      : '实验计划由 experiment-design 写入 EXPERIMENT-PLAN.md：每行是一个待验证问题及其对照、数据划分、预算与判据。',
    error: which === 'runs' ? 'runs/R-E2-05/metrics.json 不是有效的 JSON（第 3 行多了一个逗号）。这条运行不计入，其余运行正常显示。' : 'EXPERIMENT-PLAN.md 第 42 行：表格列数与表头不一致（表头 11 列，该行 9 列）。工作台不会猜测缺失的列。',
    partial: which === 'runs' ? 'runs/ 中 1 条记录缺少 metrics.json（R-E2-04，已取消；日志截断在第 9,800 步）。其余 10 条正常显示。' : null,
  });
  function head(current) {
    const db = DSH.db();
    const p = db.p;
    const pf = p.planFile;
    return html`
      <div class="dsh-sectionbar">
        ${ui.subnav('实验', [
          { key: 'plan', zh: '计划', en: 'Plan', href: '#/experiments/plan', n: p.plans.length || null },
          { key: 'runs', zh: '运行', en: 'Runs', href: '#/experiments/runs', n: p.runs.length || null },
          { key: 'review', zh: '对比与审查', en: 'Compare & review', href: '#/experiments/review', n: db.stats.reviewChanges.length || null, alert: db.stats.reviewChanges.length > 0 },
        ], current)}
        ${p.live ? ui.facts([pf ? `${pf.path} │ ${pf.version}` : '没有 EXPERIMENT-PLAN.md', pf ? pf.at : null, `运行记录 ${p.runs.length} 条`]) : pf ? ui.facts([`${pf.path} ${pf.version}`, pf.at, `runs/ ${db.stats.runsTotal} 条`, `历史报告 ${(db.stats.runsByProv.historical || 0)} 条`, `模拟 ${(db.stats.runsByProv.simulated || 0)} 条`]) : ui.facts(['没有实验计划'])}
      </div>`;
  }
  const runsOf = (planId) => DSH.db().p.runs.filter((r) => r.plan === planId);
  const verdictOf = (pl) => { const db = DSH.db(); const rv = pl.review ? db.reviews[pl.review] : null; return rv ? rv.verdict : 'pending'; };

  /* ---------- 实时模式：计划 = 实验表的行；运行 = 指定路径里的运行记录 ---------- */
  const metricKeys = (runs) => [...new Set(runs.flatMap((x) => Object.keys(x.metrics || {})))];
  const execText = (key, text) => ui.st('exec', key, { dim: true, text: text && ui.label('exec', key) !== text ? `${ui.label('exec', key)}（${text}）` : null });
  function livePlans(p, db, open) {
    const doc = p.docs.plan || {};
    return html`
      ${ui.head({ zh: '实验计划', en: 'Plan', desc: 'EXPERIMENT-PLAN.md 实验表逐行显示，单元格原文照录。“状态”列只做识别，不据此推断运行结果；计划不等于已运行。', facts: [`${p.plans.length} 个计划`, doc.at] })}
      ${(doc.notes || []).length ? ui.notice('注意', html`${doc.notes.map((n) => html`<p>${n}</p>`)}`) : ''}
      <div class="dsh-plans">
        ${p.plans.map((pl) => {
          const runs = runsOf(pl.id);
          const task = pl.task ? db.tasks[pl.task] : null;
          return html`
          <details class="dsh-plan" id="plan-${pl.id}"${open === pl.id ? raw(' open') : ''}>
            <summary>
              <span class="dsh-plan-h">${ui.id(pl.id, open === pl.id ? 'is-here' : '')}<span class="dsh-plan-t">${pl.title}</span><span class="dsh-chiprow">${execText(pl.exec, pl.statusText)}</span></span>
              <span class="dsh-plan-m ef-field"><span>${pl.scheme ? '方案 ' + pl.scheme : '未关联方案'}</span><span>${runs.length ? `运行记录 ${runs.length} 条` : '没有运行记录'}</span><span>EXPERIMENT-PLAN.md ${pl.line}</span></span>
              <span class="dsh-plan-x" aria-hidden="true">${icon('chev-d')}</span>
            </summary>
            <div class="dsh-plan-body">
              <p class="ef-read dsh-plan-q"><b>验证问题 / 变体：</b>${pl.question}</p>
              <div class="dsh-plan-grid">
                ${ui.kv([
                  ['数据与配置', ui.val(pl.config)],
                  ['依赖', pl.depsText ? html`${pl.depsText}${pl.deps.length ? html`<div>${ui.refs(pl.deps.map((x) => 'task:' + x), { idOnly: true })}</div>` : ''}` : ui.val(null)],
                  ['预算', ui.val(pl.budget)],
                ])}
                ${ui.kv([
                  ['指标与判定', ui.val(pl.criteria)],
                  ['产物位置', pl.artifacts.length ? html`${pl.artifacts.map((a) => ui.path(a, { copy: false }))}` : ui.val(null)],
                  ['状态原文', ui.val(pl.statusText)],
                ])}
              </div>
              <p class="ef-actions">
                ${ui.btn(`查看 ${runs.length} 条运行记录`, { act: 'go', data: { href: DSH.href('/experiments/runs', { plan: pl.id }) }, disabled: !runs.length })}
                ${pl.scheme ? ui.btn('方案 ' + pl.scheme, { act: 'open', data: { ref: 'scheme:' + pl.scheme } }) : ''}
                ${task ? ui.btn('任务 ' + task.id, { act: 'open', data: { ref: 'task:' + task.id } }) : ''}
              </p>
            </div>
          </details>`;
        })}
      </div>
      ${p.plans.length ? '' : html`<p class="ef-empty">实验表里没有可识别的行。</p>`}
      ${doc.html ? html`<details class="dsh-docbox"><summary>${icon('file')}EXPERIMENT-PLAN.md 原文</summary>${ui.md(doc.html)}</details>` : ''}`;
  }
  function liveRuns(p, r) {
    const f = DSH.vs('runs-f', () => ({ status: new Set(), prov: new Set() }));
    const plan = r.query.plan || 'all';
    const rows = p.runs.filter((x) => (plan === 'all' || x.plan === plan) && (!f.status.size || f.status.has(x.status)) && (!f.prov.size || f.prov.has(x.prov)));
    const keys = metricKeys(p.runs).slice(0, 5);
    const statuses = [...new Set(p.runs.map((x) => x.status))], provs = [...new Set(p.runs.map((x) => x.prov))];
    const planIds = [...new Set(p.runs.map((x) => x.plan).filter(Boolean))];
    return html`
      ${ui.head({ zh: '运行记录', en: 'Runs', desc: '来自启动时 --paths 指定目录里的运行记录（JSON）。每条记录原样保留；没有写的字段显示未记录，指标不填 0，性质没标注就显示未标注。', facts: [`显示 ${rows.length} / ${p.runs.length} 条`] })}
      <div class="dsh-filters">
        <div class="dsh-filter"><span class="ef-eyebrow">Plan</span>${ui.chips([{ key: 'all', label: '全部', n: p.runs.length, on: plan === 'all' }].concat(planIds.map((id) => ({ key: id, label: id, n: runsOf(id).length, on: plan === id }))), 'runs-plan', { label: '按计划' })}</div>
        <div class="dsh-filter"><span class="ef-eyebrow">Status</span>${ui.chips(statuses.map((k) => ({ key: k, label: ui.label('exec', k), n: p.runs.filter((x) => x.status === k).length, on: f.status.has(k) })), 'runs-status', { label: '按执行状态' })}</div>
        <div class="dsh-filter"><span class="ef-eyebrow">Source</span>${ui.chips(provs.map((k) => ({ key: k, label: ui.label('prov', k), n: p.runs.filter((x) => x.prov === k).length, on: f.prov.has(k) })), 'runs-prov', { label: '按数据性质' })}</div>
      </div>
      <div class="ef-table-wrap">
        <table class="ef-table dsh-runs">
          <thead><tr><th>运行</th><th>计划</th><th>变体</th><th class="num">种子</th><th>性质</th><th>执行</th>${keys.map((k) => html`<th class="num">${k}</th>`)}<th>开始</th><th>说明 / 首个错误</th></tr></thead>
          <tbody>${rows.map((x) => html`<tr class="is-${x.prov} is-${x.status}">
            <td>${ui.ref('run:' + x.id, { idOnly: true })}</td>
            <td>${x.plan ? ui.ref('plan:' + x.plan, { idOnly: true }) : html`<span class="muted">未写</span>`}</td>
            <td>${x.variant}</td><td class="num">${x.seed}</td>
            <td>${ui.st('prov', x.prov)}</td>
            <td>${execText(x.status, x.statusText)}</td>
            ${keys.map((k) => html`<td class="num">${x.metrics && x.metrics[k] != null ? String(x.metrics[k]) : html`<span class="dsh-missing" title="记录里没有这一项，不填 0">—</span>`}</td>`)}
            <td class="ef-field">${x.at}</td>
            <td class="dsh-runs-note">${x.firstError ? html`<code>${x.firstError.text.slice(0, 60)}</code>` : x.note || ''}</td>
          </tr>`)}</tbody>
        </table>
      </div>
      ${rows.length ? '' : html`<p class="ef-empty">没有符合筛选条件的运行记录。</p>`}
      ${metricKeys(p.runs).length > keys.length ? html`<p class="dsh-note">表中只列前 ${keys.length} 个指标；点运行编号查看全部原始指标。</p>` : ''}`;
  }
  function liveReview(p, db, r) {
    const id = r.params.id && db.plans[r.params.id] ? r.params.id : (p.plans[0] || {}).id;
    if (!id) return ui.empty({ title: '没有实验计划，因此没有可对比的内容。', text: '对比与审查以 EXPERIMENT-PLAN.md 中的计划为单位。' });
    const plan = db.plans[id];
    const runs = runsOf(id);
    const keys = metricKeys(runs);
    DSH.state.pageLabel = '对比与审查 │ ' + id;
    return html`
      ${ui.head({ zh: '对比与审查', en: 'Compare & review', desc: '工作台不自行比较或判定：协议是否可比、假设是否成立，只来自审查记录。没有审查记录时保持待验证。' })}
      <div class="dsh-toolbar"><span class="ef-eyebrow">Plan</span>${ui.chips(p.plans.map((pl) => ({ key: pl.id, label: pl.id, on: pl.id === id })), 'rv-plan', { label: '选择计划' })}</div>
      <div class="dsh-rv-q">
        <p class="dsh-ids">${ui.id(id, 'is-here')}${plan.scheme ? ui.ref('scheme:' + plan.scheme) : ''}</p>
        <h1 class="dsh-title ef-read">${plan.title}</h1>
        <p class="ef-lede ef-read">${plan.question}</p>
      </div>
      <div class="dsh-cols is-rv">
        <div class="dsh-stackcol">
          <section class="ef-panel">
            <h2>${ui.pair('Runs', '这个计划的运行记录')} <small>${runs.length} 条</small></h2>
            ${runs.length ? html`<div class="ef-table-wrap"><table class="ef-table dsh-table-tight"><thead><tr><th>运行</th><th>变体</th><th>性质</th><th>执行</th>${keys.map((k) => html`<th class="num">${k}</th>`)}</tr></thead><tbody>${runs.map((x) => html`<tr><td>${ui.ref('run:' + x.id, { idOnly: true })}</td><td>${x.variant}</td><td>${ui.st('prov', x.prov)}</td><td>${execText(x.status, x.statusText)}</td>${keys.map((k) => html`<td class="num">${x.metrics && x.metrics[k] != null ? String(x.metrics[k]) : html`<span class="dsh-missing">—</span>`}</td>`)}</tr>`)}</tbody></table></div><p class="dsh-note">只列原始值，不计算差值或区间：比较口径要由审查记录确定。</p>`
              : ui.empty({ title: `${id} 没有运行记录。`, text: '没有运行时不显示指标，也不画预估曲线。' })}
          </section>
        </div>
        <div class="dsh-stackcol">
          <section class="ef-panel">
            <h2>${ui.pair('Review', '审查结论')}</h2>
            ${ui.empty({ title: '没有读到审查记录。', text: '审查记录接入后会显示协议是否可比与研究判定；在此之前判定保持“待验证”。' })}
            <p class="dsh-chiprow">${ui.st('verdict', 'pending', { dim: true })}</p>
          </section>
          <section class="ef-panel">
            <h2>${ui.pair('Plan', '判据（原文）')}</h2>
            ${ui.ledger([['指标与判定', plan.criteria || '未记录'], ['预算', plan.budget || '未记录'], ['状态原文', plan.statusText || '未记录']])}
            <p class="ef-actions dsh-mt-s">${ui.btn('计划全文', { act: 'go', data: { href: DSH.href('/experiments/plan', { open: id, focus: 'plan-' + id }) } })}</p>
          </section>
        </div>
      </div>`;
  }

  /* ---------- 计划 ---------- */
  function matrix() {
    const db = DSH.db();
    const cell = (pid, label) => {
      const pl = db.plans[pid];
      const runs = runsOf(pid);
      const real = runs.filter((r) => r.prov === 'current' && r.status === 'done').length;
      const sim = runs.filter((r) => r.prov === 'simulated').length;
      return html`<a class="dsh-mx-cell" href="${DSH.href('/experiments/plan', { open: pid, focus: 'plan-' + pid })}">
        <span class="dsh-mx-v">${label}</span>
        <span class="ef-field">${pid} │ ${real ? `真实运行 ${real}` : sim ? `只有模拟 ${sim}` : '未运行'}</span>
        ${ui.st('verdict', verdictOf(pl))}
      </a>`;
    };
    return html`
      <section class="ef-panel dsh-matrix-panel">
        <h2>${ui.pair('Ablation grid', '消融矩阵')} <small>这个方案族的示例；不对所有方案强制四格</small></h2>
        <div class="dsh-matrix" role="table" aria-label="模块 b 与模块 c 的组合">
          <div role="row" class="dsh-mx-h"><span role="columnheader"></span><span role="columnheader" class="ef-eyebrow">不加 c</span><span role="columnheader" class="ef-eyebrow">加 c</span></div>
          <div role="row"><span role="rowheader" class="ef-eyebrow">不加 b</span><span role="cell">${cell('E1', 'A')}</span><span role="cell">${cell('E3', 'A + c')}</span></div>
          <div role="row"><span role="rowheader" class="ef-eyebrow">加 b</span><span role="cell">${cell('E2', 'A + b')}</span><span role="cell">${cell('E4', 'A + b + c')}</span></div>
        </div>
      </section>`;
  }
  DSH.views['exp-plan'] = {
    title: () => '实验计划',
    render(r) {
      const db = DSH.db();
      const p = db.p;
      const h = head('plan');
      return ui.withState(META(h, 'plan'), (banner) => {
        DSH.state.pageLabel = '实验计划';
        const open = r.query.open;
        if (p.live) return html`${h}<div class="dsh-page">${banner}${livePlans(p, db, open)}</div>`;
        return html`
        ${h}
        <div class="dsh-page">
          ${banner}
          ${ui.head({ zh: '实验计划', en: 'Plan', desc: '每个计划是一个待验证的问题：变体与对照、数据划分、配置、依赖、主指标、保护指标、预算、成功与失败条件、预期产物。', facts: [`${p.planFile.path} ${p.planFile.version}`, `最近变更：${p.planFile.change}`] })}
          ${matrix()}
          <div class="dsh-plans">
            ${p.plans.map((pl) => {
              const runs = runsOf(pl.id);
              const byS = runs.reduce((m, x) => ((m[x.status] = (m[x.status] || 0) + 1), m), {});
              const rv = pl.review ? db.reviews[pl.review] : null;
              const task = pl.task ? db.tasks[pl.task] : null;
              return html`
              <details class="dsh-plan" id="plan-${pl.id}"${open === pl.id ? raw(' open') : ''}>
                <summary>
                  <span class="dsh-plan-h">
                    ${ui.id(pl.id, open === pl.id ? 'is-here' : '')}
                    <span class="dsh-plan-t">${pl.title}</span>
                    <span class="dsh-chiprow">${task ? ui.st('exec', task.exec, { dim: true }) : html`<span class="st st--dash st--mute"><span class="st-v">没有对应任务</span></span>`}${rv ? ui.st('review', rv.status, { dim: true }) : ''}${ui.st('verdict', verdictOf(pl), { dim: true })}</span>
                  </span>
                  <span class="dsh-plan-m ef-field">
                    <span>${pl.hypothesis ? '检验 ' + pl.hypothesis : '不对应假设'}</span>
                    <span>${pl.scheme ? '方案 ' + pl.scheme : '基线'}</span>
                    <span>${runs.length ? `运行 ${runs.length} 次：${Object.entries(byS).map(([k, v]) => ui.label('exec', k) + ' ' + v).join('、')}` : '尚无运行'}</span>
                    <span>${pl.line}</span>
                  </span>
                  <span class="dsh-plan-x" aria-hidden="true">${icon('chev-d')}</span>
                </summary>
                <div class="dsh-plan-body">
                  <p class="ef-read dsh-plan-q"><b>待验证问题：</b>${pl.question}</p>
                  ${pl.conditional ? ui.notice('条件', html`<p>${pl.conditional}。</p>`) : ''}
                  <div class="dsh-plan-grid">
                    ${ui.kv([
                      ['变体 / 对照', html`${pl.variants.map((v) => html`<span class="dsh-kv-static"><span>${v.role}</span><span>${v.key}</span></span>`)}<div class="dsh-note">对照来源：${pl.control}</div>`],
                      ['数据划分', pl.split],
                      ['种子', pl.seeds],
                      ['配置', ui.path(pl.config)],
                      ['依赖', ui.refs(pl.deps.map((x) => 'task:' + x), { idOnly: true })],
                      ['预算', pl.budget],
                    ])}
                    ${ui.kv([
                      ['主指标', html`<b>${pl.primary.name}</b> <span class="ef-field">${pl.primary.dir === 'up' ? '越高越好' : '越低越好'}</span><div class="dsh-note">${pl.primary.def}；${pl.primary.agg}</div>`],
                      ['保护指标', pl.guards.length ? html`<ul class="dsh-ul">${pl.guards.map((g) => html`<li><b>${g.name}</b>：${g.rule}</li>`)}</ul>` : html`<span class="muted">无</span>`],
                      ['成功条件', pl.success],
                      ['失败条件', pl.failure],
                      ['预期产物', html`${pl.artifacts.map((a) => ui.path(a))}`],
                    ])}
                  </div>
                  <p class="ef-actions">
                    ${ui.btn(`查看 ${runs.length} 次运行`, { act: 'go', data: { href: DSH.href('/experiments/runs', { plan: pl.id }) }, disabled: !runs.length })}
                    ${ui.btn('对比与审查', { act: 'go', data: { href: '#/experiments/review/' + pl.id } })}
                    ${pl.scheme ? ui.btn('方案 ' + pl.scheme, { act: 'open', data: { ref: 'scheme:' + pl.scheme } }) : ''}
                    ${task ? ui.btn('任务 ' + task.id, { act: 'open', data: { ref: 'task:' + task.id } }) : ''}
                  </p>
                </div>
              </details>`;
            })}
          </div>
        </div>`;
      });
    },
    mount(el, r) { if (r.query.focus) DSH.flash(r.query.focus); },
  };

  /* ---------- 运行 ---------- */
  const RUN_STATUS = ['done', 'running', 'failed', 'cancelled', 'abandoned', 'na'];
  const PROV = ['current', 'historical', 'simulated'];
  DSH.views['exp-runs'] = {
    title: () => '运行记录',
    render(r) {
      const db = DSH.db();
      const p = db.p;
      const h = head('runs');
      return ui.withState(META(h, 'runs'), (banner) => {
        DSH.state.pageLabel = '运行记录';
        if (p.live) return html`${h}<div class="dsh-page">${banner}${liveRuns(p, r)}</div>`;
        const f = DSH.vs('runs-f', () => ({ status: new Set(), prov: new Set() }));
        const plan = r.query.plan || 'all';
        const rows = p.runs.filter((x) => (plan === 'all' || x.plan === plan) && (!f.status.size || f.status.has(x.status)) && (!f.prov.size || f.prov.has(x.prov)));
        const M = DSH.METRIC;
        const cell = (x, k) => {
          if (x.metrics && x.metrics[k] != null) return html`${DSH.fmt.n(x.metrics[k], M[k].d)}`;
          if (x.status === 'running' && k === 'recall_thin' && x.interim) return html`<span class="dsh-missing" title="中间值，不参与比较">${DSH.fmt.n(x.interim.recall_thin, 3)}*</span>`;
          const why = x.status === 'failed' ? '运行失败' : x.status === 'cancelled' ? '已取消' : x.status === 'running' ? '运行中' : '未记录';
          return html`<span class="dsh-missing" title="缺失：${why}，不填 0">— ${why}</span>`;
        };
        return html`
        ${h}
        <div class="dsh-page">
          ${banner}
          ${ui.head({ zh: '运行记录', en: 'Runs', desc: '每一次运行都保留，包括失败、取消和淘汰的尝试。缺失的指标写明原因，不填 0；历史报告和模拟运行单独标识，不当作本轮实验。', facts: [`显示 ${rows.length} / ${p.runs.length} 条`] })}
          <div class="dsh-filters">
            <div class="dsh-filter"><span class="ef-eyebrow">Plan</span>${ui.chips([{ key: 'all', label: '全部', n: p.runs.length, on: plan === 'all' }].concat(p.plans.map((pl) => ({ key: pl.id, label: pl.id, n: runsOf(pl.id).length, on: plan === pl.id }))), 'runs-plan', { label: '按计划' })}</div>
            <div class="dsh-filter"><span class="ef-eyebrow">Status</span>${ui.chips(RUN_STATUS.map((k) => ({ key: k, label: ui.label('exec', k), n: p.runs.filter((x) => x.status === k).length, on: f.status.has(k) })), 'runs-status', { label: '按执行状态' })}</div>
            <div class="dsh-filter"><span class="ef-eyebrow">Source</span>${ui.chips(PROV.map((k) => ({ key: k, label: ui.label('prov', k), n: p.runs.filter((x) => x.prov === k).length, on: f.prov.has(k) })), 'runs-prov', { label: '按数据性质' })}</div>
          </div>
          <div class="ef-table-wrap">
            <table class="ef-table dsh-runs">
              <thead><tr><th>运行</th><th>计划</th><th>变体</th><th class="num">种子</th><th>性质</th><th>执行</th><th class="num">细裂缝召回</th><th class="num">mIoU</th><th>开始</th><th>时长</th><th>说明 / 首个错误</th></tr></thead>
              <tbody>${rows.map((x) => html`<tr class="is-${x.prov} is-${x.status}">
                <td>${ui.ref('run:' + x.id, { idOnly: true })}</td>
                <td>${ui.ref('plan:' + x.plan, { idOnly: true })}</td>
                <td>${x.variant}</td>
                <td class="num">${x.seed}</td>
                <td>${ui.st('prov', x.prov)}</td>
                <td>${ui.st('exec', x.status)}</td>
                <td class="num">${cell(x, 'recall_thin')}</td>
                <td class="num">${cell(x, 'miou')}</td>
                <td class="ef-field">${x.at}</td>
                <td class="ef-field">${x.dur}</td>
                <td class="dsh-runs-note">${x.firstError ? html`<code>${x.firstError.text.slice(0, 48)}…</code>` : x.cancelReason || x.abandonReason || x.note || (x.status === 'running' ? `第 ${DSH.fmt.n(x.progress.step)} / ${DSH.fmt.n(x.progress.total)} 步；* 为中间值` : '')}</td>
              </tr>`)}</tbody>
            </table>
          </div>
          ${rows.length ? '' : html`<p class="ef-empty">没有符合筛选条件的运行。</p>`}
          <p class="dsh-note">* 中间验证值只表示进度，不参与比较。点运行编号查看代码与数据版本、资源、配置、日志、原始指标、产物和首个错误。</p>
        </div>`;
      });
    },
  };
  DSH.on('runs-plan', (el) => DSH.go(DSH.href('/experiments/runs', { plan: el.dataset.key === 'all' ? null : el.dataset.key }), { replace: true }));
  const toggleSet = (set, k) => (set.has(k) ? set.delete(k) : set.add(k));
  DSH.on('runs-status', (el) => { toggleSet(DSH.vs('runs-f', {}).status, el.dataset.key); DSH.render(); });
  DSH.on('runs-prov', (el) => { toggleSet(DSH.vs('runs-f', {}).prov, el.dataset.key); DSH.render(); });

  /* ---------- 对比与审查 ---------- */
  const valid = (r) => r.prov === 'current' && r.status === 'done';
  function protoTable(rows, verdict) {
    return html`
      <table class="ef-table dsh-protocol">
        <thead><tr><th>协议项</th><th>对照</th><th>变体 / 被比较方</th><th>是否一致</th></tr></thead>
        <tbody>${rows.map((x) => html`<tr><td><b>${x.zh}</b></td><td>${x.a}</td><td>${x.b}</td><td>${x.ok === true ? ui.st('check', 'pass', { text: '一致' }) : x.ok === false ? ui.st('check', 'fail', { text: '不一致' }) : ui.st('verdict', 'verifying')}${x.why ? html`<div class="dsh-note">${x.why}</div>` : ''}</td></tr>`)}</tbody>
      </table>
      <p class="dsh-chiprow dsh-mt-s">${verdict}</p>`;
  }
  function reviewPanel(rv, plan) {
    const db = DSH.db();
    const task = plan.task ? db.tasks[plan.task] : null;
    return html`
      <section class="ef-panel" id="rv-${rv.id}">
        <h2>${ui.pair('Review', '审查结论')} <small>${ui.path(rv.file)}</small></h2>
        <div class="dsh-three-states" aria-label="三个互相独立的状态">
          <div><p class="ef-eyebrow">Process / 进程</p>${task ? ui.st('exec', task.exec, { dim: true }) : '—'}<p class="dsh-note">运行有没有跑完</p></div>
          <div><p class="ef-eyebrow">Review / 审查</p>${ui.st('review', rv.status, { dim: true })}<p class="dsh-note">结果能不能当证据用</p></div>
          <div><p class="ef-eyebrow">Verdict / 判定</p>${ui.st('verdict', rv.verdict, { dim: true })}<p class="dsh-note">假设 ${rv.hypothesis} 是否成立</p></div>
        </div>
        <p class="ef-read">${rv.rationale}</p>
        ${rv.next.length ? html`<h3 class="dsh-sec-h">${ui.pair('Next', '审查要求')}</h3><ul class="dsh-ul ef-read">${rv.next.map((n) => html`<li>${n}</li>`)}</ul>` : ''}
        ${ui.ledger([['审查人', ui.member(rv.by)], ['时间', rv.at], ['结论', ui.ref('concl:' + rv.conclusion)], ['假设', ui.ref('hyp:' + rv.hypothesis)]])}
        <p class="dsh-note">执行成功不等于假设成立；判定只来自审查记录，不从运行状态推断。</p>
      </section>`;
  }
  function excluded(planId, ids) {
    const db = DSH.db();
    const rows = db.p.runs.filter((r) => r.plan === planId && !ids.includes(r.id));
    if (!rows.length) return '';
    return html`
      <section class="ef-panel">
        <h2>${ui.pair('Not compared', '没有参与比较的运行')} <small>${rows.length} 条，全部保留</small></h2>
        <ul class="ef-rows">${rows.map((r) => html`<li><div><div>${ui.ref('run:' + r.id, { idOnly: true })} ${ui.st('exec', r.status)} ${ui.st('prov', r.prov)}</div><div class="meta"><span>${r.firstError ? '首个错误：' + r.firstError.text.slice(0, 60) + '…' : r.cancelReason || r.abandonReason || r.note || (r.status === 'running' ? '运行中，只有中间值' : '')}</span></div></div></li>`)}</ul>
      </section>`;
  }
  function e2Compare(plan) {
    const db = DSH.db();
    const S = DSH.stat;
    const A = db.p.runs.filter((r) => r.plan === 'E1' && valid(r));
    const B = db.p.runs.filter((r) => r.plan === 'E2' && valid(r) && r.variant === 'A+b');
    const v = (rs, k, mul = 1) => rs.map((r) => r.metrics[k] * mul);
    const wT = S.welch(v(A, 'recall_thin', 100), v(B, 'recall_thin', 100));
    const wA = S.welch(v(A, 'recall_all', 100), v(B, 'recall_all', 100));
    const wM = S.welch(v(A, 'miou'), v(B, 'miou'));
    const crosses = (w) => w.lo < 0 && w.hi > 0;
    const latA = A.find((r) => r.metrics.latency_ms), latB = B.find((r) => r.metrics.latency_ms);
    const rel = latB.metrics.latency_ms / latA.metrics.latency_ms - 1;
    const sub = `n = ${A.length} 对 ${B.length} │ Welch t 区间`;
    return html`
      <section class="ef-panel">
        <h2>${ui.pair('Comparability', '协议是否可比')} <small>A（${A.map((r) => r.id).join('、')}）对 A+b（${B.map((r) => r.id).join('、')}）</small></h2>
        ${protoTable([
          { zh: '指标定义', a: 'eval_v2 像素级', b: 'eval_v2 像素级', ok: true },
          { zh: '指标方向', a: '越高越好', b: '越高越好', ok: true },
          { zh: '聚合方式', a: '3 个种子均值', b: '3 个种子均值', ok: true },
          { zh: '数据划分', a: 'bridge-crack-v2@7c1e2d', b: 'bridge-crack-v2@7c1e2d', ok: true },
          { zh: '预算', a: '40k 步', b: '40k 步', ok: true, why: '固定步数；固定时长的口径见问题 Q-05' },
          { zh: '数据加载顺序', a: 'a1c9e04（未固定种子）', b: 'R-E2-05 起 c03f5a8（已固定）', ok: null, why: '审查要求确认这一修复对 A 组没有影响' },
        ], html`${ui.st('check', 'pass', { text: '可比' })}${ui.st('verdict', 'verifying', { text: '1 项待核实' })}<span class="dsh-note">满足比较条件，但带着一项待核实；所以下面的差值要和审查意见一起读。</span>`)}
      </section>
      <section class="ef-panel">
        <h2>${ui.pair('Results', '结果')} <small>示例数值 │ 变体减对照</small></h2>
        ${DSH.charts.forest({
          id: 'fp-e2', title: 'A+b 相对 A 的差值', unit: '个百分点',
          domain: [-3, 6], ticks: [-2, 0, 2, 4, 6],
          rows: [
            { label: '细裂缝召回（主指标）', sub: '越高越好 │ ' + sub, diff: wT.diff, lo: wT.lo, hi: wT.hi, verdict: crosses(wT) ? '区间跨 0：证据不足' : '区间不跨 0', tipExtra: sub },
            { label: '整体召回', sub: '越高越好 │ ' + sub, diff: wA.diff, lo: wA.lo, hi: wA.hi, verdict: crosses(wA) ? '区间跨 0' : '区间不跨 0', tipExtra: sub },
            { label: 'mIoU（保护指标）', sub: '阈值：平均下降不超过 1.0 │ ' + sub, diff: wM.diff, lo: wM.lo, hi: wM.hi, threshold: -1.0, flagAt: wM.lo < -1.0 ? wM.lo : null, verdict: wM.diff > -1 ? (wM.lo < -1 ? '均值未破线；区间下界越过 −1.0' : '未破线') : '已破线', tipExtra: '虚线为保护阈值 −1.0' },
          ],
          caption: '负的差值会照样画在 0 的左边；种子只有 3 个，区间很宽，这正是审查判为“证据不足”的原因。',
        })}
        ${DSH.charts.seeds({
          title: '细裂缝召回：每个种子', unit: '召回',
          domain: [0.58, 0.66], ticks: [0.58, 0.6, 0.62, 0.64, 0.66],
          groups: [
            { label: 'A（对照）', values: A.map((r) => ({ v: r.metrics.recall_thin, run: r.id, seed: r.seed })) },
            { label: 'A+b（变体）', emph: true, values: B.map((r) => ({ v: r.metrics.recall_thin, run: r.id, seed: r.seed })) },
          ],
          caption: '对照为灰色，变体为墨色（深色主题里为黄色）。',
        })}
        ${DSH.charts.single({
          title: '推理延迟', unit: 'ms', limitLabel: '保护阈值（≤ +15%）',
          rows: [
            { label: 'A', run: latA.id, v: latA.metrics.latency_ms, rel: null, limitNote: '对照' },
            { label: 'A+b', run: latB.id, v: latB.metrics.latency_ms, rel, limitNote: rel <= 0.15 ? `未破线（${DSH.fmt.signed(rel * 100, 1)}%，接近上限）` : '已破线', over: rel > 0.12 },
          ],
        })}
      </section>
      ${excluded('E2', B.map((r) => r.id))}`;
  }
  function e1Compare() {
    const db = DSH.db();
    const A = db.p.runs.filter((r) => r.plan === 'E1' && valid(r));
    const H = db.runs['R-E1-H'];
    return html`
      <section class="ef-panel">
        <h2>${ui.pair('Comparability', '协议是否可比')} <small>本轮 3 次运行对历史报告</small></h2>
        ${protoTable([
          { zh: '指标定义', a: '像素级（eval_v2）', b: '实例级（IoU ≥ 0.5）', ok: false },
          { zh: '数据划分', a: '固定划分 v2', b: '随机划分 v1', ok: false },
          { zh: '预算', a: '40k 步', b: '报告未写明', ok: false, why: '未知不等于一致' },
          { zh: '聚合方式', a: '3 个种子均值 ± 标准差', b: '单次结果', ok: false },
        ], html`${ui.st('check', 'fail', { text: '不可比' })}<span class="dsh-note">不生成差值或排名。历史报告的 ${H.metrics.recall_thin} 只作背景，见下方。</span>`)}
      </section>
      <section class="ef-panel">
        <h2>${ui.pair('Results', '结果')} <small>示例数值 │ 只看本轮 3 次运行</small></h2>
        ${DSH.charts.seeds({
          title: '基线 A：细裂缝召回与整体召回', unit: '召回',
          domain: [0.55, 0.9], ticks: [0.55, 0.6, 0.7, 0.8, 0.9],
          groups: [
            { label: '整体召回', values: A.map((r) => ({ v: r.metrics.recall_all, run: r.id, seed: r.seed })) },
            { label: '细裂缝召回', emph: true, values: A.map((r) => ({ v: r.metrics.recall_thin, run: r.id, seed: r.seed })) },
          ],
          caption: '成功条件：细裂缝召回 < 0.65，且比整体召回低 ≥ 0.15。',
        })}
        <div class="dsh-hist">
          <p class="dsh-chiprow">${ui.st('prov', 'historical')}${ui.ref('run:R-E1-H', { idOnly: true })}</p>
          <p>历史报告：细裂缝召回 ${H.metrics.recall_thin}、整体召回 ${H.metrics.recall_all}（实例级、随机划分）。协议不同，不和本轮放进同一张图。</p>
        </div>
      </section>`;
  }
  function onlySim(planId) {
    const db = DSH.db();
    const sims = db.p.runs.filter((r) => r.plan === planId && r.prov === 'simulated');
    return html`
      <section class="ef-panel">
        <h2>${ui.pair('Results', '结果')}</h2>
        ${ui.empty({ title: '没有真实运行，因此没有对比图。', text: '不显示估计的曲线。真实运行等待依赖完成后才会出现。' })}
        ${sims.map((s) => html`
          <div class="dsh-simbox">
            <p class="dsh-chiprow">${ui.st('prov', 'simulated')}${ui.ref('run:' + s.id, { idOnly: true })}<span class="dsh-note">单独显示，不参与判定</span></p>
            <p>${s.note}。数据：${s.data}；配置：${s.config}。</p>
            ${ui.ledger(Object.entries(s.metrics).map(([k, v]) => [DSH.METRIC[k].zh, String(v)]))}
          </div>`)}
      </section>`;
  }
  DSH.views['exp-review'] = {
    title: (r) => '对比与审查' + (r.params.id ? ' ' + r.params.id : DSH.live() ? '' : ' E2'),
    render(r) {
      const db = DSH.db();
      const h = head('review');
      return ui.withState(META(h, 'review'), (banner) => {
        const p = db.p;
        if (p.live) return html`${h}<div class="dsh-page">${banner}${liveReview(p, db, r)}</div>`;
        const id = r.params.id && db.plans[r.params.id] ? r.params.id : 'E2';
        const plan = db.plans[id];
        const rv = plan.review ? db.reviews[plan.review] : null;
        const task = plan.task ? db.tasks[plan.task] : null;
        DSH.state.pageLabel = '对比与审查 │ ' + id;
        const runs = runsOf(id);
        let body;
        if (id === 'E2') body = e2Compare(plan);
        else if (id === 'E1') body = e1Compare();
        else if (runs.some((x) => x.prov === 'simulated')) body = onlySim(id);
        else body = html`<section class="ef-panel"><h2>${ui.pair('Results', '结果')}</h2>${ui.empty({ title: `${id} 还没有任何运行。`, text: plan.conditional ? plan.conditional + '。' : `${id} 依赖 ${plan.deps.join('、')}；${task ? '对应任务 ' + task.id + ' 当前为“' + ui.label('exec', task.exec) + '”。' : ''}没有运行时不显示指标，也不画预估曲线。` })}</section>`;
        return html`
        ${h}
        <div class="dsh-page">
          ${banner}
          ${ui.head({ zh: '对比与审查', en: 'Compare & review', desc: '先确认协议是否可比，再看结果；研究判定只来自审查，独立于运行是否成功。' })}
          <div class="dsh-toolbar"><span class="ef-eyebrow">Plan</span>${ui.chips(p.plans.map((pl) => ({ key: pl.id, label: pl.id + ' ' + pl.title.split('：')[0], on: pl.id === id })), 'rv-plan', { label: '选择计划' })}</div>
          <div class="dsh-rv-q">
            <p class="dsh-ids">${ui.id(id, 'is-here')}${plan.hypothesis ? ui.ref('hyp:' + plan.hypothesis) : ''}${plan.scheme ? ui.ref('scheme:' + plan.scheme) : ''}</p>
            <h1 class="dsh-title ef-read">${plan.title}</h1>
            <p class="ef-lede ef-read">${plan.question}</p>
          </div>
          <div class="dsh-cols is-rv">
            <div class="dsh-stackcol">${body}</div>
            <div class="dsh-stackcol">
              ${rv ? reviewPanel(rv, plan) : html`<section class="ef-panel"><h2>${ui.pair('Review', '审查结论')}</h2>${ui.empty({ title: '还没有审查记录。', text: '审查记录写在 reviews/ 下；没有审查时，研究判定保持“待验证”。' })}<p class="dsh-chiprow">${ui.st('verdict', 'pending', { dim: true })}</p></section>`}
              <section class="ef-panel">
                <h2>${ui.pair('Plan', '判据')}</h2>
                ${ui.ledger([['主指标', plan.primary.name], ['成功条件', plan.success], ['失败条件', plan.failure], ['预算', plan.budget]])}
                <p class="ef-actions dsh-mt-s">${ui.btn('计划全文', { act: 'go', data: { href: DSH.href('/experiments/plan', { open: id, focus: 'plan-' + id }) } })}${ui.btn('全部运行', { act: 'go', data: { href: DSH.href('/experiments/runs', { plan: id }) } })}</p>
              </section>
            </div>
          </div>
        </div>`;
      });
    },
  };
  DSH.on('rv-plan', (el) => DSH.go('#/experiments/review/' + el.dataset.key));
})();
