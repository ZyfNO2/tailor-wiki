import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execOf, decisionOf, verdictOf, provenanceOf, parseStory } from '../lib/documents.mjs';

const check = (fn, cases) => { for (const [input, want] of Object.entries(cases)) assert.deepEqual(fn(input), want, JSON.stringify(input)); };

test('execution status: negation and blocking win; unrecognised stays unknown', () => {
  check(execOf, {
    incomplete: 'pending', Incomplete: 'pending', 'not done': 'pending', 'not yet started': 'pending', 'not run': 'pending',
    'blocked (not run)': 'blocked', '未运行（阻塞）': 'blocked', '阻塞：缺数据': 'blocked', 'on hold': 'blocked',
    '计划（未运行）': 'pending', '未完成': 'pending', '尚未开始': 'pending', '待运行': 'pending',
    '已完成': 'done', '完成': 'done', done: 'done', Completed: 'done', '已交付': 'done',
    failed: 'failed', '失败：OOM': 'failed', '运行中': 'running', 'in progress': 'running', '已取消': 'cancelled',
    '部分完成': 'unknown', '待讨论': 'unknown', 'to be discussed': 'unknown', '': 'unknown', '—': 'unknown',
  });
});

test('decision: negated authorisation or selection never counts; only stated decisions do', () => {
  check(decisionOf, {
    '未授权': null, '未授权代选': null, 'not selected': null, 'not yet approved': null, '': null,
    '尚未选定方案，也未授权代理选择 → 全部方案决策状态 建议中': 'suggested',
    '用户已选定 S2': 'selected', '已选 S1': 'selected', 'selected by the user': 'selected',
    '授权代理选择': 'delegated', '用户授权代选': 'delegated', delegated: 'delegated',
    '建议中': 'suggested', 'not yet approved; proposed': 'suggested',
  });
});

test('evidence provenance is separate from support status; running is not support, simulation is not real', () => {
  check(provenanceOf, {
    '历史报告记载': ['historical'], '论文报告值': ['historical'], '已核验原始结果文件': ['verified'],
    '本轮实际运行': ['current'], '模拟结果': ['simulated'], '假设': ['hypothesis'],
    '本轮未运行': [], '没有模拟': [], '': [], '证据不足': [],
    '历史报告记载；本轮实际运行复现': ['historical', 'current'],
  });
  check(verdictOf, {
    '本轮实际运行': 'unknown', '已运行': 'unknown', '模拟结果': 'unknown',
    '支持': 'supported', '有证据支持': 'supported', '模拟结果支持': 'supported',
    '不支持': 'refuted', '被反驳': 'refuted', '证据不足': 'insufficient', '待核实': 'verifying',
    '待验证': 'pending', '假设': 'pending', '仅方案': 'pending', '': 'unknown', '待讨论': 'unknown',
  });
});

test('story contributions keep provenance, support status and the original wording', () => {
  const md = '# 叙事\n\n## 贡献—证据表\n\n| 主张 | 来源/Run/产物位置 | 证据状态 |\n|---|---|---|\n| A 有效 | 本轮实际运行 R3 | 证据不足 |\n| B 有效 | 模拟 | 模拟结果支持 |\n| C 存在 | 历史报告记载 | — |\n';
  const s = parseStory(md);
  assert.deepEqual(s.contributions.map(c => [c.provenance, c.state, c.statusText]), [[['current'], 'insufficient', '证据不足'], [['simulated'], 'supported', '模拟结果支持'], [['historical'], 'unknown', '—']]);
});

