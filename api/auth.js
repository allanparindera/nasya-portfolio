import ImageKit from 'imagekit';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nasya2026';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Admin key required' });
  }

  const authParams = imagekit.getAuthenticationParameters();
  return res.status(200).json(authParams);
}