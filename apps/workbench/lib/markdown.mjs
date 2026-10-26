// Safe Markdown -> HTML for the read-only workbench.
// Every character of user text is escaped, including { } [ ] |, so the only
// citation tokens ({{c:cN}}) and links in the output are the ones this module
// emits deliberately. Images are never loaded and local file links are shown
// as text: the workbench server never serves workspace files.

const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;', '[': '&#91;', ']': '&#93;', '|': '&#124;' };
export const escapeHtml = value => String(value ?? '').replace(/[&<>"'{}[\]|]/g, c => ENTITY[c]);
const PAGE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Plain text of inline Markdown, for headings, table parsing and summaries. */
export function plainInline(text) {
  return String(text ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1')
    .trim();
}

function emphasis(escaped) {
  return escaped
    .replace(/\\([*_~])/g, '$1')
    .replace(/\*\*(?=\S)(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(?=\S)(.+?)~~/g, '<del>$1</del>')
    .replace(/(^|[^*\w])\*(?=[^*\s])([^*]+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}
const text = value => emphasis(escapeHtml(value));
const safeHref = url => (/^(?:https?:\/\/|mailto:)[^\s<>"']+$/i.test(String(url).trim()) ? String(url).trim() : null);

const INLINE = /(\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\])|(!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\))|(\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\))|(<(https?:\/\/[^>\s]+)>)|(\$([^$\n]+?)\$)|(https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'*+,;=%]+)/g;

/** Inline Markdown; returns safe HTML. opt.pageExists(id) enables wiki links. */
export function renderInline(value, opt = {}) {
  return String(value ?? '').split(/(`+[^`\n]*?`+)/g).map(part => {
    const fence = part.match(/^`+/)?.[0];
    if (fence && part.length > fence.length * 2 && part.endsWith(fence) && !part.slice(fence.length, -fence.length).includes('`'.repeat(fence.length))) return `<code>${escapeHtml(part.slice(fence.length, -fence.length).trim())}</code>`;
    let out = '', last = 0;
    for (const m of part.matchAll(INLINE)) {
      out += text(part.slice(last, m.index));
      last = m.index + m[0].length;
      if (m[1]) {
        const id = m[2].trim(), label = (m[3] ?? (opt.pageTitle?.(id) || m[2])).trim();
        out += PAGE_ID.test(id) && opt.pageExists?.(id)
          ? `<a class="dsh-plink" href="#/knowledge/read/${id}">${text(label)}</a>`
          : `<span class="dsh-plink is-broken" title="${escapeHtml('断链：' + id + ' 不在当前快照中')}">${escapeHtml(label)}<span class="dsh-broken-tag">断链</span></span>`;
      } else if (m[4]) out += `<span class="dsh-md-img" title="${escapeHtml(m[6])}">［图片：${escapeHtml(m[5] || m[6])}］</span>`;
      else if (m[7]) {
        const href = safeHref(m[9]);
        out += href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text(m[8])}</a>` : `<span class="dsh-md-link" title="${escapeHtml('文件内链接：' + m[9])}">${text(m[8])}</span>`;
      } else if (m[10]) out += `<a href="${escapeHtml(m[11])}" target="_blank" rel="noopener noreferrer">${escapeHtml(m[11])}</a>`;
      else if (m[12]) out += `<code class="dsh-math-i" title="TeX">${escapeHtml(m[13])}</code>`;
      else {
        const url = m[14].replace(/[.,;:!?'*]+$/, '');
        out += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(m[14].slice(url.length))}`;
      }
    }
    return out + text(part.slice(last));
  }).join('');
}

/** Split a table row into cells; respects \| and pipes inside code spans. */
export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;

/**
 * Render a Markdown document.
 * opt.markers(startByte, endByte) -> extra HTML for the block, table row or
 *   list item that ends at endByte; called once per unit in document order.
 * opt.idPrefix: heading id prefix. opt.pageExists(id): wiki link targets.
 * Returns { html, headings, tables, sections, title }.
 */
export function renderMarkdown(source, opt = {}) {
  const md = String(source ?? '').replace(/\r\n?/g, '\n');
  const lines = md.split('\n');
  const offsets = [];
  let byte = 0;
  for (const line of lines) { offsets.push(byte); byte += Buffer.byteLength(line) + 1; }
  const total = Buffer.byteLength(md);
  const lineEnd = i => Math.min(total, offsets[i] + Buffer.byteLength(lines[i]));
  const headings = [], tables = [];
  let title = null, hN = 0;
  const prefix = opt.idPrefix ?? 'h';
  const inline = value => renderInline(value, opt);
  const mark = (a, b) => (opt.markers ? opt.markers(a, b) : '');
  const row = extra => (extra ? `<p class="dsh-cite-row">${extra}</p>` : '');
  const isClose = (line, fence) => { const c = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/); return !!c && c[1][0] === fence[0] && c[1].length >= fence.length; };
  const startsBlock = k => FENCE.test(lines[k]) || HEADING.test(lines[k]) || /^\s{0,3}>/.test(lines[k]) || LIST.test(lines[k]) || HR.test(lines[k]) || /^\s*\$\$/.test(lines[k]) || (lines[k].includes('|') && k + 1 < lines.length && TABLE_SEP.test(lines[k + 1]));

  // Parse into blocks; each block renders lazily so citation markers are
  // claimed strictly in document order.
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(FENCE))) {
      const fence = m[1], lang = m[2];
      let j = i + 1;
      while (j < lines.length && !isClose(lines[j], fence)) j++;
      const body = lines.slice(i + 1, j).join('\n'), a = offsets[i], b = lineEnd(Math.min(j, lines.length - 1));
      blocks.push(() => `<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(body)}</code></pre>${row(mark(a, b))}`);
      i = j + 1;
      continue;
    }
    if (/^\s*\$\$/.test(line)) {
      let j = i, body = line.trim().slice(2);
      if (body.trim().endsWith('$$')) body = body.trim().slice(0, -2);
      else {
        const acc = [body];
        j = i + 1;
        while (j < lines.length && !lines[j].includes('$$')) acc.push(lines[j++]);
        if (j < lines.length) acc.push(lines[j].slice(0, lines[j].indexOf('$$')));
        body = acc.join('\n');
      }
      const a = offsets[i], b = lineEnd(Math.min(j, lines.length - 1));
      blocks.push(() => `<pre class="dsh-math" title="TeX 公式（按原文显示）"><code>${escapeHtml(body.trim())}</code></pre>${row(mark(a, b))}`);
      i = j + 1;
      continue;
    }
    if ((m = line.match(HEADING))) {
      const level = m[1].length, plain = plainInline(m[2]);
      if (level === 1 && title == null) title = plain;
      const id = `${prefix}-${++hN}`, tag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4', a = offsets[i], b = lineEnd(i);
      headings.push({ level, text: plain, id, line: i + 1 });
      blocks.push(() => `<${tag} id="${id}">${escapeHtml(plain)}</${tag}>${row(mark(a, b))}`);
      i++;
      continue;
    }
    if (HR.test(line)) { const a = offsets[i], b = lineEnd(i); blocks.push(() => `<hr>${row(mark(a, b))}`); i++; continue; }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = splitRow(line), align = splitRow(lines[i + 1]).map(c => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : null));
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes('|')) { rows.push({ cells: splitRow(lines[j]), line: j }); j++; }
      const cell = (tag, value, k, extra = '') => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(value)}${extra}</${tag}>`;
      const headMark = [offsets[i], lineEnd(i + 1)];
      tables.push({ line: i + 1, endLine: j, headers: head.map(plainInline), rows: rows.map(r => head.map((_, k) => plainInline(r.cells[k] ?? ''))), raw: rows.map(r => head.map((_, k) => r.cells[k] ?? '')), lines: rows.map(r => r.line + 1) });
      blocks.push(() => {
        const before = mark(...headMark);
        const body = rows.map(r => `<tr>${head.map((_, k) => cell('td', r.cells[k] ?? '', k, k === head.length - 1 ? mark(offsets[r.line], lineEnd(r.line)) : '')).join('')}</tr>`).join('');
        return `${row(before)}<div class="ef-table-wrap"><table><thead><tr>${head.map((h, k) => cell('th', h, k)).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
      });
      i = j;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      let j = i + 1;
      while (j < lines.length && (/^\s{0,3}>/.test(lines[j]) || (lines[j].trim() && !startsBlock(j)))) j++;
      const inner = lines.slice(i, j).map(l => l.replace(/^\s{0,3}>\s?/, '')).join('\n'), a = offsets[i], b = lineEnd(j - 1);
      blocks.push(() => `<blockquote>${renderMarkdown(inner, { ...opt, markers: null, idPrefix: `${prefix}-q${i}` }).html}</blockquote>${row(mark(a, b))}`);
      i = j;
      continue;
    }
    if (LIST.test(line)) {
      const items = [];
      let j = i;
      while (j < lines.length) {
        const lm = lines[j].match(LIST);
        if (lm) { items.push({ indent: lm[1].replace(/\t/g, '    ').length, ordered: /\d/.test(lm[2]), start: parseInt(lm[2], 10), text: [lm[3]], a: offsets[j], b: lineEnd(j) }); j++; continue; }
        if (lines[j].trim() && items.length && /^\s+\S/.test(lines[j]) && !startsBlock(j)) { const it = items.at(-1); it.text.push(lines[j].trim()); it.b = lineEnd(j); j++; continue; }
        if (!lines[j].trim() && j + 1 < lines.length && LIST.test(lines[j + 1])) { j++; continue; }
        break;
      }
      blocks.push(() => renderList(items));
      i = j;
      continue;
    }
    let j = i;
    const para = [];
    while (j < lines.length && lines[j].trim() && (j === i || !startsBlock(j))) para.push(lines[j++].trim());
    const a = offsets[i], b = lineEnd(j - 1);
    blocks.push(() => `<p>${inline(para.join('\n'))}${mark(a, b)}</p>`);
    i = j;
  }

  function renderList(items) {
    let html = '';
    const stack = [];
    for (const it of items) {
      while (stack.length > 1 && it.indent < stack.at(-1).indent) html += `</li></${stack.pop().tag}>`;
      if (!stack.length || it.indent > stack.at(-1).indent) {
        const tag = it.ordered ? 'ol' : 'ul';
        html += `<${tag}${it.ordered && it.start > 1 ? ` start="${it.start}"` : ''}>`;
        stack.push({ indent: it.indent, tag });
      } else html += '</li>';
      const task = it.text[0].match(/^\[([ xX])\]\s+/);
      const body = task ? it.text.join('\n').slice(task[0].length) : it.text.join('\n');
      html += `<li>${task ? `<span class="dsh-md-task" aria-label="${task[1] === ' ' ? '未完成' : '已完成'}">${task[1] === ' ' ? '☐' : '☑'}</span> ` : ''}${inline(body)}${mark(it.a, it.b)}`;
    }
    while (stack.length) html += `</li></${stack.pop().tag}>`;
    return html;
  }

  let html = blocks.map(render => render()).join('\n');
  html += row(mark(total, total + 1));
  const sections = headings.map((h, k) => {
    const next = headings.slice(k + 1).find(x => x.level <= h.level);
    const endLine = next ? next.line - 1 : lines.length;
    return { ...h, endLine, markdown: lines.slice(h.line, endLine).join('\n') };
  });
  return { html, headings, tables, sections, title };
}

/** First paragraph of plain text, for summaries. */
export function firstParagraph(markdown) {
  for (const chunk of String(markdown ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const t = chunk.trim();
    if (t && !/^(#|\||```|~~~|>|[-*+]\s|\d+[.)]\s|\$\$)/.test(t)) return plainInline(t.replace(/\n/g, ' '));
  }
  return '';
}
