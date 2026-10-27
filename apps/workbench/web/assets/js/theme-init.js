/* 未选择时默认浅色；首帧前恢复有效偏好，避免闪烁。 */
document.documentElement.dataset.theme = 'light';
try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
