import { openLightbox } from './lightbox.js';

export function renderGallery(container, images) {
  container.innerHTML = '';
  if (!images.length) {
    container.innerHTML = `<div class="empty"><div class="empty__icon">📁</div><div class="empty__text">Belum ada karya.</div></div>`;
    return;
  }

  images.forEach((img, i) => {
    const name = img.name.replace(/\.[^.]+$/, ''); // strip extension
    const item = document.createElement('div');
    item.className = 'gallery__item';
    item.dataset.id = img.id;
    item.innerHTML = `
      ${img.type === 'video' 
        ? `<video src="${img.url}#t=0.1" preload="metadata" muted playsinline loading="lazy"></video><div class="gallery__icon">▶</div>` 
        : `<img src="${img.url}" alt="${name}" loading="lazy">`
      }
      <div class="gallery__overlay"><span>${name}</span></div>
    `;
    item.addEventListener('click', () => openLightbox(images, i));
    container.appendChild(item);
  });

  document.getElementById('post-count').textContent = images.length;
}
