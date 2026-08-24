import { useState, useEffect, useRef, useCallback } from 'react';

const THEME_KEY = 'nasya-portfolio-theme';
const ADMIN_KEY = 'nasya-portfolio-admin';
const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';
const IK_URL = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
const IK_PUB = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;

async function fetchAuth() {
  const passcode = sessionStorage.getItem(ADMIN_KEY) || '';
  const res = await fetch(`${API_URL}/auth`, {
    headers: { 'x-admin-key': passcode }
  });
  if (!res.ok) throw new Error('Auth failed (wrong passcode or session expired)');
  return res.json();
}

async function uploadToImageKit(file, tag) {
  const auth = await fetchAuth();
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name);
  form.append('folder', '/portfolio');
  form.append('tags', tag);
  form.append('publicKey', IK_PUB);
  form.append('signature', auth.signature);
  form.append('expire', auth.expire);
  form.append('token', auth.token);

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

async function loadProfilePhoto() {
  try {
    const res = await fetch(`${API_URL}/files`);
    if (!res.ok) return null;
    const text = await res.text();
    const files = JSON.parse(text);
    const profile = files.find(f => f.tags && f.tags.includes('profile'));
    return profile ? { id: profile.fileId, url: profile.url } : null;
  } catch { return null; }
}

async function uploadProfilePhoto(file) {
  const auth = await fetchAuth();
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', 'profile-photo');
  form.append('folder', '/portfolio');
  form.append('tags', 'profile');
  form.append('publicKey', IK_PUB);
  form.append('signature', auth.signature);
  form.append('expire', auth.expire);
  form.append('token', auth.token);
  form.append('useUniqueFileName', 'true');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/profile`);
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch { return null; }
}

async function saveProfileData(updates) {
  const passcode = sessionStorage.getItem(ADMIN_KEY) || '';
  const res = await fetch(`${API_URL}/profile`, {
    method: 'PATCH',
    headers: { 'x-admin-key': passcode, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return res.ok ? res.json() : null;
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

        return {
          id: f.fileId,
          type,
          title,
          desc,
          url: f.url,
          thumb: f.thumbnailUrl || null,
          isVideo: f.fileType === 'non-image' || /\.(mp4|mov|webm)$/i.test(f.name),
          rawTags: f.tags || []
        };
      });
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function updateItemData(fileId, updates) {
  try {
    const passcode = sessionStorage.getItem(ADMIN_KEY) || '';
    const res = await fetch(`${API_URL}/files?fileId=${fileId}`, {
      method: 'PATCH',
      headers: { 
        'x-admin-key': passcode,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch { return false; }
}

async function deleteItem(fileId) {
  try {
    const passcode = sessionStorage.getItem(ADMIN_KEY) || '';
    const res = await fetch(`${API_URL}/files?fileId=${fileId}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': passcode }
    });
    return res.ok;
  } catch { return false; }
}

function detectType(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'photo';
  return 'design';
}

function buildTags(type, title, desc) {
  const tags = [type];
  if (title) tags.push(`title:${title}`);
  if (desc) tags.push(`desc:${desc}`);
  return tags;
}

