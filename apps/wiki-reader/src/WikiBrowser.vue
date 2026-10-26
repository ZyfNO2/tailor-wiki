<template><div class="reader-shell"><header class="snapshot-bar" v-if="data">WeKnora 源码剪枝 · 只读文件 Wiki<br>工作区：{{data.workspace}}<br>提交：{{data.state.commitId}} <div class="local-status"><span>文件：{{data.status.fileStatus}}</span><span>范围覆盖：{{data.status.coverageStatus?.status ?? data.status.completion}}（见详情）</span><span>语义复核：{{data.status.semanticReview.status}}</span><span>未解决问题：{{globalIssues.length}}</span></div><details><summary>指定范围覆盖明细</summary><pre>{{JSON.stringify(data.status.coverageStatus ?? data.status,null,2)}}</pre></details></header><div v-if="error" class="reader-error" role="alert">{{error}}</div><div v-if="data" class="wiki-browser"><aside class="wiki-sidebar"><div class="wiki-sidebar-header"><t-button variant="text" @click="showGlobalIssuesDrawer=true">问题 {{globalIssues.length}}</t-button><t-input v-model="searchQuery" :placeholder="$t('knowledgeEditor.wikiBrowser.searchPlaceholder')" clearable
            @enter="doSearch" @clear="searchResults = null">
            <template #prefixIcon><t-icon name="search" /></template>
          </t-input></div><div class="wiki-page-list"><template v-if="searchResults !== null">
            <div v-for="page in searchResults" :key="page.id"
              :class="['wiki-page-item', { active: selectedPage?.id === page.id }]" role="button" tabindex="0" @keydown.enter="selectPage(page)" @keydown.space.prevent="selectPage(page)" @click="selectPage(page)">
              <div class="wiki-page-item-title">{{ page.title }}</div>
              <div class="wiki-page-item-summary">{{ page.summary }}</div>
              <div class="wiki-page-item-meta">
                <span>{{ formatDate(page.updated_at) }}</span>
              </div>
            </div>
            <div v-if="searchResults.length === 0 && !loading" class="wiki-empty-state">
              <p class="wiki-empty-desc">{{ $t('knowledgeEditor.wikiBrowser.searchNoResults') || '没有找到匹配的页面' }}</p>
            </div>
          </template><template v-else><div v-if="indexAvailable" :class="['wiki-nav-item', { active: activeSystemView === 'index' }]"
              role="button" tabindex="0" @keydown.enter="openIndexView" @keydown.space.prevent="openIndexView" @click="openIndexView">
              <t-icon name="catalog" class="wiki-nav-icon" />
              <span class="wiki-nav-text">{{ $t('knowledgeEditor.wikiBrowser.indexTitle') }}</span>
            </div><section v-for="group in groups" :key="group.name"><h3>{{group.name}}</h3><template v-for="page in group.pages" :key="page.id"><div :class="['wiki-page-item', 'wiki-page-item--list', { active: selectedPage?.id === page.id }]"
                    role="button" tabindex="0" @keydown.enter="selectPage(page)" @keydown.space.prevent="selectPage(page)" @click="selectPage(page)">
                    <div class="wiki-page-item-title">{{ page.title }}</div>
                    <div class="wiki-page-item-summary">{{ page.summary }}</div>
                    <div class="wiki-page-item-meta">
                      <span>{{ formatDate(page.updated_at) }}</span>
                    </div>
                  </div></template></section></template></div></aside><div class="wiki-content">
        <div class="wiki-reader">
          <div class="wiki-reader-inner">
            <template v-if="selectedPage">
              <!-- Navigation -->
              <div v-if="navHistory.length || navFromSystemView" class="wiki-nav-bar">
                <a href="#" class="wiki-nav-back" @click.prevent="goBack">
                  <t-icon name="arrow-left" size="14px" />
                  <span>{{ backLabel }}</span>
                </a>
              </div>

              <!-- Page header -->
              <div class="wiki-reader-header">
                <div class="wiki-reader-title-row">
                  <div class="wiki-reader-title-block">
                    <h2  class="wiki-reader-title">
                      <span class="wiki-reader-title-text">{{ selectedPage.title }}</span>

                      <t-popup v-if="pageIssues.length > 0" v-model="showIssuesBox" placement="bottom-left"
                        trigger="click"
                        :overlayInnerStyle="{ padding: 0, boxShadow: 'var(--td-shadow-3)', borderRadius: '8px', width: '560px', maxWidth: '90vw' }">
                        <span class="wiki-issue-trigger"
                          :title="$t('knowledgeEditor.wikiBrowser.issueTitle', { count: pageIssues.length })">
                          <t-icon name="error-circle-filled" style="color: var(--td-warning-color);" />
                        </span>

                        <template #content>
                          <div class="wiki-issue-popup-content">
                            <div class="wiki-issue-popup-header">
                              <div class="wiki-issue-popup-title">
                                <span>{{ $t('knowledgeEditor.wikiBrowser.issueFixSuggestions', {
                                  count:
                                    pageIssues.length
                                })
                                }}</span>
                              </div>
                              
                            </div>
                            <div class="wiki-issue-popup-list">
                              <div v-for="issue in pageIssues" :key="issue.id" class="wiki-issue-popup-item">
                                <div class="wiki-issue-popup-main">
                                  <div class="wiki-issue-popup-tags">
                                    <t-tag v-if="issue.issue_type === 'mixed_entities'" theme="warning" variant="light"
                                      size="small">{{
                                        $t('knowledgeEditor.wikiBrowser.issueMixed') }}</t-tag>
                                    <t-tag v-else-if="issue.issue_type === 'contradictory_facts'" theme="danger"
                                      variant="light" size="small">{{
                                        $t('knowledgeEditor.wikiBrowser.issueConflict') }}</t-tag>
                                    <t-tag v-else-if="issue.issue_type === 'out_of_date'" theme="default" variant="light"
                                      size="small">{{
                                        $t('knowledgeEditor.wikiBrowser.issueOutdated') }}</t-tag>
                                    <t-tag v-else theme="primary" variant="light" size="small">{{
                                      $t('knowledgeEditor.wikiBrowser.issueAttention') }}</t-tag>
                                  </div>
                                  <div class="wiki-issue-popup-desc">
                                    {{ issue.description }}
                                  </div>
                                  <div class="wiki-issue-popup-meta">
                                    <span class="wiki-issue-popup-reporter">
                                      {{ issue.reported_by === 'wiki-researcher-agent' ?
                                        $t('knowledgeEditor.wikiBrowser.issueAiLinter') :
                                        $t('knowledgeEditor.wikiBrowser.issueReportedBy', {
                                          reporter:
                                            issue.reported_by
                                        }) }}
                                    </span>
                                    
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>
                      </t-popup>
                    </h2>
                    
                    <div class="wiki-reader-title-badges wiki-reader-title-badges--secondary">
                      
                      <span class="wiki-badge wiki-badge--type">
                        <t-icon :name="getPageIcon(selectedPage)" />
                        {{ getTypeLabel(selectedPage.page_type) }}
                      </span>
                      <span class="wiki-badge wiki-badge--ver">
                        {{ $t('knowledgeEditor.wikiBrowser.version', { ver: selectedPage.version }) }}
                      </span>
                      
                      <span v-for="alias in (selectedPage.aliases || [])" :key="alias"
                        class="wiki-badge wiki-badge--alias"
                        :title="`${$t('knowledgeEditor.wikiBrowser.aliases')} ${alias}`">
                        <t-icon name="link" />
                        {{ alias }}
                      </span>
                    </div>
                    <p v-if="selectedPage.summary" class="wiki-reader-lead">{{ selectedPage.summary }}</p>
                    
                  </div>
                  <div class="wiki-reader-aside">
                    <div class="wiki-reader-actions" role="toolbar"
                      :aria-label="$t('knowledgeEditor.wikiBrowser.pageActions')">
                      
                      <template v-if="true">
                        
                        <t-tooltip :content="$t('knowledgeEditor.wikiBrowser.historyBtn')" placement="top">
                          <button type="button" class="wiki-action-btn"
                            :aria-label="$t('knowledgeEditor.wikiBrowser.historyBtn')" @click="openRevisionDrawer">
                            <t-icon name="history" />
                          </button>
                        </t-tooltip>
                        
                        
                      </template>
                    </div>
                    <div  class="wiki-reader-aside-meta">
                      <span class="wiki-reader-aside-meta-item">
                        <t-icon name="time" size="14px" />
                        {{ formatDate(selectedPage.updated_at) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Content -->
              <div   class="wiki-reader-body" v-html="renderedContent"
                @click="handleContentClick">
              </div>

              <!-- Inline markdown editor (canEdit only). Saves are guarded by
                   the page version captured at edit start; the backend answers
                   409 when someone (or the pipeline) edited in between. -->
              

              <EvidencePanel :page="selectedPage" @open-source="openSource" />
<!-- Page footer: backlinks + sources -->
              <footer v-if="(selectedPage.in_links?.length || parsedSourceRefs.length)"
                class="wiki-reader-footer">
                <div v-if="selectedPage.in_links?.length" class="wiki-reader-footer-row">
                  <span class="wiki-reader-footer-label">{{ $t('knowledgeEditor.wikiBrowser.linkedFrom') }}</span>
                  <span class="wiki-reader-footer-value">
                    <a v-for="link in selectedPage.in_links" :key="'in-' + link" href="#"
                      class="wiki-content-link" @click.prevent="navigateToSlug(link)">
                      {{ slugDisplayName(link) }}
                    </a>
                  </span>
                </div>
                <div v-if="parsedSourceRefs.length" class="wiki-reader-footer-row">
                  <span class="wiki-reader-footer-label">{{ $t('knowledgeEditor.wikiBrowser.sources') }}</span>
                  <span class="wiki-reader-footer-value">
                    <a v-for="ref in parsedSourceRefs" :key="ref.id" href="#" class="wiki-content-link"
                      @click.prevent="openSource(ref.id)">
                      {{ ref.title }}
                    </a>
                  </span>
                </div>
              </footer>
            </template>

            <!-- System view: index overview rendered as markdown. Starts
                 with intro only; an IntersectionObserver-driven sentinel
                 at the bottom auto-appends the next directory section
                 (Summary → Entity → Concept → …) as the user scrolls
                 near the end. [[wiki-link]] clicks inside the rendered
                 body are handled by handleContentClick just like a
                 regular wiki page. -->
            <template v-else-if="activeSystemView === 'index'">
              <div class="wiki-reader-header">
                <h2 class="wiki-reader-title">{{ $t('knowledgeEditor.wikiBrowser.indexTitle') }}</h2>
                <div class="wiki-reader-meta">
                  <t-tag size="small" theme="default" variant="light-outline">
                    {{ $t('knowledgeEditor.wikiBrowser.indexOverviewTag') }}
                  </t-tag>
                </div>
              </div>
              <div v-if="indexLoading && !indexMarkdown" class="wiki-reader-empty">
                <p class="wiki-empty-title">{{ $t('knowledgeEditor.wikiBrowser.loading') }}</p>
              </div>
              <template v-else-if="indexMarkdown">
                <div  class="wiki-reader-body wiki-index-body" v-html="renderedIndexMarkdown"
                  @click="handleContentClick"></div>
                <div v-if="indexHasMore"  class="wiki-index-sentinel">
                  <span v-if="indexLoading" class="wiki-index-loading">
                    {{ $t('knowledgeEditor.wikiBrowser.loading') }}
                  </span>
                </div>
              </template>
              <div v-else-if="!indexLoading" class="wiki-reader-empty">
                <p class="wiki-empty-title">{{ $t('knowledgeEditor.wikiBrowser.indexEmpty') }}</p>
              </div>
            </template>

            <!-- No page selected -->
            <div v-else class="wiki-reader-empty">
              <div class="wiki-empty-icon">
                <t-icon name="browse" size="48px" />
              </div>
              <p class="wiki-empty-title" v-if="hasContentPages">{{ $t('knowledgeEditor.wikiBrowser.selectPageHint') }}
              </p>
              <template v-else>
                <p class="wiki-empty-title">{{ $t('knowledgeEditor.wikiBrowser.emptyTitle') }}</p>
                <p class="wiki-empty-desc">{{ $t('knowledgeEditor.wikiBrowser.emptyDesc') }}</p>
              </template>
            </div>
          </div>
        </div>
      </div></div><t-drawer v-model:visible="showGlobalIssuesDrawer" header="结构化问题" size="520px" :footer="false"><article v-for="issue in globalIssues" :key="issue.id"><t-tag>{{issue.status}} · {{issue.issue_type}}</t-tag><p>{{issue.description}}</p><a href="#" @click.prevent="navigateToSlug(issue.slug);showGlobalIssuesDrawer=false">{{slugDisplayName(issue.slug)}}</a></article><p v-if="!globalIssues.length">没有未解决问题</p></t-drawer><WikiRevisionDrawer v-if="selectedPage" v-model:visible="showRevisionDrawer" kb-id="local" :slug="selectedPage.slug" :current-page="selectedPage"/><t-drawer v-model:visible="sourceVisible" :header="sourceTitle" size="75%" :footer="false"><p>{{sourceMetadata}}</p><p v-if="sourceError" role="alert">{{sourceError}}</p><pre class="source-text"><span v-for="(line,i) in sourceLines" :key="i" :id="'source-line-'+(i+1)" :class="['source-line',{'source-line--selected':i+1>=sourceRange[0]&&i+1<=sourceRange[1]}]">{{String(i+1).padStart(4)}}  {{line}}
</span></pre></t-drawer></div></template>
<script setup lang="ts">
// Local snapshot adapter state; the read-only template/Markdown surface and
// display functions are pruned from pinned WikiBrowser.vue by prune-upstream.
import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import DOMPurify from 'dompurify';
import { markdownDomPurifyConfig, markdownDomPurifySecurityHooks } from './utils/markdownDomPurify';
import { ensureLiteralSingleTildeOnGlobalMarked } from './utils/markedLiteralTilde';
import { loadSnapshot, mappedPage } from './adapter';
import type { WikiPage } from './adapter';
import WikiRevisionDrawer from './WikiRevisionDrawer.vue';
import EvidencePanel from './EvidencePanel.vue';
const { t } = useI18n();
ensureLiteralSingleTildeOnGlobalMarked();
marked.use(markedKatex({ throwOnError: true, nonStandard: false }));
const data=ref<any>(null), error=ref(''), pages=ref<WikiPage[]>([]), selectedPage=ref<WikiPage|null>(null);
const searchQuery=ref(''),searchResults=ref<any[]|null>(null),loading=ref(false),activeSystemView=ref('index'),indexAvailable=true,indexLoading=false,indexHasMore=false;
const navHistory=ref<any[]>([]),navFromSystemView=false,backLabel='返回',showRevisionDrawer=ref(false),showIssuesBox=ref(false),showGlobalIssuesDrawer=ref(false);
const sourceVisible=ref(false),sourceTitle=ref(''),sourceMetadata=ref(''),sourceError=ref(''),sourceLines=ref<string[]>([]),sourceRange=ref([0,0]);
const globalIssues=computed(()=> (data.value?.state.issues??[]).filter((i:any)=>i.status==='open').map((i:any)=>({...i,id:i.issueId,slug:i.pageIds[0],issue_type:i.type,reported_by:i.reportedBy})));
const pageIssues=computed(()=>globalIssues.value.filter((i:any)=>i.pageIds.includes(selectedPage.value?.slug)));
const parsedSourceRefs=computed(()=> (selectedPage.value?.source_refs??[]).map((v:string)=>{const [id,...title]=v.split('|');return{id,title:title.join('|')}}));
const groups=computed(()=>{const groups=new Map<string,any[]>();for(const p of pages.value){const name=(p.category??[]).join(' / ')||getTypeLabel(p.page_type);if(!groups.has(name))groups.set(name,[]);groups.get(name)!.push(p);}return [...groups].map(([name,pages])=>({name,pages}));});
const hasContentPages=computed(()=>pages.value.length>0);
const indexMarkdown=computed(()=>data.value ? '# '+data.value.state.indexIntro?.title+'\n\n'+data.value.state.indexIntro?.content+'\n\n'+appendIndexDirectoryLines(pages.value.map((p:any)=>({...p,category_path:p.category}))) : '');
const renderedIndexMarkdown=computed(()=>renderMarkdown(indexMarkdown.value));
function openIndexView(){selectedPage.value=null;activeSystemView.value='index';}
function selectPage(page:WikiPage){if(selectedPage.value)navHistory.value.push(selectedPage.value);selectedPage.value=page;activeSystemView.value='';document.title=page.title+' · WeKnora 只读';}
function navigateToSlug(slug:string){const p=pages.value.find(p=>p.slug===slug);if(!p){error.value='链接页面不可用：'+slug;return;}selectPage(p);}
function goBack(){const p=navHistory.value.pop();if(p){selectedPage.value=p;}else openIndexView();}
function slugDisplayName(slug:string){return pages.value.find(p=>p.slug===slug)?.title??slug;}
function editSourceLabel(source:string){return source==='agent'?'Agent':'文件提交';}
function editSourceIcon(){return 'file';}
function openRevisionDrawer(){showRevisionDrawer.value=true;}
function doSearch(){const q=searchQuery.value.trim().toLowerCase();searchResults.value=q?pages.value.filter(p=>(p.title+' '+p.summary+' '+p.content).toLowerCase().includes(q)):null;}
function handleContentClick(event:MouseEvent){const a=(event.target as HTMLElement).closest('a[data-slug]') as HTMLElement;if(a){event.preventDefault();navigateToSlug(a.dataset.slug!);}}
// Upstream uses marked + DOMPurify hooks. Provider-image hydration and privileged
// resource schemes are removed: this app only reads the configured file snapshot.
function renderMarkdown(content:string):string{
  try {
    let fence=false;
    const preprocessed=content.split('\n').map(line=>{if(/^\s*(```|~~~)/.test(line)){fence=!fence;return line;}if(fence)return line;return line.split(/(`+[^`]*`+)/g).map(part=>part.startsWith('`')?part:part.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g,(_m,slug,label)=>`<a href="#" class="wiki-content-link" data-slug="${slug}">${(label??slugDisplayName(slug)).replaceAll('<','&lt;').replaceAll('>','&gt;')}</a>`)).join('');}).join('\n');
    const html=marked.parse(preprocessed,{breaks:true,async:false}) as string;
    DOMPurify.addHook('beforeSanitizeElements',markdownDomPurifySecurityHooks.beforeSanitizeElements);
    DOMPurify.addHook('afterSanitizeElements',markdownDomPurifySecurityHooks.afterSanitizeElements);
    try{return DOMPurify.sanitize(html,{...markdownDomPurifyConfig,ALLOWED_URI_REGEXP:/^(?:https?:|#|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i});}
    finally{DOMPurify.removeHook('afterSanitizeElements');DOMPurify.removeHook('beforeSanitizeElements');}
  }catch(e){error.value='Markdown 渲染失败：'+String(e);return '';}
}
function openSource(sourceId:string,revision?:number,startByte?:number,endByte?:number){
  sourceVisible.value=true;sourceError.value='';
  const source=data.value.state.sources.find((s:any)=>s.sourceId===sourceId);
  const version=revision?source?.versions.find((v:any)=>v.revision===revision):source?.versions.at(-1);
  if(!source||!version||typeof version.text!=='string'){sourceError.value='该来源/版本文本不可用';sourceLines.value=[];return;}
  sourceTitle.value=source.path.split(/[\\/]/).at(-1);
  sourceMetadata.value=source.path+' · revision '+version.revision+' · '+source.status+' · SHA256 '+version.sha256;
  const bytes=new TextEncoder().encode(version.text),decode=(b:Uint8Array)=>new TextDecoder().decode(b);
  sourceRange.value=startByte!==undefined?[decode(bytes.slice(0,startByte)).split('\n').length,decode(bytes.slice(0,endByte)).split('\n').length]:[0,0];
  sourceLines.value=version.text.split('\n');
  nextTick(()=>setTimeout(()=>document.getElementById('source-line-'+sourceRange.value[0])?.scrollIntoView({block:'center'}),100));
}
onMounted(async()=>{try{data.value=await loadSnapshot();if(data.value.state.pages.some((p:any)=>typeof p.content!=='string'))throw new Error('LEGACY_PAGE: 请先由 Agent 显式迁移 facts 页面');pages.value=data.value.state.pages.map((p:any)=>mappedPage(p));}catch(e){error.value=String(e);}});
type WikiIndexEntryDTO=any;

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    knowledge: t('knowledgeEditor.wikiBrowser.filterKnowledge'),
    summary: t('knowledgeEditor.wikiBrowser.filterSummary'),
    entity: t('knowledgeEditor.wikiBrowser.filterEntity'),
    concept: t('knowledgeEditor.wikiBrowser.filterConcept'),
    synthesis: t('knowledgeEditor.wikiBrowser.filterSynthesis'),
    comparison: t('knowledgeEditor.wikiBrowser.filterComparison'),
    index: 'Index',
  }
  return map[type] || type
}

function getPageIcon(page: WikiPage): string {
  const map: Record<string, string> = {
    entity: 'tag',
    concept: 'lightbulb',
    synthesis: 'relativity',
    comparison: 'view-module',
    summary: 'file',
  }
  return map[page.page_type] || 'file'
}

function stripDuplicateLeadingTitle(content: string, title: string): string {
  if (!content || !title) return content
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  if (i >= lines.length) return content
  const headingMatch = lines[i].match(/^#\s+(.+?)\s*$/)
  if (!headingMatch) return content
  const heading = headingMatch[1].trim()
  const pageTitle = title.trim()
  if (heading !== pageTitle && heading.toLowerCase() !== pageTitle.toLowerCase()) return content
  i++
  while (i < lines.length && lines[i].trim() === '') i++
  return lines.slice(i).join('\n')
}

function appendIndexDirectoryLines(items: WikiIndexEntryDTO[]): string {
  let out = ''
  const emittedDirs = new Set<string>()
  for (const entry of items) {
    const path = (Array.isArray(entry.category_path) ? entry.category_path : [])
      .map(part => String(part || '').trim())
      .filter(Boolean)
    for (let i = 0; i < path.length; i++) {
      const parts = path.slice(0, i + 1)
      const key = parts.join('/')
      if (emittedDirs.has(key)) continue
      emittedDirs.add(key)
      out += `${'  '.repeat(i)}**${path[i]}**\n`
    }
    const display = entry.title || entry.slug
    const indent = '  '.repeat(path.length)
    if (entry.summary) {
      out += `${indent}[[${entry.slug}|${display}]] — ${entry.summary}\n`
    } else {
      out += `${indent}[[${entry.slug}|${display}]]\n`
    }
  }
  return out
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const renderedContent = computed(() => {
  if (!selectedPage.value) return ''
  const body = stripDuplicateLeadingTitle(selectedPage.value.content || '', selectedPage.value.title)
  return renderMarkdown(body)
})


</script>
<style scoped lang="less">
.wiki-browser {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--td-bg-color-container);
  // Align list rows with the session sidebar grid (menu.vue).
  --wiki-list-inset-x: 10px;
  --wiki-list-row-radius: 6px;
  --wiki-list-row-min-height: 30px;
}


// ── Left Sidebar ──
.wiki-sidebar {
  width: 280px;
  min-width: 240px;
  border-right: 1px solid var(--td-component-stroke);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--td-bg-color-container);
}


.wiki-sidebar-header {
  padding: 0 10px 8px 0;
  margin-left: -8px;
  padding-left: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}


.wiki-global-issues-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--td-warning-color-light);
  border-radius: var(--app-radius-sm);
  color: var(--td-warning-color-8);
  font-size: var(--app-text-md);
  cursor: pointer;
  transition: filter var(--app-motion-base);

  &:hover {
    filter: brightness(0.95);
  }

  .queue-text {
    line-height: 1.2;
    font-weight: 500;
  }
}


.wiki-page-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px 0;
  margin-left: -8px;
  padding-left: 8px;
}


.wiki-tree-list {
  padding: 0 0 4px;
}


// Tab bar + tree list share horizontal inset. Tree rows are plain flex and
// left-aligned; only folder rows reserve trailing space for count / actions.
.wiki-tree-panel {
  --wiki-tree-depth-indent: 14px;
  padding: 0;
}


.wiki-tab-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 6px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--td-bg-color-container);
}


