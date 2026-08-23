/** 首页简报区：读取本机已保存的视频预览 */
(function initHomeVideoPreview() {
  const host = document.getElementById('home-video-preview-list');
  const vp = window.BioAI?.videoPreview;
  if (!host || !vp) return;

  function paint() {
    vp.renderHomeList(host);
  }

  paint();

  window.addEventListener('storage', (e) => {
    if (e.key === vp.HISTORY_KEY) paint();
  });
})();
