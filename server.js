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
    imageConfigured: Boolean(process.env.OPENROUTER_API_KEY)
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
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return res.status(503).json({ error: "Image generation ke liye Render Environment mein OPENROUTER_API_KEY set karo." });
    const prompt = String(req.body.prompt || "").trim().slice(0, 5000);
    if (!prompt) return res.status(400).json({ error: "Image prompt required." });
    if (req.file && !req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Reference file image honi chahiye." });

    const width = Math.min(1536, Math.max(512, Number(req.body.width) || 1024));
    const height = Math.min(1536, Math.max(512, Number(req.body.height) || 1024));
    const ratio = width / height;
    const aspectRatio = Math.abs(ratio - 1) < 0.1 ? "1:1" :
      ratio > 1 ? (ratio > 1.5 ? "16:9" : "4:3") :
      (ratio < 0.67 ? "9:16" : "3:4");

    const body = {
      model: process.env.OPENROUTER_IMAGE_MODEL || "bytedance-seed/seedream-5.0-flash",
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
      resolution: "1K"
    };
    if (req.file) {
      body.input_references = [{
        type: "image_url",
        image_url: { url: "data:" + req.file.mimetype + ";base64," + req.file.buffer.toString("base64") }
      }];
    }

    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240000)
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || data.message || "OpenRouter image request failed." });
    const image = data.data?.[0];
    if (!image?.b64_json && !image?.url) return res.status(502).json({ error: "Image provider ne image data return nahi ki." });
    res.json({
      image_base64: image.b64_json || undefined,
      image_url: image.url || undefined,
      media_type: image.media_type || "image/png",
      cost: data.usage?.cost ?? null,
      model: body.model
    });
  } catch (e) {
    res.status(500).json({ error: "Image generation failed: " + e.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log("FRIDAY AI listening on " + port));
