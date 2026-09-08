/** 注册同域 Service Worker；失败静默（旧浏览器 / 非 HTTPS）。 */
(function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  const raw = document.documentElement?.dataset?.base || '/';
  const scope = raw.endsWith('/') ? raw : `${raw}/`;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${scope}sw.js`, { scope }).catch(() => {});
  });
})();
