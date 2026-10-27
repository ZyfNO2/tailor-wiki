import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWiki } from '../../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';
import { readWorkbench, fingerprint } from '../lib/adapter.mjs';
import { buildFixture } from './fixture.mjs';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-delivery-'));
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

const GUIDE = `# 局部注意力导学

学习目标：读懂局部窗口注意力为什么能补细节。

来源与阅读范围：设计稿全文；src/attn.py 第 1–80 行。

## 阅读路线

| 要弄懂的问题 | 必要概念 | 阅读位置 | 读完能解释什么 | 最小练习 |
| --- | --- | --- | --- | --- |
| 为什么细裂缝会漏 | 感受野 | 设计稿第 2 节 | 漏检与下采样的关系 | 画出 d2 的分辨率 |
| 窗口注意力怎样接入 | 窗口划分 | src/attn.py 第 10 行 | 接入位置与窗口大小 | — |

## 待答题

1. 窗口为 7 时，一个像素能看到多大范围？
2. 为什么接在 d2 之后而不是编码器？
`;

test('guide-only workspace shows goal, route, open questions; learner answers only with explicit --paths', async () => {
  const root = temp();
  write(root, 'RESEARCH-GUIDE.md', GUIDE);
  write(root, 'RESEARCH-PRACTICE.md', '# 练习记录\n\n第 1 题回答：大约 7×7。反馈：表达不清。\n');
  const p = await readWorkbench(root);
  assert.equal(p.empty, false); assert.equal(p.docs.guide.status, 'ok');
  assert.equal(p.guide.goal, '读懂局部窗口注意力为什么能补细节。');
  assert.match(p.guide.scope, /src\/attn\.py/);
  assert.deepEqual(p.guide.route.map(x => [x.step, x.location, x.exercise]), [[1, '设计稿第 2 节', '画出 d2 的分辨率'], [2, 'src/attn.py 第 10 行', null]]);
  assert.equal(p.guide.questions.length, 2); assert.equal(p.guide.questionsStatus, 'ok');
  assert.equal(p.guide.practice, null, 'answers stay hidden unless named in --paths');
  assert.ok(p.files.some(f => f.key === 'guide' && f.status === 'ok'));
  assert.ok(p.skills.find(s => s.id === 'research-guide').output.includes('2 步阅读路线'));
  const shown = await readWorkbench(root, { paths: ['RESEARCH-PRACTICE.md'] });
  assert.equal(shown.guide.practice.path, 'RESEARCH-PRACTICE.md'); assert.match(shown.guide.practice.html, /表达不清/);
  assert.equal(shown.runs.length, 0); assert.equal(shown.retros.length, 0, 'practice is not a report');
  // An unparsable route stays visible as text and is not counted as zero steps.
  write(root, 'RESEARCH-GUIDE.md', '# 导学\n\n## 阅读路线\n\n先读设计稿，再看代码。\n');
  const loose = await readWorkbench(root);
  assert.equal(loose.guide.routeStatus, 'unparsed'); assert.match(loose.guide.routeHtml, /先读设计稿/);
});

test('story opening, existing other forms, goal alignment and retrospectives are shown as written', async () => {
  const root = temp();
  write(root, 'STORY-PLAN.md', `# 叙事

为什么做：细裂缝漏检影响巡检。

遇到什么问题：下采样丢掉细节。

怎样解决：在 d2 之后加局部窗口注意力。

数据支持什么：目前只有历史报告，E1 未运行。

## 贡献—证据表

| 主张 | 来源/Run/产物位置 | 证据状态 |
| --- | --- | --- |
| C1 召回偏低 | 历史报告 | 待验证 |

## 组会汇报提纲

1. 问题
2. 方案
`);
  write(root, 'TAILOR.md', `# 方案

## 目标对齐

| 目标 | 现有依据 | 缺口 | 缺口类别 | 下一步 |
| --- | --- | --- | --- | --- |
| 细裂缝召回 ≥ 0.65 | 设计稿；E1 未运行 | 没有本轮基线 | 实验缺口 | 运行 E1 |
| 说清机制 | 无 | 机制只是推测 | 表达 | 补对照 |
`);
  write(root, 'EXPERIMENT-PLAN.md', `# 实验计划

| 实验标识 | 验证问题/变体 | 状态 |
| --- | --- | --- |
| E1 | 基线 | 阻塞（未找到划分） |
| E2 | A+b | 未运行 |

## E1 复盘

- 原问题与预期：基线召回约 0.61。
- 实际尝试：准备划分时发现文件缺失，未启动训练。
- 下一步：先补齐划分文件。
`);
  write(root, 'reports/progress.md', `# 进度回顾

检查时间：2026-10-27

| 分组 | 事项 | 证据 |
| --- | --- | --- |
| 已交付 | TAILOR.md | TAILOR.md |
| 受阻 | E1 | 未找到划分 |
| 下一步 | 补齐 splits/v2.json | RESEARCH-DAG.md T2 |
`);
  const p = await readWorkbench(root, { paths: ['reports'] });
  assert.deepEqual(p.story.opening.parts.map(x => x.key), ['why', 'problem', 'approach', 'evidence']);
  assert.equal(p.story.formats.length, 1); assert.equal(p.story.formats[0].kind, 'meeting');
  assert.deepEqual(p.schemeTables.alignment.rows.map(r => r.category), ['experiment', 'expression']);
  assert.deepEqual(p.schemeTables.alignment.rows[0].refs, ['plan:E1']);
  assert.equal(p.retros.length, 1); assert.equal(p.retros[0].file, 'EXPERIMENT-PLAN.md');
  assert.deepEqual(p.retros[0].parts.map(x => x.key), ['question', 'attempts', 'next']);
  assert.deepEqual(p.plans.map(x => x.exec), ['blocked', 'pending']);
  // Progress: delivered files, blocked plan, pending plan, and "next" from the written review only.
  assert.ok(p.progress.delivered.some(x => x.text === 'TAILOR.md'));
  assert.ok(p.progress.blocked.some(x => x.ref === 'plan:E1'));
  assert.ok(p.progress.pending.some(x => x.ref === 'plan:E2'));
  assert.deepEqual(p.progress.next.map(x => x.text), ['补齐 splits/v2.json']);
  assert.equal(p.progress.review.file, 'reports/progress.md');
  assert.equal(p.wikiFeedback.find(f => f.key === 'plan').status, 'no-wiki');
});

