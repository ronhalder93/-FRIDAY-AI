const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

const CIVITAI_BASE = "https://orchestration.civitai.com";
const DEFAULT_CIVITAI_CHAT_MODEL = "urn:air:qwen3:repository:huggingface:Civitai/Qwen3.6-35B-A3B-Abliterated-AWQ@main.tar";
const DEFAULT_CIVITAI_IMAGE_MODEL = "urn:air:sd1:checkpoint:civitai:4384@128713";

function civitaiToken() {
  return process.env.CIVITAI_API_TOKEN || process.env.CIVITAI_TOKEN || process.env.CIVITAI_API_KEY || "";
}
async function readJson(response) {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return { message: raw.slice(0, 1000) }; }
}
function providerError(data, fallback) {
  return data?.error?.message || data?.message || data?.detail || data?.title || fallback;
}
function findImageUrl(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.url === "string" && /^https?:\/\//i.test(value.url)) return value.url;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findImageUrl(item); if (found) return found; }
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (["url", "downloadUrl"].includes(key) && typeof item === "string" && /^https?:\/\//i.test(item)) return item;
      const found = findImageUrl(item); if (found) return found;
    }
  }
  return null;
}

app.get("/api/status", (_req, res) => {
  const civitaiReady = Boolean(civitaiToken());
  res.json({
    name: "FRIDAY AI",
    status: "online",
    chatConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    imageConfigured: Boolean(process.env.ZARA_API_URL && process.env.ZARA_API_TOKEN) || Boolean(process.env.OPENROUTER_API_KEY),
    zaraConfigured: Boolean(process.env.ZARA_API_URL && process.env.ZARA_API_TOKEN),
    civitaiConfigured: civitaiReady,
    civitaiChatConfigured: civitaiReady,
    civitaiImageConfigured: civitaiReady
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], language = "auto", provider = "openrouter" } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "Message required." });
    const safeMessages = messages.slice(-20).map(m => ({
      role: ["user", "assistant"].includes(m.role) ? m.role : "user",
      content: String(m.content || "").slice(0, 12000)
    }));
    const systemMessage = { role: "system", content: "You are FRIDAY, a helpful, capable multilingual AI assistant. Reply in the user's language (including Bengali, Hindi, English or Hinglish). Be clear and honest about limitations. Do not claim to have generated images unless an image worker actually returns one. User language preference: " + language };
    let response, data;
    if (provider === "civitai") {
      const key = civitaiToken();
      if (!key) return res.status(503).json({ error: "Civitai connect nahi hai. Render Environment mein CIVITAI_API_KEY set karo." });
      const model = process.env.CIVITAI_CHAT_MODEL || DEFAULT_CIVITAI_CHAT_MODEL;
      response = await fetch(CIVITAI_BASE + "/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [systemMessage, ...safeMessages], temperature: 0.7, stream: false }),
        signal: AbortSignal.timeout(120000)
      });
      data = await readJson(response);
      if (!response.ok) return res.status(response.status).json({ error: providerError(data, "Civitai chat request failed.") });
    } else {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return res.status(503).json({ error: "Chat model abhi connect nahi hai. Render Environment mein OPENROUTER_API_KEY set karna hoga." });
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "openrouter/free",
          messages: [systemMessage, ...safeMessages],
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(120000)
      });
      data = await readJson(response);
      if (!response.ok) return res.status(response.status).json({ error: providerError(data, "OpenRouter chat request failed.") });
    }
    res.json({ reply: data.choices?.[0]?.message?.content || "No response received.", provider });
  } catch (e) {
    res.status(500).json({ error: "Chat request failed: " + e.message });
  }
});

