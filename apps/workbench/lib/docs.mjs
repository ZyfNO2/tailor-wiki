// The research files the workbench shows, one per Skill output, at the
// workspace root. No imports: the launcher lists them even when nothing else
// loads, so a failed start can still point at the actual Markdown.
export const DOCS = [
  { key: 'tailor', path: 'TAILOR.md', label: '学术裁缝方案', by: 'academic-tailor', view: 'schemes' },
  { key: 'dag', path: 'RESEARCH-DAG.md', label: '研究任务 DAG', by: 'academic-tailor', view: 'dag' },
  { key: 'plan', path: 'EXPERIMENT-PLAN.md', label: '实验计划', by: 'experiment-design', view: 'plan' },
  { key: 'story', path: 'STORY-PLAN.md', label: '研究叙事', by: 'research-story', view: 'story' },
  { key: 'guide', path: 'RESEARCH-GUIDE.md', label: '研究导学', by: 'research-guide', view: 'guide' },
];
// The Wiki's human-readable entry written by wiki-maintain.
export const WIKI_INDEX = 'wiki/INDEX.md';
