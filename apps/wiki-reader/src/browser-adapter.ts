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
