import ImageKit from 'imagekit';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nasya2026';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const files = await imagekit.listFiles({
        path: '/portfolio',
        sort: 'DESC_CREATED'
      });
      return res.status(200).json(files);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized: Admin key required' });
    }

    try {
      const { fileId } = req.query;
      if (!fileId) return res.status(400).json({ error: 'fileId required' });
      await imagekit.deleteFile(fileId);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}