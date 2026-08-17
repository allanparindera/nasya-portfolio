// ==========================================
// GANTI URL INI setelah deploy Apps Script
// ==========================================
const GAS_URL = 'GANTI_DENGAN_APPS_SCRIPT_URL';

const CACHE_KEY = 'portfolio_images';
const CACHE_TTL = 5 * 60 * 1000;

export async function fetchImages() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL) return data;
  }

  const res = await fetch(GAS_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'API error');

  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.images, ts: Date.now() }));
  return json.images;
}

export async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const res = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            base64: base64
          })
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        sessionStorage.removeItem(CACHE_KEY);
        resolve(await res.json());
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function deleteFile(id) {
  const res = await fetch(`${GAS_URL}?action=delete&id=${id}`);
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  sessionStorage.removeItem(CACHE_KEY);
  return res.json();
}
