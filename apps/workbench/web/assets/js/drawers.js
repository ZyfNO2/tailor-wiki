/* DSH 研究工作台 · drawers.js
   ---------------------------------------------------------------------------
   对象详情面板：Run、任务、成员、来源、引用、trace、冲突、产物。
   自然语言与标题在前；ID、hash、字节范围、原始 trace 放在“技术信息”里，默认收起。
   所有操作只读；会改变真实状态的操作只画出位置并标明“后置”。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  const D = (DSH.drawers = {});

  const METRIC = {
    recall_thin: { zh: '细裂缝召回', dir: 'up', d: 3 },
    recall_all: { zh: '整体召回', dir: 'up', d: 3 },
    miou: { zh: 'mIoU', dir: 'up', d: 1 },
    latency_ms: { zh: '推理延迟（ms）', dir: 'down', d: 1 },
    peak_mem: { zh: '峰值显存（GB）', dir: 'down', d: 1 },
    breaks: { zh: '长裂缝断裂段数', dir: 'down', d: 1 },
  };
  DSH.METRIC = METRIC;
  const sec = (zh, en, body, id) => html`<section class="dsh-sec"${id ? raw(` id="${id}"`) : ''}><h3 class="dsh-sec-h">${ui.pair(en, zh)}</h3>${body}</section>`;
  const tech = (rows) => html`<details class="dsh-tech"><summary>${icon('hash')}技术信息</summary>${ui.kv(rows)}</details>`;
  const later = (items) => html`
    <div class="dsh-later" aria-label="后置操作，本轮不提供">
      <p class="ef-eyebrow slash">Later</p>
      <p>以下操作会改变真实状态，本轮只标出位置，不提供：</p>
      <p class="ef-actions">${items.map((t) => ui.btn(t, { disabled: true, title: '后置：本轮只读，不提供此操作' }))}</p>
    </div>`;

  /* ---------- Run ---------- */
  function runLog(r) {
    const L = [];
    if (r.live || r.prov === 'historical') return null;
    L.push(`[${r.at}] start ${r.id} variant=${r.variant} seed=${r.seed} code=${r.code}`);
    L.push(`[config] ${r.config}`);
    if (r.status === 'failed') {
      L.push('[step 1000/40000] loss 0.618');
      L.push(`[step 1240/40000] ${r.firstError.text}`);
      L.push('[exit] code 1');
    } else if (r.status === 'cancelled') {
      L.push('[step 9000/40000] loss 0.231');
      L.push('[step 9800/40000] SIGTERM received');
      L.push('（日志在此截断；没有 metrics.json）');
    } else if (r.status === 'running') {
      L.push('[step 15000/40000] val recall_thin 0.590 (interim)');
      L.push(`[step ${r.progress.step}/${r.progress.total}] heartbeat`);
    } else if (r.metrics) {
      L.push('[step 40000/40000] loss 0.142');
      L.push(`[eval] recall_thin ${r.metrics.recall_thin}${r.metrics.miou ? ' miou ' + r.metrics.miou : ''}`);
      L.push('[exit] code 0');
    }
    return L.join('\n');
  }
  D.run = (id) => {
    const db = DSH.db();
    const r = db.runs[id];
    const plan = db.plans[r.plan] || {};
    const review = plan.review ? db.reviews[plan.review] : null;
    const banner =
      r.prov === 'historical' ? ui.notice('历史报告', html`<p>${r.note}</p>`)
        : r.prov === 'simulated' ? ui.notice('模拟', html`<p>${r.note}</p>`)
          : r.status === 'abandoned' ? ui.notice('已淘汰', html`<p>${r.abandonReason}。指标保留在下方，但不参与任何比较。</p>`)
            : r.status === 'cancelled' ? ui.notice('已取消', html`<p>${r.cancelReason}。${r.readNote}。</p>`)
              : r.status === 'running' ? ui.notice('运行中', html`<p>第 ${DSH.fmt.n(r.progress.step)} / ${DSH.fmt.n(r.progress.total)} 步。中间验证值只作进度参考，不参与比较。</p>`)
                : '';
    const metricRows = r.live ? Object.keys(r.metrics || {}) : Object.keys(METRIC).filter((k) => (r.metrics && r.metrics[k] != null) || ['recall_thin', 'miou'].includes(k));
    const M = (k) => METRIC[k] || { zh: k, dir: null, d: 4 };
    const body = html`
      <div class="dsh-chiprow">${ui.st('exec', r.status, { dim: true })}${ui.st('prov', r.prov, { dim: true })}</div>
      ${banner}
      ${ui.ledger([
        ['计划', r.plan ? ui.ref('plan:' + r.plan) : html`<span class="muted">记录没有写计划</span>`],
        plan.scheme ? ['方案', ui.ref('scheme:' + plan.scheme)] : null,
        ['变体', r.variant],
        ['种子', String(r.seed)],
      ])}
      ${sec('原始指标', 'Raw metrics', r.metrics || r.interim
        ? html`<table class="ef-table dsh-table-tight"><thead><tr><th>指标</th><th>方向</th><th class="num">值</th></tr></thead><tbody>
            ${metricRows.map((k) => {
              const v = r.metrics && r.metrics[k];
              return html`<tr><td>${M(k).zh}</td><td class="ef-field">${M(k).dir === 'up' ? '越高越好' : M(k).dir === 'down' ? '越低越好' : '方向未记录'}</td><td class="num">${v != null ? (r.live ? String(v) : DSH.fmt.n(v, M(k).d)) : html`<span class="dsh-missing" title="没有记录这一项">— 未记录</span>`}</td></tr>`;
            })}
            ${r.interim ? html`<tr><td>细裂缝召回（中间值，第 ${r.interim.atStep} 步）</td><td class="ef-field">不参与比较</td><td class="num">${DSH.fmt.n(r.interim.recall_thin, 3)}</td></tr>` : ''}
          </tbody></table>`
        : html`<p class="dsh-missing-block">没有指标：${r.status === 'failed' ? '运行失败，没有写出指标' : r.status === 'cancelled' ? '运行被取消，没有写出指标' : r.live ? '记录里没有 metrics 字段' : '尚未产出'}。缺失的值不填 0。</p>`)}
      ${r.firstError ? sec('首个错误', 'First error', html`<p class="ef-field">${r.firstError.at}</p><pre class="dsh-code is-err"><code>${r.firstError.text}</code></pre>`) : ''}
      ${r.live ? sec('记录', 'Record', ui.ledger([
        ['状态原文', r.statusText != null ? html`<code>${String(r.statusText)}</code>` : html`<span class="muted">未记录</span>`],
        ['开始', r.at], ['时长', r.dur], r.config ? ['配置', String(r.config)] : null, r.code ? ['代码版本', html`<code>${String(r.code)}</code>`] : null, r.data ? ['数据版本', html`<code>${String(r.data)}</code>`] : null,
        r.task ? ['任务', ui.ref('task:' + r.task)] : null, r.note ? ['说明', r.note] : null,
      ])) : r.prov !== 'historical' ? sec('版本与资源', 'Versions', ui.ledger([
        ['代码版本', html`<code>${r.code}</code>`],
        ['数据版本', html`<code>${r.data}</code>`],
        ['配置', r.config],
        ['资源', r.gpu || '—'],
        ['开始', r.at],
        ['时长', r.dur],
        r.metrics && r.metrics.peak_mem ? ['峰值显存', r.metrics.peak_mem + ' GB'] : null,
      ])) : sec('来源', 'Source', html`<p>${ui.ref('source:' + r.source)}</p><p class="dsh-note">历史报告的定义、划分和预算与本轮协议不同，详见对比页的“协议是否可比”。</p>`)}
      ${runLog(r) ? sec('日志摘录', 'Log', html`<pre class="dsh-code"><code>${runLog(r)}</code></pre>`) : ''}
      ${r.files ? sec('产物', 'Files', html`<ul class="dsh-files-list">${r.files.map((f) => html`<li>${ui.path(f)}</li>`)}</ul>`) : ''}
      ${sec('研究判定', 'Verdict', html`
        <p class="dsh-note">运行状态只说明进程是否跑完；假设是否成立由计划的审查决定。</p>
        ${review ? html`<div class="dsh-chiprow">${ui.st('review', review.status, { dim: true })}${ui.st('verdict', review.verdict, { dim: true })}${ui.ref('review:' + review.id)}</div>` : html`<p class="dsh-note">${r.plan} 还没有审查记录。</p>`}`)}
      ${r.live ? tech([['Run 标识', r.id], ['计划', r.plan ? 'EXPERIMENT-PLAN.md ' + (plan.line || '（计划表中没有这一行）') : '记录没有写 planId'], ['记录文件', (r.files || []).join('、')]]) : tech([['Run 标识', r.id], ['计划版本', 'EXPERIMENT-PLAN.md v3 ' + (plan.line || '')], ['目录', r.prov === 'historical' ? '—' : `runs/${r.plan}/${r.id}/`]])}
      ${later(['重新运行', '停止运行', '修改结果'])}`;
    DSH.side.open({ key: 'run:' + id, eyebrow: 'Run / ' + id, title: `${r.plan || '未关联计划'} │ ${r.variant}${r.seed !== '—' ? ' │ seed ' + r.seed : ''}`, short: id, body });
  };

  /* ---------- 任务（也是 DAG 节点） ---------- */
  D.task = (id) => {
    const t = DSH.db().tasks[id];
    if (!t) return;
    DSH.side.open({ key: 'task:' + id, eyebrow: 'Task / ' + id, title: t.title, short: id, body: D.taskBody(id, { locate: true }) });
  };
  D.taskBody = (id, opt = {}) => {
    const db = DSH.db();
    const t = db.tasks[id];
    const edges = (db.p.dagEdges || []).concat(DSH.state.proto === 'cycle' && db.p.dagCycleEdge ? [db.p.dagCycleEdge] : []);
    const ups = edges.filter((e) => e.to === id);
    const downs = edges.filter((e) => e.from === id);
    const artifact = (k) => {
      const a = db.artifacts[k];
      if (!a) return html`<li><code>${k.replace(/^src:/, '')}</code></li>`;
      return html`<li>${ui.path(a.path, { copy: a.state !== 'missing' })} ${a.state === 'missing' ? ui.st('edge', 'missing', { text: '尚未产出' }) : a.state === 'stale' ? ui.st('edge', 'stale') : ''}${a.note ? html`<div class="dsh-note">${a.note}</div>` : ''}</li>`;
    };
    const nodeName = (nid) => (db.tasks[nid] ? ui.ref('task:' + nid) : html`<span class="oref is-broken">${icon('ghost')}<span class="oref-id">缺失节点</span><span class="oref-t">${((db.p.dagMissing || []).find((m) => m.id === nid) || {}).title || nid}</span></span>`);
    const reviewWarn = t.exec === 'done' && (t.review === 'changes' || t.review === 'rejected')
      ? ui.notice('注意', html`<p>执行已完成，但审查结论为“${ui.label('review', t.review)}”${t.reviewNote ? '（' + t.reviewNote + '）' : ''}。下游 ${downs.map((e) => e.to).join('、') || '任务'} 仍可能受阻。</p>`)
      : t.exec === 'done' && t.review === 'pending'
        ? ui.notice('待审', html`<p>执行已完成，审查还没有结论${t.reviewNote ? '（' + t.reviewNote + '）' : ''}。完成不等于结果已被接受。</p>`)
        : '';
    const body = html`
      <div class="dsh-chiprow">${ui.st('exec', t.exec, { dim: true })}${t.review !== 'unknown' ? ui.st('review', t.review, { dim: true }) : ''}</div>
      ${reviewWarn}
      ${t.blocked ? ui.notice('阻塞', html`<p>${t.blocked}</p>`) : ''}
      ${t.firstError ? ui.notice('失败', html`<p>首个错误：</p><pre class="dsh-code is-err"><code>${t.firstError}</code></pre>`) : ''}
      ${t.unknownNote ? ui.notice('未知', html`<p>${t.unknownNote}。工作台不猜测它的状态。</p>`) : ''}
      ${t.stale ? ui.notice('输入已更新', html`<p>${t.stale}。结果仍然显示，但可能需要复核。</p>`) : ''}
      ${t.progress ? html`<div class="ef-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${t.progress.total}" aria-valuenow="${t.progress.done}" style="--p:${(t.progress.done / t.progress.total).toFixed(3)}"><span class="ef-eyebrow">Running / ${t.progress.label}</span><span class="ef-field">${DSH.fmt.n(t.progress.done)} / ${DSH.fmt.n(t.progress.total)} 步</span><i></i></div>` : ''}
      ${ui.ledger([
        t.live ? ['状态原文', t.statusText ? html`<code>${t.statusText}</code>` : html`<span class="muted">状态列为空</span>`] : null,
        ['阶段', t.stage],
        t.live ? null : ['负责人', ui.member(t.owner)],
        ['最近事件', html`${t.event}${t.at !== '—' ? html` <span class="ef-field">${t.at}</span>` : ''}`],
      ])}
      ${sec('上游：等待什么', 'Waits for', ups.length ? html`<ul class="dsh-deps">${ups.map((e) => html`<li><span class="dsh-deps-n">${nodeName(e.from)}</span><span class="dsh-deps-w">${e.wait}</span>${ui.st('edge', e.state)}${e.note ? html`<div class="dsh-note">${e.note}</div>` : ''}</li>`)}</ul>` : html`<p class="dsh-note">没有上游依赖。</p>`)}
      ${sec('下游：谁在等它', 'Needed by', downs.length ? html`<ul class="dsh-deps">${downs.map((e) => html`<li><span class="dsh-deps-n">${nodeName(e.to)}</span><span class="dsh-deps-w">${e.wait}</span>${ui.st('edge', e.state)}</li>`)}</ul>` : html`<p class="dsh-note">没有下游任务。</p>`)}
      ${sec('输入与输出', 'Inputs / outputs', html`<div class="dsh-io"><div><p class="ef-eyebrow">In</p><ul class="dsh-files-list">${t.inputs.length ? t.inputs.map(artifact) : html`<li class="muted">无</li>`}</ul></div><div><p class="ef-eyebrow">Out</p><ul class="dsh-files-list">${t.outputs.length ? t.outputs.map(artifact) : html`<li class="muted">无</li>`}</ul></div></div>`)}
      ${t.links && t.links.length ? sec('关联对象', 'Related', ui.refs(t.links)) : ''}
      ${t.trace && db.traces[t.trace] ? sec('事件摘要', 'Trace', html`${ui.timeline(db.traces[t.trace].events)}<p class="dsh-note">${ui.ref('trace:' + t.trace)}</p>`) : ''}
      ${sec('来源文件', 'Defined in', html`<p>${ui.path(t.live ? 'RESEARCH-DAG.md' : 'dag.yaml')} <span class="ef-field">${t.line}</span></p>`)}
      ${opt.locate ? html`<p class="ef-actions">${ui.btn('在 DAG 中定位', { act: 'go', data: { href: DSH.href('/dag', { focus: id }) }, icon: 'target' })}${ui.btn('任务列表', { act: 'go', data: { href: DSH.href('/tasks/list', { focus: 'task-row-' + id }) } })}</p>` : html`<p class="ef-actions">${ui.btn('在面板中打开', { act: 'open', data: { ref: 'task:' + id } })}</p>`}
      ${later(['派发', '重试', '暂停'])}`;
    return body;
  };

  /* ---------- 成员 ---------- */
  D.member = (id) => {
    const db = DSH.db();
    const m = db.members[id];
    const tasks = (db.p.tasks || []).filter((t) => t.owner === id);
    const tr = m.trace && db.traces[m.trace];
    const body = html`
      <div class="dsh-chiprow">${ui.st('member', m.state, { dim: true })}<span class="st st--chip">${icon(m.kind === 'human' ? 'user' : 'bot', 'st-g')}<span class="st-v">${m.kind === 'human' ? '人' : 'Agent 会话'}</span></span></div>
      ${m.staleNote ? ui.notice('状态未知', html`<p>${m.staleNote}。</p>`) : ''}
      ${m.blocked ? ui.notice('受阻', html`<p>${m.blocked}</p>`) : ''}
      ${ui.ledger([
        ['角色', m.role],
        m.kind === 'agent' ? ['模型', m.model ? html`${m.model} <span class="ef-field">会话记录</span>` : html`<span class="muted">未记录</span>`] : null,
        m.session ? ['会话', html`<code>${m.session}</code> ${ui.path(m.link)}`] : null,
        ['当前任务', m.current ? ui.ref('task:' + m.current) : html`<span class="muted">无</span>`],
        ['最近活动', m.lastActive],
        m.heartbeat ? ['最近心跳', m.heartbeat] : null,
      ])}
      ${sec('关联任务', 'Tasks', tasks.length ? html`<ul class="dsh-deps">${tasks.map((t) => html`<li><span class="dsh-deps-n">${ui.ref('task:' + t.id)}</span>${ui.st('exec', t.exec)}${ui.st('review', t.review)}</li>`)}</ul>` : html`<p class="dsh-note">没有分配给该成员的任务。</p>`)}
      ${sec('已交付产物', 'Delivered', html`<ul class="dsh-files-list">${m.delivered.map((f) => html`<li>${ui.path(f)}</li>`)}</ul>`)}
      ${tr ? sec('事件摘要', 'Events', html`${ui.timeline(tr.events)}<p class="dsh-note">这里只展示会话记录里的事件摘要，不展示模型的内部推理。</p>`) : ''}
      ${later(['派发任务', '暂停会话', '邀请成员'])}`;
    DSH.side.open({ key: 'member:' + id, eyebrow: 'Member / ' + id + (m.session ? ' / ' + m.session : ''), title: m.name, short: m.name, body });
  };

  /* ---------- 来源与引用 ---------- */
  function contextLines(srcId, c) {
    const db = DSH.db();
    if (c && c.context) return html`<ol class="dsh-src">${c.context.map((l) => html`<li class="${l.hit ? 'is-hit' : ''}"><span class="ln ef-field">${l.n}</span><span class="tx">${l.t || ' '}</span></li>`)}</ol>`;
    const lines = (db.p.sourceContext || {})[srcId];
    if (!lines) return html`<p class="dsh-note">没有可内嵌的上下文；可以复制路径后在本机打开原文。</p>`;
    const mark = c && c.mark;
    return html`<ol class="dsh-src">${lines.map((l) => {
      const hit = mark && l.t && (l.t.includes(mark) || mark.includes(l.t.trim()) && l.t.trim().length > 4);
      return html`<li class="${hit ? 'is-hit' : ''}"><span class="ln ef-field">${l.n}</span><span class="tx">${l.t || ' '}</span></li>`;
    })}</ol>`;
  }
  const excerpt = (c) => {
    if (!c.mark || !c.excerpt.includes(c.mark)) return html`${c.excerpt}`;
    const [a, b] = c.excerpt.split(c.mark);
    return html`${a}<mark>${c.mark}</mark>${b}`;
  };
  DSH.citeExcerpt = excerpt;
  D.source = (id) => {
    const db = DSH.db();
    const s = db.sources[id];
    const cites = Object.entries(db.cites).filter(([, c]) => c.source === id);
    const issues = (db.p.issues || []).filter((q) => (q.sides || []).some((x) => x.source === id));
    const body = html`
      <div class="dsh-chiprow">${ui.st('cov', s.status, { dim: true })}<span class="st st--chip"><span class="st-v">${s.kind}${s.year && s.year !== '—' ? ' │ ' + s.year : ''}</span></span></div>
      ${s.status === 'missing' ? ui.notice('来源缺失', html`<p>${s.reason}。引用它的说法按待核实处理，不能作为依据。</p>`) : ''}
      ${s.kind === '历史报告' ? ui.notice('历史报告', html`<p>其中的结果来自过去的报告，不是本轮实验。</p>`) : ''}
      ${ui.ledger([
        ['路径', ui.path(s.path)],
        ['处理范围', s.range],
        s.unread ? ['未读范围', html`<b>${s.unread}</b>`, true] : null,
        s.reason && s.status !== 'missing' ? ['原因', s.reason] : null,
        s.note ? ['说明', s.note] : null,
        s.attribution ? ['作者 / 归属', s.attribution] : null,
      ])}
      ${sec('被引用', 'Cited in', cites.length ? html`<ul class="dsh-cites">${cites.map(([cid, c]) => html`<li><div class="dsh-cites-h">${ui.ref('wiki:' + c.page)}<span class="ef-field">[${c.n}] │ ${c.loc}</span></div><blockquote class="dsh-quote">${excerpt(c)}</blockquote></li>`)}</ul>` : html`<p class="dsh-note">没有 Wiki 页引用这份来源。</p>`)}
      ${issues.length ? sec('相关问题', 'Issues', ui.refs(issues.map((q) => 'issue:' + q.id))) : ''}
      ${sec(db.p.live ? '文件开头' : '原文片段', 'Context', contextLines(id, null))}
      ${db.p.live ? tech([['来源标识', s.id], ['来源版本', s.revision != null ? 'r' + s.revision : '—'], ['内容 hash', s.sha256 ? 'sha256:' + s.sha256 : '—'], ['覆盖记录', '快照 ' + (db.p.wikiSnapshot ? db.p.wikiSnapshot.version : '—') + ' │ state.json']]) : tech([['来源标识', s.id], ['覆盖记录', 'wiki/_coverage.json │ tr-0425']])}`;
    DSH.side.open({ key: 'source:' + id, eyebrow: 'Source / ' + id, title: s.path.split('/').pop(), short: s.path.split('/').pop(), body });
  };
  D.cite = (cid) => {
    const db = DSH.db();
    const c = db.cites[cid];
    const s = db.sources[c.source] || { id: c.source, path: c.source, kind: '来源', status: 'missing' };
    const page = db.pages[c.page];
    const body = html`
      <div class="dsh-chiprow">${ui.ref('wiki:' + c.page)}${c.missing ? ui.evi('missing') : ui.st('cov', s.status, { dim: true })}</div>
      ${c.missing ? ui.notice('来源缺失', html`<p>${s.reason || '来源文件现在不可用'}。下面的片段是引用时记录的，现在无法与原文核对。</p>`) : ''}
      ${c.stale ? ui.notice('来源已更新', html`<p>这条引用指向来源的旧版本（${c.srcVersion}）；来源现在有新版本，引用需要由 wiki-maintain 复核。</p>`) : ''}
      ${s.kind === '历史报告' ? ui.notice('历史报告', html`<p>这是过去的报告，不是本轮实验结果。</p>`) : ''}
      ${sec('引用片段', 'Excerpt', html`<blockquote class="dsh-quote is-lg">${excerpt(c)}</blockquote>`)}
      ${ui.ledger([
        ['来源文件', ui.path(s.path, { copy: !c.missing })],
        ['材料性质', s.kind + (s.year && s.year !== '—' ? ' │ ' + s.year : '')],
        ['位置', c.loc],
        ['来源版本', html`<code>${c.srcVersion}</code>`],
        ['引用它的页面', html`${page.title} <span class="ef-field">[${c.n}]</span>`],
      ])}
      ${sec('原文上下文', 'In context', contextLines(c.source, c))}
      ${tech([['引用标识', c.cid], ['来源标识', s.id], ['字节范围', c.bytes], ['来源 hash', c.srcVersion]])}
      <p class="ef-actions">
        ${ui.btn('回到正文位置', { act: 'cite-back', data: { cite: cid }, icon: 'arrow-l' })}
        ${!c.missing ? ui.btn('在来源列表中定位', { act: 'cite-locate', data: { cite: cid } }) : ''}
      </p>`;
    DSH.side.open({ key: 'cite:' + cid, eyebrow: `Citation / ${c.page} [${c.n}]`, title: s.path.split('/').pop(), short: `[${c.n}]`, body });
  };
  DSH.on('cite-back', async (el) => {
    const c = DSH.db().cites[el.dataset.cite];
    await DSH.side.close();
    const want = '#/knowledge/read/' + c.page;
    DSH.state.flash = 'cite-' + el.dataset.cite;
    if (DSH.parse().hash.split('?')[0] !== want) DSH.go(want);
    else { DSH.flash(DSH.state.flash); DSH.state.flash = null; }
  });
  DSH.on('cite-locate', async (el) => {
    const cid = el.dataset.cite;
    const c = DSH.db().cites[cid];
    const cur = DSH.parse();
    await DSH.side.close();
    DSH.state.returnTo = { label: `${DSH.db().pages[c.page].title} [${c.n}]`, hash: cur.hash.startsWith('#/knowledge/read') ? cur.hash : '#/knowledge/read/' + c.page, anchor: 'cite-' + cid };
    DSH.go(DSH.href('/knowledge/sources', { focus: 'src-row-' + c.source }));
  });

  /* ---------- 引用弹出层：在正文旁就地展开 ---------- */
  DSH.citePop = (anchor, cid) => {
    const db = DSH.db();
    const c = db.cites[cid];
    const s = db.sources[c.source] || { id: c.source, path: c.source, kind: '来源', status: 'missing' };
    DSH.pop.open(anchor, html`
      <div class="dsh-citepop" role="dialog" aria-label="引用 [${c.n}] 来源预览">
        <header>
          <span class="ef-pair"><span class="ef-eyebrow">Citation [${c.n}]</span><span>${s.path.split('/').pop()}</span></span>
          <button type="button" class="dsh-copy" data-pop-close aria-label="关闭">${icon('x')}</button>
        </header>
        ${c.missing ? ui.notice('来源缺失', html`<p>${s.reason || '来源文件现在不可用'}。</p>`) : c.stale ? ui.notice('来源已更新', html`<p>引用的是旧版本，需要复核。</p>`) : ''}
        ${s.kind === '历史报告' ? html`<p class="dsh-chiprow">${ui.st('prov', 'historical')}<span class="dsh-note">不是本轮实验</span></p>` : ''}
        <blockquote class="dsh-quote">${excerpt(c)}</blockquote>
        ${ui.facts([s.kind + (s.year && s.year !== '—' ? ' ' + s.year : ''), c.loc, '来源版本 ' + c.srcVersion.split('…')[0] + '…'])}
        <details class="dsh-tech"><summary>${icon('hash')}技术信息</summary>${ui.kv([['引用标识', c.cid], ['来源标识', s.id], ['字节范围', c.bytes], ['来源 hash', c.srcVersion]])}</details>
        <p class="ef-actions">
          ${ui.btn('查看原文上下文', { act: 'open', data: { ref: 'cite:' + cid } })}
          ${!c.missing ? html`<button type="button" class="ef-btn small" data-act="copy" data-text="${DSH.project().workspace + (DSH.project().workspace.includes('\\') ? '\\' + s.path.replace(/\//g, '\\') : '/' + s.path)}">${icon('copy')}复制路径</button>` : ''}
        </p>
      </div>`, { label: '引用预览', cls: 'is-cite' });
  };
  DSH.on('cite', (el) => DSH.citePop(el, el.dataset.cite));

  /* ---------- trace ---------- */
  D.trace = (id) => {
    const db = DSH.db();
    const tr = db.traces[id];
    const body = html`
      ${ui.ledger([tr.member ? ['成员', ui.ref('member:' + tr.member)] : ['执行', 'wiki-maintain 运行助手'], [tr.member ? '会话' : '运行', html`<code>${tr.session}</code>`], ['时间', tr.at]])}
      ${sec('事件', 'Events', ui.timeline(tr.events))}
      <p class="dsh-note">trace 是执行过程的事件摘要，只读；不展示模型的内部推理。</p>
      ${tech([['trace 文件', tr.file || `traces/${id}.jsonl`], ['事件数', String(tr.events.length)]])}`;
    DSH.side.open({ key: 'trace:' + id, eyebrow: 'Trace / ' + id, title: tr.title, short: id, body });
  };

  /* ---------- 冲突 ---------- */
  D.conflict = (id) => {
    const db = DSH.db();
    const c = db.conflicts[id];
    const body = html`
      ${ui.notice('冲突', html`<p>两个会话在 3 分钟内修改了同一文件。工作台只展示已记录的冲突，不替你合并。</p>`)}
      ${ui.ledger([['文件', ui.path(c.file)], ['状态', c.status]])}
      ${sec('修改记录', 'Edits', html`<ul class="dsh-deps">${c.edits.map((e) => html`<li><span class="dsh-deps-n">${ui.ref('member:' + e.member)}</span><span class="dsh-deps-w">${e.text}</span><span class="ef-field">${e.at} │ ${e.session}</span></li>`)}</ul>`)}
      ${later(['合并修改', '保留其一'])}`;
    DSH.side.open({ key: 'conflict:' + id, eyebrow: 'Conflict / ' + id, title: c.file.split('/').pop(), short: id, body });
  };

  /* ---------- 产物 ---------- */
  D.artifact = (id) => {
    const db = DSH.db();
    const a = db.artifacts[id];
    const users = (db.p.tasks || []).filter((t) => t.inputs.includes(id));
    const body = html`
      <div class="dsh-chiprow">${a.state === 'missing' ? ui.st('edge', 'missing', { text: '尚未产出' }) : ui.st('fresh', 'ok', { text: '已产出' })}</div>
      ${ui.ledger([['路径', ui.path(a.path, { copy: a.state !== 'missing' })], ['产出任务', a.by ? ui.ref('task:' + a.by) : html`<span class="muted">没有任务产出它</span>`], ['时间', a.at]])}
      ${a.note ? html`<p class="dsh-note">${a.note}</p>` : ''}
      ${sec('使用它的任务', 'Used by', users.length ? ui.refs(users.map((t) => 'task:' + t.id)) : html`<p class="dsh-note">没有任务使用它。</p>`)}`;
    DSH.side.open({ key: 'artifact:' + id, eyebrow: 'Artifact', title: a.path, short: a.path, body });
  };
})();
