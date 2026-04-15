import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/rss", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KudosMonitor/1.0)" }
    });
    const text = await response.text();
    res.set("Content-Type", "application/xml");
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log("RSS proxy kører på http://localhost:3001"));