.wiki-tab-bar-scroll {
  display: flex;
  gap: 16px;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}


.wiki-tab-bar-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}


.wiki-view-toggle {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: var(--app-radius-sm);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
}


.wiki-view-toggle-btn {
  width: 24px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-xs);
  background: transparent;
  color: var(--td-text-color-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--app-motion-instant) ease, color var(--app-motion-instant) ease;

  &:hover {
    color: var(--td-text-color-primary);
  }

  &.active {
    color: var(--td-brand-color);
    background: var(--td-bg-color-container);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .t-icon {
    font-size: var(--app-text-lg);
  }
}


.wiki-tab-bar-action {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--td-text-color-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: background-color var(--app-motion-fast) ease, color var(--app-motion-fast) ease;

  .t-icon {
    font-size: var(--app-text-lg);
  }

  &:hover {
    color: var(--td-brand-color);
    background: var(--td-bg-color-container-hover);
  }

  &:disabled {
    color: var(--td-text-color-placeholder);
    background: transparent;
    cursor: not-allowed;
    opacity: 0.45;
  }
}


.wiki-tree-trailing {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}


.wiki-group-sentinel {
  // Invisible sentinel watched by IntersectionObserver to trigger
  // the next page fetch. Height > 0 so it reliably enters the viewport.
  height: 1px;
  width: 100%;
}


