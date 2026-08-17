import { renderGallery } from './gallery.js';

let allImages = [];

export function renderCategories(images) {
  allImages = images;
  const nav = document.getElementById('categories');
  const cats = ['all', ...new Set(images.map(i => i.category).filter(Boolean))];

  nav.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat === 'all' ? ' active' : '');
    btn.dataset.category = cat;
    btn.textContent = cat === 'all' ? 'All' : cat;
    btn.addEventListener('click', () => selectCategory(cat, btn));
    nav.appendChild(btn);
  });
}

function selectCategory(cat, btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const filtered = cat === 'all' ? allImages : allImages.filter(i => i.category === cat);
  renderGallery(document.getElementById('gallery'), filtered);
}
