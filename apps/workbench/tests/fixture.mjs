// Synthetic workspace for workbench tests and local preview. Two real Wiki
// commits through the repository runtime plus the four Skill artifacts in
// their prescribed table formats. Fixture content only: no research result.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FileWiki } from '../../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';

const bytes = s => Buffer.byteLength(s);
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
function cite(prepared, file, quote) {
  const source = prepared.sources.find(s => s.path === file), v = source.versions.at(-1), at = v.text.indexOf(quote);
  if (at < 0) throw new Error(`fixture quote not found in ${file}: ${quote}`);
  const startByte = bytes(v.text.slice(0, at));
  return { sourceId: source.sourceId, revision: v.revision, startByte, endByte: startByte + bytes(quote), quote };
}
// Map each listed piece of content/summary to its citations (pieces must
// cover every non-whitespace byte, as the runtime requires).
function evidence(field, text, pieces) {
  return pieces.map(([id, piece, citations]) => {
    const at = text.indexOf(piece);
    if (at < 0) throw new Error(`fixture piece not found: ${piece}`);
    const startByte = bytes(text.slice(0, at));
    return { id, target: { field, startByte, endByte: startByte + bytes(piece), quote: piece }, citations };
  });
}
const read = (prepared, file) => { const s = prepared.sources.find(x => x.path === file), v = s.versions.at(-1); return { path: file, status: 'read', sourceId: s.sourceId, revision: v.revision, sha256: v.sha256, reason: 'Fixture: whole file read.', readRanges: [{ startByte: 0, endByte: bytes(v.text) }] }; };

