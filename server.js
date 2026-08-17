import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';

dotenv.config();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nasya2026';

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

app.listen(3001, () => {
  console.log('Dev API proxy running on http://localhost:3001');
});