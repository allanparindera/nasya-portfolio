export function renderSkeletons(container, count = 6) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'skeleton';
    container.appendChild(el);
  }
}

export function renderError(container, message) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty__icon">⚠️</div>
      <div class="empty__text">Gagal memuat gambar: ${message}<br><br>Cek Google Apps Script URL.</div>
    </div>
  `;
}

export function renderEmpty(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty__icon">📁</div>
      <div class="empty__text">Belum ada karya desain di Google Drive.</div>
    </div>
  `;
}
