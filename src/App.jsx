import videoCdnMap from './video-cdn-map.json';
import { useState, useEffect, useRef, useCallback } from 'react';

const THEME_KEY = 'nasya-portfolio-theme';
const ADMIN_KEY = 'nasya-admin-auth';
const API_URL = '/api';

// ─── Cloudinary Helper (Zero-lag webp responsive image CDN) ───
function getOptimizedImageUrl(url, width = 600) {
  if (!url) return url;
  if (url.includes('ik.imagekit.io')) {
    const base = url.split('?')[0];
    return `${base}?tr=w-${width},q-80,f-auto`;
  }
  return url;
}

// ─── API Helpers ───
async function checkAuthStatus() {
  const key = sessionStorage.getItem(ADMIN_KEY);
  if (!key) return false;
  try {
    const res = await fetch(`${API_URL}/auth`, {
      headers: { 'x-admin-key': key }
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function uploadFile(file, tags, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const authRes = await fetch(`${API_URL}/auth`);
      if (!authRes.ok) throw new Error('Failed to get auth signature');
      const auth = await authRes.json();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('token', auth.token);
      formData.append('signature', auth.signature);
      formData.append('expire', auth.expire);
      formData.append('publicKey', auth.publicKey);
      formData.append('folder', '/portfolio');
      formData.append('tags', tags.join(','));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });
}

async function uploadProfilePhoto(file) {
  return uploadFile(file, ['profile'], () => {});
}

async function loadProfilePhoto() {
  try {
    const res = await fetch(`${API_URL}/files`);
    if (!res.ok) return null;
    const text = await res.text();
    const files = JSON.parse(text);
    const profile = files.find(f => Array.isArray(f.tags) && f.tags.includes('profile'));
    return profile ? { id: profile.fileId, url: profile.url } : null;
  } catch {
    return null;
  }
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/profile`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function saveProfile(data) {
  const res = await fetch(`${API_URL}/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': sessionStorage.getItem(ADMIN_KEY) || ''
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Gagal menyimpan profil');
  return await res.json();
}

async function loadItems() {
  try {
    const res = await fetch(`${API_URL}/files`);
    if (!res.ok) throw new Error('Fetch failed');
    const text = await res.text();
    const files = JSON.parse(text);
    return files
      .filter(f => !f.tags || !f.tags.includes('profile'))
      .map(f => {
        let type = 'design';
        let title = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        let desc = '';
        
        if (Array.isArray(f.tags)) {
          for (const tag of f.tags) {
            if (['design', 'photo', 'video'].includes(tag)) {
              type = tag;
            } else if (tag.startsWith('title:')) {
              title = tag.slice(6);
            } else if (tag.startsWith('desc:')) {
              desc = tag.slice(5);
            }
          }
        }

        const cdnEntry = videoCdnMap[f.fileId];
        const isVideo = f.fileType === 'non-image' || /\.(mp4|mov|webm)$/i.test(f.name);
        const resolvedUrl = (cdnEntry && cdnEntry.cdn_url) ? cdnEntry.cdn_url : f.url;

        return {
          id: f.fileId,
          type,
          title,
          desc,
          url: resolvedUrl,
          thumb: f.thumbnailUrl || null,
          isVideo,
          rawTags: f.tags || []
        };
      });
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function updateItemData(fileId, updatedData, currentRawTags = []) {
  try {
    const tags = buildTags(updatedData.type, updatedData.title, updatedData.desc);
    const res = await fetch(`${API_URL}/files?fileId=${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': sessionStorage.getItem(ADMIN_KEY) || ''
      },
      body: JSON.stringify({ tags })
    });
    if (!res.ok) throw new Error('Update failed');
    return true;
  } catch (err) {
    console.error('Update item failed:', err);
    return false;
  }
}

async function deleteItem(fileId) {
  try {
    const res = await fetch(`${API_URL}/files?fileId=${fileId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-key': sessionStorage.getItem(ADMIN_KEY) || ''
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildTags(type, title, desc) {
  const tags = [type];
  if (title) tags.push(`title:${title.trim()}`);
  if (desc) tags.push(`desc:${desc.trim()}`);
  return tags;
}

// ─── Video Thumbnail Generator (Lazy Loaded Intersection Observer) ───
function VideoThumb({ src, className }) {
  const containerRef = useRef();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#09090b' }}>
      {inView ? (
        <video
          src={src}
          muted
          preload="metadata"
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' }} />
      )}
      <div className="video-play-badge">▶</div>
    </div>
  );
}

// ─── Avatar Crop Modal ───
function AvatarCropModal({ file, onSave, onClose }) {
  const imgRef = useRef();
  const canvasRef = useRef();
  const [imgUrl, setImgUrl] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePointerDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y)
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleZoom = (delta) => {
    setScale(prev => Math.min(3, Math.max(0.5, prev + delta)));
  };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);

    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    const naturalAspect = img.naturalWidth / img.naturalHeight;
    let drawW, drawH;
    if (naturalAspect >= 1) {
      drawH = size * scale;
      drawW = drawH * naturalAspect;
    } else {
      drawW = size * scale;
      drawH = drawW / naturalAspect;
    }

    const drawX = (size - drawW) / 2 + offset.x;
    const drawY = (size - drawH) / 2 + offset.y;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        onSave(croppedFile);
      }
      setSaving(false);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="crop-modal" onClick={e => e.stopPropagation()}>
        <h3>Sesuaikan Foto Profil</h3>
        <p className="crop-hint">Geser dan perbesar foto agar pas di dalam lingkaran</p>
        <div
          className="crop-container"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt="Crop target"
              className="crop-image"
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center'
              }}
            />
          )}
          <div className="crop-mask-circle" />
        </div>
        <div className="crop-controls">
          <button type="button" onClick={() => handleZoom(-0.1)} className="crop-zoom-btn">−</button>
          <span className="crop-zoom-label">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => handleZoom(0.1)} className="crop-zoom-btn">+</button>
        </div>
        <div className="crop-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="button" className="btn-primary" onClick={handleCrop} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Foto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Edit Component for Bio ───
