import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

app.get('/api/auth', (req, res) => {
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
