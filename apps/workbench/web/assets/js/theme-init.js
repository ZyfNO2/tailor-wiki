/* 首帧前套用用户选过的深浅主题，避免闪烁（独立文件，便于严格 CSP） */
try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
