/* DSH 研究工作台 · core.js
   ---------------------------------------------------------------------------
   基础设施：安全模板、图标、状态、路由、事件委托、浮层（侧栏面板 / 弹出层 /
   提示 / 命令面板）、深浅切换。经典脚本，不依赖框架，双击 index.html 即可运行。
   动效遵循 endfield-ui：短、硬、机械；系统“减少动态效果”时全部跳到最终状态。 */
(function () {
  'use strict';
  const DSH = (window.DSH = window.DSH || {});

  /* ---------- 1. 安全模板：插值默认转义，raw() 才原样输出 ---------- */
  class Safe {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
  }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const raw = (s) => new Safe(s == null ? '' : String(s));
  /* 布尔值原样写成 true / false：模板里只在属性（aria-pressed 等）中插入布尔值，
     条件内容一律用三元表达式，不用 a && b，所以不会把 false 印到页面上 */
  function out(v) {
    if (v == null) return '';
    if (v === true || v === false) return String(v);
    if (v instanceof Safe) return v.s;
    if (Array.isArray(v)) return v.map(out).join('');
    return esc(v);
  }
  function html(strings, ...vals) {
    let s = '';
    for (let i = 0; i < strings.length; i++) {
      s += strings[i];
      if (i < vals.length) s += out(vals[i]);
    }
    return new Safe(s);
  }
  Object.assign(DSH, { html, raw, esc, out, Safe });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  DSH.$ = $;
  DSH.$$ = $$;
  DSH.still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 2. 图标：1.5px 线性、方头、尖角；不填色（状态符号除外） ---------- */
  const I24 = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20.5 20.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    'chev-r': '<path d="m9 6 6 6-6 6"/>',
    'chev-d': '<path d="m6 9 6 6 6-6"/>',
    'chev-l': '<path d="m15 6-6 6 6 6"/>',
    'chev-u': '<path d="m6 15 6-6 6 6"/>',
    'arrow-r': '<path d="M4 12h15M13 6l6 6-6 6"/>',
    'arrow-l': '<path d="M20 12H5M11 6l-6 6 6 6"/>',
    'arrow-ur': '<path d="M7 17 17 7M9 7h8v8"/>',
    copy: '<path d="M9 9h11v11H9z"/><path d="M5.5 15H4V4h11v1.5"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<path d="M5.5 11h13v9.5h-13z"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/>',
    filter: '<path d="M3.5 5h17l-6.5 8v6l-4 1.5V13z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1.5M4 12h1.5M4 18h1.5"/>',
    graph: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="13" cy="18" r="2.5"/><path d="M8.4 7.3l7.1-.9M7.3 9.2l4.5 6.6M16.9 8.3l-2.8 7.4"/>',
    table: '<path d="M3.5 5h17v14h-17zM3.5 10h17M3.5 14.5h17M9.5 10v9"/>',
    board: '<path d="M4 4h4.5v16H4zM10 4h4.5v10H10zM16 4h4v13h-4z"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4.5l3 1.5"/>',
    diff: '<path d="M6 4v9a3 3 0 0 0 3 3h6"/><path d="m12 13 3 3-3 3"/><path d="M18 20v-9a3 3 0 0 0-3-3H9"/><path d="m12 11-3-3 3-3"/>',
    link: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3.5-3.5a3.5 3.5 0 0 0-5-5L12 7"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-3.5 3.5a3.5 3.5 0 0 0 5 5L12 17"/>',
    unlink: '<path d="m15.5 13.5 3-3a3.5 3.5 0 0 0-5-5L12 7"/><path d="m8.5 10.5-3 3a3.5 3.5 0 0 0 5 5L12 17"/><path d="M4 4l3 3M17 17l3 3"/>',
    cpu: '<path d="M6.5 6.5h11v11h-11zM10 10h4v4h-4zM9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
    db: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5"/>',
    terminal: '<path d="M3.5 4.5h17v15h-17z"/><path d="m7 9 3 3-3 3M12.5 15h4.5"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    bot: '<path d="M5 8.5h14V19H5z"/><path d="M12 4.5v4M9 13v1.5M15 13v1.5M2.5 12.5v3M21.5 12.5v3"/>',
    box: '<path d="M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'eye-off': '<path d="M2.5 12S6 5.5 12 5.5c2 0 3.7.7 5.1 1.7M21.5 12S18 18.5 12 18.5c-2 0-3.7-.7-5.1-1.7"/><path d="M4 20 20 4"/>',
    refresh: '<path d="M19.5 11A7.5 7.5 0 0 0 6 6.5L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4.5 13A7.5 7.5 0 0 0 18 17.5l2-2"/><path d="M20 20v-4.5h-4.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    'panel-r': '<path d="M3.5 4.5h17v15h-17zM14.5 4.5v15"/>',
    'panel-l': '<path d="M3.5 4.5h17v15h-17zM9.5 4.5v15"/>',
    layers: '<path d="m12 3.5 9 4.5-9 4.5-9-4.5z"/><path d="m3 12.5 9 4.5 9-4.5"/>',
    fold: '<path d="m7 4 5 5 5-5M7 20l5-5 5 5"/>',
    unfold: '<path d="m7 9 5-5 5 5M7 15l5 5 5-5"/>',
    impact: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9"/>',
    route: '<circle cx="6" cy="18.5" r="2.2"/><circle cx="18" cy="5.5" r="2.2"/><path d="M8.2 18.5H15a3.2 3.2 0 0 0 0-6.4H9a3.2 3.2 0 0 1 0-6.4h6.8"/>',
    play: '<path d="M7 4.5v15L19 12z"/>',
    pause: '<path d="M8.5 5v14M15.5 5v14"/>',
    send: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
    retry: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    archive: '<path d="M3.5 4.5h17v4h-17zM5 8.5v11h14v-11M10 12.5h4"/>',
    cycle: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4"/>',
    zap: '<path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5z"/>',
    similar: '<path d="M4 9.5c2.7-2.2 5.3-2.2 8 0s5.3 2.2 8 0M4 15c2.7-2.2 5.3-2.2 8 0s5.3 2.2 8 0"/>',
    quote: '<path d="M5 7h5v5c0 3-1.5 5-4 5.5M14 7h5v5c0 3-1.5 5-4 5.5"/>',
    hash: '<path d="M5 9h15M4 15h15M10 3.5 8 20.5M16 3.5l-2 17"/>',
    commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
    branch: '<circle cx="6.5" cy="5.5" r="2.2"/><circle cx="6.5" cy="18.5" r="2.2"/><circle cx="17.5" cy="8" r="2.2"/><path d="M6.5 7.7v8.6M17.5 10.2c0 3.5-3 5.3-8.8 6.3"/>',
    book: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z"/>',
    scissors: '<circle cx="6" cy="6.5" r="2.8"/><circle cx="6" cy="17.5" r="2.8"/><path d="M20 4.5 8.3 15.5M14.5 14.4 20 19.5M8.3 8.5 11.5 11.5"/>',
    flask: '<path d="M9 3.5h6M10 3.5V10l-5.5 9.5h15L14 10V3.5"/><path d="M7.5 15h9"/>',
    dag: '<path d="M3 4.5h6v5H3zM15 3h6v5h-6zM15 16h6v5h-6z"/><path d="M9 7h3v11.5h3M12 5.5h3"/>',
    tasks: '<path d="M3.5 6.5 5 8l2.5-2.5M3.5 12.5 5 14l2.5-2.5M3.5 18.5 5 20l2.5-2.5M10.5 7h10M10.5 13h10M10.5 19h10"/>',
    team: '<circle cx="9" cy="8" r="3.3"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M15.5 4.8a3.3 3.3 0 0 1 0 6.4M17.5 14.6c2 .6 3.2 2.4 3.5 5.4"/>',
    story: '<path d="M4 20h4.5L19.5 9 15 4.5 4 15.5z"/><path d="M13 6.5l4.5 4.5"/>',
    overview: '<path d="M3.5 3.5h7.5v9H3.5zM13 3.5h7.5v5H13zM13 10.5h7.5v10H13zM3.5 14.5h7.5v6H3.5z"/>',
    ruler: '<path d="M3 16.5 16.5 3 21 7.5 7.5 21z"/><path d="M7 12.5 9 14.5M10 9.5l2 2M13 6.5l2 2"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    flag: '<path d="M5.5 21V4h11l-2 4 2 4H5.5"/>',
    sim: '<path d="M4 4h16v16H4z" stroke-dasharray="3 2.6"/>',
    ghost: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.6"/>',
    keyboard: '<path d="M2.5 6h19v12h-19z"/><path d="M6 10h.5M9.5 10h.5M13 10h.5M16.5 10h.5M7.5 14h9"/>',
  };
  /* 状态符号：16 格；圆 = 执行，方 = 审查，菱形 = 研究判定，书签 = 用户决策 */
  const I16 = {
    'g-pending': '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 1.9"/>',
    'g-running': '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none"/>',
    'g-blocked': '<circle cx="8" cy="8" r="5.5"/><path d="M5 8h6"/>',
    'g-failed': '<circle cx="8" cy="8" r="5.5"/><path d="m6 6 4 4M10 6l-4 4"/>',
    'g-cancelled': '<circle cx="8" cy="8" r="5.5"/><path d="M4.3 11.7l7.4-7.4"/>',
    'g-done': '<circle cx="8" cy="8" r="5.5"/><path d="m5.4 8.2 1.8 1.8 3.4-3.6"/>',
    'g-unknown': '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 1.9"/><path d="M6.7 6.6a1.4 1.4 0 1 1 1.9 1.3c-.4.2-.6.5-.6.9v.4M8 10.8v.4"/>',
    'g-rv-none': '<path d="M2.5 2.5h11v11h-11z" stroke-dasharray="2.2 1.9"/>',
    'g-rv-pending': '<path d="M2.5 2.5h11v11h-11z"/><path d="M8 7.2v1.6" stroke-width="2.4"/>',
    'g-rv-pass': '<path d="M2.5 2.5h11v11h-11z"/><path d="m5.3 8.2 1.9 1.9 3.6-3.8"/>',
    'g-rv-changes': '<path d="M2.5 2.5h11v11h-11z"/><path d="M8 5v3.6M8 10.5v.5"/>',
    'g-rv-fail': '<path d="M2.5 2.5h11v11h-11z"/><path d="m5.5 5.5 5 5M10.5 5.5l-5 5"/>',
    'g-vd-supported': '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" fill="currentColor"/>',
    'g-vd-refuted': '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z"/><path d="m6 6 4 4M10 6l-4 4"/>',
    'g-vd-insufficient': '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z"/><path d="M8 1.8 1.8 8 8 14.2z" fill="currentColor"/>',
    'g-vd-pending': '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" stroke-dasharray="2.2 1.9"/>',
    'g-vd-na': '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z"/><path d="M5.5 8h5"/>',
    'g-dc-suggested': '<path d="M4 2.5h8v11l-4-2.8-4 2.8z" stroke-dasharray="2.2 1.9"/>',
    'g-dc-selected': '<path d="M4 2.5h8v11l-4-2.8-4 2.8z" fill="currentColor"/>',
    'g-dc-delegated': '<path d="M4 2.5h8v11l-4-2.8-4 2.8z"/><path d="M6.4 5.4h3.2v2.8H6.4z" fill="currentColor" stroke="none"/>',
    'g-ck-pass': '<path d="m3 8.5 3 3 7-7"/>',
    'g-ck-warn': '<path d="M8 2 1.6 13.5h12.8z"/><path d="M8 6.5v3.2M8 11.4v.4"/>',
    'g-ck-fail': '<path d="m3.5 3.5 9 9M12.5 3.5l-9 9"/>',
    'g-ck-na': '<path d="M4 8h8"/>',
    'g-pv-current': '<path d="M3 3h10v10H3z"/><path d="M5.5 5.5h5v5h-5z" fill="currentColor" stroke="none"/>',
    'g-pv-historical': '<path d="M2.5 3h11v3h-11zM3.5 6v7h9V6M6.5 9h3"/>',
    'g-pv-simulated': '<path d="M2.5 2.5h11v11h-11z" stroke-dasharray="2 1.6"/>',
    'g-pv-example': '<path d="M2.5 4.5h7l4 3.5-4 3.5h-7z"/>',
    'g-fr-ok': '<path d="m3 8.5 3 3 7-7"/>',
    'g-fr-stale': '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.3l2 1.3"/>',
    'g-fr-error': '<path d="M8 2 1.6 13.5h12.8z"/><path d="M8 6.5v3.2M8 11.4v.4"/>',
    'g-fr-partial': '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none"/>',
    'g-fr-missing': '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 1.9"/><path d="M4.3 11.7l7.4-7.4"/>',
    'g-zap': '<path d="M9 1.5 3 9h4.5L7 14.5 13 7H8.5z"/>',
    'g-unlink': '<path d="m10 9 2-2a2.4 2.4 0 0 0-3.4-3.4L7.2 5"/><path d="M6 7 4 9a2.4 2.4 0 0 0 3.4 3.4l1.4-1.4"/><path d="M2.5 2.5l2 2M11.5 11.5l2 2"/>',
    'g-q': '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 1.9"/><path d="M6.7 6.6a1.4 1.4 0 1 1 1.9 1.3c-.4.2-.6.5-.6.9v.4M8 10.8v.4"/>',
    'g-open': '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.6M8 10.5v.5"/>',
    'g-resolved': '<circle cx="8" cy="8" r="5.5"/><path d="m5.4 8.2 1.8 1.8 3.4-3.6"/>',
    'g-lock': '<path d="M3.5 7.5h9v6.5h-9z"/><path d="M5.5 7.5V5.2a2.5 2.5 0 0 1 5 0v2.3"/>',
    'g-hyp': '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" stroke-dasharray="2.2 1.9"/>',
  };
  function injectSprite() {
    const sym = (name, vb, body) => `<symbol id="i-${name}" viewBox="${vb}">${body}</symbol>`;
    const s = Object.entries(I24).map(([k, v]) => sym(k, '0 0 24 24', v)).join('') + Object.entries(I16).map(([k, v]) => sym(k, '0 0 16 16', v)).join('');
    const wrap = document.createElement('div');
    wrap.hidden = true;
    wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${s}</svg>`;
    document.body.prepend(wrap);
  }
  DSH.icon = (name, cls = '') => raw(`<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`);

  /* ---------- 3. 状态：只保存视图偏好；研究数据一律从文件读取 ---------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('dsh.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('dsh.' + k, JSON.stringify(v)); } catch {} },
  };
  DSH.LS = LS;
  DSH.state = {
    projectId: LS.get('project', 'p-dsh'),
    proto: 'normal', /* 原型状态演示：normal | loading | empty | error | stale | partial | cycle */
    returnTo: null, /* 跨对象跳转后的“返回”位置：{ label, hash, anchor } */
    scroll: {},
    view: {}, /* 每个视图自己的界面状态（筛选、展开、选中），只影响显示 */
  };
  DSH.vs = (key, init) => {
    const k = DSH.state.projectId + ':' + key;
    if (!(k in DSH.state.view)) DSH.state.view[k] = typeof init === 'function' ? init() : init;
    return DSH.state.view[k];
  };
  /* 重新读取到新内容时清空视图状态：选中、展开、筛选可能指向已不存在的对象 */
  DSH.resetViewState = () => { DSH.state.view = {}; };

  /* ---------- 4. 路由（hash） ---------- */
  const routes = [];
  DSH.route = (pattern, view, extra = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
    routes.push({ re, keys, view, ...extra });
  };
  DSH.parse = () => {
    const h = decodeURIComponent(location.hash.slice(1)) || '/overview';
    const [path, qs] = h.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = m[i + 1]));
        return { view: r.view, section: r.section, params, query, path, hash: '#' + h };
      }
    }
    return { view: 'notfound', section: null, params: {}, query, path, hash: '#' + h };
  };
  DSH.href = (path, query) => {
    const q = query ? Object.entries(query).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
    return '#' + path + (q ? '?' + q : '');
  };
  DSH.go = (hash, { replace = false } = {}) => {
    if (location.hash === hash) DSH.render();
    else if (replace) { history.replaceState(null, '', hash); DSH.render(); }
    else location.hash = hash;
  };

  /* ---------- 5. 事件委托：data-act / data-change / data-input ---------- */
  DSH.actions = {};
  DSH.on = (name, fn) => (DSH.actions[name] = fn);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.matches(':disabled,[aria-disabled="true"]')) return;
    const fn = DSH.actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && DSH.actions[el.dataset.change]) DSH.actions[el.dataset.change](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && DSH.actions[el.dataset.input]) DSH.actions[el.dataset.input](el, e);
  });

  /* ---------- 6. 复制：本机文件不能直接打开时，提供复制路径 ---------- */
  DSH.copy = async (text, label = '已复制路径') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.append(t);
      t.select();
      try { document.execCommand('copy'); } catch {}
      t.remove();
    }
    DSH.toast(label + '：' + text);
  };
  DSH.on('copy', (el) => DSH.copy(el.dataset.text, el.dataset.label || '已复制路径'));

  /* ---------- 7. 等待退出动效：减少动效时立即完成 ---------- */
  /* 只等有限时长的动画；页面在后台时动画会暂停，所以再加一个兜底时限 */
  const settled = (el) => new Promise((done) => {
    if (DSH.still() || !el.getAnimations || document.hidden) return done();
    const a = el.getAnimations({ subtree: true }).filter((x) => x.effect && x.effect.getTiming().iterations !== Infinity);
    if (!a.length) return done();
    const t = setTimeout(done, 700);
    Promise.allSettled(a.map((x) => x.finished)).then(() => { clearTimeout(t); done(); });
  });
  DSH.settled = settled;

  /* ---------- 8. 提示条（toast）：深色条、左侧黄条、一句话，2 秒后擦掉 ---------- */
  DSH.toast = (text, ms = 2200) => {
    $$('.ef-toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'ef-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.append(el);
    setTimeout(async () => {
      el.classList.add('is-closing');
      await settled(el);
      el.remove();
    }, ms);
  };

  /* ---------- 9. 侧栏面板：对象详情（Run、任务、成员、来源、trace…） ---------- */
  const side = {
    el: null, stack: [], current: null,
    init() {
      this.el = $('#dsh-side');
      this.el.addEventListener('cancel', (e) => { e.preventDefault(); this.close(); });
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el) this.close();
        if (e.target.closest('[data-side-close]')) this.close();
        if (e.target.closest('[data-side-back]')) this.back();
      });
    },
    /* content: { key, eyebrow, title, body, foot } —— key 用于避免重复入栈 */
    open(content) {
      if (this.el.open && this.current && this.current.key !== content.key) this.stack.push(this.current);
      this.current = content;
      this.paint();
      if (!this.el.open) this.el.showModal();
      const s = $('.dsh-side-scroll', this.el);
      if (s) s.scrollTop = 0;
      const h = $('#dsh-side-title', this.el);
      h && h.focus({ preventScroll: true });
    },
    paint() {
      const c = this.current;
      $('#dsh-side-eyebrow', this.el).textContent = c.eyebrow || '';
      $('#dsh-side-title', this.el).textContent = c.title || '';
      $('#dsh-side-body', this.el).innerHTML = out(c.body);
      const back = $('[data-side-back]', this.el);
      back.hidden = !this.stack.length;
      if (this.stack.length) back.querySelector('span').textContent = '返回 ' + (this.stack[this.stack.length - 1].short || this.stack[this.stack.length - 1].title);
    },
    back() {
      if (!this.stack.length) return;
      this.current = this.stack.pop();
      this.paint();
    },
    async close() {
      if (!this.el.open || this.el.classList.contains('is-closing')) return;
      this.el.classList.add('is-closing');
      await settled(this.el);
      this.el.classList.remove('is-closing');
      this.el.close();
      this.stack = [];
      this.current = null;
    },
  };
  DSH.side = side;

  /* ---------- 10. 弹出层：引用预览、菜单 ---------- */
  const pop = {
    el: null, anchor: null, onClose: null,
    init() {
      this.el = $('#dsh-pop');
      document.addEventListener('pointerdown', (e) => {
        if (!this.el.hidden && !this.el.contains(e.target) && !(this.anchor && this.anchor.contains(e.target))) this.close(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.el.hidden) { e.stopPropagation(); this.close(true); }
      }, true);
      this.el.addEventListener('click', (e) => { if (e.target.closest('[data-pop-close]')) this.close(true); });
    },
    open(anchor, body, { label = '', cls = '', onClose = null, focus = true } = {}) {
      if (!this.el.hidden && this.anchor === anchor) return this.close(true);
      this.close(false);
      this.anchor = anchor;
      this.onClose = onClose;
      this.el.className = 'dsh-pop ' + cls;
      this.el.setAttribute('aria-label', label);
      this.el.innerHTML = out(body);
      this.el.hidden = false;
      anchor.setAttribute('aria-expanded', 'true');
      this.place();
      if (focus) {
        const f = this.el.querySelector('[autofocus], button, a[href], input, select, [tabindex]:not([tabindex="-1"])');
        (f || this.el).focus({ preventScroll: true });
      }
    },
    place() {
      const a = this.anchor.getBoundingClientRect();
      const p = this.el.getBoundingClientRect();
      const vw = innerWidth, vh = innerHeight, m = 8;
      let top = a.bottom + 6;
      if (top + p.height > vh - m && a.top - 6 - p.height > m) top = a.top - 6 - p.height;
      top = Math.max(m, Math.min(top, vh - p.height - m));
      let left = Math.min(a.left, vw - p.width - m);
      left = Math.max(m, left);
      this.el.style.top = top + 'px';
      this.el.style.left = left + 'px';
    },
    close(returnFocus) {
      if (this.el.hidden) return;
      this.el.hidden = true;
      this.el.innerHTML = '';
      if (this.anchor) {
        this.anchor.setAttribute('aria-expanded', 'false');
        if (returnFocus && document.contains(this.anchor)) this.anchor.focus({ preventScroll: true });
      }
      const cb = this.onClose;
      this.anchor = null;
      this.onClose = null;
      cb && cb();
    },
  };
  DSH.pop = pop;

  /* ---------- 11. 悬停说明：值在前、名字在后；只做补充，信息另有表格可查 ---------- */
  const tip = {
    el: null, host: null,
    init() {
      this.el = $('#dsh-tip');
      const show = (e) => {
        const h = e.target.closest && e.target.closest('[data-tip]');
        if (!h || h === this.host) return;
        this.host = h;
        const lines = h.dataset.tip.split('\n');
        this.el.replaceChildren();
        lines.forEach((t, i) => {
          const d = document.createElement(i === 0 ? 'strong' : 'span');
          d.textContent = t;
          this.el.append(d);
        });
        this.el.hidden = false;
        const r = h.getBoundingClientRect();
        const p = this.el.getBoundingClientRect();
        let left = r.left + r.width / 2 - p.width / 2;
        left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
        let top = r.top - p.height - 8;
        if (top < 8) top = r.bottom + 8;
        this.el.style.left = left + 'px';
        this.el.style.top = top + 'px';
      };
      const hide = (e) => {
        if (!this.host) return;
        if (e.relatedTarget && this.host.contains(e.relatedTarget)) return;
        this.host = null;
        this.el.hidden = true;
      };
      document.addEventListener('pointerover', show);
      document.addEventListener('focusin', show);
      document.addEventListener('pointerout', hide);
      document.addEventListener('focusout', hide);
      document.addEventListener('scroll', () => { this.host = null; this.el.hidden = true; }, true);
    },
  };

  /* ---------- 12. 深浅切换：从按钮处扩散一个圆；减少动效时直接切换 ---------- */
  const theme = {
    get() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); },
    set(t) {
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('theme', t); } catch {}
      this.sync();
      DSH.emit && DSH.emit('theme');
    },
    /* 没有保存过选择时跟随系统；只同步按钮状态，不写入 */
    sync() { $$('[data-act="theme"]').forEach((b) => b.setAttribute('aria-pressed', String(this.get() === 'dark'))); },
  };
  DSH.theme = theme;
  DSH.on('theme', (el, e) => {
    const next = theme.get() === 'dark' ? 'light' : 'dark';
    if (DSH.still() || !document.startViewTransition) return theme.set(next);
    const box = el.getBoundingClientRect();
    const x = e.clientX || box.left + box.width / 2;
    const y = e.clientY || box.top + box.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const html = document.documentElement;
    html.classList.add('ef-theming');
    const t = document.startViewTransition(() => theme.set(next));
    t.ready.then(() => html.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: Math.max(240, Math.min(600, r / 3)), easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {});
    t.finished.finally(() => html.classList.remove('ef-theming'));
  });

  /* ---------- 13. 简单事件总线：视图之间互不直接调用 ---------- */
  const bus = {};
  DSH.listen = (name, fn) => (bus[name] = bus[name] || []).push(fn);
  DSH.emit = (name, data) => (bus[name] || []).forEach((fn) => fn(data));

  DSH.bootCore = () => {
    injectSprite();
    side.init();
    pop.init();
    tip.init();
    theme.sync();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => theme.sync());
  };
})();