.wiki-group-loading {
  display: flex;
  justify-content: center;
  padding: 6px 0;
}


.wiki-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--wiki-list-row-min-height);
  padding: 0 10px 0 var(--wiki-list-inset-x);
  border-radius: var(--wiki-list-row-radius);
  cursor: pointer;
  margin-bottom: 0;
  transition: background var(--app-motion-fast) ease, color var(--app-motion-fast) ease;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }

  &.active {
    background: var(--td-bg-color-container-hover);

    .wiki-nav-text {
      color: var(--td-brand-color);
      font-weight: 400;
    }

    .wiki-nav-icon {
      color: var(--td-brand-color);
    }
  }

  .wiki-nav-icon {
    font-size: var(--app-text-xl);
    color: var(--td-text-color-secondary);
  }

  .wiki-nav-text {
    font-size: var(--app-text-base);
    font-weight: 400;
    line-height: 20px;
    color: var(--td-text-color-primary);
  }
}


.wiki-sidebar-divider {
  height: 1px;
  background: var(--td-component-stroke);
  margin: 6px 0;
}


.wiki-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 2px 8px;
  border-radius: 0;
  font-size: var(--app-text-md);
  color: var(--td-text-color-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
  transition: background var(--app-motion-fast), color var(--app-motion-fast);

  &:hover {
    color: var(--td-text-color-primary);
  }

  &.active {
    color: var(--td-brand-color);
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      left: 2px;
      right: 2px;
      bottom: 1px;
      height: 2px;
      border-radius: 2px 2px 0 0;
      background: var(--td-brand-color);
    }
  }

  .wiki-tab-count {
    font-size: var(--app-text-xs);
    padding: 0;
    line-height: 1;
    color: var(--td-text-color-placeholder);
  }

  &.active .wiki-tab-count {
    color: var(--td-brand-color);
    font-weight: 500;
  }
}