function EditableBio({ profileData, onSave, isAdmin }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: profileData.title || '',
    bio: profileData.bio || ''
  });

  useEffect(() => {
    setDraft({
      title: profileData.title || '',
      bio: profileData.bio || ''
    });
  }, [profileData]);

  if (!isAdmin) {
    return (
      <div className="hero-bio-readonly">
        <p className="hero-title">{profileData.title || 'Packaging Development Specialist & Graphic Designer'}</p>
        <p className="hero-desc">{profileData.bio || 'Packaging development specialist with 3+ years in pharmaceutical packaging and graphic design. Focused on compliance, precision, and visual impact.'}</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="editable-bio-form">
        <input
          className="bio-input"
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
          placeholder="Judul / Role"
        />
        <textarea
          className="bio-textarea"
          value={draft.bio}
          onChange={e => setDraft({ ...draft, bio: e.target.value })}
          placeholder="Deskripsi singkat bio..."
          rows={3}
        />
        <div className="bio-actions">
          <button className="btn-primary-sm" onClick={async () => {
            await onSave(draft);
            setEditing(false);
          }}>Simpan</button>
          <button className="btn-secondary-sm" onClick={() => setEditing(false)}>Batal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-bio-editable" onClick={() => setEditing(true)} title="Klik untuk mengedit bio">
      <p className="hero-title">{profileData.title || 'Packaging Development Specialist & Graphic Designer'}</p>
      <p className="hero-desc">{profileData.bio || 'Packaging development specialist with 3+ years in pharmaceutical packaging and graphic design. Focused on compliance, precision, and visual impact.'}</p>
      <span className="edit-hint-chip">✎ Edit bio</span>
    </div>
  );
}