test('story gaps and banned wording come from lists or tables without duplicates; unreadable sections are not zero', () => {
  const s = parseStory('# S\n\n## 最少补证事项\n\n| 缺口 | 下一步 |\n|---|---|\n| 基线口径未核对 | 运行 E1 |\n| 缺划分文件 | 补齐 splits |\n| 基线口径未核对 | 运行 E1 |\n\n## 禁用表述\n\n- 首次提出\n- 显著优于所有方法\n- 首次提出\n');
  assert.deepEqual(s.gaps.map(g => [g.text, g.next]), [['基线口径未核对', '运行 E1'], ['缺划分文件', '补齐 splits']]);
  assert.equal(s.gapsStatus, 'ok'); assert.deepEqual(s.weak, ['首次提出', '显著优于所有方法']); assert.equal(s.weakStatus, 'ok');
  const list = parseStory('# S\n\n## 补证事项\n\n1. 先运行 E1\n   - 细节：确认口径\n2. 补齐划分文件\n\n## 目前不宜使用的强表述\n\n| 表述 | 原因 |\n|---|---|\n| 首次 | 未查新 |\n');
  assert.deepEqual(list.gaps.map(g => g.text), ['先运行 E1', '补齐划分文件']); assert.deepEqual(list.weak, ['首次']);
  const prose = parseStory('# S\n\n## 最少补证事项\n\n目前只需要补一次基线运行，其余待讨论。\n');
  assert.equal(prose.gapsStatus, 'unparsed'); assert.deepEqual(prose.gaps, []); assert.match(prose.gapsHtml, /补一次基线运行/);
  const none = parseStory('# S\n\n## 一句话主线\n\n主线。\n');
  assert.equal(none.gapsStatus, 'missing'); assert.equal(none.weakStatus, 'missing');
});

test('story opening answers the four questions; optional talk formats are listed only when present', async () => {
  const { parseStory: ps } = await import('../lib/documents.mjs');
  const labeled = ps('# 细裂缝故事\n\n证据状态：待验证设计故事\n\n**为什么做：** 细裂缝漏检会让巡检漏掉早期损伤。\n\n**遇到的问题：** 下采样丢失细节。\n\n**怎样解决：** 在解码器加入局部窗口注意力。\n\n**数据支持什么：** 目前只有设计，E1 未运行。\n\n## 证据附录\n\n内容。\n\n## 组会汇报提纲\n\n- 第一页：问题\n');
  assert.deepEqual(labeled.opening.parts.map(p => p.key), ['why', 'problem', 'approach', 'evidence']);
  assert.equal(labeled.opening.statusLine, '待验证设计故事');
  assert.deepEqual(labeled.formats.map(f => f.kind), ['meeting']);
  const plain = ps('# 故事\n\n第一段讲动机。\n\n第二段讲问题。\n\n## 贡献—证据表\n');
  assert.equal(plain.opening.parts, null); assert.match(plain.opening.html, /第一段讲动机/);
  assert.equal(ps('# 故事\n\n## 只有小节\n').opening, null);
});

test('research guide: goal, reading scope, route steps and pending questions', async () => {
  const { parseGuide } = await import('../lib/documents.mjs');
  const md = '# 研究导学\n\n学习目标：弄懂局部窗口注意力。\n\n来源与阅读范围：p01 第 3–4 页已读；第 6 节未读。\n\n## 阅读路线\n\n| 要弄懂的问题 | 必要概念 | 阅读位置 | 读完能解释什么 | 最小练习 |\n|---|---|---|---|---|\n| 为什么是线性复杂度 | 自注意力 | p01 第 3 页；attn.py:L40 | 计算量与窗口的关系 | 估算 128×128 的计算量 |\n| 移位窗口有什么用 | 跨窗口信息 | p01 第 4 页 | 信息如何跨窗口 | 画出两层窗口 |\n\n## 待回答的理解题\n\n1. 窗口改成 14 时计算量怎么变？\n2. 为什么需要移位？\n';
  const g = parseGuide(md);
  assert.equal(g.goal, '弄懂局部窗口注意力。'); assert.match(g.scope, /第 6 节未读/);
  assert.equal(g.routeStatus, 'ok'); assert.equal(g.route.length, 2);
  assert.deepEqual(Object.keys(g.route[0]).filter(k => g.route[0][k]), ['step', 'question', 'concepts', 'location', 'outcome', 'exercise', 'line']);
  assert.deepEqual(g.questions, ['窗口改成 14 时计算量怎么变？', '为什么需要移位？']); assert.equal(g.questionsStatus, 'ok');
  const prose = parseGuide('# 导学\n\n## 阅读路线\n\n先读第三节，再看代码。\n');
  assert.equal(prose.routeStatus, 'unparsed'); assert.equal(prose.questionsStatus, 'missing');
});

