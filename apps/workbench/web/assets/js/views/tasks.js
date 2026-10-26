/* 任务与 Team（控制台子页）
   任务以列表为主、看板为辅；执行状态与审查状态分列。
   Team 只显示真实存在的成员与会话；“建议的分工”是模板，不显示成正在工作的 Agent。
   没有心跳只表示状态陈旧 / 未知，不判定离线或失败。本页只读，操作位置标为后置。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const EXEC = ['pending', 'running', 'blocked', 'failed', 'cancelled', 'done', 'unknown'];
  const REVIEW = ['none', 'pending', 'changes', 'rejected', 'passed'];
  function bar(current) {
    const db = DSH.db();
    const p = db.p;
    return html`
      <div class="dsh-sectionbar">
        ${ui.subnav('任务与 Team', [
          { key: 'list', zh: '任务列表', en: 'List', href: '#/tasks/list', n: p.tasks.length || null },
          { key: 'board', zh: '看板', en: 'Board', href: '#/tasks/board' },
          { key: 'team', zh: 'Team', en: 'Members', href: '#/tasks/team', n: p.members.length || null },
        ], current)}
        ${p.live ? ui.facts(['RESEARCH-DAG.md', `读取 ${p.readAt}`]) : p.tasks.length ? ui.facts(['dag.yaml', 'team/sessions.jsonl', `读取 ${p.readAt}`]) : ui.facts(['没有任务记录'])}
      </div>`;
  }
  const META = (head, team) => ({
    head, key: team ? 'team' : 'dag', file: team ? 'team/sessions.jsonl' : DSH.live() ? 'RESEARCH-DAG.md' : 'dag.yaml', skill: team ? '会话记录' : DSH.live() ? 'academic-tailor' : '研究者与各会话',
    liveFile: team ? null : undefined, empty: !team && DSH.live() && !DSH.db().p.tasks.length,
    emptyTitle: team ? '还没有成员或会话记录。' : '还没有任务记录。',
    emptyText: team
      ? (DSH.live() ? 'Team 调度是后续功能；这个工作区没有成员或会话记录。工作台不会把角色模板显示成正在工作的 Agent。' : 'Team 只显示真实存在的成员与会话。没有记录时，不会把角色模板显示成正在工作的 Agent。')
      : DSH.live() ? '任务来自 RESEARCH-DAG.md 的任务节点表；没有时这里不会生成示例任务。' : '任务来自 dag.yaml 与会话记录；没有记录时，这里不会生成示例任务。',
    error: team ? 'team/sessions.jsonl 第 31 行不是有效的 JSON。该行之后的会话无法读取，已读取的 3 个会话照常显示（选“部分读取”查看）。' : 'dag.yaml 第 88 行缩进错误：T-11 的 inputs 无法解析。',
    partial: team ? 'team/sessions.jsonl 第 31 行之后无法解析：s-0418 的结束事件缺失，按最后一条心跳显示。' : 'dag.yaml 中 T-12 缺少 status 字段，已按“未知”显示。',
  });
  const ups = (id) => DSH.db().p.dagEdges.filter((e) => e.to === id);
  const isMissing = (id) => (DSH.db().p.dagMissing || []).some((m) => m.id === id) || id.startsWith('X-');
  const filt = () => DSH.vs('tasks-f', () => ({ owner: '' }));
  const fromQuery = (r, key) => (r.query[key] ? r.query[key].split(',') : []);

  /* ---------- 列表 ---------- */
  DSH.views['tasks-list'] = {
    title: () => '任务列表',
    render(r) {
      const db = DSH.db();
      const p = db.p;
      const h = bar('list');
      return ui.withState(META(h), (banner) => {
        DSH.state.pageLabel = '任务列表';
        const ex = fromQuery(r, 'exec'), rv = fromQuery(r, 'review');
        const f = filt();
        const rows = p.tasks.filter((t) => (!ex.length || ex.includes(t.exec)) && (!rv.length || rv.includes(t.review)) && (!f.owner || t.owner === f.owner));
        const owners = [...new Set(p.tasks.map((t) => t.owner).filter(Boolean))];
        const art = (k) => { const a = db.artifacts[k]; return a ? a : { path: k.replace(/^src:/, ''), state: 'ok' }; };
        return html`
        ${h}
        <div class="dsh-page">
          ${banner}
          ${ui.head({ zh: '任务', en: 'Tasks', desc: '任务标识、目标、阶段、负责人、依赖、执行状态、审查状态、最近事件与产物。状态以文件里的实际字段为准，不另造状态。', facts: [`显示 ${rows.length} / ${p.tasks.length} 项`] })}
          <div class="dsh-filters">
            <div class="dsh-filter"><span class="ef-eyebrow">Execution</span>${ui.chips(EXEC.map((k) => ({ key: k, label: ui.label('exec', k), n: p.tasks.filter((t) => t.exec === k).length, on: ex.includes(k), glyph: icon(ui.ST.exec.items[k][1]) })), 'tk-exec', { label: '按执行状态' })}</div>
            ${p.live ? '' : html`<div class="dsh-filter"><span class="ef-eyebrow">Review</span>${ui.chips(REVIEW.map((k) => ({ key: k, label: ui.label('review', k), n: p.tasks.filter((t) => t.review === k).length, on: rv.includes(k), glyph: icon(ui.ST.review.items[k][1]) })), 'tk-review', { label: '按审查状态' })}</div>`}
            ${owners.length ? html`<label class="dsh-select is-inline"><span class="ef-eyebrow">Owner</span><select data-change="tk-owner" aria-label="按负责人"><option value="">全部成员</option>${owners.map((o) => html`<option value="${o}"${f.owner === o ? raw(' selected') : ''}>${(db.members[o] || { name: o }).name}</option>`)}</select></label>` : ''}
          </div>
          <div class="ef-table-wrap">
            <table class="ef-table dsh-tasks">
              <thead><tr><th>任务</th><th>阶段</th>${p.live ? '' : html`<th>负责人</th>`}<th>依赖</th><th>执行</th>${p.live ? html`<th>状态原文</th>` : html`<th>审查</th><th>最近事件</th>`}<th>产物</th></tr></thead>
              <tbody>${rows.map((t) => html`<tr id="task-row-${t.id}">
                <td><button type="button" class="dsh-task-name" data-act="open" data-ref="task:${t.id}"><span class="dsh-id">${t.id}</span><span>${t.title}</span></button>${t.blocked || t.firstError ? html`<div class="dsh-note">${t.blocked || '首个错误：' + t.firstError}</div>` : ''}</td>
                <td>${t.stage}</td>
                ${p.live ? '' : html`<td>${ui.member(t.owner)}</td>`}
                <td>${ups(t.id).length ? html`<span class="dsh-deps-inline">${ups(t.id).map((e) => html`<span title="等待：${e.wait}（${ui.label('edge', e.state)}）">${isMissing(e.from) ? html`<span class="oref is-broken"><span class="oref-id">缺失 ${p.live ? e.from : ''}</span></span>` : ui.ref('task:' + e.from, { idOnly: true })}</span>`)}</span>` : html`<span class="muted">无</span>`}</td>
                <td>${ui.st('exec', t.exec)}</td>
                ${p.live ? html`<td>${t.statusText ? html`<code>${t.statusText}</code>` : html`<span class="muted">空</span>`}</td>` : html`<td>${ui.st('review', t.review)}${t.reviewNote ? html`<div class="dsh-note">${t.reviewNote}</div>` : ''}</td>
                <td><span class="ef-read">${t.event}</span><div class="ef-field">${t.at}</div></td>`}
                <td>${t.outputs.length ? html`<ul class="dsh-files-list is-tight">${t.outputs.map((k) => { const a = art(k); return html`<li>${ui.path(a.path, { copy: a.state !== 'missing' })}${a.state === 'missing' ? html` <span class="ef-field">尚未产出</span>` : ''}</li>`; })}</ul>` : html`<span class="muted">无</span>`}</td>
              </tr>`)}</tbody>
            </table>
          </div>
          ${rows.length ? '' : html`<p class="ef-empty">没有符合筛选条件的任务。</p>`}
          ${ex.length || rv.length || f.owner ? html`<p class="ef-actions">${ui.btn('清除筛选', { act: 'tk-clear' })}</p>` : ''}
        </div>`;
      });
    },
    mount(el, r) { if (r.query.focus) DSH.flash(r.query.focus); },
  };
  const toggleQ = (key, k) => {
    const r = DSH.parse();
    const cur = r.query[key] ? r.query[key].split(',') : [];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : cur.concat(k);
    const q = { ...r.query, [key]: next.join(',') || null, focus: null };
    DSH.go(DSH.href(r.path, q), { replace: true });
  };
  DSH.on('tk-exec', (el) => toggleQ('exec', el.dataset.key));
  DSH.on('tk-review', (el) => toggleQ('review', el.dataset.key));
  DSH.on('tk-owner', (el) => { filt().owner = el.value; DSH.render(); });
  DSH.on('tk-clear', () => { filt().owner = ''; DSH.go('#/tasks/list', { replace: true }); });

  /* ---------- 看板（辅助视图，只读） ---------- */
  DSH.views['tasks-board'] = {
    layout: 'fixed',
    title: () => '任务看板',
    render() {
      const db = DSH.db();
      const p = db.p;
      const h = bar('board');
      return ui.withState(META(h), (banner) => {
        DSH.state.pageLabel = '任务看板';
        return html`
        ${h}
        <div class="dsh-boardwrap">
          ${banner}
          <p class="dsh-note dsh-board-note">${icon('g-lock')} 看板按执行状态分列，只读：不能拖动改状态。审查状态写在每张卡片上，与执行状态分开。</p>
          <div class="dsh-board" role="list">
            ${EXEC.map((k) => {
              const ts = p.tasks.filter((t) => t.exec === k);
              return html`<section class="dsh-col is-${k}" role="listitem" aria-label="${ui.label('exec', k)}：${ts.length} 项">
                <h2 class="dsh-col-h">${ui.st('exec', k)}<span class="ef-field">${ts.length}</span></h2>
                <ol class="dsh-col-list" data-scroll-key="col-${k}">${ts.length ? ts.map((t) => html`<li><button type="button" class="dsh-card" data-act="open" data-ref="task:${t.id}">
                  <span class="dsh-card-h"><span class="dsh-id">${t.id}</span><span class="ef-field">${t.stage}</span></span>
                  <span class="dsh-card-t">${t.title}</span>
                  ${t.review !== 'unknown' ? html`<span class="dsh-chiprow">${ui.st('review', t.review, { dim: true })}</span>` : ''}
                  <span class="ef-field">${t.live ? (t.statusText || '状态列为空') : (t.owner ? (db.members[t.owner] || { name: t.owner }).name : '未指派') + ' │ ' + t.at}</span>
                </button></li>`) : html`<li class="dsh-col-empty">没有${ui.label('exec', k)}的任务。</li>`}</ol>
              </section>`;
            })}
          </div>
        </div>`;
      });
    },
  };

  /* ---------- Team ---------- */
  DSH.views.team = {
    title: () => 'Team',
    render() {
      const db = DSH.db();
      const p = db.p;
      const h = bar('team');
      return ui.withState(META(h, true), (banner) => {
        DSH.state.pageLabel = 'Team';
        return html`
        ${h}
        <div class="dsh-page">
          ${banner}
          ${ui.head({ zh: 'Team', en: 'Members', desc: '真实存在的成员与会话：名称、角色、模型（有记录才显示）、当前任务、运行状态、最近活动、已交付产物与受阻原因。', facts: [`${p.members.length} 个成员与会话`, `建议的分工 ${p.roleTemplates.length} 个（尚无会话）`, `已记录冲突 ${p.conflicts.length} 个`] })}
          <h2 class="ef-group-head"><span>${ui.pair('Members & sessions', '已存在的成员与会话')}</span><span class="ef-field">${p.members.length}</span></h2>
          <div class="dsh-team">
            ${p.members.map((m) => {
              const task = m.current ? db.tasks[m.current] : null;
              return html`
              <article class="dsh-member is-${m.state}" aria-labelledby="mem-${m.id}">
                <header>
                  <span class="dsh-member-ic">${icon(m.kind === 'human' ? 'user' : 'bot')}</span>
                  <div><h3 id="mem-${m.id}">${m.name}</h3><p class="ef-field">${m.kind === 'human' ? '人' : '会话 ' + m.session} │ ${m.role}</p></div>
                  ${ui.st('member', m.state)}
                </header>
                ${m.staleNote ? html`<p class="dsh-member-warn">${m.staleNote}。</p>` : ''}
                ${ui.ledger([
                  m.kind === 'agent' ? ['模型', m.model ? m.model : '未记录', false] : null,
                  ['当前任务', task ? html`${task.id} ${ui.label('exec', task.exec)}` : '无'],
                  ['最近活动', m.lastActive],
                  m.heartbeat ? ['最近心跳', m.heartbeat, m.state === 'unknown'] : null,
                  ['已交付', m.delivered.length + ' 项'],
                ])}
                ${m.blocked ? html`<p class="dsh-note"><b>受阻：</b>${m.blocked}</p>` : ''}
                <p class="ef-actions">${ui.btn('任务、trace 与产物', { act: 'open', data: { ref: 'member:' + m.id } })}${task ? ui.btn(task.id, { act: 'open', data: { ref: 'task:' + task.id } }) : ''}</p>
              </article>`;
            })}
          </div>

          <h2 class="ef-group-head"><span>${ui.pair('Suggested roles', '建议的分工（尚无会话）')}</span><span class="ef-field">${p.roleTemplates.length}</span></h2>
          <p class="dsh-note">这些只是文件里提出的分工建议，不是正在工作的 Agent；没有会话、没有心跳、没有产物。</p>
          <div class="dsh-team">
            ${p.roleTemplates.map((t) => html`
              <article class="dsh-member is-template">
                <header><span class="dsh-member-ic">${icon('ghost')}</span><div><h3>${t.name}</h3><p class="ef-field">${t.skill || '未指定 Skill'} │ 模板</p></div>${ui.st('member', 'idle', { text: '未创建会话' })}</header>
                <p class="ef-read">${t.text}</p>
                <p class="ef-field">出处：${t.from}</p>
              </article>`)}
          </div>

          <h2 class="ef-group-head"><span>${ui.pair('Recorded conflicts', '已记录的冲突')}</span><span class="ef-field">${p.conflicts.length}</span></h2>
          ${p.conflicts.map((c) => html`
            <section class="ef-panel">
              <h2>${ui.path(c.file)} <small>${c.status}</small></h2>
              <ul class="ef-rows">${c.edits.map((e) => html`<li><div><div>${db.members[e.member].name} <code class="dsh-code-inline">${e.session}</code></div><div class="meta"><span>${e.at}</span><span>${e.text}</span></div></div></li>`)}</ul>
              <p class="dsh-note">只展示已记录的冲突，不虚构调度系统，也不替你合并。</p>
              <p class="ef-actions">${ui.btn('冲突详情', { act: 'open', data: { ref: 'conflict:' + c.id } })}</p>
            </section>`)}

          <div class="dsh-later is-block" aria-label="后置操作，本轮不提供">
            <p class="ef-eyebrow slash">Later / 后置</p>
            <p>未来可能放在这里的操作：聊天、邀请成员、派发任务、重试、暂停。本轮只读，不提供，也不计入验收。</p>
            <p class="ef-actions">${['邀请成员', '派发任务', '重试', '暂停'].map((t) => ui.btn(t, { disabled: true, title: '后置：本轮不提供' }))}</p>
          </div>
        </div>`;
      });
    },
  };
})();
