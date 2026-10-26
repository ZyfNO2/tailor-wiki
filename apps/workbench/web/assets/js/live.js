/* DSH 研究工作台 · live.js —— 数据从哪里来
   ---------------------------------------------------------------------------
   通过工作台服务（node apps/workbench/server.mjs）打开：读取 /api/workbench，
   即真实工作区文件的只读投影；每 5 秒比对一次文件指纹，Skill 写入新内容后自动更新。
   直接双击 index.html（file://）：载入 data.js 示例数据，作为设计原型查看。
   服务读取失败时显示失败原因，不回退到示例数据冒充工作区内容。 */
(function () {
  'use strict';
  const DSH = window.DSH;
  const { html, icon } = DSH;
  const served = location.protocol === 'http:' || location.protocol === 'https:';
  DSH.mode = served ? 'live' : 'demo';
  let fingerprint = null;
  let busy = false;

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || 'HTTP ' + r.status);
    return body;
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
        ${DSH.ui.notice('读取失败', html`<p>${error.message}</p><p class="ef-field">工作台只读；它停止或出错都不影响四个 Skill 的使用。</p>`, html`<p class="ef-actions"><button type="button" class="ef-btn small" data-retry>${icon('refresh')}重新读取</button></p>`)}
      </div>`);
    const b = DSH.$('[data-retry]');
    if (b) b.addEventListener('click', () => location.reload());
  }

  /* 重新读取：只在内容变化时重绘，保留当前地址 */
  DSH.refresh = async (opt = {}) => {
    if (busy) return;
    busy = true;
    try {
      const data = await getJSON('api/workbench');
      const changed = data.fingerprint !== fingerprint;
      fingerprint = data.fingerprint;
      DSH.setData(data);
      DSH.render();
      if (!opt.quiet) DSH.toast(changed ? '已重新读取：工作区文件有变化' : '已重新读取：文件没有变化');
      else if (changed) DSH.toast('工作区文件有变化，已更新显示');
    } catch (e) {
      DSH.toast('重新读取失败：' + e.message, 4000);
    } finally {
      busy = false;
    }
  };
  async function poll() {
    if (document.hidden || busy || !fingerprint) return;
    try {
      const r = await getJSON('api/fingerprint');
      if (r.fingerprint !== fingerprint) await DSH.refresh({ quiet: true });
    } catch (e) { /* 服务暂时不可达：保留当前显示，下次再试 */ }
  }
  DSH.on('refresh', () => DSH.refresh());

  (async () => {
    if (!served) {
      try {
        await loadScript('assets/js/data.js');
        DSH.setData(window.DSH_DATA);
        DSH.boot();
      } catch (e) { DSH.bootCore(); fatal(e); }
      return;
    }
    try {
      const data = await getJSON('api/workbench');
      fingerprint = data.fingerprint;
      DSH.setData(data);
      DSH.boot();
      setInterval(poll, 5000);
      document.addEventListener('visibilitychange', poll);
    } catch (e) {
      DSH.bootCore();
      fatal(e);
    }
  })();
})();