export async function buildFixture(root) {
  write(root, 'materials/design.md', '# 裂缝分割设计稿\n\n本方案提出在基线 A 的解码器中插入局部窗口注意力。\n\n目标：细裂缝召回不低于 0.65。\n');
  write(root, 'materials/report.md', '# 历史报告\n\n2025 年报告记载：基线 A 的细裂缝召回为 0.61。\n\n该报告采用实例级指标与随机划分。\n');
  write(root, 'materials/slides.pptx', 'binary placeholder');
  const wiki = new FileWiki(root);
  const scope = { paths: ['materials'], requestScope: { mode: 'full', paths: ['materials'] } };

  let p = await wiki.run('prepare', scope);
  const c1 = '基线 A 是多尺度编码-解码分割网络。\n\n| 指标 | 记载值 |\n| --- | --- |\n| 细裂缝召回 | 0.61 |\n\n报告采用实例级指标，与本轮口径不同。';
  const s1 = '基线 A 的历史记载。';
  const c2 = '设计稿提出在 [[baseline-a|基线 A]] 的解码器中插入局部窗口注意力。\n\n设计目标为细裂缝召回不低于 0.65。';
  const s2 = '局部窗口注意力接入方案（设计稿）。';
  await wiki.run('apply', {
    runId: p.runId, baseCommitId: p.baseCommitId, draftType: 'fixture', complete: true,
    coverageDecisions: [read(p, 'materials/design.md'), read(p, 'materials/report.md')],
    pages: [
      { pageId: 'baseline-a', title: '基线 A', pageType: 'entity', category: ['方法与模块'], aliases: ['Baseline A'], summary: s1, content: c1, expectedVersion: 0, expectedHash: null, evidence: [
        ...evidence('content', c1, [['def', '基线 A 是多尺度编码-解码分割网络。', [cite(p, 'materials/design.md', '基线 A')]], ['table', '| 指标 | 记载值 |\n| --- | --- |\n| 细裂缝召回 | 0.61 |', [cite(p, 'materials/report.md', '基线 A 的细裂缝召回为 0.61')]], ['protocol', '报告采用实例级指标，与本轮口径不同。', [cite(p, 'materials/report.md', '该报告采用实例级指标与随机划分。')]]]),
        ...evidence('summary', s1, [['sum', s1, [cite(p, 'materials/report.md', '2025 年报告记载')]]]),
      ] },
      { pageId: 'crack-seg', title: '局部窗口注意力接入', pageType: 'concept', category: ['方法与模块'], summary: s2, content: c2, expectedVersion: 0, expectedHash: null, evidence: [
        ...evidence('content', c2, [['plan', '设计稿提出在 [[baseline-a|基线 A]] 的解码器中插入局部窗口注意力。', [cite(p, 'materials/design.md', '本方案提出在基线 A 的解码器中插入局部窗口注意力。')]], ['goal', '设计目标为细裂缝召回不低于 0.65。', [cite(p, 'materials/design.md', '目标：细裂缝召回不低于 0.65。')]]]),
        ...evidence('summary', s2, [['sum', s2, [cite(p, 'materials/design.md', '裂缝分割设计稿')]]]),
      ] },
    ],
  });

  // Second commit: the design changes, one page is rewritten, an issue is
  // recorded and one page receives an explicit semantic review.
  write(root, 'materials/design.md', '# 裂缝分割设计稿\n\n本方案提出在基线 A 的解码器 d2 之后插入局部窗口注意力，窗口为 7。\n\n目标：细裂缝召回不低于 0.65。\n');
  write(root, 'materials/notes.md', '# 组会记录\n\n讨论了标注噪声。\n\n下半部分是未整理的草稿。\n');
  p = await wiki.run('prepare', scope);
  const old = id => p.pages.find(x => x.pageId === id);
  const c2b = '设计稿提出在 [[baseline-a|基线 A]] 的解码器 d2 之后插入局部窗口注意力，窗口为 7。\n\n- 接入位置：d2 之后\n- 窗口：7\n\n设计目标为细裂缝召回不低于 0.65；这是计划，不是结果。';
  const baseA = old('baseline-a');
  const notes = p.sources.find(s => s.path === 'materials/notes.md'), nv = notes.versions.at(-1);
  await wiki.run('apply', {
    runId: p.runId, baseCommitId: p.baseCommitId, draftType: 'fixture', complete: true,
    coverageDecisions: [read(p, 'materials/design.md'), { ...read(p, 'materials/report.md'), status: 'reuse' }, { path: 'materials/notes.md', status: 'partial', reason: 'Fixture: only the first half was read.', readRanges: [{ startByte: 0, endByte: bytes('# 组会记录\n\n讨论了标注噪声。\n') }] }],
    sourceContexts: p.sources.filter(s => s.path !== 'materials/notes.md').map(s => ({ sourceId: s.sourceId, revision: s.versions.at(-1).revision, title: path.basename(s.path), documentType: s.path.includes('report') ? '历史报告' : '设计方案', date: s.path.includes('report') ? '2025' : '2026-10', summary: 'Fixture source context.', attribution: 'Fixture author' })),
    pages: [
      { pageId: 'crack-seg', title: '局部窗口注意力接入', pageType: 'concept', category: ['方法与模块'], summary: s2, content: c2b, expectedVersion: old('crack-seg').version, expectedHash: old('crack-seg').contentHash, changeReason: '设计稿更新了接入位置与窗口大小。', evidence: [
        ...evidence('content', c2b, [['plan', '设计稿提出在 [[baseline-a|基线 A]] 的解码器 d2 之后插入局部窗口注意力，窗口为 7。', [cite(p, 'materials/design.md', '本方案提出在基线 A 的解码器 d2 之后插入局部窗口注意力，窗口为 7。')]], ['where', '- 接入位置：d2 之后\n- 窗口：7', [cite(p, 'materials/design.md', '解码器 d2 之后插入局部窗口注意力，窗口为 7')]], ['goal', '设计目标为细裂缝召回不低于 0.65；这是计划，不是结果。', [cite(p, 'materials/design.md', '目标：细裂缝召回不低于 0.65。')]]]),
        ...evidence('summary', s2, [['sum', s2, [cite(p, 'materials/design.md', '裂缝分割设计稿')]]]),
      ] },
      { pageId: 'baseline-a', title: baseA.title, pageType: baseA.pageType, category: baseA.category, aliases: baseA.aliases, summary: s1, content: c1, expectedVersion: baseA.version, expectedHash: baseA.contentHash,
        evidence: [
          ...evidence('content', c1, [['def', '基线 A 是多尺度编码-解码分割网络。', [cite(p, 'materials/design.md', '基线 A')]], ['table', '| 指标 | 记载值 |\n| --- | --- |\n| 细裂缝召回 | 0.61 |', [cite(p, 'materials/report.md', '基线 A 的细裂缝召回为 0.61')]], ['protocol', '报告采用实例级指标，与本轮口径不同。', [cite(p, 'materials/report.md', '该报告采用实例级指标与随机划分。')]]]),
          ...evidence('summary', s1, [['sum', s1, [cite(p, 'materials/report.md', '2025 年报告记载')]]]),
        ],
        review: { status: 'reviewed', reviewer: 'fixture-reviewer', scope: 'Fixture: cited report and design reread.', checks: ['def', 'table', 'protocol', 'sum'].map(evidenceId => ({ evidenceId, assessment: 'supported', reason: 'Fixture check.' })) } },
    ],
    issues: [{ issueId: 'metric-protocol', type: 'conflict', description: '历史报告与本轮的细裂缝召回口径不同。实例级与像素级不能直接比较。', reportedBy: 'fixture', status: 'open', pageIds: ['baseline-a'], evidenceRefs: [{ pageId: 'baseline-a', evidenceId: 'protocol' }], sourceIds: [p.sources.find(s => s.path === 'materials/report.md').sourceId] }],
    sourceDispositions: [{ sourceId: notes.sourceId, revision: nv.revision, disposition: 'no-wiki-needed', reason: 'Fixture: meeting notes, nothing to file yet.' }],
  });

  write(root, 'TAILOR.md', `# 学术裁缝方案

## 任务与约束

研究问题：局部细节建模能否改善细裂缝召回？

决策状态：建议中，等待用户选定

## 方案 S1：A + b（解码器插入）

在基线 A 的解码器 d2 之后插入局部窗口注意力，见 [[crack-seg]]。

- 技术就绪：可设计（尚不可试跑）
- 证据状态：待核实
- 最小验证：E1 对 E2

## 方案 S2：A + c（并联全局上下文）

用并联分支补充全局上下文。

- 技术就绪：可试跑
- 证据状态：部分支持

## 证据与就绪检查

| 检查项 | 实际证据/版本/位置 | 核验状态与缺口 | 受阻步骤及最小预检 |
| --- | --- | --- | --- |
| 原方法、指标定义 | 设计稿第 3 行 | 转述待核对 | 同名指标不可混比 |
| 数据与监督 | 未找到划分文件 | 未找到 | 阻塞 T2 |

## 模块来源表

| 模块 | 出处/页码或代码位置 | 原作用 | 拟改动 |
| --- | --- | --- | --- |
| b 局部窗口注意力 | 设计稿第 3 行 | 增强边缘响应 | 只插入 d2 之后 |
`);
  write(root, 'RESEARCH-DAG.md', `# 研究任务 DAG

## 节点

| 任务 ID | 关联方案 | 目标 | 输入 | 预期产物 | 状态 | 阻塞原因 |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | S1 | 核对接口与原文 | TAILOR.md | 核对记录 | 已完成 | — |
| T2 | S1 | 准备固定划分 | 数据目录 | splits/v2.json | 阻塞 | 未找到划分文件 |
| T3 | S1 | 运行 E1 基线 | splits/v2.json | runs/E1 | 未运行 | — |

## 依赖

| 前置 | 后续 | 所需产物/条件 |
| --- | --- | --- |
| T1 | T2 | 核对记录 |
| T2 | T3 | splits/v2.json |
| T9 | T3 | 外部评测脚本 |

\`\`\`mermaid
graph LR; T1 --> T2; T2 --> T3
\`\`\`
`);
  write(root, 'EXPERIMENT-PLAN.md', `# 实验计划

实验设计只交付计划；未授权运行。

| 实验标识 | 验证问题/变体 | 数据与配置 | 依赖 | 指标与判定 | 预算 | 产物位置 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | 基线 A 在固定划分上的细裂缝召回 | splits/v2.json；configs/a.yaml | T2 | 细裂缝召回；只记录 | 待先导测量 | runs/E1/ | 未运行 |
| E2 | S1：A+b 对 A 的差异 | 同 E1 | E1、T3 | 细裂缝召回提升且 mIoU 下降不超过 1.0 | 待定 | runs/E2/ | 计划 |
`);
  write(root, 'STORY-PLAN.md', `# 研究叙事方案

一句话主线：细裂缝漏检可能来自局部细节丢失；S1 检验在解码器加入局部窗口注意力能否改善召回（待验证）。

## 贡献—证据表

| 主张 | 相对已有工作的差异 | 来源/Run/产物位置 | 证据状态 | 局限或缺口 |
| --- | --- | --- | --- | --- |
| 基线在细裂缝上召回偏低 | 本项目固定划分复核 | 报告记载；E1 未运行；baseline-a | 待验证 | 历史口径不同 |
| A+b 改善细裂缝召回 | 接入位置在解码器 | S1；E2 | 待验证 | 尚无运行 |

## 关键图表安排

- 细裂缝漏检示例：拟回答漏检发生在哪里
- 主指标对照表：等待 E1、E2

## 最少补证事项

- 先运行 E1，确认基线口径
- 补齐固定划分文件
`);
  write(root, 'runs/E1-seed0.json', JSON.stringify({ runId: 'R-E1-0', planId: 'E1', taskId: 'T3', status: 'not-run', provenance: 'current', note: 'Fixture placeholder: not executed.' }, null, 2));
  return root;
}
