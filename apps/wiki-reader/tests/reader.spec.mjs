import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FileWiki } from '../../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';
import { readWorkspace, createReaderServer } from '../server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('pinned upstream closure matches stored hashes and pruned reader removes write/graph imports',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'upstream/SOURCE-MANIFEST.json')));
  assert.equal(manifest.commit,'e1f9a6166a593a4804a2f99f1d942919c9cc8ea7');
  for(const f of manifest.files)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'upstream',f.file))).digest('hex'),f.sha256);
  const browser=fs.readFileSync(path.join(root,'src/WikiBrowser.vue'),'utf8'),rev=fs.readFileSync(path.join(root,'src/WikiRevisionDrawer.vue'),'utf8');
  assert.doesNotMatch(browser,/useAssistant|createWiki|deleteWiki|updateWiki|buildGraphLayout|editForm|onDropOnDirectory/);
  assert.doesNotMatch(rev,/revertWikiPage|doRevert|canEdit/);
  assert.match(browser,/stripDuplicateLeadingTitle/);assert.match(browser,/wiki-reader-body/);assert.match(rev,/diffWikiRevision/);
});
test('server reads verified snapshot ancestry, rejects tampering and all writes, never serves raw arbitrary files',{timeout:5000},async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'reader-protocol-fixture-'));
  fs.writeFileSync(path.join(workspace,'source.txt'),'Synthetic fixture source.');
  const wiki=new FileWiki(workspace),p=await wiki.run('prepare',{paths:['source.txt']});
  await wiki.run('apply',{runId:p.runId,baseCommitId:null,draftType:'fixture',complete:true,pages:[]});
  const d=readWorkspace(workspace);assert.equal(d.history.length,1);assert.equal(d.state.commitId,wiki.current().commitId);
  const server=createReaderServer(workspace);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url='http://127.0.0.1:'+server.address().port;
    assert.equal((await fetch(url+'/api/snapshot',{method:'POST'})).status,405);
    assert.equal((await fetch(url+'/source.txt')).status,404);
    assert.equal((await fetch(url+'/api/snapshot')).status,200);
    fs.appendFileSync(path.join(workspace,'wiki/history',d.state.commitId,'state.json'),' ');
    assert.throws(()=>readWorkspace(workspace),/MANUAL_EDIT_CONFLICT/);
    const response=await fetch(url+'/api/snapshot');assert.equal(response.status,500);assert.match((await response.json()).error,/MANUAL_EDIT_CONFLICT/);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