.wiki-page-item {
  min-height: var(--wiki-list-row-min-height);
  box-sizing: border-box;
  overflow: hidden;
  padding: 6px 10px 6px var(--wiki-list-inset-x);
  border-radius: var(--wiki-list-row-radius);
  cursor: pointer;
  margin-bottom: 0;
  user-select: none;
  transition: background var(--app-motion-fast) ease, color var(--app-motion-fast) ease;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }

  &.active {
    background: var(--td-bg-color-container-hover);

    .wiki-page-item-title {
      color: var(--td-brand-color);
    }
  }
}


.wiki-group-scroller {
  min-height: 60px;
  margin: 4px 0;
}


.wiki-page-item--list {
  height: 98px;
  padding: 8px 10px 8px var(--wiki-list-inset-x);
}


.wiki-page-item--list .wiki-page-item-title {
  display: block;
  font-size: var(--app-text-base);
  font-weight: 400;
  line-height: 20px;
  margin-bottom: 4px;
  color: var(--td-text-color-primary);
  transition: color var(--app-motion-fast) ease;
}


.wiki-page-item-summary {
  font-size: var(--app-text-sm);
  line-height: 1.5;
  color: var(--td-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}


.wiki-page-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--app-text-xs);
  color: var(--td-text-color-placeholder);
}


