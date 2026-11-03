const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_req, res) => {
  res.json({
    name: "FRIDAY AI",
    status: "online",
    chatConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    imageWorkerConfigured: Boolean(process.env.GPU_WORKER_URL)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return res.status(503).json({ error: "Chat model abhi connect nahi hai. Render Environment mein OPENROUTER_API_KEY set karna hoga." });
    const { messages = [], language = "auto" } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "Message required." });
    const safeMessages = messages.slice(-20).map(m => ({
      role: ["user", "assistant"].includes(m.role) ? m.role : "user",
      content: String(m.content || "").slice(0, 12000)
    }));
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "You are FRIDAY, a helpful, capable multilingual AI assistant. Reply in the user's language (including Bengali, Hindi, English or Hinglish). Be clear and honest about limitations. Do not claim to have generated images unless an image worker actually returns one. User language preference: " + language }
        ].concat(safeMessages),
        temperature: 0.7
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Chat provider request failed." });
    res.json({ reply: data.choices?.[0]?.message?.content || "No response received." });
  } catch (e) {
    res.status(500).json({ error: "Chat request failed: " + e.message });
  }
});

app.post("/api/generate", upload.single("reference"), async (req, res) => {
  try {
    const worker = process.env.GPU_WORKER_URL;
    if (!worker) return res.status(503).json({ error: "Image GPU worker abhi connect nahi hai. FRIDAY AI interface ready hai; GPU endpoint baad mein connect hoga." });
    const form = new FormData();
    form.append("prompt", String(req.body.prompt || "").slice(0, 5000));
    form.append("negative_prompt", String(req.body.negative_prompt || "").slice(0, 2000));
    form.append("width", String(Math.min(1536, Math.max(512, Number(req.body.width) || 1024))));
    form.append("height", String(Math.min(1536, Math.max(512, Number(req.body.height) || 1024))));
    if (req.file) form.append("reference", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    const headers = {};
    if (process.env.GPU_WORKER_TOKEN) headers.Authorization = "Bearer " + process.env.GPU_WORKER_TOKEN;
    const r = await fetch(worker.replace(/\/$/, "") + "/generate", { method: "POST", headers, body: form, signal: AbortSignal.timeout(240000) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error || "GPU worker request failed." });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Image generation failed: " + e.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log("FRIDAY AI listening on " + port));
