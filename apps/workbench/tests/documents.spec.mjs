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
