export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Vault is stored in local memory files — not available on Vercel
  res.status(200).json([]);
}
