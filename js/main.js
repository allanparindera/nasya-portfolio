import { fetchImages, uploadFile, deleteFile } from './api.js';
import { renderGallery } from './gallery.js';
import { renderSkeletons, renderError, renderEmpty } from './loader.js';
import { renderCategories } from './navigation.js';
import './lightbox.js';

const gallery = document.getElementById('gallery');
const adminPanel = document.getElementById('admin-panel');
const uploadBtn = document.getElementById('upload-btn');
const uploadInput = document.getElementById('upload-input');
const uploadStatus = document.getElementById('upload-status');

// Tampilkan admin panel kalau ada ?admin=1 di URL
if (new URLSearchParams(window.location.search).get('admin') === '1') {
  adminPanel.classList.add('show');
}

async function init() {
  renderSkeletons(gallery, 9);
  try {
    const items = await fetchImages();
    if (!items.length) return renderEmpty(gallery);
    renderCategories(items);
    renderGallery(gallery, items);
  } catch (err) {
    renderError(gallery, err.message);
  }
}

// Upload file (Gambar / Video)
uploadBtn.addEventListener('click', async () => {
  const file = uploadInput.files[0];
  if (!file) return (uploadStatus.textContent = 'Pilih file gambar atau video dulu.');
  
  uploadBtn.disabled = true;
  uploadStatus.textContent = 'Uploading... (tunggu sebentar, file diubah jadi base64)';
  
  try {
    await uploadFile(file);
    uploadStatus.textContent = 'Upload sukses!';
    uploadInput.value = '';
    init(); // Reload
  } catch (err) {
    uploadStatus.textContent = `Error: ${err.message}`;
  } finally {
    uploadBtn.disabled = false;
  }
});

// Delete via Klik Kanan
gallery.addEventListener('contextmenu', async (e) => {
  if (!adminPanel.classList.contains('show')) return;
  const item = e.target.closest('.gallery__item');
  if (!item) return;
  
  e.preventDefault();
  const id = item.dataset.id;
  if (!confirm('Hapus file ini dari Drive?')) return;
  
  try {
    item.style.opacity = '0.5';
    await deleteFile(id);
    init();
  } catch (err) {
    alert(`Gagal hapus: ${err.message}`);
    item.style.opacity = '1';
  }
});

document.addEventListener('DOMContentLoaded', init);