app.post("/api/generate", upload.single("reference"), async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim().slice(0, 5000);
    if (!prompt) return res.status(400).json({ error: "Image prompt required." });
    if (req.file && !req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Reference file honi chahiye." });
    const width = Math.min(1536, Math.max(512, Number(req.body.width) || 1024));
    const height = Math.min(1536, Math.max(512, Number(req.body.height) || 1024));

    if (req.body.provider === "zara") {
      if (req.file) return res.status(400).json({ error: "ZARA currently accepts text prompts only; reference-image support is not enabled in this Colab bridge." });
      const zaraUrl = String(process.env.ZARA_API_URL || "").replace(/\/+$/, "");
      const zaraToken = process.env.ZARA_API_TOKEN || "";
      if (!zaraUrl || !zaraToken) return res.status(503).json({ error: "ZARA Studio is not connected yet. Set ZARA_API_URL and ZARA_API_TOKEN in Render Environment." });
      const response = await fetch(zaraUrl + "/generate", {
        method: "POST",
        headers: { "Authorization": "Bearer " + zaraToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, width, height,
          style: String(req.body.style || "photo"),
          mode: "single",
          steps: Math.min(50, Math.max(12, Number(req.body.steps) || 32)),
          cfg: Math.min(10, Math.max(2, Number(req.body.cfg) || 6)),
          seed: Number.isFinite(Number(req.body.seed)) ? Number(req.body.seed) : Math.floor(Math.random() * 2147483647)
        }),
        signal: AbortSignal.timeout(900000)
      });
      const data = await readJson(response);
      if (!response.ok) return res.status(response.status).json({ error: providerError(data, "ZARA Studio generation failed.") });
      if (!data.image_base64) return res.status(502).json({ error: data.error || "ZARA bridge returned no image." });
      return res.json({ image_base64: data.image_base64, media_type: data.media_type || "image/png", provider: "zara", status: data.status || "completed" });
    }

    if (req.body.provider === "civitai") {
      const key = civitaiToken();
      if (!key) return res.status(503).json({ error: "Civitai connect nahi hai. Render Environment mein CIVITAI_API_KEY set karo." });
      if (req.file) return res.status(400).json({ error: "Civitai ke is initial integration mein reference-image upload abhi supported nahi hai. Reference ke bina try karo." });
      const workflow = {
        steps: [{
          "$type": "imageGen",
          input: {
            engine: process.env.CIVITAI_IMAGE_ENGINE || "sdcpp",
            ecosystem: process.env.CIVITAI_IMAGE_ECOSYSTEM || "sd1",
            operation: "createImage",
            model: process.env.CIVITAI_IMAGE_MODEL || DEFAULT_CIVITAI_IMAGE_MODEL,
            prompt,
            negativePrompt: String(req.body.negativePrompt || "worst quality, low quality, blurry").slice(0, 2000),
            width, height,
            steps: Math.min(40, Math.max(10, Number(req.body.steps) || 20)),
            cfgScale: Math.min(12, Math.max(1, Number(req.body.cfgScale) || 7))
          }
        }]
      };
      let response = await fetch(CIVITAI_BASE + "/v2/consumer/workflows?wait=60", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(workflow),
        signal: AbortSignal.timeout(90000)
      });
      let data = await readJson(response);
      if (!response.ok) return res.status(response.status).json({ error: providerError(data, "Civitai image workflow failed.") });
      const workflowId = data.id || data.workflowId;
      const getStatus = x => String(x?.status || x?.state || "").toLowerCase();
      const done = x => ["succeeded", "success", "completed", "complete"].includes(getStatus(x));
      const failed = x => ["failed", "error", "cancelled", "canceled"].includes(getStatus(x));
      let attempts = 0;
      while (workflowId && !done(data) && !failed(data) && attempts < 5) {
        await new Promise(resolve => setTimeout(resolve, [2000, 4000, 7000, 10000, 12000][attempts++]));
        response = await fetch(CIVITAI_BASE + "/v2/consumer/workflows/" + encodeURIComponent(workflowId), {
          headers: { "Authorization": "Bearer " + key },
          signal: AbortSignal.timeout(30000)
        });
        data = await readJson(response);
        if (!response.ok) return res.status(response.status).json({ error: providerError(data, "Civitai workflow status check failed.") });
      }
      if (failed(data)) return res.status(502).json({ error: providerError(data, "Civitai image workflow failed.") });
      const imageUrl = findImageUrl(data);
      if (!imageUrl) return res.status(202).json({ pending: true, workflow_id: workflowId || null, status: getStatus(data) || "processing", message: "Civitai job abhi process ho raha hai. Thodi der baad dobara check karo." });
      return res.json({ image_url: imageUrl, provider: "civitai", model: process.env.CIVITAI_IMAGE_MODEL || DEFAULT_CIVITAI_IMAGE_MODEL, workflow_id: workflowId || null });
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return res.status(503).json({ error: "Image generation ke liye Render Environment mein OPENROUTER_API_KEY set karo." });
    const ratio = width / height;
    const aspectRatio = Math.abs(ratio - 1) < 0.1 ? "1:1" : ratio > 1 ? (ratio > 1.5 ? "16:9" : "4:3") : (ratio < 0.67 ? "9:16" : "3:4");
    const body = {
      model: process.env.OPENROUTER_IMAGE_MODEL || "bytedance-seed/seedream-5-0-flash",
      prompt, n: 1, aspect_ratio: aspectRatio, resolution: "1K"
    };
    if (req.file) body.input_references = [{ type: "image_url", image_url: { url: "data:" + req.file.mimetype + ";base64," + req.file.buffer.toString("base64") } }];
    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240000)
    });
    const data = await readJson(response);
    if (!response.ok) return res.status(response.status).json({ error: providerError(data, "OpenRouter image request failed.") });
    const image = data.data?.[0];
    if (!image?.b64_json && !image?.url) return res.status(502).json({ error: "Image provider ne image data return nahi ki." });
    return res.json({ image_base64: image.b64_json || undefined, image_url: image.url || undefined, media_type: image.media_type || "image/png", cost: data.usage?.cost ?? null, model: body.model, provider: "openrouter" });
  } catch (e) {
    return res.status(500).json({ error: "Image generation failed: " + e.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log("FRIDAY AI listening on " + port));
