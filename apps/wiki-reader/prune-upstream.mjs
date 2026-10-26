// Mechanical source pruning: retained sections come from the pinned SFC bytes.
// Rerun only deliberately; it overwrites the generated component files.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseSFC } from '@vue/compiler-sfc';
import { parse } from '@vue/compiler-dom';
const root = path.dirname(fileURLToPath(import.meta.url));
const upstream = file => fs.readFileSync(path.join(root, 'upstream/frontend/src', file), 'utf8');
const browser = upstream('views/knowledge/wiki/WikiBrowser.vue');
const b = parseSFC(browser).descriptor;
const ast = parse(b.template.content);
function find(node, predicate) { if (predicate(node)) return node; for (const c of node.children ?? []) { const result = find(c, predicate); if (result) return result; } }
const hasClass = (node, name) => node.props?.some(p => p.name === 'class' && p.value?.content.split(' ').includes(name) || p.name === 'bind' && p.arg?.content === 'class' && p.exp?.content.includes(`'${name}'`));
function pruned(node) {
  const source = node.loc.source, edits = [];
  function walk(n) {
    if (n !== node && n.type === 1) {
      const vIf = n.props.find(p => p.type === 7 && ['if','else-if'].includes(p.name));
      const exp = vIf?.exp?.content ?? '';
      const remove = hasClass(n,'wiki-page-editor') || n.props.some(p=>p.type===7 && p.name==='model' && p.exp?.content.startsWith('editForm.')) || exp === 'editingPage' || /props\.canEdit|viewInGraph|editSourceVisible/.test(exp) || n.tag === 't-popconfirm' || n.props.some(p => p.type === 7 && p.name === 'on' && /view-graph/.test(p.exp?.content ?? '')) || n.tag === 't-tooltip' && /viewInGraph|deletePageBtn|editBtn/.test(n.loc.source);
      if (remove || n.tag === 'template' && n.props.some(p => p.name === 'else') && /wiki-page-editor|t-textarea/.test(n.loc.source)) { edits.push([n.loc.start.offset-node.loc.start.offset, n.loc.end.offset-node.loc.start.offset,'']); return; }
      for (const p of n.props) if (p.type === 7 && ['if','else','else-if'].includes(p.name) && (p.exp?.content === '!editingPage' || p.name === 'else' && /historyBtn/.test(n.loc.source))) edits.push([p.loc.start.offset-node.loc.start.offset,p.loc.end.offset-node.loc.start.offset,n.tag==='template'?'v-if="true"':'']);
    }
    for (const c of n.children ?? []) walk(c);
  }
  walk(node);
  return edits.sort((a,b)=>b[0]-a[0]).reduce((s,[a,b,v])=>s.slice(0,a)+v+s.slice(b),source);
}
const right = find(ast, n => hasClass(n,'wiki-content'));
let reader = pruned(right).replaceAll('!editingPage && ','').replaceAll("emit('open-source-doc', ref.id)", 'openSource(ref.id)').replaceAll('ref="indexBodyRef"','').replaceAll('ref="readerBodyRef"','').replaceAll('ref="indexSentinelRef"','');
// Keep the upstream read-only page header/body/footer and index templates. Local
// metadata/evidence are appended after the authoritative body, never rewrites.
reader = reader.replace('<!-- Page footer: backlinks + sources -->', '<EvidencePanel :page="selectedPage" @open-source="openSource" />\n<!-- Page footer: backlinks + sources -->');
const search = find(ast, n => n.tag === 't-input' && n.props?.some(p => p.name === 'model' && p.exp?.content === 'searchQuery'));
const hitTemplate = find(ast, n => n.tag === 'template' && n.props?.some(p => p.name === 'if' && p.exp?.content === 'searchResults !== null'));
const nav = find(ast,n=>hasClass(n,'wiki-nav-item'));
const flat = find(ast,n=> n.tag==='div' && n.props?.some(p=>p.name==='bind' && p.arg?.content==='class' && /wiki-page-item--list/.test(p.exp?.content??'')));
let item = flat.loc.source.replaceAll('item.', 'page.').replace('selectPage(item)', 'selectPage(page)');
const template = `<template><div class="reader-shell"><header class="snapshot-bar" v-if="data">WeKnora 源码剪枝 · 只读文件 Wiki<br>工作区：{{data.workspace}}<br>提交：{{data.state.commitId}} <div class="local-status"><span>文件：{{data.status.fileStatus}}</span><span>范围覆盖：{{data.status.coverageStatus?.status ?? data.status.completion}}（见详情）</span><span>语义复核：{{data.status.semanticReview.status}}</span><span>未解决问题：{{globalIssues.length}}</span></div><details><summary>指定范围覆盖明细</summary><pre>{{JSON.stringify(data.status.coverageStatus ?? data.status,null,2)}}</pre></details></header><div v-if="error" class="reader-error" role="alert">{{error}}</div><div v-if="data" class="wiki-browser"><aside class="wiki-sidebar"><div class="wiki-sidebar-header"><t-button variant="text" @click="showGlobalIssuesDrawer=true">问题 {{globalIssues.length}}</t-button>${search.loc.source}</div><div class="wiki-page-list">${hitTemplate.loc.source}<template v-else>${nav.loc.source}<section v-for="group in groups" :key="group.name"><h3>{{group.name}}</h3><template v-for="page in group.pages" :key="page.id">${item}</template></section></template></div></aside>${reader}</div><t-drawer v-model:visible="showGlobalIssuesDrawer" header="结构化问题" size="520px" :footer="false"><article v-for="issue in globalIssues" :key="issue.id"><t-tag>{{issue.status}} · {{issue.issue_type}}</t-tag><p>{{issue.description}}</p><a href="#" @click.prevent="navigateToSlug(issue.slug);showGlobalIssuesDrawer=false">{{slugDisplayName(issue.slug)}}</a></article><p v-if="!globalIssues.length">没有未解决问题</p></t-drawer><WikiRevisionDrawer v-if="selectedPage" v-model:visible="showRevisionDrawer" kb-id="local" :slug="selectedPage.slug" :current-page="selectedPage"/><t-drawer v-model:visible="sourceVisible" :header="sourceTitle" size="75%" :footer="false"><p>{{sourceMetadata}}</p><p v-if="sourceError" role="alert">{{sourceError}}</p><pre class="source-text"><span v-for="(line,i) in sourceLines" :key="i" :id="'source-line-'+(i+1)" :class="['source-line',{'source-line--selected':i+1>=sourceRange[0]&&i+1<=sourceRange[1]}]">{{String(i+1).padStart(4)}}  {{line}}\n</span></pre></t-drawer></div></template>`;
const accessibleTemplate=template.replaceAll('@click="selectPage(page)"','role="button" tabindex="0" @keydown.enter="selectPage(page)" @keydown.space.prevent="selectPage(page)" @click="selectPage(page)"').replaceAll('@click="openIndexView"','role="button" tabindex="0" @keydown.enter="openIndexView" @keydown.space.prevent="openIndexView" @click="openIndexView"');
const script = fs.readFileSync(path.join(root,'src/browser-adapter.ts'),'utf8');
const functions = ['getTypeLabel','getPageIcon','stripDuplicateLeadingTitle','appendIndexDirectoryLines','formatDate'];
// Use TypeScript's parser to retain exact function source, without regex braces.
const ts = await import('typescript');
const sourceFile = ts.createSourceFile('WikiBrowser.ts',b.scriptSetup.content,ts.ScriptTarget.Latest,true);
const retained = sourceFile.statements.filter(s=>ts.isFunctionDeclaration(s)&&functions.includes(s.name?.text)).map(s=>s.getText(sourceFile)).join('\n\n');
const rendered = b.scriptSetup.content.slice(b.scriptSetup.content.indexOf('const renderedContent = computed('),b.scriptSetup.content.indexOf('function stripDuplicateLeadingTitle'));
// Original Less rules for browser/list/reader, excluding graph/editor/drop state.
const less = b.styles[0].content, blocks=[]; let start=0,depth=0;
for(let i=0;i<less.length;i++){if(less[i]==='{')depth++;if(less[i]==='}'&&--depth===0){const block=less.slice(start,i+1);start=i+1;if(!/graph|editing|editor|folder-action|rename|drop|drag|create|move|dialog|queue|chat/i.test(block.split('{')[0]))blocks.push(block);}}
fs.writeFileSync(path.join(root,'src/WikiBrowser.vue'),accessibleTemplate+'\n<script setup lang="ts">\n'+script+'\n'+retained+'\n'+rendered+'\n</script>\n<style scoped lang="less">'+blocks.join('\n')+'\n</style>\n');
let revision = upstream('views/knowledge/wiki/WikiRevisionDrawer.vue');
revision = revision.replace("from '@/api/wiki'", "from './adapter'");
revision = revision.replace(/\s*<t-popconfirm v-if="canEdit[\s\S]*?<\/t-popconfirm>/,'').replace('  revertWikiPage,\n','').replace('  canEdit?: boolean\n','').replace("  (e: 'reverted', page: WikiPage): void\n",'').replace("const reverting = ref(false)\n",'');
const r = parseSFC(revision).descriptor, rSource=ts.createSourceFile('rev.ts',r.scriptSetup.content,ts.ScriptTarget.Latest,true);
const doRevert = rSource.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='doRevert');
revision=revision.replace(doRevert.getText(rSource),'');
// Explicit local errors (the upstream toast-only path could look like no diff).
revision=revision.replace('<div class="wiki-rev-layout">','<p v-if="loadError" class="reader-error" role="alert">{{loadError}}</p><div class="wiki-rev-layout">').replace("const { t } = useI18n()", "const { t } = useI18n()\nconst loadError = ref('')").replaceAll('MessagePlugin.error(', 'loadError.value = String(').replace('function resetAndLoad() {',"function resetAndLoad() {\n  loadError.value = ''");
revision=revision.replace('@click="selectCurrent"','role="button" tabindex="0" @keydown.enter="selectCurrent" @click="selectCurrent"').replace('@click="selectRevision(rev)"','role="button" tabindex="0" @keydown.enter="selectRevision(rev)" @click="selectRevision(rev)"');
fs.writeFileSync(path.join(root,'src/WikiRevisionDrawer.vue'),revision);
for(const file of ['utils/wikiRevisionDiff.ts','utils/wikiLineDiff.ts','utils/markedLiteralTilde.ts','utils/markdownDomPurify.ts','components/settings/SettingDrawer.vue']){const dest=path.join(root,'src',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,upstream(file));}
fs.copyFileSync(path.join(root,'upstream/LICENSE'),path.join(root,'LICENSE.WeKnora'));