.wiki-directory-item {
  height: 34px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 calc(var(--wiki-tree-depth, 0) * var(--wiki-tree-depth-indent, 14px) + var(--wiki-list-inset-x));
  border-radius: var(--wiki-list-row-radius);
  cursor: pointer;
  margin: 0;
  color: var(--td-text-color-secondary);
  background: transparent;
  user-select: none;
  transition: background var(--app-motion-fast) ease, color var(--app-motion-fast) ease;

  &:hover {
    background: var(--td-bg-color-container-hover);
    color: var(--td-text-color-primary);

    :deep(.wiki-directory-action--reveal) {
      opacity: 1;
    }
  }
}


.wiki-folder-inline-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;

  :deep(.t-button) {
    padding: 0 4px;
    height: 24px;
  }

  :deep(.wiki-folder-action-btn) {
    border-radius: var(--app-radius-xs);
    transition: all var(--app-motion-base) ease;

    .t-icon {
      font-size: var(--app-text-base);
    }
  }

  :deep(.wiki-folder-action-btn.confirm) {
    background: transparent;
    color: var(--td-text-color-secondary);

    &:hover {
      background: var(--td-bg-color-secondarycontainer);
      color: var(--td-brand-color);
    }
  }

  :deep(.wiki-folder-action-btn.cancel) {
    background: transparent;
    color: var(--td-text-color-secondary);

    &:hover {
      background: var(--td-bg-color-secondarycontainer);
      color: var(--td-error-color);
    }
  }
}


