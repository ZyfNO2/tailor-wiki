// Open the read-only workbench for one workspace and print only a verified URL.
//   node open.mjs [--workspace DIR] [--paths runs,reports] [--port 8772] [--json]
// A running workbench is reused only when its /api/identity names the same
// workspace and the same --paths; a port that answers with anything else is
// skipped, never returned. Otherwise a server is started detached on the next
// free port (it keeps running after this command; its log goes to the system
// temp directory), and the URL is printed only after it answers for this
// workspace. On failure the real error is printed together with the Markdown
// outputs that exist. Nothing else is run and nothing in the workspace is written.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DOCS, WIKI_INDEX } from './lib/docs.mjs';

const APP_ID = 'tailor-wiki-workbench', TRIES = 20, START_TIMEOUT = 15000;
const app = path.dirname(fileURLToPath(import.meta.url));
const samePath = (a, b) => (process.platform === 'win32' ? String(a).toLowerCase() === String(b).toLowerCase() : a === b);
const samePaths = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** free │ workbench (with identity) │ other (busy with something else). */
export async function probe(port, timeout = 1500) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/identity`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    const body = await r.json().catch(() => null);
    return r.ok && body?.app === APP_ID && typeof body.workspace === 'string' ? { state: 'workbench', identity: body } : { state: 'other', detail: `HTTP ${r.status}，不是这个工作台` };
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return { state: 'free' };
    return { state: 'other', detail: error.name === 'AbortError' ? '端口有程序占用但没有响应' : error.cause?.code ?? error.message };
  } finally { clearTimeout(timer); }
}
const bound = (identity, root, paths) => samePath(identity.workspace, root) && samePaths(identity.paths, paths);

/** The projection must load too; a server that only answers with an error is not delivered. */
async function loads(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/workbench`, { headers: { Accept: 'application/json' } });
    const body = await r.json().catch(() => ({}));
    return r.ok && Array.isArray(body.projects) ? null : `工作台读取工作区失败：${body.error ?? 'HTTP ' + r.status}`;
  } catch (error) { return `工作台读取工作区失败：${error.cause?.code ?? error.message}`; }
}

/** Markdown outputs that exist in the workspace, as absolute paths. */
export function outputs(root) {
  return [...DOCS.map(d => d.path), WIKI_INDEX].map(rel => path.join(root, rel)).filter(file => { try { return fs.statSync(file).isFile(); } catch { return false; } });
}

export async function openWorkbench({ workspace = process.cwd(), paths = [], port = 8772 } = {}) {
  const root = fs.realpathSync(workspace), skipped = [];
  for (let at = port; at < port + TRIES; at++) {
    const seen = await probe(at);
    if (seen.state === 'workbench') {
      if (!bound(seen.identity, root, paths)) { skipped.push(`${at}：已有工作台在读另一个工作区或另一组 --paths（${seen.identity.workspace}）`); continue; }
      const error = await loads(at);
      if (error) return { ok: false, error, workspace: root, reused: true, port: at, skipped };
      return { ok: true, url: `http://127.0.0.1:${at}/`, workspace: root, paths, reused: true, pid: seen.identity.pid, port: at, skipped };
    }
    if (seen.state === 'other') { skipped.push(`${at}：${seen.detail}`); continue; }

    const log = path.join(os.tmpdir(), `tailor-wiki-workbench-${at}-${Date.now()}.log`), fd = fs.openSync(log, 'a');
    const args = [path.join(app, 'server.mjs'), '--workspace', root, '--port', String(at), ...(paths.length ? ['--paths', paths.join(',')] : [])];
    const child = spawn(process.execPath, args, { detached: true, stdio: ['ignore', fd, fd], windowsHide: true });
    fs.closeSync(fd);
    let exited = null;
    child.on('exit', (code, signal) => { exited = { code, signal }; });
    child.on('error', error => { exited = { error }; });
    child.unref();
    const deadline = Date.now() + START_TIMEOUT;
    let lost = false;
    while (!exited && Date.now() < deadline) {
      const now = await probe(at, 1000);
      if (now.state === 'workbench' && now.identity.pid !== child.pid) { lost = true; break; }
      if (now.state === 'workbench') {
        const error = await loads(at);
        if (error) { try { process.kill(child.pid); } catch { /* already gone */ } return { ok: false, error, log, workspace: root, port: at, skipped }; }
        return { ok: true, url: `http://127.0.0.1:${at}/`, workspace: root, paths, reused: false, pid: child.pid, port: at, log, skipped };
      }
      await sleep(150);
    }
    if (lost) { try { process.kill(child.pid); } catch { /* already gone */ } skipped.push(`${at}：启动时端口被另一个工作台抢先占用`); continue; }
    const tail = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').slice(-8).join('\n') : '';
    if (exited && /EADDRINUSE/.test(tail)) { skipped.push(`${at}：启动时端口被占用`); continue; }
    if (!exited) { try { process.kill(child.pid); } catch { /* already gone */ } }
    const why = exited?.error ? exited.error.message : exited ? `服务进程退出（代码 ${exited.code ?? exited.signal}）` : `服务 ${START_TIMEOUT / 1000} 秒内没有在 ${at} 端口为这个工作区应答`;
    return { ok: false, error: `${why}${tail ? `\n${tail}` : ''}`, log, workspace: root, port: at, skipped };
  }
  return { ok: false, error: `从 ${port} 起的 ${TRIES} 个端口都不可用`, workspace: root, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const asJson = args.includes('--json');
  const paths = (flag('--paths') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  let result;
  try { result = await openWorkbench({ workspace: flag('--workspace') ?? process.cwd(), paths, port: Number(flag('--port') ?? 8772) }); }
  catch (error) { result = { ok: false, error: String(error?.message ?? error), workspace: path.resolve(flag('--workspace') ?? process.cwd()) }; }
  if (!result.ok) { try { result.outputs = outputs(fs.realpathSync(result.workspace)); } catch { result.outputs = []; } }
  if (asJson) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else if (result.ok) process.stdout.write([
    `工作台已就绪（只读）：${result.url}`,
    `工作区：${result.workspace}（已通过 /api/identity 核对${result.paths.length ? `；--paths ${result.paths.join(',')}` : ''}）`,
    result.reused ? `复用已在运行的工作台（进程 ${result.pid}）。` : `新启动的工作台在后台运行（进程 ${result.pid}；日志 ${result.log}）。`,
    ...(result.skipped.length ? [`跳过的端口：${result.skipped.join('；')}`] : []),
  ].join('\n') + '\n');
  else process.stdout.write([
    `工作台没有打开：${result.error}`,
    ...(result.log ? [`日志：${result.log}`] : []),
    ...(result.skipped?.length ? [`跳过的端口：${result.skipped.join('；')}`] : []),
    result.outputs.length ? '工作区里的产物（可直接打开）：' : '工作区里还没有可展示的 Markdown 产物。',
    ...result.outputs.map(file => `- ${file}`),
  ].join('\n') + '\n');
  process.exitCode = result.ok ? 0 : 1;
}
