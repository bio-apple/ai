const tabs = document.querySelectorAll('.nav-tab');
const sections = document.querySelectorAll('.section');
const toolCards = document.querySelectorAll('.tool-card');

function showSection(id) {
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  tabs.forEach(t => {
    const tool = t.dataset.tool;
    const match = tool === 'all'
      ? id === 'section-home'
      : id === `section-${tool}`;
    t.classList.toggle('active', match);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tool = tab.dataset.tool;
    showSection(tool === 'all' ? 'section-home' : `section-${tool}`);
  });
});

toolCards.forEach(card => {
  card.addEventListener('click', () => {
    showSection(`section-${card.dataset.tool}`);
  });
});

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showSection(`section-${btn.dataset.goto}`));
});

/* Case accordion */
document.querySelectorAll('.case-header').forEach(header => {
  const toggle = () => {
    const card = header.closest('.case-card');
    const wasOpen = card.classList.contains('open');
    document.querySelectorAll('.case-card').forEach(c => c.classList.remove('open'));
    if (!wasOpen) card.classList.add('open');
  };
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
});

/* Case filter */
const filters = document.querySelectorAll('.case-filter');
const caseCards = document.querySelectorAll('.case-card[data-tool]');

filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    caseCards.forEach(card => {
      card.classList.toggle('hidden', filter !== 'all' && card.dataset.tool !== filter);
    });
  });
});

/* Copy prompt */
document.querySelectorAll('.prompt-block').forEach(block => {
  block.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(block.textContent.replace('点击复制', '').trim());
      block.classList.add('copied');
      setTimeout(() => block.classList.remove('copied'), 2000);
    } catch {
      /* fallback: ignore */
    }
  });
});