test('Wiki feedback compares file hashes; originals changed after the snapshot show; fingerprint sees new docs, events and originals', async () => {
  const root = await buildFixture(temp());
  let p = await readWorkbench(root);
  assert.deepEqual(p.wikiFeedback.map(f => [f.key, f.status]), [['plan', 'not-synced'], ['story', 'not-synced']]);
  assert.deepEqual(p.drift, { changed: [], missing: [], unreadable: [] });
  // Register STORY-PLAN.md the way feedback does: as a source of a Wiki commit.
  const wiki = new FileWiki(root), prepared = await wiki.run('prepare', { paths: ['STORY-PLAN.md'], requestScope: { mode: 'full', paths: ['STORY-PLAN.md'] } });
  const story = prepared.sources.find(s => s.path === 'STORY-PLAN.md'), v = story.versions.at(-1);
  await wiki.run('apply', { runId: prepared.runId, baseCommitId: prepared.baseCommitId, draftType: 'fixture', complete: true, pages: [],
    coverageDecisions: [{ path: 'STORY-PLAN.md', status: 'read', sourceId: story.sourceId, revision: v.revision, sha256: v.sha256, reason: 'Fixture.', readRanges: [{ startByte: 0, endByte: Buffer.byteLength(v.text) }] }],
    sourceDispositions: [{ sourceId: story.sourceId, revision: v.revision, disposition: 'no-wiki-needed', reason: 'Fixture: feedback registration only.' }] });
  p = await readWorkbench(root);
  assert.equal(p.wikiFeedback.find(f => f.key === 'story').status, 'synced');
  const before = fingerprint(root);
  fs.appendFileSync(path.join(root, 'STORY-PLAN.md'), '\n- 新的补证事项\n');
  p = await readWorkbench(root);
  assert.equal(p.wikiFeedback.find(f => f.key === 'story').status, 'outdated');
  const afterStory = fingerprint(root); assert.notEqual(afterStory, before);
  // An original changed after the snapshot: content hash differs, Wiki is stale.
  const design = p.sources.find(s => s.path === 'materials/design.md');
  fs.appendFileSync(path.join(root, 'materials/design.md'), '\n补充：窗口改为 9。\n');
  const afterSource = fingerprint(root); assert.notEqual(afterSource, afterStory, 'source originals are part of the fingerprint');
  p = await readWorkbench(root);
  // Both the design note and the fed-back STORY-PLAN.md changed after their snapshot.
  assert.ok(p.drift.changed.includes(design.id)); assert.equal(p.drift.changed.length, 2);
  assert.equal(p.sources.find(s => s.id === design.id).drift, 'changed');
  assert.equal(p.sources.find(s => s.path === 'materials/notes.md').drift, null);
  fs.rmSync(path.join(root, 'materials/report.md'));
  p = await readWorkbench(root);
  assert.equal(p.drift.missing.length, 1);
  // A new guide and a new run event are discovered by the change detector.
  const g0 = fingerprint(root); write(root, 'RESEARCH-GUIDE.md', GUIDE); const g1 = fingerprint(root); assert.notEqual(g1, g0);
  const run = fs.readdirSync(path.join(root, '.wiki/runs'))[0], events = path.join(root, '.wiki/runs', run, 'events');
  const extra = path.join(events, 'zz-fixture-event.json'); fs.writeFileSync(extra, '{}');
  assert.notEqual(fingerprint(root), g1, 'a new run event changes the fingerprint');
  fs.rmSync(extra);
});
