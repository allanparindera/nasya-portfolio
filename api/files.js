import ImageKit from 'imagekit';
import fs from 'fs';
import path from 'path';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nasya2026';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// CDN mapping for video files on GitHub Releases
let cdnMapping = {};
try {
  const mapPath = path.join(process.cwd(), 'src', 'video-cdn-map.json');
  if (fs.existsSync(mapPath)) {
    cdnMapping = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }
} catch (e) {
  console.error('Error loading video CDN map:', e);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const files = await imagekit.listFiles({
        path: '/portfolio',
        sort: 'DESC_CREATED'
      });

      const mappedFiles = files.map(file => {
        if (cdnMapping[file.fileId]) {
          return {
            ...file,
            url: cdnMapping[file.fileId].cdn_url,
            isCdn: true
          };
        }
        return file;
      });

      return res.status(200).json(mappedFiles);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE' || req.method === 'PATCH') {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized: Admin key required' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { fileId } = req.query;
      if (!fileId) return res.status(400).json({ error: 'fileId required' });
      await imagekit.deleteFile(fileId);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { fileId } = req.query;
      const { tags } = req.body || {};
      if (!fileId) return res.status(400).json({ error: 'fileId required' });
      if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags array required' });

      const updated = await imagekit.updateFileDetails(fileId, { tags });
      return res.status(200).json({ success: true, file: updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
