const tabs = document.querySelectorAll('.nav-tab');
const sections = document.querySelectorAll('.section');
const toolCards = document.querySelectorAll('.tool-card');

function showSection(id) {
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tool === id.replace('section-', '')));
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
