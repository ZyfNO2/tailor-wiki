/* DSH 研究工作台 · live.js —— 数据从哪里来
   ---------------------------------------------------------------------------
   通过工作台服务（node apps/workbench/server.mjs）打开：读取 /api/workbench，
   即真实工作区文件的只读投影；页面在前台时约每 5 秒比对一次文件指纹，Skill 写入新内容后更新。
   直接双击 index.html（file://）：载入 data.js 示例数据，作为设计原型查看。
   服务读取失败时显示失败原因，不回退到示例数据冒充工作区内容。
   连接状态：显示最后一次成功读取与检查的时间；服务失联、检查过久未成功、
   或同一地址换成了另一个工作区时都明确提示，不静默保留旧内容冒充最新。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, icon } = DSH;
  const served = location.protocol === 'http:' || location.protocol === 'https:';
  DSH.mode = served ? 'live' : 'demo';
  const POLL = 5000, STALE = 30000, TIMEOUT = 4000;
  let fingerprint = null, workspace = null, busy = false;
  /* state: ok 已连接 │ offline 服务失联 │ stale 检查过久未成功 │ moved 地址换了工作区 */
  const link = { state: 'ok', lastRead: null, lastCheck: null, error: null, other: null };
  DSH.link = link;

  async function getJSON(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: ctl.signal });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'HTTP ' + r.status);
      return body;
    } catch (e) {
      throw e.name === 'AbortError' ? new Error(`服务 ${TIMEOUT / 1000} 秒内没有响应`) : e.message === 'Failed to fetch' ? new Error('连不上工作台服务（可能已停止）') : e;
    } finally { clearTimeout(timer); }
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('无法载入 ' + src));
      document.body.appendChild(s);
    });
  }
  function fatal(error) {
    document.title = '读取失败 │ DSH 研究工作台';
    DSH.$('#view').innerHTML = DSH.out(html`
      <div class="dsh-page">
        <header class="ef-head dsh-head"><h1>读取失败 <small>Workspace unavailable</small></h1><p>工作台没有读到工作区数据，因此什么也不显示，不用示例数据代替。</p></header>
        ${DSH.ui.notice('读取失败', html`<p>${error.message}</p><p class="ef-field">工作台只读；它停止或出错都不影响 Skill 的使用。产物仍在工作区的 Markdown 文件里。</p>`, html`<p class="ef-actions"><button type="button" class="ef-btn small" data-retry>${icon('refresh')}重新读取</button></p>`)}
      </div>`);
    const b = DSH.$('[data-retry]');
    if (b) b.addEventListener('click', () => location.reload());
  }

  /* ---------- 连接状态：顶栏上的小块 + 失联时的横幅 ---------- */
  const clock = (t) => (t ? new Date(t).toLocaleTimeString('zh-CN', { hour12: false }) : '—');
  DSH.linkStatus = () => {
    const text = link.state === 'ok' ? `已连接 │ ${clock(link.lastCheck)} 检查`
      : link.state === 'offline' ? `服务失联 │ 内容停在 ${clock(link.lastRead)}`
        : link.state === 'moved' ? '地址换了工作区 │ 已停止更新'
          : `可能陈旧 │ ${clock(link.lastCheck)} 后未检查成功`;
    return html`<span class="dsh-link" id="dsh-link" title="最后成功读取内容：${clock(link.lastRead)}；最后成功检查文件变化：${clock(link.lastCheck)}。页面在前台时约每 ${POLL / 1000} 秒检查一次，后台标签页暂停检查。">${DSH.ui.st('link', link.state, { text })}</span>`;
  };
  function paintLink() {
    const chip = DSH.$('#dsh-link');
    if (chip) chip.outerHTML = DSH.out(DSH.linkStatus());
    const bar = DSH.$('#shell-link');
    if (!bar) return;
    if (link.state === 'ok') { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    const msg = link.state === 'offline'
      ? html`<b>与工作台服务失联。</b>下面是 ${clock(link.lastRead)} 最后一次成功读取的内容，之后的文件变化没有显示。${link.error ? html`<span class="ef-field">原因：${link.error}</span>` : ''}`
      : link.state === 'moved'
        ? html`<b>这个地址现在服务的是另一个工作区：</b><code>${link.other}</code>。为免把两个项目混在一起，页面停止自动更新，仍显示 <code>${workspace}</code> 的内容。`
        : html`<b>内容可能陈旧。</b>最后一次成功检查文件变化是 ${clock(link.lastCheck)}；之后的检查没有完成。`;
    bar.innerHTML = DSH.out(html`<div class="ef-notice dsh-notice" data-flag="${DSH.ui.label('link', link.state)}"><div><p>${msg}</p><p class="ef-field">工作台只读；它停止或换了工作区都不影响 Skill，产物仍在工作区文件里。</p><p class="ef-actions"><button type="button" class="ef-btn small" data-act="${link.state === 'moved' ? 'link-reload' : 'refresh'}">${icon('refresh')}${link.state === 'moved' ? '载入新工作区' : '重新连接'}</button></p></div></div>`);
  }
  function setLink(state, extra = {}) {
    const was = link.state;
    Object.assign(link, { state }, extra);
    paintLink();
    if (was !== 'ok' && state === 'ok') DSH.toast('已重新连接工作台服务');
  }
  DSH.on('link-reload', () => location.reload());

  /* 重新读取：只在内容变化时重绘，保留当前地址 */
  DSH.refresh = async (opt = {}) => {
    if (busy || link.state === 'moved') return;
    busy = true;
    try {
      const data = await getJSON('api/workbench');
      if (workspace && data.workspace && data.workspace !== workspace) { setLink('moved', { other: data.workspace }); return; }
      const changed = data.fingerprint !== fingerprint;
      fingerprint = data.fingerprint;
      link.lastRead = link.lastCheck = Date.now();
      link.error = null;
      DSH.setData(data);
      DSH.render();
      setLink('ok');
      if (!opt.quiet) DSH.toast(changed ? '已重新读取：工作区文件有变化' : '已重新读取：文件没有变化');
      else if (changed) DSH.toast('工作区文件有变化，已更新显示');
    } catch (e) {
      setLink('offline', { error: e.message });
      if (!opt.quiet) DSH.toast('重新读取失败：' + e.message, 4000);
    } finally {
      busy = false;
    }
  };
  async function poll() {
    if (document.hidden || busy || !fingerprint || link.state === 'moved') return;
    try {
      const r = await getJSON('api/fingerprint');
      if (r.workspace && r.workspace !== workspace) return setLink('moved', { other: r.workspace });
      if (r.fingerprint !== fingerprint || link.state === 'offline') return await DSH.refresh({ quiet: true });
      link.lastCheck = Date.now();
      if (link.state !== 'ok') setLink('ok');
      else paintLink();
    } catch (e) {
      /* 服务暂时不可达：保留当前显示，明确标出失联与最后成功读取的时间，下次再试 */
      setLink('offline', { error: e.message });
    }
  }
  function watchdog() {
    if (document.hidden || link.state !== 'ok' || !link.lastCheck) return;
    if (Date.now() - link.lastCheck > STALE) setLink('stale');
  }
  DSH.on('refresh', () => DSH.refresh());

  (async () => {
    if (!served) {
      try {
        await loadScript('assets/js/data.js');
        DSH.setData(window.DSH_DATA);
        DSH.boot();
      } catch (e) {
        /* 安装到工作区的副本不带示例数据：直接双击只会到这里 */
        DSH.bootCore();
        fatal(new Error('直接打开 index.html 只能看设计原型的示例数据，这份工作台没有附带示例数据。请在工作区根目录运行 node .claude/workbench/open.mjs --workspace .（或 .agents/workbench/open.mjs），打开它给出的地址。'));
      }
      return;
    }
    try {
      const data = await getJSON('api/workbench');
      fingerprint = data.fingerprint;
      workspace = data.workspace || null;
      link.lastRead = link.lastCheck = Date.now();
      DSH.setData(data);
      DSH.boot();
      setInterval(poll, POLL);
      setInterval(watchdog, POLL);
      document.addEventListener('visibilitychange', poll);
    } catch (e) {
      DSH.bootCore();
      fatal(e);
    }
  })();
})();
