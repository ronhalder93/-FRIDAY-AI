const $ = id => document.getElementById(id);
const messages = [];
function setView(view) {
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.view === view));
  $(view + "View").classList.add("active");
  $("pageTitle").textContent = view === "chat" ? "AI Assistant" : "Image Studio";
  $("pageSub").textContent = view === "chat" ? "Ask anything. Create something." : "Turn your ideas into visuals.";
}
document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
$("newChat").addEventListener("click", () => { messages.length = 0; $("messages").innerHTML = ""; $("welcome").style.display = ""; $("chatInput").focus(); setView("chat"); });
$("menu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
document.querySelectorAll(".suggestions button").forEach(b => b.addEventListener("click", () => { $("chatInput").value = b.textContent; $("chatInput").focus(); }));
function addMessage(role, content) {
  $("welcome").style.display = "none";
  const row = document.createElement("div"); row.className = "message " + role;
  const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role === "user" ? "You" : "F";
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = content;
  row.append(avatar, bubble); $("messages").append(row); window.scrollTo(0, document.body.scrollHeight);
}
$("chatForm").addEventListener("submit", async e => {
  e.preventDefault(); const text = $("chatInput").value.trim(); if (!text) return;
  $("chatInput").value = ""; messages.push({role:"user",content:text}); addMessage("user",text);
  const wait = "FRIDAY is thinking…"; addMessage("assistant",wait);
  const last = $("messages").lastElementChild;
  try {
    const r = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});
    const data = await r.json(); last.querySelector(".bubble").textContent = data.reply || data.error || "Something went wrong.";
    if (data.reply) messages.push({role:"assistant",content:data.reply});
  } catch { last.querySelector(".bubble").textContent = "Connection error. Please try again."; }
});
$("reference").addEventListener("change", () => { $("fileName").textContent = $("reference").files[0]?.name || "＋ Choose reference image"; });
$("imageForm").addEventListener("submit", async e => {
  e.preventDefault(); const result = $("imageResult"); result.textContent = "Generating image with OpenRouter…";
  const form = new FormData(); form.append("prompt",$("prompt").value); form.append("width",$("width").value); form.append("height",$("height").value);
  if ($("reference").files[0]) form.append("reference",$("reference").files[0]);
  try {
    const r = await fetch("/api/generate",{method:"POST",body:form}); const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Generation failed.");
    result.innerHTML = "";
    if (data.image_url) { const img = document.createElement("img"); img.src = data.image_url; result.append(img); }
    else if (data.image_base64) { const img = document.createElement("img"); img.src = "data:" + (data.media_type || "image/png") + ";base64," + data.image_base64; result.append(img); }
    else result.textContent = "Worker replied, but no image_url or image_base64 was returned.";
  } catch (err) { result.textContent = err.message; }
});
fetch("/api/status").then(r=>r.json()).then(s=>{
  $("connection").textContent = s.chatConfigured ? "OpenRouter connected" : "Waiting for OpenRouter key";
  document.querySelector(".status-dot").style.background = s.chatConfigured ? "#54d6a1" : "#edb65b";
}).catch(()=>{$("connection").textContent="Status unavailable";});
