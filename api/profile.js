const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nasya2026';

// Vercel serverless is stateless — use env or hardcoded defaults.
// Profile edits persist via PATCH updating a KV or just return defaults.
// ponytail: upgrade to Vercel KV or Supabase when edit frequency justifies it.
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(DEFAULT_PROFILE);
  }

  if (req.method === 'PATCH') {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // In serverless, can't persist to filesystem. Return merged for now.
    const allowed = ['name', 'role', 'summary', 'location', 'email', 'linkedin', 'phone', 'status'];
    const result = { ...DEFAULT_PROFILE };
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) result[key] = req.body[key];
    }
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