.wiki-directory-toggle,
.wiki-page-file-icon {
  flex: 0 0 auto;
  color: var(--td-text-color-placeholder);
  font-size: var(--app-text-lg);
}


.wiki-directory-title,
.wiki-page-item-title {
  min-width: 0;
  flex: 1;
  font-size: var(--app-text-md);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.wiki-directory-title {
  font-weight: 600;
}


.wiki-directory-count {
  flex: 0 0 auto;
  min-width: 16px;
  text-align: right;
  font-size: var(--app-text-xs);
  line-height: 18px;
  color: var(--td-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}


.wiki-directory-load-more {
  height: 30px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: calc(var(--wiki-tree-depth, 0) * var(--wiki-tree-depth-indent, 14px));
  border-radius: var(--app-radius-sm);
  cursor: pointer;
  margin: 1px 0;
  color: var(--td-brand-color);
  font-size: var(--app-text-sm);

  &:hover {
    background: var(--td-brand-color-light);
  }
}


.wiki-page-item--tree {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  min-height: 34px;
  padding: 4px 10px 4px calc(var(--wiki-tree-depth, 0) * var(--wiki-tree-depth-indent, 14px) + var(--wiki-list-inset-x));
  border-radius: var(--wiki-list-row-radius);
  margin: 0;

  &.active {
    .wiki-page-file-icon {
      color: var(--td-brand-color);
    }
  }
}


.wiki-page-item--tree .wiki-page-item-title {
  font-size: var(--app-text-base);
  font-weight: 400;
  line-height: 20px;
  color: var(--td-text-color-primary);
  transition: color var(--app-motion-fast) ease;
}


// ── Right Content ──
.wiki-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}


.wiki-reader {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 16px;
}


.wiki-reader-inner {
  width: 100%;
}


.wiki-reader-header {
  margin-bottom: 24px;
}


.wiki-reader-lead {
  margin: 10px 0 0;
  font-size: var(--app-text-lg);
  line-height: 1.65;
  color: var(--td-text-color-secondary);
}


.wiki-reader-title-block {
  flex: 1;
  min-width: 0;
}


.wiki-reader-aside {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}


.wiki-reader-aside-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  max-width: 220px;
}


