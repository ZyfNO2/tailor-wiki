import * as fs from 'node:fs';import * as path from 'node:path';import {execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(root,'provenance'),{recursive:true});
for(const name of ['WikiBrowser.vue','WikiRevisionDrawer.vue']){
  const old='upstream/frontend/src/views/knowledge/wiki/'+name,now='src/'+name;
  let diff;try{diff=execFileSync('git',['diff','--no-index','--',old,now],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});}catch(e){if(e.status!==1)throw e;diff=e.stdout;}
  fs.writeFileSync(path.join(root,'provenance',name+'.diff'),diff);
}
const names=Object.keys(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).dependencies);
const list=names.map(name=>{const p=JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json')));return{name,version:p.version,license:p.license??'see package notice'};});
fs.writeFileSync(path.join(root,'provenance/THIRD-PARTY.json'),JSON.stringify(list,null,2)+'\n');
for(const name of names){const base=path.join(root,'node_modules',name);for(const file of fs.readdirSync(base).filter(n=>/^(?:licen[cs]e|notice|copying)(?:\.|$)/i.test(n))){const original=path.join(base,file);if(!fs.statSync(original).isFile())continue;const target=path.join(root,'provenance/licenses',name.replaceAll('/','_')+'-'+file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(original,target);}}
