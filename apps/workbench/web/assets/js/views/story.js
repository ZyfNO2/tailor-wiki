/* 研究叙事（阅读页，STORY-PLAN.md）
   一句话主线；问题 → 方法变化 → 验证 → 边界；贡献—证据表；
   区分待验证机制、实际观察、已有支持的解释与备选解释；图表安排只显示拟回答的问题、
   已有素材和待制作状态，没有图就不显示成已完成。不生成、不修改论文正文。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, raw, icon } = DSH;
  const ui = DSH.ui;
  DSH.views = DSH.views || {};

  const STATE = { supported: ['verdict', 'supported'], insufficient: ['verdict', 'insufficient'], pending: ['verdict', 'pending'], verifying: ['verdict', 'verifying'], refuted: ['verdict', 'refuted'], unknown: ['verdict', 'unknown'] };
  const stateChip = (s, dim) => ui.st((STATE[s] || STATE.unknown)[0], (STATE[s] || STATE.unknown)[1], { dim });
  const KINDS = [
    ['observed', '实际观察', '运行和审查里直接看到的结果'],
    ['supported', '已有支持的解释', '有来源或实验支持的解释'],
    ['mechanism', '待验证机制', '设计动机或原文观察，本项目还没有直接证据'],
    ['alternative', '备选解释', '同样能解释结果、需要排除的说法'],
  ];
  const ASPECTS = [['observation', '问题观察'], ['performance', '性能收益'], ['mechanism', '机制解释'], ['novelty', '文献新颖性']];

  /* ---------- 实时模式：STORY-PLAN.md 的主线、贡献—证据表、图表安排与补证事项 ---------- */
  function liveStory(p, s, banner) {
    const doc = p.docs.story || {};
    return html`
      <div class="dsh-doc">
        <article class="dsh-sheet is-wide" data-scroll-key="sheet" aria-labelledby="st-title">
          ${banner}
          <p class="ef-crumb ef-field"><span>研究叙事</span><span>${s.file}</span></p>
          <p class="dsh-ids"><span class="dsh-kv-static"><span>文件</span><span>${s.file}</span></span><span class="dsh-kv-static"><span>Skill</span><span>${s.by}</span></span></p>
          ${ui.facts([s.at, s.version, `${s.contributions.length} 项贡献`, `${s.gaps.length} 个补证事项`])}
          <h1 class="dsh-title ef-read" id="st-title">${doc.title || '研究叙事'}</h1>
          <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
          <figure class="dsh-thread">
            <p class="ef-eyebrow slash">Main thread / 一句话主线</p>
            ${s.thread ? html`<blockquote class="ef-read">${s.thread}</blockquote>` : html`<p class="muted">文件中没有写出一句话主线。</p>`}
            <figcaption class="dsh-note">叙事是写作规划，不是性能或机制成立的独立证据。</figcaption>
          </figure>

          <h2 class="dsh-h2">${ui.pair('Contributions × evidence', '贡献—证据表')}</h2>
          ${s.contributions.length ? html`
          <div class="ef-table-wrap">
            <table class="ef-table dsh-contrib">
              <thead><tr><th>主张</th><th>相对已有工作的差异</th><th>来源 / Run / 产物（原文）</th><th>证据性质</th><th>支持状态</th><th>局限或缺口</th></tr></thead>
              <tbody>${s.contributions.map((c) => html`<tr id="contrib-${c.id}">
                <td><span class="dsh-id">${c.id}</span> <span class="ef-read">${c.text}</span></td>
                <td>${ui.val(c.diff)}</td>
                <td>${ui.val(c.evidenceText, '没有写来源')}${c.refs.length ? html`<div>${ui.refs(c.refs, { idOnly: true })}</div>` : ''}</td>
                <td>${(c.provenance || []).length ? html`<span class="dsh-chiprow">${c.provenance.map((k) => ui.st('prov', k))}</span>` : ui.st('prov', 'unknown')}</td>
                <td>${stateChip(c.state)}${c.statusText ? html`<div class="ef-field">${c.statusText}</div>` : ''}</td>
                <td>${ui.val(c.gapText, '无')}</td>
              </tr>`)}</tbody>
            </table>
          </div>
          <p class="dsh-note">证据性质（报告记载、已核验结果文件、本轮实际运行、模拟、假设）与支持状态分开显示，都只取单元格原文：运行过不等于支持，模拟不等于本轮真实实验。关联对象只在 ID 实际出现时连上。</p>` : html`<p class="ef-empty">没有找到贡献—证据表（需要“主张”与“证据 / 来源”列）。</p>`}

          ${s.figures.length ? html`
          <h2 class="dsh-h2">${ui.pair('Figures', '关键图表安排')}</h2>
          <p class="dsh-note">只列计划：没有做出来的图不画成成品。</p>
          <ol class="dsh-ul ef-read">${s.figures.map((f) => html`<li id="fig-${f.id}"><b>${f.title}</b>${f.question ? html` │ 拟回答：${f.question}` : ''}${f.materials ? html` │ 素材：${f.materials}` : ''}${f.statusText ? html` <span class="ef-field">${f.statusText}</span>` : ''}</li>`)}</ol>` : ''}

          ${s.weak && s.weak.length ? html`
          <h2 class="dsh-h2">${ui.pair('Avoid', '目前不宜使用的强表述')}</h2>
          <ul class="dsh-ul ef-read">${s.weak.map((w) => html`<li>${w}</li>`)}</ul>` : ''}

          ${doc.html ? html`<details class="dsh-docbox"><summary>${icon('file')}STORY-PLAN.md 原文</summary>${ui.md(doc.html)}</details>` : ''}
        </article>
        <aside class="dsh-margin" data-scroll-key="margin" aria-label="补证事项">
          <h2 class="dsh-margin-h">${ui.pair('Evidence gaps', '最少补证事项')} <span class="ef-field">${s.gaps.length}</span></h2>
          ${s.gaps.length ? html`<ol class="dsh-gaps">${s.gaps.map((g) => html`<li id="gap-${g.id}"><p><span class="dsh-id">${g.id}</span> <b>${g.text}</b></p></li>`)}</ol>` : html`<p class="ef-empty">文件中没有补证事项小节。</p>`}
          <p class="ef-actions">${ui.btn('跳到实验计划', { act: 'go', data: { href: '#/experiments/plan' } })}</p>
          <h2 class="dsh-margin-h">${ui.pair('Boundary', '边界')}</h2>
          <p class="dsh-note">这一页只展示 STORY-PLAN.md，不生成或修改论文正文。</p>
          ${ui.ledger([['文件', ui.path(s.file)], ['版本', s.version], ['更新', s.at]])}
        </aside>
      </div>`;
  }

  DSH.views.story = {
    layout: 'fixed',
    title: () => '研究叙事',
    render(r) {
      const db = DSH.db();
      const p = db.p;
      const meta = {
        head: html`<div class="dsh-page">${ui.head({ zh: '研究叙事', en: 'Story' })}</div>`,
        key: 'story', file: 'STORY-PLAN.md', skill: 'research-story',
        emptyTitle: '还没有研究叙事。',
        emptyText: '叙事由 research-story 写入 STORY-PLAN.md：一句话主线、贡献与证据的对应、图表安排。工作台不会替你生成或修改论文正文。',
        error: 'STORY-PLAN.md 第 58 行：贡献表的“证据”列引用了不存在的运行 R-E9-01。其余内容可读（选“部分读取”查看断链如何显示）。',
        partial: 'STORY-PLAN.md 中 1 处引用找不到对象（R-E9-01），已显示为断链；其余内容正常显示。',
      };
      return ui.withState(meta, (banner) => {
        const s = p.story;
        DSH.state.pageLabel = '研究叙事';
        if (s.live) return liveStory(p, s, banner);
        const done = s.figures.filter((f) => f.status === 'done').length;
        return html`
        <div class="dsh-doc">
          <article class="dsh-sheet is-wide" data-scroll-key="sheet" aria-labelledby="st-title">
            ${banner}
            <p class="ef-crumb ef-field"><span>研究叙事</span><span>${s.file} ${s.version}</span></p>
            <p class="dsh-ids">${ui.id(s.version, 'is-here')}<span class="dsh-kv-static"><span>文件</span><span>${s.file}</span></span><span class="dsh-kv-static"><span>Skill</span><span>${s.by}</span></span></p>
            ${ui.facts([s.at, `${s.contributions.length} 项贡献`, `${s.gaps.length} 个证据缺口`, `图表完成 ${done} / ${s.figures.length}`])}
            <h1 class="dsh-title ef-read" id="st-title">研究叙事</h1>
            <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
            <figure class="dsh-thread">
              <p class="ef-eyebrow slash">Main thread / 一句话主线（草案）</p>
              <blockquote class="ef-read">${s.thread}</blockquote>
              <figcaption class="dsh-chiprow">${ui.st('decision', s.choice, { dim: true, text: '主线尚未选定' })}<span class="dsh-note">当前写的是主线 A；主线 B 见下方“主线建议”。</span></figcaption>
            </figure>
            ${DSH.state.proto === 'partial' ? html`<p class="dsh-note">断链示例：${ui.ref('run:R-E9-01')}</p>` : ''}

            <h2 class="dsh-h2">${ui.pair('Structure', '问题 → 方法变化 → 验证 → 边界')}</h2>
            <ol class="dsh-argue">${s.structure.map((x, i) => html`
              <li class="is-${x.state}">
                <p class="dsh-argue-h"><b class="ef-field">${DSH.fmt.pad(i + 1)}</b><span class="ef-pair"><span class="ef-eyebrow">${x.en}</span><span>${x.zh}</span></span></p>
                <p class="ef-read">${x.text}</p>
                <p class="dsh-chiprow">${stateChip(x.state)}</p>
                <p>${ui.refs(x.refs, { idOnly: true })}</p>
                ${x.note ? html`<p class="dsh-note">${x.note}</p>` : ''}
              </li>`)}</ol>

            <h2 class="dsh-h2">${ui.pair('Contributions × evidence', '贡献—证据表')}</h2>
            <div class="ef-table-wrap">
              <table class="ef-table dsh-contrib">
                <thead><tr><th>贡献</th><th>方面</th><th>证据（方案 / 运行 / 来源）</th><th>支持状态</th><th>缺口</th></tr></thead>
                <tbody>${s.contributions.map((c) => html`<tr id="contrib-${c.id}">
                  <td><span class="dsh-id">${c.id}</span> <span class="ef-read">${c.text}</span></td>
                  <td>${ui.st('aspect', c.aspect)}</td>
                  <td>${c.refs.length ? ui.refs(c.refs, { idOnly: true }) : html`<span class="dsh-missing">没有证据</span>`}</td>
                  <td>${stateChip(c.state)}</td>
                  <td>${c.gaps.length ? ui.refs(c.gaps.map((g) => 'gap:' + g), { idOnly: true }) : html`<span class="muted">无</span>`}</td>
                </tr>`)}</tbody>
              </table>
            </div>
            <p class="dsh-note">文献新颖性、性能收益和机制解释分开呈现：一项性能结果不能顺带证明机制，也不能证明新颖。</p>

            <h2 class="dsh-h2">${ui.pair('Claims', '论断的性质')}</h2>
            <div class="dsh-lanes">${KINDS.map(([k, zh, d]) => {
              const cl = s.claims.filter((c) => c.kind === k);
              return html`<section class="dsh-lane is-${k}">
                <h3>${ui.st('claim', k)}</h3>
                <p class="dsh-note">${d}</p>
                <ul>${cl.map((c) => html`<li><span class="ef-read">${c.text}</span>${c.refs.length ? html`<span class="orefs">${c.refs.map((x) => ui.ref(x, { idOnly: true }))}</span>` : ''}${c.note ? html`<span class="dsh-note">${c.note}</span>` : ''}</li>`)}</ul>
              </section>`;
            })}</div>

            <h2 class="dsh-h2">${ui.pair('Figures', '图表安排')}</h2>
            <p class="dsh-note">图表只列计划：拟回答的问题、已有素材、待制作状态。没有做出来的图不画成成品，也不放示意曲线。</p>
            <div class="dsh-figs">${s.figures.map((f) => html`
              <section class="dsh-fig" id="fig-${f.id}">
                <div class="dsh-figph" aria-hidden="true"><span>${f.id}</span><b>未制作</b></div>
                <div>
                  <p class="dsh-chiprow">${ui.id(f.id)}${ui.st('fig', f.status)}</p>
                  <h3>${f.title}</h3>
                  ${ui.kv([['拟回答', f.question], ['已有素材', f.materials]])}
                  ${f.refs.length ? html`<p>${ui.refs(f.refs, { idOnly: true })}</p>` : ''}
                </div>
              </section>`)}</div>

            <h2 class="dsh-h2">${ui.pair('Storylines', '主线建议与取舍')}</h2>
            <div class="dsh-storylines">${s.storylines.map((l) => html`
              <section class="dsh-storyline">
                <p class="dsh-chiprow">${ui.id(l.id)}<b>${l.name}</b></p>
                <p class="ef-read">${l.thread}</p>
                ${ui.kv([['需要的证据', l.needs], ['风险', l.risk], ['用到的贡献', ui.refs(l.fits.map((x) => 'contrib:' + x), { idOnly: true })]])}
              </section>`)}</div>
            <p class="dsh-chiprow">${ui.st('decision', s.choice, { dim: true, text: '建议中：等研究者选择' })}</p>
          </article>
          <aside class="dsh-margin" data-scroll-key="margin" aria-label="缺口与方面">
            <h2 class="dsh-margin-h">${ui.pair('Evidence gaps', '证据缺口')} <span class="ef-field">${s.gaps.length}</span></h2>
            <ol class="dsh-gaps">${s.gaps.map((g) => html`<li id="gap-${g.id}">
              <p><span class="dsh-id">${g.id}</span> <b>${g.text}</b></p>
              <p class="dsh-note">下一步：${g.next}</p>
              ${g.refs.length ? html`<p>${ui.refs(g.refs, { idOnly: true })}</p>` : html`<p class="dsh-gap-t">实验计划里没有对应的行</p>`}
            </li>`)}</ol>
            <p class="ef-actions">${ui.btn('跳到实验计划', { act: 'go', data: { href: '#/experiments/plan' } })}</p>
            <h2 class="dsh-margin-h">${ui.pair('Aspects', '分开看的三个方面')}</h2>
            ${ui.ledger(ASPECTS.map(([k, zh]) => {
              const cs = s.contributions.filter((c) => c.aspect === k);
              return [zh, cs.map((c) => c.id + ' ' + ui.label('verdict', c.state)).join('；') || '无', cs.some((c) => c.state !== 'supported')];
            }))}
            <h2 class="dsh-margin-h">${ui.pair('Boundary', '边界')}</h2>
            <p class="dsh-note">这一页只展示 STORY-PLAN.md。不默认生成或修改论文正文；叙事润色不会改变实验结果。</p>
            ${ui.ledger([['文件', ui.path(s.file)], ['版本', s.version], ['更新', s.at]])}
          </aside>
        </div>`;
      });
    },
    mount(el, r) { if (r.query.focus) DSH.flash(r.query.focus); },
  };
})();