.wiki-reader-aside-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--app-text-sm);
  line-height: 1.4;
  color: var(--td-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.wiki-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--app-radius-xs);
  font-size: var(--app-text-sm);
  line-height: 1.4;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-secondarycontainer);

  .t-icon {
    font-size: var(--app-text-md);
    flex-shrink: 0;
  }
}


.wiki-badge--ver {
  font-family: var(--td-font-family-mono);
  font-variant-numeric: tabular-nums;
}


.wiki-badge--source {
  cursor: default;
}


.wiki-badge--alias {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.wiki-nav-bar {
  margin-bottom: 8px;
}


.wiki-nav-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--app-text-md);
  color: var(--td-text-color-secondary);
  text-decoration: none;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: var(--app-radius-xs);
  transition: all var(--app-motion-fast);

  &:hover {
    color: var(--td-brand-color);
    background: var(--td-bg-color-container-hover);
  }
}


.wiki-reader-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}


.wiki-reader-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--td-text-color-primary);
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}


.wiki-reader-title-text {
  min-width: 0;
}


.wiki-reader-title-badges {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}


.wiki-reader-title-badges--secondary {
  margin-top: 8px;
}


.wiki-edit-field {
  width: 100%;

  :deep(.t-input),
  :deep(.t-textarea) {
    border-radius: var(--app-radius-md);
    background: var(--td-bg-color-container);
    transition: border-color var(--app-motion-fast) ease, box-shadow var(--app-motion-fast) ease;
  }

  :deep(.t-input:focus-within),
  :deep(.t-textarea:focus-within) {
    border-color: var(--td-brand-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--td-brand-color) 10%, transparent);
  }
}


.wiki-edit-field--title {
  width: 100%;

  :deep(.t-input__inner) {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.35;
    padding: 10px 12px;
    height: auto;
    min-height: 44px;
  }
}


.wiki-edit-field--summary {
  margin: 10px 0 0;

  :deep(.t-textarea__inner) {
    font-size: var(--app-text-base);
    line-height: 1.6;
    padding: 10px 12px;
    resize: vertical;
  }
}


.wiki-edit-field--content {
  :deep(.t-textarea__inner) {
    font-family: var(--td-font-family-mono);
    font-size: var(--app-text-base);
    line-height: 1.7;
    padding: 12px 14px;
    resize: vertical;
  }
}


.wiki-reader-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}


.wiki-action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--td-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: color var(--app-motion-fast) ease;

  .t-icon {
    font-size: var(--app-text-xl);
  }

  &:hover {
    color: var(--td-text-color-primary);
  }

  &.wiki-action-btn--danger:hover {
    color: var(--td-error-color);
  }
}


.wiki-reader-aliases {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin: 0 0 8px;
  font-size: var(--app-text-md);
  line-height: 1.4;
}


.wiki-alias-label {
  color: var(--td-text-color-placeholder);
  font-size: var(--app-text-md);
  line-height: 1.4;
}


.wiki-alias-tag {
  // Slight vertical nudge so the tag baseline lines up with the label.
  vertical-align: middle;
}


.wiki-reader-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}


.wiki-reader-meta-text {
  font-size: var(--app-text-md);
  color: var(--td-text-color-placeholder);
}


.wiki-reader-links {
  padding: 12px 16px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: var(--app-radius-md);
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}


.wiki-link-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--app-text-md);
}


.wiki-link-label {
  color: var(--td-text-color-secondary);
  font-weight: 500;
  flex-shrink: 0;
}


.wiki-link-tag {
  color: var(--td-brand-color);
  text-decoration: none;
  font-family: var(--app-font-family-mono);
  font-size: var(--app-text-sm);
  padding: 2px 8px;
  background: color-mix(in srgb, var(--td-brand-color) 6%, transparent);
  border-radius: var(--app-radius-xs);
  transition: background var(--app-motion-fast);

  &:hover {
    background: color-mix(in srgb, var(--td-brand-color) 12%, transparent);
  }
}


.wiki-reader-footer {
  margin-top: 32px;
  padding-top: 18px;
  border-top: 1px solid var(--td-component-stroke);
  display: flex;
  flex-direction: column;
  gap: 10px;
}


.wiki-reader-footer-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
  font-size: var(--app-text-md);
  line-height: 1.65;
}


.wiki-reader-footer-label {
  flex: 0 0 64px;
  font-size: var(--app-text-sm);
  color: var(--td-text-color-placeholder);
}


.wiki-reader-footer-value {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
}