test('experiment retrospective and progress review are read from their sections, never invented', async () => {
  const { parseRetro } = await import('../lib/documents.mjs');
  const md = '# 实验计划\n\n| 实验标识 | 状态 |\n|---|---|\n| E1 | 失败 |\n\n## E1 复盘\n\n- 原问题与预期：细裂缝召回是否偏低\n- 实际尝试：batch 16，OOM 后改 8\n- 观察与失败：第一次 OOM\n- 解释边界：只有一个种子\n- 下一步：补两个种子\n\n## 进度回顾\n\n检查时间：2026-10-27 10:00\n\n| 分组 | 事项 | 证据 |\n|---|---|---|\n| 已交付 | TAILOR.md | TAILOR.md |\n| 受阻 | E2 | 缺划分文件 |\n| 待验证 | C2 | 尚无运行 |\n| 下一步 | 补划分文件 | — |\n';
  const r = parseRetro(md, 'EXPERIMENT-PLAN.md');
  assert.equal(r.retros.length, 1);
  assert.deepEqual(r.retros[0].parts.map(p => p.key), ['question', 'attempts', 'observations', 'interpretation', 'next']);
  assert.equal(r.progress.checkedAt, '2026-10-27 10:00');
  assert.deepEqual(Object.fromEntries(Object.entries(r.progress.groups).map(([k, v]) => [k, v.map(x => x.text)])), { delivered: ['TAILOR.md'], blocked: ['E2'], pending: ['C2'], next: ['补划分文件'] });
  assert.deepEqual(parseRetro('# 计划\n\n| 实验标识 | 状态 |\n|---|---|\n| E1 | 未运行 |\n', 'EXPERIMENT-PLAN.md'), { retros: [], progress: null });
});

test('multi-ID edges, priority-first gap tables and labelled guide questions preserve their content', async () => {
  const { parseDag, parseGuide, parseStory } = await import('../lib/documents.mjs');
  const dag = '| 任务 ID | 目标 |\n|---|---|\n| A | a |\n| B | b |\n| C | c |\n\n| 前置 | 后续 |\n|---|---|\n| A+B | C、MISSING |';
  const parsed = parseDag(dag);
  assert.deepEqual(parsed.edges.map(e => [e.from, e.to]), [['A','C'],['A','MISSING'],['B','C'],['B','MISSING']]);
  assert.equal(parseDag(dag.replace('C、MISSING', 'C 或 MISSING')).warnings.length, 1);
  const story = parseStory('# 故事\n## 补证事项\n| 优先级 | 需要补什么 |\n|---|---|\n| 1 | 核对误差 |\n| 2 | 补充消融 |');
  assert.deepEqual(story.gaps.map(x => x.text), ['核对误差','补充消融']);
  assert.equal(story.gapsStatus, 'ok');
  const unknown = parseStory('# 故事\n## 补证事项\n| 优先级 | 未知列 |\n|---|---|\n| 1 | 不可丢失 |');
  assert.equal(unknown.gapsStatus, 'unparsed'); assert.deepEqual(unknown.gaps, []); assert.match(unknown.gapsHtml, /不可丢失/);
  const guide = parseGuide('# 导学\n## 理解题\n**题目**：\n\n> AUC 升而 ECE 恶化意味着什么？');
  assert.deepEqual(guide.questions, ['AUC 升而 ECE 恶化意味着什么？']); assert.equal(guide.questionsStatus, 'ok');
});

test('tailor goal alignment separates expression, evidence, experiment and method gaps', async () => {
  const { parseTailor } = await import('../lib/documents.mjs');
  const md = '# 方案\n\n## 目标对齐\n\n| 目标 | 现有依据 | 缺口 | 类别 | 下一步 |\n|---|---|---|---|---|\n| 提高细裂缝召回 | E1 报告 | 证据不足 | 证据缺口 | 运行 E1 |\n| 讲清动机 | 草稿 | 表述不清 | 表达不清 | 改写叙事 |\n| 跨数据集泛化 | 无 | 没有对应实验 | 实验缺口 | 设计 E5 |\n| 实时性 | — | 现有模块太慢 | 方法缺口 | 换模块 |\n| 噪声标注 | 已有对照 | — | 已有支持 | — |\n| 部署平台 | ？ | 待确认 | 待确认 | 问用户 |\n';
  const t = parseTailor(md);
  assert.deepEqual(t.alignment.rows.map(r => r.category), ['evidence', 'expression', 'experiment', 'method', 'supported', 'pending']);
  assert.equal(t.alignment.rows[0].goal, '提高细裂缝召回'); assert.equal(t.alignment.rows[0].next, '运行 E1');
  assert.equal(parseTailor('# 方案\n\n## 方案 S1：A+b\n\n内容。\n').alignment, null);
});
