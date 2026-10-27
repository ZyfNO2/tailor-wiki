import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkDag } from '../../research-pack/trial-skills/academic-tailor/scripts/check-dag.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../research-pack/trial-skills/academic-tailor/scripts/check-dag.mjs');
const nodes = rows => `| 任务 ID | 目标 | 预期产物 | 状态 |\n|---|---|---|---|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`;
const edges = rows => `| 前置 | 后续 | 所需产物/条件 |\n|---|---|---|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`;

test('DAG check reports duplicates, missing endpoints, self-dependencies, cycles and claims used as tasks, with file lines', () => {
  const md = `# DAG\n\n## 节点\n\n${nodes([['T1', '准备数据', 'splits.json', '已完成'], ['T2', '训练', 'runs/T2', '未运行'], ['T2', '重复行', '—', '未运行'], ['T3', '汇总', 'report.md', '未开始']])}\n## 依赖\n\n${edges([['T1', 'T2', 'splits.json'], ['T2', 'T2', '自身'], ['T2', 'T3', '结果'], ['T3', 'T2', '回环'], ['T9', 'T3', '外部脚本'], ['C1', 'T3', '主张'], ['T3', '（暂无后续）', '—']])}`;
  const r = checkDag(md, { file: 'RESEARCH-DAG.md', claims: ['C1'] });
  assert.equal(r.ok, false);
  assert.deepEqual([...new Set(r.errors.map(e => e.code))].sort(), ['claim-as-dependency', 'cycle', 'duplicate-id', 'missing-endpoint', 'self-dependency']);
  assert.ok(r.errors.every(e => /^RESEARCH-DAG\.md:\d+$/.test(e.at)), JSON.stringify(r.errors));
  assert.equal(r.errors.find(e => e.code === 'missing-endpoint').ids.join(), 'T9');
  assert.deepEqual(r.errors.find(e => e.code === 'cycle').ids, ['T2', 'T3']);
  assert.ok(r.warnings.some(w => w.code === 'placeholder-endpoint'));
});

test('a plan that depends on the very task executing it is flagged; real prerequisites are not', () => {
  // T12 implements the baselines EXP-C1 uses: a real prerequisite, not flagged.
  const dag = `${nodes([['T12', '实现两个对照：EXP-C1 无记忆、EXP-C2 Top-k', 'configs/', '未开始'], ['T13', '准备 harness', 'harness/', '未开始'], ['T14', '运行 EXP-A2', 'runs/EXP-A2/', '未运行']])}\n${edges([['T12', 'T14', 'configs'], ['T13', 'T14', 'harness']])}`;
  const plan = '| 实验标识 | 验证问题/变体 | 依赖 | 状态 |\n|---|---|---|---|\n| EXP-A2 | 完整栈 | T13、T14 | 未运行 |\n| EXP-C1 | 无记忆对照 | T12 | 未运行 |\n';
  const r = checkDag(dag, { file: 'RESEARCH-DAG.md', plan, planFile: 'EXPERIMENT-PLAN.md' });
  const own = r.errors.filter(e => e.code === 'plan-depends-on-own-task');
  assert.equal(own.length, 1); assert.deepEqual(own[0].ids, ['EXP-A2', 'T14']); assert.match(own[0].at, /^EXPERIMENT-PLAN\.md:3$/);
});

test('a clean DAG with an independent node passes from the CLI and the file is never modified', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-check-'));
  const file = path.join(root, 'RESEARCH-DAG.md');
  fs.writeFileSync(file, `${nodes([['T1', '准备', 'a', '已完成'], ['T2', '运行', 'b', '未运行'], ['T3', '独立调研', 'c', '未开始']])}\n${edges([['T1', 'T2', 'a']])}`);
  const before = fs.readFileSync(file);
  const run = spawnSync(process.execPath, [script, '--dag', file], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); const r = JSON.parse(run.stdout);
  assert.equal(r.ok, true); assert.equal(r.tasks, 3); assert.equal(r.edges, 1);
  assert.ok(r.notes.some(n => n.code === 'independent-node' && n.ids.includes('T3')));
  assert.deepEqual(fs.readFileSync(file), before);
  fs.writeFileSync(file, `${nodes([['T1', '准备', 'a', '已完成']])}\n${edges([['T1', 'T1', 'a']])}`);
  assert.equal(spawnSync(process.execPath, [script, '--dag', file], { encoding: 'utf8' }).status, 1);
});
