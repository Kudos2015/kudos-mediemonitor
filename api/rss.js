export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KudosMonitor/1.0)" }
    });
    const text = await response.text();
    res.setHeader("Content-Type", "application/xml");
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
