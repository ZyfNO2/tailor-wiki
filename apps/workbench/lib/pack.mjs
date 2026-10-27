// The Skill pack modules the workbench reads with (read adapter, Skill names,
// Wiki runtime read paths). They come from the first layout that has them:
//   installed copy  <host>/workbench/pack/      (copied by the installer)
//   package         <package>/workbench/../     (workbench next to the pack)
//   repository      apps/workbench/../../research-pack/
// The workbench never imports Skill code any other way, and no Skill imports this.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layouts = [path.join(app, 'pack'), path.dirname(app), path.resolve(app, '..', '..', 'research-pack')];
export const packRoot = layouts.find(dir => fs.existsSync(path.join(dir, 'research-intent.mjs')) && fs.existsSync(path.join(dir, 'trial-skills', 'wiki-maintain', 'scripts', 'wiki.mjs')));
if (!packRoot) throw new Error(`WORKBENCH_INCOMPLETE: Skill pack modules not found next to the workbench (looked in ${layouts.join(', ')})`);
const load = rel => import(pathToFileURL(path.join(packRoot, rel)).href);

export const { readArtifacts, runCollection, runIdentity, runMetrics } = await load('research-intent.mjs');
export const { skillNames, skillHosts } = await load('install-independent.mjs');
export const { FileWiki } = await load('trial-skills/wiki-maintain/scripts/wiki.mjs');