// ─── Edit Item Modal ───
function EditItemModal({ item, onSave, onClose }) {
  const [title, setTitle] = useState(item.title || '');
  const [desc, setDesc] = useState(item.desc || '');
  const [type, setType] = useState(item.type || 'design');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(item.id, { title, desc, type });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Edit Karya</h3>
        <form onSubmit={handleSubmit} className="edit-form">
          <label>
            <span>Kategori</span>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="design">Design</option>
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label>
            <span>Judul</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label>
            <span>Deskripsi</span>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Upload Modal ───
function UploadModal({ onUploadComplete, onClose }) {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('design');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const tags = buildTags(type, title, desc);
      const res = await uploadFile(file, tags, p => setProgress(p));
      const newItem = {
        id: res.fileId,
        type,
        title: title.trim() || res.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        desc: desc.trim(),
        url: res.url,
        thumb: res.thumbnailUrl || null,
        isVideo: res.fileType === 'non-image' || /\.(mp4|mov|webm)$/i.test(res.name),
        rawTags: tags
      };
      onUploadComplete(newItem);
      onClose();
    } catch (err) {
      alert('Upload gagal: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Tambah Karya Baru</h3>
        <form onSubmit={handleSubmit} className="upload-form">
          <div
            className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
            />
            {file ? (
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            ) : (
              <div className="dropzone-prompt">
                <span className="upload-icon">↑</span>
                <p>Klik atau seret file ke sini</p>
                <small>Mendukung JPG, PNG, WEBP, MP4, MOV</small>
              </div>
            )}
          </div>

          <label>
            <span>Kategori</span>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="design">Design</option>
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </label>

          <label>
            <span>Judul</span>
            <input
              type="text"
              placeholder="Contoh: Desain Kemasan Flucadex"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>

          <label>
            <span>Deskripsi Singkat</span>
            <textarea
              placeholder="Jelaskan konsep, tools yang dipakai, dll..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
            />
          </label>

          {uploading && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <span className="progress-text">Mengupload... {progress}%</span>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={uploading}>Batal</button>
            <button type="submit" className="btn-primary" disabled={!file || uploading}>
              {uploading ? 'Memproses...' : 'Upload Karya'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── IntersectionObserver fade-in hook ───
function useFadeIn() {
  const ref = useRef();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.05, rootMargin: '100px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Card({ item, onDelete, onEdit, onClick, index, isAdmin, featured }) {
  const [deleting, setDeleting] = useState(false);
  const [cardRef, visible] = useFadeIn();

  return (
    <div ref={cardRef} className={`card ${item.isVideo ? 'card-video' : ''} ${featured ? 'card-featured' : ''} ${visible ? 'card-visible' : 'card-hidden'}`} style={{ transitionDelay: `${Math.min(index, 10) * 0.03}s` }} onClick={() => onClick(item)}>
      <div className="media-container">
        {item.isVideo ? (
          <VideoThumb src={item.url} className="video-thumb-wrap" />
        ) : (
          <img
            src={getOptimizedImageUrl(item.url, 600)}
            alt={item.title}
            loading="lazy"
            decoding="async"
          />
        )}
        {!item.isVideo && (
          <div className="card-overlay">
            <span className="play-icon">⤢</span>
          </div>
        )}
      </div>
      <div className="card-info">
        <div className="card-info-left">
          <span className="badge">{item.type}</span>
          <h3 className="card-title">{item.title}</h3>
          {item.desc && <p className="card-desc">{item.desc}</p>}
        </div>
        {isAdmin && (
          <div className="card-admin-actions" onClick={e => e.stopPropagation()}>
            <button
              className="action-icon-btn edit-btn"
              title="Edit Nama & Deskripsi"
              onClick={() => onEdit(item)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="action-icon-btn delete-btn"
              title="Hapus Karya"
              disabled={deleting}
              onClick={async () => {
                if (confirm(`Hapus "${item.title}"?`)) {
                  setDeleting(true);
                  await onDelete(item.id);
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App Component ───
export default function App() {
  const [items, setItems] = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileData, setProfileData] = useState({
    name: 'Nasya Safira',
    title: 'Packaging Development Specialist & Graphic Designer',
    bio: 'Packaging development specialist with 3+ years in pharmaceutical packaging and graphic design. Focused on compliance, precision, and visual impact.'
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const avatarInputRef = useRef();

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('portfolio');
  const [lightbox, setLightbox] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const avatarTapCount = useRef(0);
  const avatarTapTimer = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Check auth session
  useEffect(() => {
    checkAuthStatus().then(authed => setIsAdmin(authed));
  }, []);

  const handleAvatarTap = () => {
    if (isAdmin) {
      avatarInputRef.current?.click();
      return;
    }
    avatarTapCount.current += 1;
    if (avatarTapTimer.current) clearTimeout(avatarTapTimer.current);

    if (avatarTapCount.current >= 3) {
      avatarTapCount.current = 0;
      setShowPasscodeModal(true);
    } else {
      avatarTapTimer.current = setTimeout(() => {
        avatarTapCount.current = 0;
      }, 1000);
    }
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setPasscodeError('');
    try {
      const res = await fetch(`${API_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput })
      });
      if (res.ok) {
        sessionStorage.setItem(ADMIN_KEY, passcodeInput);
        setIsAdmin(true);
        setShowPasscodeModal(false);
        setPasscodeInput('');
      } else {
        setPasscodeError('Passcode salah');
        setPasscodeInput('');
      }
    } catch {
      setPasscodeError('Gagal koneksi ke server');
    }
    setVerifying(false);
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setShowUpload(false);
    sessionStorage.removeItem(ADMIN_KEY);
  };

  useEffect(() => {
    Promise.all([loadItems(), loadProfilePhoto(), loadProfile()]).then(([data, photo, prof]) => {
      setItems(data);
      if (photo) setProfilePhoto(photo);
      if (prof) setProfileData(prof);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Avatar file selected → open crop modal
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    e.target.value = '';
  };

  // After crop → upload
  const handleCroppedSave = async (croppedFile) => {
    setCropFile(null);
    setUploadingAvatar(true);
    try {
      if (profilePhoto?.id) await deleteItem(profilePhoto.id);
      const res = await uploadProfilePhoto(croppedFile);
      setProfilePhoto({ id: res.fileId, url: res.url });
    } catch (err) {
      alert('Gagal ganti foto profil: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveBio = async (newBioData) => {
    try {
      const updated = await saveProfile({
        ...profileData,
        ...newBioData
      });
      setProfileData(updated);
    } catch (err) {
      alert('Gagal menyimpan profil: ' + err.message);
    }
  };

  const toggleTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  const handleDelete = useCallback(async (id) => {
    const ok = await deleteItem(id);
    if (ok) setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleSaveItem = useCallback(async (id, updatedData) => {
    const item = items.find(i => i.id === id);
    const ok = await updateItemData(id, updatedData, item?.rawTags);
    if (ok) {
      const updatedItem = {
        ...item,
        ...updatedData
      };
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    }
    setEditingItem(null);
  }, [items]);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div className="app">
      <header className="hero">
        <div className="container">
          <div className="hero-top">
            <div className="avatar-wrapper" onClick={handleAvatarTap} title={isAdmin ? "Ganti foto profil" : undefined} style={{ cursor: 'pointer' }}>
              <input type="file" ref={avatarInputRef} style={{display:'none'}} accept="image/*" onChange={handleAvatarFileSelect} />
              {uploadingAvatar ? (
                <div className="avatar-placeholder avatar-loading">
                  <div className="avatar-spinner" />
                </div>
              ) : profilePhoto ? (
                <img src={getOptimizedImageUrl(profilePhoto.url, 240)} alt={profileData.name} className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  <span>NS</span>
                </div>
              )}
              {isAdmin && <div className="avatar-edit-overlay"><span>📷</span></div>}
            </div>

            <div className="hero-info">
              <div className="name-row">
                <h1 className="name">{profileData.name || 'Nasya Safira'}</h1>
                <div className="theme-toggle-wrap">
                  {isAdmin && (
                    <button className="admin-status-badge" onClick={handleLogout} title="Klik untuk keluar dari mode admin">
                      Admin Mode (Keluar)
                    </button>
                  )}
                  <button className="theme-toggle" onClick={toggleTheme} title="Ganti Tema">
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>

              <EditableBio profileData={profileData} onSave={handleSaveBio} isAdmin={isAdmin} />

              <div className="hero-actions">
                <a href="#contact" className="btn-primary-sm" onClick={e => { e.preventDefault(); setTab('about'); }}>
                  Tentang Saya
                </a>
                <a href="mailto:nasyasafira23@gmail.com" className="btn-secondary-sm">
                  Hubungi
                </a>
                {isAdmin && (
                  <button className="btn-primary-sm btn-upload-hero" onClick={() => setShowUpload(true)}>
                    + Upload Karya
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="nav-tabs">
        <div className="container tab-container">
          <div className="tabs-list">
            <button
              className={`tab-btn ${tab === 'portfolio' ? 'active' : ''}`}
              onClick={() => setTab('portfolio')}
            >
              Portofolio
            </button>
            <button
              className={`tab-btn ${tab === 'about' ? 'active' : ''}`}
              onClick={() => setTab('about')}
            >
              Tentang & Pengalaman
            </button>
          </div>

          {tab === 'portfolio' && (
            <div className="filter-chips">
              {['all', 'design', 'photo', 'video'].map(f => (
                <button
                  key={f}
                  className={`filter-chip ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Semua' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {tab === 'portfolio' ? (
          <div className="container">
            {loading ? (
              <div className="empty-state"><p>Memuat portofolio...</p></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <p>Belum ada karya di filter ini.</p>
                {isAdmin && <button className="upload-toggle" onClick={() => setShowUpload(true)}>Upload sekarang</button>}
              </div>
            ) : (
              <div className="gallery">
                {filtered.map((item, i) => (
                  <Card key={item.id} item={item} index={i} onDelete={handleDelete} onEdit={setEditingItem} onClick={setLightbox} isAdmin={isAdmin} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="container about-view">
            <div className="about-grid">
              <section className="about-section">
                <h2>Experience</h2>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="item-header">
                      <h3>Digital Marketing & Content Creator</h3>
                      <span className="time">Jun 2025 – Present</span>
                    </div>
                    <p className="company">PT. Samco Farma</p>
                    <ul>
                      <li>Integrated digital marketing strategies across Instagram, TikTok, LinkedIn & website.</li>
                      <li>Produces 20+ monthly branded visual & video assets using Adobe Suite & CapCut.</li>
                      <li>Campaign performance optimization via Meta Business Suite & TikTok Analytics.</li>
                    </ul>
                  </div>
                  <div className="timeline-item">
                    <div className="item-header">
                      <h3>Packaging Development Specialist</h3>
                      <span className="time">Jul 2022 – Jun 2025</span>
                    </div>
                    <p className="company">PT. Samco Farma</p>
                    <ul>
                      <li>Lead packaging compliance & design verification with BPOM regulatory standards.</li>
                      <li>Collaborated with QA, QC, and external printing vendors for mass production quality.</li>
                      <li>Standardized 50+ SKU packaging artworks ensuring zero print-run defects.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="about-section">
                <h2>Skills & Tools</h2>
                <div className="skills-group">
                  <h4>Design & Creative</h4>
                  <div className="skill-tags">
                    <span>Adobe Illustrator</span>
                    <span>Adobe Photoshop</span>
                    <span>CorelDraw</span>
                    <span>Figma</span>
                    <span>CapCut</span>
                  </div>
                </div>
                <div className="skills-group">
                  <h4>Packaging & Compliance</h4>
                  <div className="skill-tags">
                    <span>BPOM Regulation</span>
                    <span>Pre-press & Print Quality</span>
                    <span>Color Management</span>
                    <span>Barcode & NIE Specs</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer" id="contact">
        <div className="container footer-content">
          <p>© {new Date().getFullYear()} Nasya Safira. All rights reserved.</p>
          <div className="footer-links">
            <a href="mailto:nasyasafira23@gmail.com">Email</a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
      </footer>

      {/* Lightbox Modal */}
      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
            <div className="lightbox-media-wrap">
              {lightbox.isVideo ? (
                <video src={lightbox.url} controls autoPlay className="lightbox-media" />
              ) : (
                <img src={lightbox.url} alt={lightbox.title} className="lightbox-media" />
              )}
            </div>
            <div className="lightbox-info">
              <span className="badge">{lightbox.type}</span>
              <h3>{lightbox.title}</h3>
              {lightbox.desc && <p>{lightbox.desc}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploadComplete={(newItem) => setItems(prev => [newItem, ...prev])}
        />
      )}

      {/* Edit Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItem}
        />
      )}

      {/* Crop Avatar Modal */}
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onClose={() => setCropFile(null)}
          onSave={handleCroppedSave}
        />
      )}

      {/* Passcode Modal */}
      {showPasscodeModal && (
        <div className="modal-backdrop" onClick={() => setShowPasscodeModal(false)}>
          <div className="modal-content passcode-modal" onClick={e => e.stopPropagation()}>
            <h3>Masuk Mode Admin</h3>
            <p className="modal-desc">Masukkan passcode untuk mengelola karya dan bio.</p>
            <form onSubmit={handlePasscodeSubmit}>
              <input
                type="password"
                placeholder="Passcode..."
                value={passcodeInput}
                onChange={e => setPasscodeInput(e.target.value)}
                autoFocus
                className="passcode-input"
              />
              {passcodeError && <p className="error-text">{passcodeError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowPasscodeModal(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={verifying}>
                  {verifying ? 'Memeriksa...' : 'Masuk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
