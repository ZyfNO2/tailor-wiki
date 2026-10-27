/* 研究导学（阅读页，RESEARCH-GUIDE.md）
   学习目标、来源与阅读范围、阅读路线（要弄懂的问题—必要概念—阅读位置—读完能解释什么—最小练习）、
   当前待答题。讲解、提问与反馈在 Agent 对话里进行，这里只展示文件。
   学习者的回答（RESEARCH-PRACTICE.md）只在启动时用 --paths 明确提供时显示，且不算科研证据。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  function route(g) {
    if (g.route.length) return html`
      <div class="ef-table-wrap">
        <table class="ef-table dsh-route">
          <thead><tr><th class="num">步</th><th>要弄懂的问题</th><th>必要概念</th><th>论文 / 代码位置</th><th>读完能解释什么</th><th>最小练习</th></tr></thead>
          <tbody>${g.route.map((x) => html`<tr id="step-${x.step}">
            <td class="num">${DSH.fmt.pad(x.step)}</td>
            <td class="ef-read">${ui.val(x.question)}</td>
            <td>${ui.val(x.concepts)}</td>
            <td>${ui.val(x.location)}</td>
            <td>${ui.val(x.outcome)}</td>
            <td>${ui.val(x.exercise, '未安排')}</td>
          </tr>`)}</tbody>
        </table>
      </div>
      <p class="dsh-note">按文件里的阅读路线表逐行列出，单元格原文照录。路线是阅读安排，不代表已经读完或已经理解。</p>`;
    if (g.routeStatus === 'unparsed') return html`${ui.notice('未识别', html`<p>阅读路线小节没有可识别的表格（需要“要弄懂的问题”与“阅读位置”等列），按原文显示。</p>`)}${ui.md(g.routeHtml)}`;
    return html`<p class="ef-empty">文件中没有阅读路线。</p>`;
  }
  function questions(g) {
    if (g.questions.length) return html`<ol class="dsh-ul ef-read">${g.questions.map((q) => html`<li>${q}</li>`)}</ol>`;
    if (g.questionsStatus === 'unparsed') return html`${ui.notice('未识别', html`<p>待答题小节没有可识别的列表或表格，按原文显示，不计为 0 道。</p>`)}${ui.md(g.questionsHtml)}`;
    return html`<p class="ef-empty">文件中没有待答题小节。</p>`;
  }

  DSH.views.guide = {
    layout: 'fixed',
    title: () => '研究导学',
    render() {
      const db = DSH.db();
      const p = db.p;
      const head = html`<div class="dsh-page">${ui.head({ zh: '研究导学', en: 'Guide' })}</div>`;
      const meta = {
        head, key: 'guide', file: 'RESEARCH-GUIDE.md', skill: 'research-guide',
        emptyTitle: '还没有研究导学。',
        emptyText: 'research-guide 按研究目标写 RESEARCH-GUIDE.md：学习目标、阅读范围、阅读路线和待答题。讲解与练习在 Agent 对话里进行；工作台只展示文件，不出题、不判分。',
      };
      return ui.withState(meta, (banner) => {
        const g = p.guide;
        DSH.state.pageLabel = '研究导学';
        if (!g) return html`${head}<div class="dsh-pad">${ui.empty({ title: meta.emptyTitle, text: meta.emptyText, file: meta.file, skill: meta.skill })}</div>`;
        const doc = p.docs.guide || {};
        return html`
        <div class="dsh-doc">
          <article class="dsh-sheet is-wide" data-scroll-key="sheet" aria-labelledby="gd-title">
            ${banner}
            <p class="ef-crumb ef-field"><span>研究导学</span><span>${g.file}</span></p>
            <p class="dsh-ids"><span class="dsh-kv-static"><span>文件</span><span>${g.file}</span></span><span class="dsh-kv-static"><span>Skill</span><span>research-guide</span></span></p>
            ${ui.facts([g.at, g.version, `${g.route.length} 步阅读路线`, g.questionsStatus === 'unparsed' ? '待答题未识别' : `${g.questions.length} 道待答题`])}
            <h1 class="dsh-title ef-read" id="gd-title">${g.title || '研究导学'}</h1>
            <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
            ${ui.kv([['学习目标', ui.val(g.goal)], ['来源与阅读范围', ui.val(g.scope)]])}

            <h2 class="dsh-h2">${ui.pair('Reading route', '阅读路线')}</h2>
            ${route(g)}

            ${g.practice ? html`
            <h2 class="dsh-h2">${ui.pair('Practice', '学习者回答与反馈')}</h2>
            ${ui.notice('仅学习记录', html`<p>来自 ${ui.path(g.practice.path)}，因为启动时用 --paths 明确指定才显示。回答与反馈是学习记录，不作为科研证据，也不回流 Wiki。</p>`)}
            ${ui.md(g.practice.html)}` : ''}

            ${doc.html ? html`<details class="dsh-docbox"><summary>${icon('file')}RESEARCH-GUIDE.md 原文</summary>${ui.md(doc.html)}</details>` : ''}
          </article>
          <aside class="dsh-margin" data-scroll-key="margin" aria-label="待答题">
            <h2 class="dsh-margin-h">${ui.pair('Open questions', '当前待答题')} <span class="ef-field">${g.questionsStatus === 'unparsed' ? '未识别' : g.questions.length}</span></h2>
            ${questions(g)}
            <p class="dsh-note">回答、提示和补讲在 research-guide 的对话里进行。工作台不出题、不判分，也不估算掌握度。</p>
            <h2 class="dsh-margin-h">${ui.pair('Answers', '个人回答')}</h2>
            <p class="dsh-note">${g.practice ? '已按 --paths 显示学习记录（见正文）。' : '回答默认只留在对话里；保存到 RESEARCH-PRACTICE.md 并在启动工作台时用 --paths 指定后才显示。'}</p>
            <h2 class="dsh-margin-h">${ui.pair('Boundary', '边界')}</h2>
            <p class="dsh-note">导学帮助读懂方法，不替代实验、查新或效果验证。</p>
            ${ui.ledger([['文件', ui.path(g.file)], ['版本', g.version], ['更新', g.at]])}
          </aside>
        </div>`;
      });
    },
    mount(el, r) { if (r.query.focus) DSH.flash(r.query.focus); },
  };
})();
