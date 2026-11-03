const $ = id => document.getElementById(id);
let messages = [];
let historyItems = [];
let busy = false;
const HISTORY_KEY = "friday_ai_recent_v1";
function setView(view) {
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.view === view));
  $(view + "View").classList.add("active");
  $("pageTitle").textContent = view === "chat" ? "AI Assistant" : "Image Studio";
}
document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => {setView(b.dataset.view); $("sidebar").classList.remove("open");}));
$("newChat").addEventListener("click", () => startNewChat());
$("closeSidebar").addEventListener("click", () => $("sidebar").classList.remove("open"));
$("menu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("clearHistory").addEventListener("click", () => {historyItems=[];saveHistory();renderHistory();});
document.querySelectorAll(".suggestions button").forEach(b => b.addEventListener("click", () => { $("chatInput").value = b.dataset.prompt; $("chatInput").focus(); }));
function startNewChat(){if(messages.length) saveCurrentChat();messages=[];$("messages").innerHTML="";$("welcome").style.display="";$("chatInput").value="";setView("chat");$("chatInput").focus();}
function loadHistory(){try{historyItems=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");}catch{historyItems=[];}renderHistory();}
function saveHistory(){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(historyItems.slice(0,15)));}catch{}}
function saveCurrentChat(){if(!messages.length)return;const first=messages.find(m=>m.role==="user");if(!first)return;historyItems.unshift({title:first.content.slice(0,48),messages:messages.slice(0,30),time:Date.now()});historyItems=historyItems.slice(0,15);saveHistory();renderHistory();}
function renderHistory(){const host=$("historyList");host.innerHTML="";if(!historyItems.length){const p=document.createElement("p");p.className="empty-history";p.textContent="Your conversations will appear here.";host.append(p);return;}historyItems.forEach((item,index)=>{const b=document.createElement("button");b.className="history-item";b.textContent="◦  "+item.title;b.title=item.title;b.addEventListener("click",()=>{messages=item.messages.slice();$("messages").innerHTML="";$("welcome").style.display="none";messages.forEach(m=>addMessage(m.role,m.content,false));setView("chat");$("sidebar").classList.remove("open");});host.append(b);});}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function formatReply(text){
  let safe=escapeHtml(text);
  safe=safe.replace(/```([\w-]*)\n?([\s\S]*?)```/g,(_,lang,code)=>'<pre><code>'+code.trim()+'</code></pre>');
  safe=safe.replace(/`([^`]+)`/g,'<code>$1</code>');
  safe=safe.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');
  safe=safe.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
  safe=safe.replace(/^\s*[-*] (.*)$/gm,'<li>$1</li>');
  safe=safe.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g,m=>'<ul>'+m+'</ul>');
  return safe.split(/\n{2,}/).map(block=>/^<(h[1-3]|pre|ul|ol)/.test(block)?block:'<p>'+block.replace(/\n/g,'<br>')+'</p>').join("");
}
function addMessage(role, content, actions=true){
  $("welcome").style.display="none";
  const row=document.createElement("div");row.className="message "+role;
  const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=role==="user"?"YOU":"F";
  const bubble=document.createElement("div");bubble.className="bubble";
  if(role==="assistant" && content==="__typing__"){bubble.innerHTML='<div class="typing"><i></i><i></i><i></i></div>';}
  else if(role==="assistant")bubble.innerHTML=formatReply(content);
  else bubble.textContent=content;
  row.append(avatar,bubble);$("messages").append(row);
  if(role==="assistant"&&actions&&content!=="__typing__"){const bar=document.createElement("div");bar.className="message-actions";const copy=document.createElement("button");copy.textContent="▢ Copy";copy.addEventListener("click",()=>navigator.clipboard?.writeText(content).then(()=>copy.textContent="✓ Copied"));bar.append(copy);row.append(bar);}
  if(actions)row.scrollIntoView({behavior:"smooth",block:"end"});
  return row;
}
$("chatForm").addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;const text=$("chatInput").value.trim();if(!text)return;
  busy=true;$("chatInput").value="";$("chatInput").style.height="";$("send").disabled=true;
  messages.push({role:"user",content:text});addMessage("user",text);
  const pending=addMessage("assistant","__typing__",false);
  try{
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,provider:$("chatProvider")?.value||"openrouter"})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||"Chat request failed.");
    const reply=data.reply||"No response received.";pending.querySelector(".bubble").innerHTML=formatReply(reply);
    messages.push({role:"assistant",content:reply});
    const bar=document.createElement("div");bar.className="message-actions";const copy=document.createElement("button");copy.textContent="▢ Copy";copy.addEventListener("click",()=>navigator.clipboard?.writeText(reply).then(()=>copy.textContent="✓ Copied"));bar.append(copy);pending.append(bar);
    if(messages.filter(m=>m.role==="user").length===1)saveCurrentChat();
  }catch(err){pending.querySelector(".bubble").textContent=err.message;}
  finally{busy=false;$("send").disabled=false;$("chatInput").focus();}
});
$("chatInput").addEventListener("input",()=>{const el=$("chatInput");el.style.height="auto";el.style.height=Math.min(el.scrollHeight,180)+"px";});
$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit();}});
$("attachButton").addEventListener("click",()=>{});
$("reference").addEventListener("change",()=>{$("fileName").textContent=$("reference").files[0]?.name||"Upload an image to guide the result";});
$("imageForm").addEventListener("submit",async e=>{
  e.preventDefault();const result=$("imageResult");result.className="result loading";result.innerHTML='<div class="typing"><i></i><i></i><i></i></div><b>Creating your image…</b><p>This can take a little while.</p>';
  const form=new FormData();form.append("prompt",$("prompt").value);form.append("width",$("width").value);form.append("height",$("height").value);form.append("provider",$("imageProvider")?.value||"openrouter");if($("reference").files[0])form.append("reference",$("reference").files[0]);
  try{const r=await fetch("/api/generate",{method:"POST",body:form});const data=await r.json();if(data.pending){result.className="result error";result.innerHTML="";const title=document.createElement("b");title.textContent="Generation is still running";const msg=document.createElement("p");msg.textContent=data.message||"Civitai is still processing this image. Please try again in a moment.";result.append(title,msg);return;}if(!r.ok)throw new Error(data.error||"Generation failed.");result.className="result";result.innerHTML="";if(data.image_url){const img=document.createElement("img");img.src=data.image_url;img.alt="Generated image";result.append(img);}else if(data.image_base64){const img=document.createElement("img");img.src="data:"+(data.media_type||"image/png")+";base64,"+data.image_base64;img.alt="Generated image";result.append(img);}else throw new Error("No image returned.");if(data.cost!==null&&data.cost!==undefined){const note=document.createElement("p");note.textContent="Provider cost: $"+Number(data.cost).toFixed(4);result.append(note);}}
  catch(err){result.className="result error";result.innerHTML="";const title=document.createElement("b");title.textContent="Image generation failed";const msg=document.createElement("p");msg.textContent=err.message;result.append(title,msg);}
});
fetch("/api/status").then(r=>r.json()).then(s=>{const ready=[];if(s.chatConfigured)ready.push("OpenRouter");if(s.civitaiConfigured)ready.push("Civitai");$("connection").textContent=ready.length?ready.join(" + ")+" connected":"Waiting for API keys";document.querySelector(".pulse-dot").style.background=ready.length?"#58d7a3":"#e6b45d";document.querySelector(".pulse-dot").style.color=ready.length?"#58d7a3":"#e6b45d";}).catch(()=>{$("connection").textContent="Status unavailable";});
loadHistory();