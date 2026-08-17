import { useState, useEffect, useRef, useCallback } from 'react';

const THEME_KEY = 'nasya-portfolio-theme';
const ADMIN_KEY = 'nasya-portfolio-admin';
const PASSCODE = 'nasya2026';
const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';
const IK_URL = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
const IK_PUB = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;

async function fetchAuth() {
  const res = await fetch(`${API_URL}/auth`);
  if (!res.ok) throw new Error('Auth failed');
  return res.json(); // { signature, expire, token }
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
    const files = await res.json();
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

async function loadItems() {
  try {
    const res = await fetch(`${API_URL}/files`);
    if (!res.ok) throw new Error('Fetch failed');
    const files = await res.json();
    return files.map(f => ({
      id: f.fileId,
      type: (f.tags && f.tags[0]) || 'design',
      title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      url: f.url,
      isVideo: f.fileType === 'non-image' || /\.(mp4|mov|webm)$/i.test(f.name),
      desc: ''
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function deleteItem(fileId) {
  try {
    const res = await fetch(`${API_URL}/files?fileId=${fileId}`, { method: 'DELETE' });
    return res.ok;
  } catch { return false; }
}

function detectType(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'photo';
  return 'design';
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
          isVideo: tag === 'video',
          desc: ''
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

function Card({ item, onDelete, onClick, index, isAdmin }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="card" style={{ animationDelay: `${index * 0.04}s` }} onClick={() => onClick(item)}>
      <div className="media-container">
        {item.isVideo ? (
          <video
            src={item.url}
            muted loop playsInline
            onMouseOver={(e) => e.target.play()}
            onMouseOut={(e) => { e.target.pause(); e.target.currentTime = 0; }}
          />
        ) : (
          <img src={item.url} alt={item.title} loading="lazy" />
        )}
        <div className="card-overlay">
          <span className="play-icon">{item.isVideo ? '▶' : '⤢'}</span>
        </div>
      </div>
      <div className="card-info">
        <div className="card-info-left">
          <span className="badge">{item.type}</span>
          <h3 className="card-title">{item.title}</h3>
        </div>
        {isAdmin && (
          <button
            className="delete-btn"
            title="Hapus"
            disabled={deleting}
            onClick={async (e) => {
              e.stopPropagation();
              setDeleting(true);
              await onDelete(item.id);
            }}
          >
            {deleting ? '...' : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('works');
  const [lightbox, setLightbox] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  // Admin mode
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const handleAvatarTap = (e) => {
    if (isAdmin) {
      // Already admin — allow avatar change
      avatarInputRef.current?.click();
      return;
    }
    // Secret knock: 5 taps on avatar to open passcode modal
    tapCountRef.current += 1;
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowPasscodeModal(true);
    }
  };

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcodeInput.toLowerCase() === PASSCODE) {
      setIsAdmin(true);
      sessionStorage.setItem(ADMIN_KEY, '1');
      setShowPasscodeModal(false);
      setPasscodeInput('');
      setPasscodeError('');
    } else {
      setPasscodeError('Wrong passcode');
      setPasscodeInput('');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setShowUpload(false);
    sessionStorage.removeItem(ADMIN_KEY);
  };

  useEffect(() => {
    Promise.all([loadItems(), loadProfilePhoto()]).then(([data, photo]) => {
      // Filter out profile photo from gallery items if any
      setItems(data.filter(i => i.type !== 'profile'));
      if (photo) setProfilePhoto(photo);
      setLoading(false);
    });
  }, []);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      if (profilePhoto?.id) await deleteItem(profilePhoto.id);
      const res = await uploadProfilePhoto(file);
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

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div className="app">
      <header className="hero">
        <div className="container">
          <div className="hero-top">
            <div className="avatar-wrapper" onClick={handleAvatarTap} title={isAdmin ? "Ganti foto profil" : undefined} style={{ cursor: 'pointer' }}>
              <input type="file" ref={avatarInputRef} style={{display:'none'}} accept="image/*" onChange={handleAvatarChange} />
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
                <h1>Nasya Safira Rahardja</h1>
                <span className="status-badge">Available</span>
                {isAdmin && (
                  <button className="admin-status-btn" onClick={handleLogout} title="Klik untuk keluar admin mode">
                    Admin Active (Logout)
                  </button>
                )}
              </div>
              <p className="role-tag">Digital Marketing Specialist & Multimedia Designer</p>
              <p className="summary">
                4+ years crafting visual identities, packaging systems (BPOM standard), and performance-driven content for pharmaceutical and creative sectors.
              </p>
              <div className="hero-meta">
                <span className="loc">📍 Tangerang</span>
                <span className="dot">•</span>
                <a href="mailto:safiranasya32@gmail.com">safiranasya32@gmail.com</a>
                <span className="dot">•</span>
                <a href="https://linkedin.com/in/nasya-safira-rahardja" target="_blank" rel="noreferrer">LinkedIn</a>
                <span className="dot">•</span>
                <a href="https://wa.me/6285716248635" target="_blank" rel="noreferrer">+62 857-1624-8635</a>
              </div>
            </div>
          </div>
          <div className="main-nav">
            <button className={`nav-tab ${tab === 'works' ? 'active' : ''}`} onClick={() => setTab('works')}>Selected Works</button>
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
                  {f} {f !== 'all' && <span className="count">{items.filter(i => i.type === f).length}</span>}
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
                  <Card key={item.id} item={item} index={i} onDelete={handleDelete} onClick={setLightbox} isAdmin={isAdmin} />
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
        <p>© 2026 Nasya Safira. Built for modern portfolios.</p>
      </footer>

      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />

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
            <button type="submit">Enter</button>
          </form>
        </div>
      )}
    </div>
  );
}