// ─── Video Thumbnail Generator ───
function VideoThumb({ src, className }) {
  const canvasRef = useRef();
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = src;
    video.currentTime = 1; // grab frame at 1s

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        setThumb(canvas.toDataURL('image/jpeg', 0.8));
      } catch { /* CORS fallback: no thumb */ }
    }, { once: true });

    video.addEventListener('error', () => setThumb(null), { once: true });
  }, [src]);

  if (thumb) {
    return (
      <div className={className} style={{ position: 'relative' }}>
        <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div className="video-play-badge">▶</div>
      </div>
    );
  }

  // Fallback: show video with poster attempt
  return (
    <div className={className} style={{ position: 'relative' }}>
      <video src={src} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

  const handleSave = async () => {
    setSaving(true);
    const img = imgRef.current;
    const size = 400;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Map viewport coords to image coords
    const containerSize = 280;
    const imgScale = scale * Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight);
    const sx = (size / 2 - offset.x * (size / containerSize)) / imgScale - img.naturalWidth / 2 + img.naturalWidth / 2;

    // Simpler approach: draw the image same as preview, then export
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const drawScale = scale * Math.max(size / img.naturalWidth, size / img.naturalHeight);
    ctx.scale(drawScale, drawScale);
    ctx.translate(offset.x * (img.naturalWidth / containerSize) / scale, offset.y * (img.naturalHeight / containerSize) / scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    canvas.toBlob(blob => {
      if (blob) {
        const croppedFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
        onSave(croppedFile);
      }
      setSaving(false);
    }, 'image/jpeg', 0.9);
  };

  const containerSize = 280;

  return (
    <div className="passcode-overlay" onClick={onClose}>
      <div className="crop-modal" onClick={e => e.stopPropagation()}>
        <h3>Crop Foto Profil</h3>
        <div
          className="crop-viewport"
          style={{ width: containerSize, height: containerSize }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              draggable={false}
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                minWidth: '100%', minHeight: '100%',
                objectFit: 'cover',
                cursor: dragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            />
          )}
          <div className="crop-circle-overlay" />
        </div>
        <div className="crop-controls">
          <label>Zoom</label>
          <input
            type="range" min="1" max="3" step="0.05"
            value={scale}
            onChange={e => setScale(parseFloat(e.target.value))}
          />
        </div>
        <div className="edit-actions">
          <button type="button" className="edit-cancel" onClick={onClose}>Batal</button>
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Editable Text ───
function InlineEdit({ value, onChange, tag: Tag = 'p', className = '', multiline = false, placeholder = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef();

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  if (editing) {
    return multiline ? (
      <textarea
        ref={inputRef}
        className={`inline-edit-input ${className}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        rows={3}
        placeholder={placeholder}
      />
    ) : (
      <input
        ref={inputRef}
        className={`inline-edit-input ${className}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <Tag
      className={`inline-editable ${className}`}
      onClick={() => setEditing(true)}
      title="Klik untuk edit"
    >
      {value || <span className="inline-placeholder">{placeholder}</span>}
      <span className="inline-edit-icon">✎</span>
    </Tag>
  );
}


function EditModal({ item, onSave, onClose }) {
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState(item.desc || '');
  const [type, setType] = useState(item.type);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const tags = buildTags(type, title, desc);
    const ok = await updateItemData(item.id, { tags });
    if (ok) {
      onSave({ ...item, title, desc, type });
    } else {
      alert('Gagal menyimpan perubahan');
    }
    setSaving(false);
  };

  return (
    <div className="passcode-overlay" onClick={onClose}>
      <form className="edit-modal" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Edit Detail</h3>
        <label>Judul</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul karya" />
        <label>Deskripsi</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Deskripsi singkat..." rows={3} />
        <label>Kategori</label>
        <div className="edit-type-row">
          {['design', 'photo', 'video'].map(t => (
            <button type="button" key={t} className={`filter-btn ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
        <div className="edit-actions">
          <button type="button" className="edit-cancel" onClick={onClose}>Batal</button>
          <button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  );
}

function Lightbox({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>&times;</button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {item.isVideo ? (
          <video src={item.url} controls autoPlay className="lightbox-media" />
        ) : (
          <img src={item.url} alt={item.title} className="lightbox-media" />
        )}
        <div className="lightbox-info">
          <span className="badge">{item.type}</span>
          <h3>{item.title}</h3>
          {item.desc && <p className="lightbox-desc">{item.desc}</p>}
        </div>
      </div>
    </div>
  );
}

function UploadZone({ onUploadComplete }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef();

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tag = detectType(file);
      setProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
      try {
        const res = await uploadToImageKit(file, tag);
        onUploadComplete({
          id: res.fileId,
          type: tag,
          title: res.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          url: res.url,
          thumb: res.thumbnailUrl || null,
          isVideo: tag === 'video',
          desc: '',
          rawTags: [tag]
        });
      } catch (err) {
        alert(`Gagal upload ${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
    setProgress('');
  }, [onUploadComplete]);

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''}`}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !uploading && inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="upload-icon">
        {uploading ? (
          <svg className="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>
      <p className="upload-text">
        {uploading ? progress : 'Upload portofolio baru (Drop atau klik)'}
      </p>
      <p className="upload-hint">Foto, video pendek, karya desain — langsung live di cloud</p>
    </div>
  );
}

// ─── IntersectionObserver fade-in hook (fix #5) ───
function useFadeIn() {
  const ref = useRef();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Card({ item, onDelete, onEdit, onClick, index, isAdmin, featured }) {
  const [deleting, setDeleting] = useState(false);
  const [cardRef, visible] = useFadeIn();
  return (
    <div ref={cardRef} className={`card ${featured ? 'card-featured' : ''} ${visible ? 'card-visible' : 'card-hidden'}`} style={{ transitionDelay: `${index * 0.04}s` }} onClick={() => onClick(item)}>
      <div className="media-container">
        {item.isVideo ? (
          <VideoThumb src={item.url} className="video-thumb-wrap" />
        ) : (
          <img src={item.url} alt={item.title} loading="lazy" />
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
              title="Hapus"
              disabled={deleting}
              onClick={async () => {
                if (confirm(`Yakin mau hapus "${item.title}"?`)) {
                  setDeleting(true);
                  await onDelete(item.id);
                }
              }}
            >
              {deleting ? '...' : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const avatarInputRef = useRef();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('works');
  const [lightbox, setLightbox] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  // Admin mode
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const [verifying, setVerifying] = useState(false);

  // Profile data from server
  const p = profileData || {
    name: 'Nasya Safira Rahardja',
    role: 'Digital Marketing Specialist & Multimedia Designer',
    summary: '4+ years crafting visual identities, packaging systems (BPOM standard), and performance-driven content for pharmaceutical and creative sectors.',
    location: 'Tangerang',
    email: 'safiranasya32@gmail.com',
    linkedin: 'https://linkedin.com/in/nasya-safira-rahardja',
    phone: '+62 857-1624-8635',
    status: 'Available'
  };

  const updateProfile = async (field, value) => {
    const updated = await saveProfileData({ [field]: value });
    if (updated) setProfileData(updated);
  };

  const handleAvatarTap = (e) => {
    if (isAdmin) {
      avatarInputRef.current?.click();
      return;
    }
    tapCountRef.current += 1;
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowPasscodeModal(true);
    }
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (!passcodeInput) return;
    setVerifying(true);
    setPasscodeError('');
    try {
      const res = await fetch(`${API_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput })
      });
      if (res.ok) {
        setIsAdmin(true);
        sessionStorage.setItem(ADMIN_KEY, passcodeInput);
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
    e.target.value = ''; // reset so same file can be re-selected
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
    }
    setUploadingAvatar(false);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleUpload = useCallback((newItem) => {
    setItems(prev => [newItem, ...prev]);
  }, []);

  const handleDelete = useCallback(async (id) => {
    const ok = await deleteItem(id);
    if (ok) setItems(prev => prev.filter(i => i.id !== id));
    else alert('Gagal hapus file dari cloud');
  }, []);

  const handleEditSave = useCallback((updatedItem) => {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    setEditingItem(null);
  }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div className="app">
      <header className="hero">
        <div className="container">
          <div className="hero-top">
            <div className="avatar-wrapper" onClick={handleAvatarTap} title={isAdmin ? "Ganti foto profil" : undefined} style={{ cursor: 'pointer' }}>
              <input type="file" ref={avatarInputRef} style={{display:'none'}} accept="image/*" onChange={handleAvatarFileSelect} />
              {uploadingAvatar ? (
                <div className="avatar"><svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg></div>
              ) : profilePhoto ? (
                <img src={profilePhoto.url} alt="Profile" className="avatar-img" />
              ) : (
                <div className="avatar">NS</div>
              )}
              {isAdmin && <div className="avatar-overlay">📷</div>}
            </div>
            <div className="hero-details">
              <div className="title-row">
                {isAdmin ? (
                  <InlineEdit value={p.name} onChange={v => updateProfile('name', v)} tag="h1" />
                ) : (
                  <h1>{p.name}</h1>
                )}
                <span className="status-badge">{p.status || 'Available'}</span>
                {isAdmin && (
                  <button className="admin-status-btn" onClick={handleLogout} title="Klik untuk keluar admin mode">
                    Admin Active (Logout)
                  </button>
                )}
              </div>
              {isAdmin ? (
                <InlineEdit value={p.role} onChange={v => updateProfile('role', v)} tag="p" className="role-tag" placeholder="Role / Jabatan" />
              ) : (
                <p className="role-tag">{p.role}</p>
              )}
              {isAdmin ? (
                <InlineEdit value={p.summary} onChange={v => updateProfile('summary', v)} tag="p" className="summary" multiline placeholder="Ringkasan profil..." />
              ) : (
                <p className="summary">{p.summary}</p>
              )}
              <div className="hero-meta">
                <span className="loc">📍 {p.location}</span>
                <span className="dot">•</span>
                <a href={`mailto:${p.email}`}>{p.email}</a>
                <span className="dot">•</span>
                <a href={p.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
                <span className="dot">•</span>
                <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">{p.phone}</a>
              </div>
            </div>
          </div>
          <div className="main-nav">
            <button className={`nav-tab ${tab === 'works' ? 'active' : ''}`} onClick={() => { setTab('works'); setTimeout(() => document.querySelector('.toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>Selected Works</button>
            <button className={`nav-tab ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>Experience & Tools</button>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {tab === 'works' ? (
        <>
          <div className="container toolbar">
            <div className="filters">
              {['all', 'design', 'photo', 'video'].map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`filter-btn ${filter === f ? 'active' : ''}`}>
                   {f} <span className="count">{f === 'all' ? items.length : items.filter(i => i.type === f).length}</span>
                 </button>
              ))}
            </div>
            {isAdmin && (
              <button className="upload-toggle" onClick={() => setShowUpload(v => !v)}>
                {showUpload ? 'Close Upload' : 'Drop File'}
              </button>
            )}
          </div>

          {isAdmin && showUpload && (
            <div className="container">
              <UploadZone onUploadComplete={handleUpload} />
            </div>
          )}

          <div className="container">
            {loading ? (
              <div className="empty-state"><p>Memuat portofolio dari cloud...</p></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <p>Belum ada karya di filter ini.</p>
                {isAdmin && <button className="upload-toggle" onClick={() => setShowUpload(true)}>Upload sekarang</button>}
              </div>
            ) : (
              <div className="gallery">
                {filtered.map((item, i) => (
                  <Card key={item.id} item={item} index={i} onDelete={handleDelete} onEdit={setEditingItem} onClick={setLightbox} isAdmin={isAdmin} featured={i === 0} />
                ))}
              </div>
            )}
          </div>
        </>
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
                    <li>Led end-to-end packaging design for 30+ pharmaceutical SKUs with BPOM standard compliance.</li>
                    <li>Cut design-to-print turnaround time by 25% via cross-functional workflow streamlining.</li>
                  </ul>
                </div>
                <div className="timeline-item">
                  <div className="item-header">
                    <h3>Social Media Design Intern</h3>
                    <span className="time">Jun 2018 – Sep 2019</span>
                  </div>
                  <p className="company">About TNG</p>
                  <ul>
                    <li>Created 100+ social media assets for viral community growth and event collaterals.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="about-sidebar">
              <div className="side-card">
                <h2>Stack</h2>
                <div className="skill-group">
                  <span className="group-title">Creative</span>
                  <div className="tags">
                    <span>Photoshop</span><span>Illustrator</span><span>Premiere Pro</span><span>CapCut</span><span>Figma</span>
                  </div>
                </div>
                <div className="skill-group">
                  <span className="group-title">Marketing</span>
                  <div className="tags">
                    <span>Content Strategy</span><span>Meta Suite</span><span>TikTok Ads</span><span>BPOM Standard</span>
                  </div>
                </div>
              </div>
              <div className="side-card">
                <h2>Education</h2>
                <div className="edu-item">
                  <h4>M.Kom — Business Intelligence</h4>
                  <p className="school">Universitas Raharja (2024 - 2026)</p>
                </div>
                <div className="edu-item">
                  <h4>S.Kom — Multimedia & Broadcasting</h4>
                  <p className="school">Universitas Raharja (2019 - 2023)</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      <footer className="container footer">
        <p>© 2026 {p.name?.split(' ')[0] || 'Nasya'} {p.name?.split(' ')[1] || 'Safira'}</p>
      </footer>

      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      {editingItem && <EditModal item={editingItem} onSave={handleEditSave} onClose={() => setEditingItem(null)} />}
      {cropFile && <AvatarCropModal file={cropFile} onSave={handleCroppedSave} onClose={() => setCropFile(null)} />}

      {showPasscodeModal && (
        <div className="passcode-overlay" onClick={() => { setShowPasscodeModal(false); setPasscodeError(''); setPasscodeInput(''); }}>
          <form className="passcode-modal" onClick={e => e.stopPropagation()} onSubmit={handlePasscodeSubmit}>
            <h3>Admin Access</h3>
            <input
              type="password"
              placeholder="Passcode"
              value={passcodeInput}
              onChange={e => setPasscodeInput(e.target.value)}
              autoFocus
            />
            {passcodeError && <p className="passcode-error">{passcodeError}</p>}
            <button type="submit" disabled={verifying}>
              {verifying ? '...' : 'Enter'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