.wiki-reader-footer .wiki-content-link {
  color: var(--td-brand-color);
  text-decoration: none;
  border-bottom: 1px dashed var(--td-brand-color);
  cursor: pointer;
  font-weight: 500;

  &:hover {
    border-bottom-style: solid;
    text-decoration: none !important;
  }
}


// ── Empty states ──
.wiki-empty-state,
.wiki-reader-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}


// ── Index overview (system view) ──
// The index view renders as markdown through the same pipeline as a
// normal wiki page, so it inherits .wiki-reader-body styling automatically.
// We use a sentinel below the body to drive auto-pagination via
// IntersectionObserver — the user never sees a "Load more" button.
.wiki-index-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 16px 0 24px;
  color: var(--td-text-color-placeholder);
  font-size: var(--app-text-md);
}


.wiki-index-loading {
  opacity: 0.7;
}


.wiki-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--td-bg-color-secondarycontainer);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--td-text-color-placeholder);
}


.wiki-empty-title {
  font-size: var(--app-text-base);
  font-weight: 500;
  color: var(--td-text-color-secondary);
  margin: 0 0 4px;
}


.wiki-empty-desc {
  font-size: var(--app-text-md);
  color: var(--td-text-color-placeholder);
  margin: 0;
}


.help-glyph-icon {
  font-size: var(--app-text-base) !important;
  font-weight: 600;
  line-height: 14px !important;
  text-align: center;
  width: 14px;
  color: inherit;
}


.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}


.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--app-text-xs);
  color: var(--td-text-color-secondary);

  &.clickable {
    cursor: pointer;
    transition: all var(--app-motion-fast);

    &:hover {
      color: var(--td-text-color-primary);
    }
  }

  &.disabled {
    color: var(--td-text-color-placeholder);
    text-decoration: line-through;
    opacity: 0.5;
  }
}


.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}


.legend-familiar-ring {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  box-sizing: border-box;
  border: 2px solid #0052d9;
  background: transparent;
}


.legend-divider {
  height: 1px;
  background: var(--td-component-stroke);
  margin: 0 -12px;
}


.legend-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}


.legend-action {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--app-text-xs);
  line-height: 14px;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  user-select: none;
  transition: all var(--app-motion-fast);

  &:hover {
    color: var(--td-brand-color);

    .legend-action-icon {
      color: var(--td-brand-color);
    }
  }

  &.active {
    color: var(--td-brand-color);

    .legend-action-icon {
      color: var(--td-brand-color);
    }
  }
}


.wiki-drawer-neighbor-hint {
  font-size: var(--app-text-sm);
  line-height: 16px;
  color: var(--td-text-color-secondary);
  user-select: none;
}


.legend-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  font-size: var(--app-text-md);
  line-height: 1;
  color: var(--td-text-color-placeholder);
  transition: color var(--app-motion-fast);

  .t-icon {
    font-size: var(--app-text-md);
    line-height: 1;
  }
}


@keyframes node-active-pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }

  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}


.node-active-ring {
  transform-origin: 0 0;
  animation: node-active-pulse 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}


// ── Issues Popup ──
.wiki-issue-trigger {
  margin-left: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--app-text-3xl);
  transition: opacity var(--app-motion-base) ease;

  &:hover {
    opacity: 0.8;
  }
}


.wiki-issue-popup-content {
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-container);
  border-radius: var(--app-radius-md);
  overflow: hidden;
}


.wiki-issue-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--td-bg-color-secondarycontainer);
  border-bottom: 1px solid var(--td-component-stroke);
}


.wiki-issue-popup-title {
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: var(--app-text-base);
  color: var(--td-text-color-primary);

  .wiki-issue-popup-icon {
    color: var(--td-brand-color);
    margin-right: 8px;
    font-size: var(--app-text-xl);
  }
}


.wiki-issue-popup-list {
  display: flex;
  flex-direction: column;
  max-height: 400px;
  overflow-y: auto;
  gap: 12px;
  padding: 8px 12px;
}


.wiki-issue-popup-item {
  display: flex;
  padding: 16px;
  gap: 12px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--app-radius-sm);
  transition: box-shadow var(--app-motion-base) ease, border-color var(--app-motion-base) ease;
  background: var(--td-bg-color-container);

  &:hover {
    border-color: var(--td-brand-color-light);
  }
}


.wiki-issue-popup-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}


.wiki-issue-popup-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}


.wiki-issue-popup-desc {
  font-size: var(--app-text-md);
  color: var(--td-text-color-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 150px;
  overflow-y: auto;
  padding-right: 4px;
}


/* 优化描述区域的滚动条样式 */
.wiki-issue-popup-desc::-webkit-scrollbar {
  width: 4px;
}


.wiki-issue-popup-desc::-webkit-scrollbar-thumb {
  background: var(--td-scrollbar-color);
  border-radius: var(--app-radius-xs);
}


.wiki-issue-popup-desc::-webkit-scrollbar-track {
  background: transparent;
}


.wiki-issue-popup-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--td-component-stroke);
}


.wiki-issue-popup-reporter {
  font-size: var(--app-text-sm);
  color: var(--td-text-color-placeholder);
  flex: 1;
}


.wiki-issue-popup-actions {
  display: flex;
  align-items: center;
}


.wiki-issue-popup-action {
  font-size: var(--app-text-sm);
  color: var(--td-brand-color);
  cursor: pointer;
  transition: opacity var(--app-motion-base) ease;

  &:hover {
    opacity: 0.8;
  }
}
</style>
