let imagesData = [];
let currentIndex = 0;

const lb = document.getElementById('lightbox');
const imgEl = document.getElementById('lb-img');
const vidEl = document.getElementById('lb-video');
const captionEl = document.getElementById('lb-caption');

export function openLightbox(images, startIndex) {
  imagesData = images;
  currentIndex = startIndex;
  updateLightbox();
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lb.hidden = true;
  document.body.style.overflow = '';
  imgEl.src = '';
  vidEl.src = '';
  vidEl.pause();
}

function updateLightbox() {
  const current = imagesData[currentIndex];
  
  if (current.type === 'video') {
    imgEl.hidden = true;
    vidEl.hidden = false;
    vidEl.src = current.url;
    vidEl.play().catch(() => {}); // Auto-play if allowed
  } else {
    vidEl.hidden = true;
    vidEl.pause();
    imgEl.hidden = false;
    imgEl.src = current.url;
  }
  
  captionEl.textContent = current.name.replace(/\.[^.]+$/, '');
}

function nextImage(e) {
  if (e) e.stopPropagation();
  currentIndex = (currentIndex + 1) % imagesData.length;
  updateLightbox();
}

function prevImage(e) {
  if (e) e.stopPropagation();
  currentIndex = (currentIndex - 1 + imagesData.length) % imagesData.length;
  updateLightbox();
}

// Event Listeners
document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-next').addEventListener('click', nextImage);
document.getElementById('lb-prev').addEventListener('click', prevImage);
lb.addEventListener('click', (e) => {
  if (e.target === lb) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'ArrowLeft') prevImage();
});
