import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = join(__dirname, 'profile.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nasya2026';

const DEFAULT_PROFILE = {
  name: 'Nasya Safira Rahardja',
  role: 'Digital Marketing Specialist & Multimedia Designer',
  summary: '4+ years crafting visual identities, packaging systems (BPOM standard), and performance-driven content for pharmaceutical and creative sectors.',
  location: 'Tangerang',
  email: 'safiranasya32@gmail.com',
  linkedin: 'https://linkedin.com/in/nasya-safira-rahardja',
  phone: '+62 857-1624-8635',
  status: 'Available'
};

function loadProfile() {
  try {
    if (existsSync(PROFILE_PATH)) return JSON.parse(readFileSync(PROFILE_PATH, 'utf8'));
  } catch {}
  return { ...DEFAULT_PROFILE };
}

function saveProfile(data) {
  writeFileSync(PROFILE_PATH, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

app.post('/api/verify', (req, res) => {
  const { passcode } = req.body || {};
  if (!passcode || passcode !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid passcode' });
  }
  return res.status(200).json({ success: true });
});

app.get('/api/auth', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Admin key required' });
  }

  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.json(authParams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    const files = await imagekit.listFiles({
      path: '/portfolio',
      sort: 'DESC_CREATED'
    });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Admin key required' });
  }

  try {
    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ error: 'fileId required' });
    await imagekit.deleteFile(fileId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/files', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Admin key required' });
  }

  try {
    const { fileId } = req.query;
    const { tags } = req.body || {};
    if (!fileId) return res.status(400).json({ error: 'fileId required' });
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags array required' });
    
    const updated = await imagekit.updateFileDetails(fileId, { tags });
    res.json({ success: true, file: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile text endpoints
app.get('/api/profile', (req, res) => {
  res.json(loadProfile());
});

app.patch('/api/profile', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const current = loadProfile();
  const allowed = ['name', 'role', 'summary', 'location', 'email', 'linkedin', 'phone', 'status'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) current[key] = req.body[key];
  }
  saveProfile(current);
  res.json(current);
});

app.listen(3001, () => {
  console.log('Dev API proxy running on http://localhost:3001');
});