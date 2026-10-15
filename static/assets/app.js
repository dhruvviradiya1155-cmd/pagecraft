"use strict";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
document.getElementById("yr").textContent = new Date().getFullYear();

/* ---------- icons ---------- */
const P = {
  merge:"M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h4.5V11M13 16.5H8.5V13",
  split:"M4 4h16v16H4zM12 4v16",
  remove:"M6 3h9l4 4v14H6zM9.5 12.5l6 6M15.5 12.5l-6 6",
  extract:"M6 3h9l4 4v14H6zM12 10v7M9 14l3 3 3-3",
  organize:"M4 4h6v7H4zM14 4h6v7h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  rotate:"M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5",
  compress:"M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5",
  img2pdf:"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  pdf2img:"M4 5h16v14H4zM8 12.5l3 3 5-6",
  text:"M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4",
  numbers:"M6 3h9l4 4v14H6zM10.5 12l1.5-1v6M10 17h4",
  watermark:"M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  crop:"M6 2v16h16M2 6h16v16",
  sign:"M3 17c3 0 4-8 6-8s0 8 3 8 3-4 5-4 2 3 4 3M3 21h18",
  ocr:"M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 10h8M8 14h5",
  protect:"M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2",
  unlock:"M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2M12 15v2",
  html2pdf:"M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14",
  word:"M6 3h9l4 4v14H6zM15 3v4h4M8.5 11l1.3 6 2.2-4.5 2.2 4.5 1.3-6",
  excel:"M6 3h9l4 4v14H6zM15 3v4h4M9.5 11l5 6M14.5 11l-5 6",
  ppt:"M6 3h9l4 4v14H6zM15 3v4h4M10 18v-7h2.6a2 2 0 0 1 0 4H10",
  repair:"M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z",
  pdfa:"M4 5h16v4H4zM5 9v10h14V9M10 13h4",
  up:"M12 19V5M6 11l6-6 6 6", down:"M12 5v14M6 13l6 6 6-6",
  left:"M15 6l-6 6 6 6", right:"M9 6l6 6-6 6",
  x:"M6 6l12 12M18 6L6 18", file:"M6 3h9l4 4v14H6zM15 3v4h4",
  search:"M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  dl:"M12 4v11M7 10l5 5 5-5M5 20h14", back:"M15 6l-6 6 6 6", upload:"M12 16V4M7 9l5-5 5 5M5 20h14"
};
const ICON_ALIAS = {word2pdf:"word", pdf2word:"word", excel2pdf:"excel", pdf2excel:"excel", ppt2pdf:"ppt", pdf2ppt:"ppt"};
const svg = (n, s=24) => (n=ICON_ALIAS[n]||n, `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`);

/* ---------- tools catalogue (sent by the server) ---------- */
const BOOT = JSON.parse(document.getElementById("boot").textContent);
const TOOLS = BOOT.tools;
const GROUPS = Object.fromEntries(BOOT.groups.map(g=>[g.id,[g.label,g.color]]));
const bySlug = Object.fromEntries(TOOLS.map(t=>[t.slug,t]));
const byId = Object.fromEntries(TOOLS.map(t=>[t.id,t]));

/* ---------- helpers ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = b => b<1024? b+" B" : b<1048576? (b/1024).toFixed(1)+" KB" : (b/1048576).toFixed(2)+" MB";
const baseName = n => n.replace(/\.[^.]+$/,"");
const pdfBlob = bytes => new Blob([bytes], {type:"application/pdf"});
const tick = () => new Promise(r=>setTimeout(r,0));
const mm = v => v*72/25.4;
function hexRgb(h){ const n=parseInt(h.slice(1),16); return rgb((n>>16&255)/255,(n>>8&255)/255,(n&255)/255); }
function canvasBytes(c, type="image/jpeg", q=.9){ return new Promise((res,rej)=>c.toBlob(b=>b? b.arrayBuffer().then(a=>res(new Uint8Array(a))) : rej(new Error("Could not encode image")), type, q)); }
async function openPdfJs(bytes){
  try { return await pdfjsLib.getDocument({data: bytes.slice()}).promise; }
  catch(e){ if(e && e.name==="PasswordException") throw new Error("This PDF is password-protected. Remove the password first, then try again."); throw new Error("This file couldn't be read as a PDF. It may be damaged."); }
}
async function openPdfLib(bytes){
  try { return await PDFDocument.load(bytes, {password:""}); }
  catch(e){ return PDFDocument.load(bytes, {ignoreEncryption:true}); }
}
const loaded = {};
function loadScript(u){
  return loaded[u] ||= new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=u; s.onload=res;
    s.onerror=()=>{ delete loaded[u]; s.remove(); rej(new Error("A required component couldn't load. Check your internet connection and try again.")); };
    document.head.appendChild(s); });
}
const TESS_URL="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const H2C_URL="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
async function renderPage(doc, n, {width, scale, extraRot=0}={}){
  const page = await doc.getPage(n);
  const vp1 = page.getViewport({scale:1, rotation:(page.rotate+extraRot)%360});
  const s = scale || (width / vp1.width);
  const vp = page.getViewport({scale:s, rotation:(page.rotate+extraRot)%360});
  const c = document.createElement("canvas");
  c.width = Math.max(1,Math.floor(vp.width)); c.height = Math.max(1,Math.floor(vp.height));
  const ctx = c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx, viewport:vp}).promise;
  page.cleanup();
  return c;
}
function parseRanges(str, max){
  const groups = [];
  for (const part of str.split(",").map(s=>s.trim()).filter(Boolean)){
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if(!m) throw new Error(`"${part}" isn't a page or range. Use a format like 1-3, 5, 8-10.`);
    let a=+m[1], b=m[2]? +m[2] : a;
    if(a<1||b<1||a>max||b>max) throw new Error(`Page ${a>max||a<1?a:b} doesn't exist. This PDF has ${max} pages.`);
    if(b<a) [a,b]=[b,a];
    const g=[]; for(let i=a;i<=b;i++) g.push(i-1); groups.push(g);
  }
  if(!groups.length) throw new Error("Enter at least one page or range.");
  return groups;
}
async function copyInto(srcBytes, list){
  const src = await openPdfLib(srcBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, list.map(x=>x.i));
  copied.forEach((p,k)=>{ const r=list[k].rot||0; if(r) p.setRotation(degrees((p.getRotation().angle+r)%360)); out.addPage(p); });
  return out.save();
}

/* ---------- routing ---------- */
let S = null; // current tool state
window.addEventListener("popstate", route);
document.addEventListener("click", e=>{
  const a=e.target.closest("a[href]");
  if(!a || e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute("download")) return;
  const url=new URL(a.getAttribute("href"), location.href);
  if(url.origin!==location.origin) return;
  const slug=url.pathname.replace(/^\/+|\/+$/g,"");
  if(url.pathname==="/" || bySlug[slug]){
    e.preventDefault();
    if(url.pathname!==location.pathname) history.pushState(null,"",url.pathname);
    route();
  }
});
let firstRoute = true;
function route(){
  const slug = location.pathname.replace(/^\/+|\/+$/g,"");
  if (S && S.xhr) S.xhr.abort();
  if (S && S.urls) S.urls.forEach(u=>URL.revokeObjectURL(u));
  if (S && S.doc) S.doc.destroy();
  S = null;
  if (bySlug[slug]) openTool(bySlug[slug]);
  else if (!slug) renderHome();
  else if (!firstRoute) { location.reload(); return; }   // privacy, terms, about: rendered by the server
  if (!firstRoute) window.scrollTo(0,0);
  firstRoute = false;
}

/* ---------- home ---------- */
function renderHome(){
  document.title = `${BOOT.siteName} – Free PDF tools: merge, split, compress, convert`;
  const groups = Object.entries(GROUPS).map(([g,[label,c]])=>{
    const items = TOOLS.filter(t=>t.g===g).map(t=>`
      <a class="card" href="/${t.slug}" style="--tc:var(${c})" data-q="${esc((t.name+" "+t.desc).toLowerCase())}">
        <span class="ico">${svg(t.id)}</span>
        <span><h3>${t.name}</h3><p>${t.desc}</p></span>
      </a>`).join("");
    return `<section class="group" data-g="${g}"><h2>${label}</h2><div class="grid">${items}</div></section>`;
  }).join("");
  $("#app").innerHTML = `
  <div class="wrap">
    <section class="hero">
      <h1>Every PDF tool you need, <em>free and private.</em></h1>
      <div>
        <p>Merge, split, compress, convert, sign and protect PDFs for free. Most tools run right in your browser, so your documents never leave your device.</p>
        <span class="badge"><b></b>${TOOLS.length} tools · No sign-up · No watermarks</span>
      </div>
    </section>
    <div class="search">${svg("search",18)}<input id="q" type="text" placeholder="Search tools, e.g. merge, jpg, sign" aria-label="Search tools"></div>
    <div id="groups">${groups}</div>
    <section class="group"><h2>How it works</h2>
      <div class="how">
        <div><b>Choose a tool</b><p>Pick what you need to do with your PDF from the list above.</p></div>
        <div><b>Add your files</b><p>Drop files onto the page. Most tools open them right in your browser. Office conversions use our secure server and delete your file right after.</p></div>
        <div><b>Download the result</b><p>Adjust the settings, press the button and save your new file.</p></div>
      </div>
    </section>
  </div>`;
  $("#q").addEventListener("input", e=>{
    const q = e.target.value.trim().toLowerCase();
    $$(".card").forEach(c=>c.hidden = q && !c.dataset.q.includes(q));
    $$("#groups .group").forEach(g=>g.hidden = !$$(".card",g).some(c=>!c.hidden));
  });
}

/* ---------- tool shell ---------- */
function openTool(t){
  document.title = `${t.name} – free online | ${BOOT.siteName}`;
  const color = `var(${GROUPS[t.g][1]})`;
  S = { t, files:[], pages:[], doc:null, urls:[], busy:false };
  const accepts = t.accept || ".pdf,application/pdf";
  $("#app").innerHTML = `
  <div class="wrap" style="--tc:${color}">
    <a class="back" href="/">${svg("back",16)} All tools</a>
    <div class="tool-head"><span class="ico">${svg(t.id)}</span><div><h1>${t.name}</h1><p>${t.desc}</p>
      ${t.kind==="server" ? `<span class="where srv"><b></b>Converted on our secure server · deleted right after</span>` : `<span class="where"><b></b>Runs on your device · never uploaded</span>`}</div></div>
    <label class="drop" id="drop">
      <input type="file" id="fileIn" accept="${accepts}" ${t.multi?"multiple":""} hidden>
      <span class="ico" style="margin:auto">${svg("upload")}</span>
      <h2>${t.multi? (t.id==="img2pdf"?"Choose images":"Choose PDF files") : ({word2pdf:"Choose a Word file",excel2pdf:"Choose an Excel file",ppt2pdf:"Choose a PowerPoint file",html2pdf:"Choose an HTML file"}[t.id] || "Choose a PDF file")}</h2>
      <p>or drop ${t.multi?"them":"it"} here · ${t.kind==="server" ? `${t.accept.split(",").filter(a=>a.startsWith(".")).join(" ").toUpperCase().replace(/\./g,"")} · up to ${BOOT.maxUploadMb} MB` : "processed on your device"}</p>
    </label>
    <p class="err" id="loadErr" hidden></p>
    <div class="bench" id="bench" hidden>
      <section class="pane"><div class="pane-head" id="paneHead"></div><div id="paneBody"></div></section>
      <aside class="pane side" id="side"></aside>
    </div>
  </div>`;
  const drop = $("#drop"), inp = $("#fileIn");
  inp.addEventListener("change", ()=>{ addFiles([...inp.files]); inp.value=""; });
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
  drop.addEventListener("drop", e=>addFiles([...e.dataTransfer.files]));
  if(t.kind==="html"){ showBench(); renderHtmlPane(); }
}

function filterFiles(list){
  const t=S.t;
  if(t.kind==="server"){ const ok=t.accept.split(",").filter(a=>a.startsWith(".")); return list.filter(f=>ok.some(x=>f.name.toLowerCase().endsWith(x))); }
  if(t.kind==="html") return list.filter(f=>/\.html?$/i.test(f.name)||f.type==="text/html");
  return list.filter(f => t.id==="img2pdf" ? f.type.startsWith("image/") : (f.type==="application/pdf" || /\.pdf$/i.test(f.name)));
}

async function addFiles(list){
  const err = $("#loadErr"); err.hidden = true;
  const ok = filterFiles(list);
  if(!ok.length){ err.textContent = S.t.id==="img2pdf" ? "Those files aren't images. Choose JPG, PNG or WebP files." : S.t.kind==="html" ? "That file isn't an HTML file. Choose a file ending in .html." : S.t.kind==="server" ? `This tool accepts ${S.t.accept.split(",").filter(a=>a.startsWith(".")).join(", ")} files.` : "That file isn't a PDF. Choose a file ending in .pdf."; err.hidden=false; return; }
  if(S.t.kind==="html"){ $("#htmlSrc").value = await ok[0].text(); S.htmlName = baseName(ok[0].name); updateHtmlPreview(); clearResult(); return; }
  if(S.t.kind==="files"){
    for(const f of ok) S.files.push({file:f, name:f.name, size:f.size, bytes:new Uint8Array(await f.arrayBuffer())});
    showBench(); renderFileList();
  } else if(S.t.kind==="server"){
    const f=ok[0];
    if(f.size > BOOT.maxUploadMb*1048576){ err.textContent=`This file is ${fmt(f.size)}. The limit is ${BOOT.maxUploadMb} MB per file.`; err.hidden=false; return; }
    S.files=[{file:f,name:f.name,size:f.size,bytes: /\.pdf$/i.test(f.name) ? new Uint8Array(await f.arrayBuffer()) : null}];
    showBench(); renderServerFile(); clearResult();
  } else if(S.t.kind==="raw"){
    const f=ok[0]; S.files=[{file:f,name:f.name,size:f.size,bytes:new Uint8Array(await f.arrayBuffer())}];
    showBench(); renderRawFile();
  } else {
    const f = ok[0];
    try{
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await openPdfJs(bytes);
      S.files=[{file:f,name:f.name,size:f.size,bytes}]; S.doc=doc;
      S.pages = Array.from({length:doc.numPages},(_,i)=>({i, rot:0, sel:false, del:false, el:null, cv:null}));
      showBench(); renderPageGrid();
    }catch(e){ err.textContent=e.message; err.hidden=false; }
  }
}

function showBench(){
  $("#drop").hidden = true; $("#bench").hidden = false;
  if(!$("#side").dataset.ready){ buildSide(); $("#side").dataset.ready="1"; }
}

/* ---------- file list (merge, img2pdf) ---------- */
async function renderFileList(){
  const head=$("#paneHead"), body=$("#paneBody");
  head.innerHTML = `<div><strong>${S.files.length} file${S.files.length!==1?"s":""}</strong> <span>· ${fmt(S.files.reduce((a,f)=>a+f.size,0))} · use the arrows to set the order</span></div>
    <label class="btn ghost">${svg("upload",16)} Add more<input type="file" id="moreIn" accept="${S.t.accept}" multiple hidden></label>`;
  $("#moreIn").addEventListener("change", e=>{ addFiles([...e.target.files]); });
  body.innerHTML = `<div class="flist">${S.files.map((f,k)=>`
    <div class="fitem" data-k="${k}">
      <span class="thumb" data-k="${k}"><canvas width="44" height="56"></canvas></span>
      <div class="meta"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${fmt(f.size)}<span class="pc"></span></small></div>
      <button class="iconbtn" data-a="up" aria-label="Move up" ${k===0?"disabled":""}>${svg("up")}</button>
      <button class="iconbtn" data-a="down" aria-label="Move down" ${k===S.files.length-1?"disabled":""}>${svg("down")}</button>
      <button class="iconbtn" data-a="rm" aria-label="Remove file">${svg("x")}</button>
    </div>`).join("")}</div>`;
  $$(".fitem", body).forEach(row=>{
    const k=+row.dataset.k;
    row.addEventListener("click", e=>{
      const a=e.target.closest("button")?.dataset.a; if(!a) return;
      if(a==="up"&&k>0) [S.files[k-1],S.files[k]]=[S.files[k],S.files[k-1]];
      if(a==="down"&&k<S.files.length-1) [S.files[k+1],S.files[k]]=[S.files[k],S.files[k+1]];
      if(a==="rm") S.files.splice(k,1);
      if(!S.files.length){ route(); return; }
      renderFileList(); clearResult();
    });
  });
  // thumbnails
  for(const [k,f] of S.files.entries()){
    const holder = $(`.thumb[data-k="${k}"]`, body); if(!holder) continue;
    try{
      if(S.t.id==="img2pdf"){
        if(!f.thumb) f.thumb = URL.createObjectURL(f.file), S.urls.push(f.thumb);
        holder.innerHTML = `<img src="${f.thumb}" alt="">`;
      } else {
        if(!f.thumbCv){ const d=await openPdfJs(f.bytes); f.pages=d.numPages; f.thumbCv=await renderPage(d,1,{width:88}); d.destroy(); }
        const c=f.thumbCv.cloneNode(); c.getContext("2d").drawImage(f.thumbCv,0,0); holder.replaceChildren(c);
        $(".pc",holder.parentElement).textContent = ` · ${f.pages} page${f.pages>1?"s":""}`;
      }
    }catch(e){ const m=$(".pc",holder.parentElement); if(m) m.textContent=" · can't be read"; f.bad=true; }
  }
}

/* ---------- server tools ---------- */
async function renderServerFile(){
  const f=S.files[0], ext=(f.name.split(".").pop()||"").toUpperCase().slice(0,5);
  $("#paneHead").innerHTML=`<strong>Your file</strong><label class="btn ghost">${svg("upload",16)} Choose a different file<input type="file" id="swapIn" accept="${S.t.accept}" hidden></label>`;
  $("#swapIn").addEventListener("change",e=>{ if(e.target.files[0]) addFiles([e.target.files[0]]); e.target.value=""; });
  $("#paneBody").innerHTML=`<div class="fcard"><span class="thumb">${esc(ext)}</span><div class="meta"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${fmt(f.size)}<span id="pcount"></span></small></div></div>`;
  if(f.bytes && S.t.id!=="repair"){
    try{ const d=await openPdfJs(f.bytes); const c=await renderPage(d,1,{width:144}); $(".fcard .thumb").replaceChildren(c);
      $("#pcount").textContent=` · ${d.numPages} page${d.numPages>1?"s":""}`; d.destroy(); }
    catch(e){ $("#pcount").textContent = /password/i.test(e.message) ? " · password-protected: unlock it first" : " · this PDF may be damaged"; }
  }
}
function serverOpts(){
  switch(S.t.id){
    case "excel2pdf": return {fit: $("#o-fit").checked ? "1" : ""};
    case "pdf2excel": return {layout: radio("xl")};
    case "pdf2ppt": return {mode: radio("pm")};
    case "pdfa": return {level: $("#o-level").value};
    default: return {};
  }
}
function fileNameFrom(cd){
  let m=cd.match(/filename\*=UTF-8''([^;]+)/i); if(m) try{ return decodeURIComponent(m[1]); }catch(_){}
  m=cd.match(/filename="?([^";]+)"?/i); return m? m[1] : null;
}
function serverConvert(){
  const f=S.files[0], fd=new FormData();
  fd.append("file", f.file, f.name);
  for(const [k,v] of Object.entries(serverOpts())) fd.append(k,v);
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest(); S.xhr=x;
    x.open("POST","/api/convert/"+S.t.id); x.responseType="blob";
    x.upload.onprogress=e=>{ if(e.lengthComputable) progress(e.loaded,e.total,`Uploading… ${Math.round(100*e.loaded/e.total)}%`); };
    x.upload.onload=()=>{ progress(1,1); $("#prog").parentElement.classList.add("busy"); $("#progTxt").textContent="Converting… big files can take up to a minute."; };
    x.onload=async()=>{
      if(x.status===200){
        const name=fileNameFrom(x.getResponseHeader("Content-Disposition")||"") || baseName(f.name)+"."+S.t.out;
        resolve({files:[{blob:x.response,name}], title:"Done! Your file is ready.", note:"Your file has been deleted from our server."});
      } else {
        let msg = x.status===413 ? `This file is too large. The limit is ${BOOT.maxUploadMb} MB.` : x.status>=502 ? "The conversion server isn't responding. Please try again in a minute." : "Something went wrong. Please try again.";
        try{ const j=JSON.parse(await x.response.text()); if(j.error) msg=j.error; }catch(_){}
        reject(new Error(msg));
      }
    };
    x.onerror=()=>reject(new Error("Couldn't reach the conversion server. Check your internet connection and try again."));
    x.onabort=()=>reject(new Error("Conversion cancelled."));
    x.send(fd);
  });
}

/* ---------- raw file (unlock) ---------- */
async function renderRawFile(){
  const f=S.files[0];
  $("#paneHead").innerHTML=`<strong>Your file</strong>`;
  $("#paneBody").innerHTML=`<div class="fitem"><span class="ico" style="width:44px;height:56px">${svg("protect")}</span>
    <div class="meta"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${fmt(f.size)} · <span id="lockState">checking…</span></small></div></div>`;
  let state;
  try{ await PDFDocument.load(f.bytes); state="not protected"; f.locked=0; }
  catch(e){ try{ await PDFDocument.load(f.bytes,{password:""}); state="has editing/printing restrictions"; f.locked=1; } catch(e2){ state="needs a password to open"; f.locked=2; } }
  $("#lockState").textContent=state;
  const pf=$("#pwField"); if(pf) pf.hidden = f.locked===1;
}

/* ---------- HTML source (html2pdf) ---------- */
const SAMPLE_HTML = `<!doctype html>
<html><head><style>
  body{font-family:Georgia,serif;color:#1d2433;margin:0;padding:8px}
  h1{font-size:30px;margin:0 0 4px} .muted{color:#667}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid #dde}
  td:last-child,th:last-child{text-align:right}
  .total{font-weight:bold;font-size:18px}
</style></head><body>
  <h1>Invoice #1042</h1>
  <p class="muted">Example · Shree Textiles, Ring Road, Surat · 15 Oct 2026</p>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
    <tr><td>Cotton fabric, 40 m</td><td>2</td><td>₹ 8,400</td></tr>
    <tr><td>Silk saree blanks</td><td>5</td><td>₹ 12,750</td></tr>
    <tr><td class="total">Total</td><td></td><td class="total">₹ 21,150</td></tr>
  </table>
</body></html>`;
function renderHtmlPane(){
  $("#paneHead").innerHTML=`<div><strong>HTML code</strong> <span>· paste your own or load a file. The example below shows how it works.</span></div>
    <label class="btn ghost">${svg("upload",16)} Load .html file<input type="file" id="htmlIn" accept=".html,.htm,text/html" hidden></label>`;
  $("#paneBody").innerHTML=`<div class="field"><label for="htmlSrc">Code</label><textarea class="out" id="htmlSrc" spellcheck="false"></textarea></div>
    <div class="field" style="margin-top:14px"><span class="lbl">Preview</span>
    <iframe id="htmlPrev" sandbox="allow-same-origin" title="HTML preview" style="width:100%;height:380px;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe></div>
    <p class="hint" style="margin-top:8px">Scripts in your HTML don't run. To convert a live website, open it in your browser, press Ctrl+S to save it as .html, then load that file here.</p>`;
  $("#htmlSrc").value=SAMPLE_HTML; S.htmlName="document";
  $("#htmlIn").addEventListener("change",e=>{ addFiles([...e.target.files]); e.target.value=""; });
  let to; $("#htmlSrc").addEventListener("input",()=>{ clearTimeout(to); to=setTimeout(updateHtmlPreview,400); clearResult(); });
  updateHtmlPreview();
}
function updateHtmlPreview(){ const f=$("#htmlPrev"); if(f) f.srcdoc=$("#htmlSrc").value; }

/* ---------- page grid ---------- */
function renderPageGrid(){
  const mode=S.t.mode, f=S.files[0];
  const head=$("#paneHead"), body=$("#paneBody");
  const hints = {select:"Click pages to select them", organize:"Drag to reorder, or use the buttons", rotate:"Click a page to turn it 90°", pick:"Click the page you want to sign", view:""};
  head.innerHTML = `<div><strong title="${esc(f.name)}">${esc(f.name.length>40?f.name.slice(0,38)+"…":f.name)}</strong> <span>· ${S.pages.length} page${S.pages.length>1?"s":""} · ${fmt(f.size)}</span></div>
    <span id="gridHint" style="font-size:14px;color:var(--muted)">${hints[mode]}</span>`;
  body.innerHTML = `<div class="pages" id="pages"></div><div id="extra"></div>`;
  const grid=$("#pages");
  S.pages.forEach(p=>{
    const el=document.createElement("div");
    el.className="pg"+(mode!=="view"?" clickable":"");
    el.innerHTML=`<div class="frame"><div class="skel"></div></div><span class="num">${p.i+1}</span>`;
    if(mode==="organize"){
      el.draggable=true;
      el.insertAdjacentHTML("beforeend",`<div class="ctrls">
        <button class="iconbtn" data-a="l" aria-label="Move left">${svg("left")}</button>
        <button class="iconbtn" data-a="r" aria-label="Rotate">${svg("rotate")}</button>
        <button class="iconbtn" data-a="d" aria-label="Delete page">${svg("x")}</button>
        <button class="iconbtn" data-a="rt" aria-label="Move right">${svg("right")}</button></div>`);
    }
    p.el=el; grid.appendChild(el);
    el.addEventListener("click", e=>onPageClick(p,e));
  });
  if(mode==="organize") enableDrag(grid);
  (async()=>{
    for(const p of S.pages){
      if(!S || !S.doc) return;
      try{ const c=await renderPage(S.doc,p.i+1,{width:220}); p.cv=c; const fr=$(".frame",p.el); fr.replaceChildren(c); applyRot(p); }catch(e){}
      await tick();
    }
  })();
  if(mode==="view" || mode==="select") selectionChanged();
}
function applyRot(p){ if(p.el && p.cv) p.cv.style.transform = `rotate(${p.rot}deg) scale(${p.rot%180? .75:1})`; }
function onPageClick(p,e){
  const mode=S.t.mode;
  if(mode==="select"){ p.sel=!p.sel; p.el.classList.toggle("sel",p.sel); selectionChanged(); }
  else if(mode==="rotate"){ p.rot=(p.rot+90)%360; applyRot(p); clearResult(); }
  else if(mode==="pick"){ S.pages.forEach(q=>{q.sel=false;q.el.classList.remove("sel")}); p.sel=true; p.el.classList.add("sel"); showPlacer(p); }
  else if(mode==="organize"){
    const a=e.target.closest("button")?.dataset.a; if(!a) return;
    const k=S.pages.indexOf(p);
    if(a==="r"){ p.rot=(p.rot+90)%360; applyRot(p); }
    if(a==="d"){ p.del=!p.del; p.el.classList.toggle("x",p.del); }
    if(a==="l"&&k>0){ S.pages.splice(k,1); S.pages.splice(k-1,0,p); }
    if(a==="rt"&&k<S.pages.length-1){ S.pages.splice(k,1); S.pages.splice(k+1,0,p); }
    if(a==="l"||a==="rt") S.pages.forEach(q=>$("#pages").appendChild(q.el));
    clearResult();
  }
}
function enableDrag(grid){
  let dragP=null;
  grid.addEventListener("dragstart",e=>{ const el=e.target.closest(".pg"); dragP=S.pages.find(p=>p.el===el); el.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; });
  grid.addEventListener("dragend",()=>{ $$(".pg",grid).forEach(el=>el.classList.remove("dragging","dropbefore")); dragP=null; });
  grid.addEventListener("dragover",e=>{ e.preventDefault(); const el=e.target.closest(".pg"); $$(".pg",grid).forEach(x=>x.classList.toggle("dropbefore",x===el && el!==dragP?.el)); });
  grid.addEventListener("drop",e=>{
    e.preventDefault(); const el=e.target.closest(".pg"); if(!dragP||!el||el===dragP.el) return;
    const target=S.pages.find(p=>p.el===el);
    S.pages.splice(S.pages.indexOf(dragP),1); S.pages.splice(S.pages.indexOf(target),0,dragP);
    S.pages.forEach(p=>grid.appendChild(p.el)); clearResult();
  });
}
function selectionChanged(){
  const n=S.pages.filter(p=>p.sel).length, h=$("#gridHint");
  if(S.t.mode==="select" && h) h.textContent = n? `${n} page${n>1?"s":""} selected` : "Click pages to select them";
  const sc=$("#selCount"); if(sc) sc.textContent=n;
  clearResult();
}

/* ---------- side panels ---------- */
const OPTS = {
  merge:()=>`<p class="hint">Files are joined top to bottom in the order shown.</p>`,
  split:()=>`
    <div class="field"><span class="lbl">Split by</span><div class="seg">
      <label><input type="radio" name="sm" value="all" checked><span>Every page</span></label>
      <label><input type="radio" name="sm" value="ranges"><span>Ranges</span></label>
      <label><input type="radio" name="sm" value="every"><span>Every N</span></label></div></div>
    <div class="field" id="f-ranges" hidden><label for="o-ranges">Page ranges</label><input type="text" id="o-ranges" placeholder="1-3, 4-6, 7"><p class="hint">Each range becomes its own PDF.</p></div>
    <div class="field" id="f-every" hidden><label for="o-every">Pages per file</label><input type="number" id="o-every" min="1" value="2"></div>
    <p class="note">You'll get the files in one ZIP download.</p>`,
  remove:()=>`<p class="hint"><b id="selCount">0</b> pages selected for removal. Selected pages will be deleted; the rest are kept in order.</p>
    <div class="field"><label for="o-ranges">Or type pages to remove</label><input type="text" id="o-ranges" placeholder="e.g. 2, 5-7"></div>`,
  extract:()=>`<p class="hint"><b id="selCount">0</b> pages selected.</p>
    <div class="field"><label for="o-ranges">Or type pages to extract</label><input type="text" id="o-ranges" placeholder="e.g. 1-3, 8"></div>
    <div class="field"><span class="lbl">Save as</span><div class="seg">
      <label><input type="radio" name="xm" value="one" checked><span>One PDF</span></label>
      <label><input type="radio" name="xm" value="sep"><span>Separate PDFs</span></label></div></div>`,
  organize:()=>`<p class="hint">Drag pages into a new order, rotate them, or mark them for deletion. On a phone, use the arrow buttons under each page.</p>
    <button class="btn ghost" id="resetOrg" type="button">Reset changes</button>`,
  compress:()=>`
    <div class="field"><span class="lbl">Compression level</span><div class="seg" style="flex-direction:column">
      <label><input type="radio" name="cl" value="low"><span>Light · best quality</span></label>
      <label><input type="radio" name="cl" value="med" checked><span>Recommended · good balance</span></label>
      <label><input type="radio" name="cl" value="high"><span>Strong · smallest file</span></label></div></div>
    <p class="note">Pages are re-saved as optimized images. This works best on scans and photo-heavy files; text in the result can no longer be selected.</p>`,
  rotate:()=>`<span class="lbl">Rotate all pages</span>
    <div class="seg"><button class="btn ghost" type="button" data-rot="270">↺ Left</button><button class="btn ghost" type="button" data-rot="90">↻ Right</button><button class="btn ghost" type="button" data-rot="180">180°</button></div>
    <p class="hint">Or click single pages to turn them one at a time.</p>
    <button class="btn ghost" id="resetRot" type="button">Reset</button>`,
  crop:()=>`<p class="hint">Trim this much from each edge of every page (millimetres).</p>
    <div class="row2">
      <div class="field"><label for="o-t">Top</label><input type="number" id="o-t" min="0" value="10"></div>
      <div class="field"><label for="o-b">Bottom</label><input type="number" id="o-b" min="0" value="10"></div>
      <div class="field"><label for="o-l">Left</label><input type="number" id="o-l" min="0" value="10"></div>
      <div class="field"><label for="o-r">Right</label><input type="number" id="o-r" min="0" value="10"></div>
    </div>`,
  img2pdf:()=>`
    <div class="field"><label for="o-size">Page size</label><select id="o-size"><option value="fit">Same as image</option><option value="a4" selected>A4 (210 × 297 mm)</option><option value="letter">US Letter (8.5 × 11 in)</option></select></div>
    <div class="field"><span class="lbl">Orientation</span><div class="seg">
      <label><input type="radio" name="or" value="auto" checked><span>Auto</span></label>
      <label><input type="radio" name="or" value="p"><span>Portrait</span></label>
      <label><input type="radio" name="or" value="l"><span>Landscape</span></label></div></div>
    <div class="field"><label for="o-margin">Margin</label><select id="o-margin"><option value="0">None</option><option value="20" selected>Small</option><option value="50">Large</option></select></div>`,
  pdf2img:()=>`
    <div class="field"><span class="lbl">Format</span><div class="seg">
      <label><input type="radio" name="fmt" value="jpg" checked><span>JPG</span></label>
      <label><input type="radio" name="fmt" value="png"><span>PNG</span></label></div></div>
    <div class="field"><label for="o-dpi">Image quality</label><select id="o-dpi"><option value="1.39">Normal (100 DPI)</option><option value="2.08" selected>High (150 DPI)</option><option value="4.17">Print (300 DPI)</option></select></div>`,
  ocr:()=>`
    <div class="field"><label for="o-lang">Language of the document</label><select id="o-lang">
      <option value="eng" selected>English</option><option value="hin">Hindi</option><option value="guj">Gujarati</option><option value="mar">Marathi</option>
      <option value="spa">Spanish</option><option value="fra">French</option><option value="deu">German</option><option value="por">Portuguese</option><option value="ita">Italian</option></select></div>
    <p class="note">Adds a hidden text layer so you can search and copy text in scanned pages. The pages look exactly the same. For Hindi, Gujarati and Marathi you get the text as a .txt file. The first run downloads the language data, which takes a little longer.</p>`,
  protect:()=>`
    <div class="field"><label for="o-pw">Password</label><input type="password" id="o-pw" autocomplete="new-password" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg)"></div>
    <div class="field"><label for="o-pw2">Repeat password</label><input type="password" id="o-pw2" autocomplete="new-password" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg)"></div>
    <div class="field"><span class="lbl">People who open it may</span>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="o-print" checked> Print</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="o-copy" checked> Copy text</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="o-edit"> Edit and add comments</label></div>
    <p class="note">Keep your password safe. If you forget it, the file can't be opened, and we can't recover it.</p>`,
  unlock:()=>`
    <div class="field" id="pwField"><label for="o-upw">Current password</label><input type="password" id="o-upw" autocomplete="current-password" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg)"></div>
    <p class="hint">You need to know the password to unlock a file that asks for one. Files that only block printing or copying unlock without a password.</p>`,
  html2pdf:()=>`
    <div class="field"><label for="o-size">Page size</label><select id="o-size"><option value="a4" selected>A4</option><option value="letter">US Letter</option></select></div>
    <div class="field"><span class="lbl">Orientation</span><div class="seg">
      <label><input type="radio" name="or" value="p" checked><span>Portrait</span></label>
      <label><input type="radio" name="or" value="l"><span>Landscape</span></label></div></div>
    <div class="field"><label for="o-margin">Margin</label><select id="o-margin"><option value="0">None</option><option value="28" selected>Normal</option><option value="56">Wide</option></select></div>
    <p class="note">Pages are saved as high-quality images of your HTML, so text in the PDF can't be selected.</p>`,
  word2pdf:()=>`<p class="hint">Works with DOC, DOCX, ODT, RTF and TXT files. Fonts, tables, images and page layout are kept.</p>`,
  ppt2pdf:()=>`<p class="hint">Each slide becomes one PDF page. Animations, videos and speaker notes aren't included.</p>`,
  excel2pdf:()=>`<label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" id="o-fit" checked style="margin-top:4px"> <span><b>Fit each sheet on one page</b><br><span class="hint">Turn off to use the page breaks set in your spreadsheet.</span></span></label>`,
  pdf2word:()=>`<p class="hint">Text, tables, images and layout are kept so you can edit the file in Word.</p><p class="note">Scanned PDFs come out as pictures. Run OCR PDF on them first to get editable text.</p>`,
  pdf2ppt:()=>`<div class="field"><span class="lbl">Slides</span><div class="seg" style="flex-direction:column">
      <label><input type="radio" name="pm" value="image" checked><span>Exact look · each page as a picture</span></label>
      <label><input type="radio" name="pm" value="edit"><span>Editable text · layout may shift</span></label></div></div>`,
  pdf2excel:()=>`<div class="field"><span class="lbl">Put tables in</span><div class="seg">
      <label><input type="radio" name="xl" value="pages" checked><span>One sheet per page</span></label>
      <label><input type="radio" name="xl" value="single"><span>One sheet</span></label></div></div>
    <p class="note">Works best with PDFs made on a computer, such as bank statements, invoices and reports. For scans, run OCR PDF first.</p>`,
  pdfa:()=>`<div class="field"><label for="o-level">PDF/A version</label><select id="o-level">
      <option value="1">PDF/A-1b (oldest, most compatible)</option><option value="2" selected>PDF/A-2b (recommended)</option><option value="3">PDF/A-3b</option></select></div>
    <p class="hint">PDF/A is the long-term archive format many courts, government portals and e-filing systems ask for.</p>`,
  repair:()=>`<p class="hint">Rebuilds the inside of a damaged PDF so it opens again. Very badly damaged files may lose some pages.</p>`,
  text:()=>`<p class="hint">Extracts the text layer. Scanned pages that are only pictures contain no text to extract.</p>`,
  numbers:()=>`
    <div class="field"><label for="o-pos">Position</label><select id="o-pos">
      <option value="bc" selected>Bottom center</option><option value="br">Bottom right</option><option value="bl">Bottom left</option>
      <option value="tc">Top center</option><option value="tr">Top right</option><option value="tl">Top left</option></select></div>
    <div class="field"><label for="o-fmtn">Format</label><select id="o-fmtn">
      <option value="{n}">1</option><option value="Page {n}">Page 1</option><option value="Page {n} of {t}" selected>Page 1 of 10</option><option value="{n} / {t}">1 / 10</option></select></div>
    <div class="row2">
      <div class="field"><label for="o-first">Start on page</label><input type="number" id="o-first" min="1" value="1"></div>
      <div class="field"><label for="o-start">First number</label><input type="number" id="o-start" min="0" value="1"></div>
      <div class="field"><label for="o-fs">Font size (pt)</label><input type="number" id="o-fs" min="6" max="48" value="11"></div>
      <div class="field"><label for="o-col">Color</label><input type="color" id="o-col" value="#333333" style="height:42px;width:100%;border:1px solid var(--line);border-radius:8px;background:var(--bg)"></div>
    </div>`,
  watermark:()=>`
    <div class="field"><label for="o-wt">Text</label><input type="text" id="o-wt" value="CONFIDENTIAL" maxlength="60"></div>
    <div class="row2">
      <div class="field"><label for="o-ws">Size (pt)</label><input type="number" id="o-ws" min="8" max="200" value="64"></div>
      <div class="field"><label for="o-wc">Color</label><input type="color" id="o-wc" value="#d63a2f" style="height:42px;width:100%;border:1px solid var(--line);border-radius:8px;background:var(--bg)"></div>
    </div>
    <div class="field"><label for="o-wo">Opacity <span id="wov">25%</span></label><input type="range" id="o-wo" min="5" max="100" value="25"></div>
    <div class="field"><span class="lbl">Angle</span><div class="seg">
      <label><input type="radio" name="wa" value="45" checked><span>Diagonal</span></label>
      <label><input type="radio" name="wa" value="0"><span>Horizontal</span></label></div></div>`,
  sign:()=>`
    <div class="field"><span class="lbl">Draw your signature</span><canvas class="sigpad" id="sigpad"></canvas>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" type="button" id="sigClear">Clear</button>
      <label class="btn ghost">Upload image<input type="file" id="sigUp" accept="image/png,image/jpeg" hidden></label></div></div>
    <div class="field"><label for="o-sw">Signature width <span id="swv">30%</span> of page</label><input type="range" id="o-sw" min="10" max="70" value="30"></div>
    <p class="hint">Pick a page, then click on its large preview where the signature should go. You can sign several pages: placements are kept per page.</p>`,
};
const ACTION = {merge:"Merge PDFs",split:"Split PDF",remove:"Remove pages",extract:"Extract pages",organize:"Save new PDF",compress:"Compress PDF",rotate:"Save rotated PDF",crop:"Crop PDF",img2pdf:"Convert to PDF",pdf2img:"Convert to images",text:"Extract text",numbers:"Add page numbers",watermark:"Add watermark",sign:"Save signed PDF",ocr:"Run OCR",protect:"Protect PDF",unlock:"Unlock PDF",html2pdf:"Convert to PDF",word2pdf:"Convert to PDF",excel2pdf:"Convert to PDF",ppt2pdf:"Convert to PDF",pdf2word:"Convert to Word",pdf2excel:"Convert to Excel",pdf2ppt:"Convert to PowerPoint",pdfa:"Convert to PDF/A",repair:"Repair PDF"};

function buildSide(){
  const t=S.t, side=$("#side");
  side.innerHTML = `<h3>Settings</h3>${OPTS[t.id]()}
    <p class="err" id="runErr" hidden></p>
    <div id="progWrap" hidden><div class="prog"><i id="prog"></i></div><p class="hint" id="progTxt" style="margin-top:6px">Working…</p></div>
    <button class="btn big tool-c" id="runBtn" type="button">${ACTION[t.id]}</button>
    <div id="resultBox"></div>
    <button class="btn ghost" type="button" id="restart">Start over with another file</button>`;
  if(t.kind==="server") $("#restart").hidden=true;
  $("#runBtn").addEventListener("click", run);
  $("#restart").addEventListener("click", ()=>route());
  side.addEventListener("input", clearResult);
  side.addEventListener("change", e=>{
    if(e.target.name==="sm"){ $("#f-ranges").hidden=e.target.value!=="ranges"; $("#f-every").hidden=e.target.value!=="every"; }
  });
  if(t.id==="rotate"){
    $$("[data-rot]",side).forEach(b=>b.addEventListener("click",()=>{ S.pages.forEach(p=>{p.rot=(p.rot+ +b.dataset.rot)%360; applyRot(p)}); clearResult(); }));
    $("#resetRot").addEventListener("click",()=>{ S.pages.forEach(p=>{p.rot=0;applyRot(p)}); clearResult(); });
  }
  if(t.id==="organize") $("#resetOrg").addEventListener("click",()=>{ S.pages.sort((a,b)=>a.i-b.i).forEach(p=>{p.rot=0;p.del=false;p.el.classList.remove("x");applyRot(p);$("#pages").appendChild(p.el)}); clearResult(); });
  if(t.id==="watermark") $("#o-wo").addEventListener("input",e=>$("#wov").textContent=e.target.value+"%");
  if(t.id==="sign") setupSign();
}

/* ---------- signature ---------- */
function setupSign(){
  S.sig=null; S.place={};
  const c=$("#sigpad"), ctx=c.getContext("2d");
  const fit=()=>{ const r=c.getBoundingClientRect(); c.width=r.width*2; c.height=r.height*2; ctx.lineWidth=5; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#14204a"; };
  fit();
  let drawing=false, has=false, last=null;
  const pt=e=>{ const r=c.getBoundingClientRect(); return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]; };
  c.addEventListener("pointerdown",e=>{ drawing=true; last=pt(e); c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove",e=>{ if(!drawing) return; const p=pt(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last=p; has=true; });
  const end=()=>{ if(!drawing) return; drawing=false; if(has) setSig(trimCanvas(c)); };
  c.addEventListener("pointerup",end); c.addEventListener("pointercancel",end);
  $("#sigClear").addEventListener("click",()=>{ ctx.clearRect(0,0,c.width,c.height); has=false; S.sig=null; S.place={}; refreshPlacer(); });
  $("#sigUp").addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f) return; const img=new Image();
    img.onload=()=>{ const cv=document.createElement("canvas"); cv.width=img.naturalWidth; cv.height=img.naturalHeight; cv.getContext("2d").drawImage(img,0,0); setSig(cv); URL.revokeObjectURL(img.src); };
    img.src=URL.createObjectURL(f);
  });
  $("#o-sw").addEventListener("input",e=>{ $("#swv").textContent=e.target.value+"%"; refreshPlacer(); });
}
function trimCanvas(c){
  const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data; let x0=c.width,y0=c.height,x1=0,y1=0;
  for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){ if(d[(y*c.width+x)*4+3]>0){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
  const pad=6, w=Math.max(1,x1-x0+pad*2), h=Math.max(1,y1-y0+pad*2), o=document.createElement("canvas"); o.width=w; o.height=h;
  o.getContext("2d").drawImage(c,x0-pad,y0-pad,w,h,0,0,w,h); return o;
}
function setSig(cv){ S.sig={url:cv.toDataURL("image/png"), ar:cv.height/cv.width}; refreshPlacer(); clearResult(); }
async function showPlacer(p){
  const ex=$("#extra");
  ex.innerHTML=`<div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px"><div class="pane-head"><strong>Page ${p.i+1}</strong><span id="plHint">${S.sig?"Click to place your signature":"Draw your signature in the settings panel first"}</span></div><div class="center"><div class="placer" id="placer"></div></div>
    <div class="center" style="margin-top:10px"><button class="btn ghost" type="button" id="unplace">Remove signature from this page</button></div></div>`;
  const cv=await renderPage(S.doc,p.i+1,{width:Math.min(720,ex.clientWidth||600)}); cv.className="page";
  const pl=$("#placer"); pl.appendChild(cv);
  pl.addEventListener("click",e=>{
    if(!S.sig) return; const r=cv.getBoundingClientRect();
    S.place[p.i]={x:(e.clientX-r.left)/r.width, y:(e.clientY-r.top)/r.height}; refreshPlacer(); clearResult();
  });
  $("#unplace").addEventListener("click",()=>{ delete S.place[p.i]; refreshPlacer(); clearResult(); });
  S.cur=p.i; refreshPlacer();
  ex.scrollIntoView({behavior:"smooth",block:"start"});
}
function refreshPlacer(){
  const pl=$("#placer"); if(!pl) return; $("img",pl)?.remove();
  const h=$("#plHint"); if(h) h.textContent=S.sig?"Click to place your signature":"Draw your signature in the settings panel first";
  const pos=S.place[S.cur]; if(!S.sig||!pos) return;
  const w=+$("#o-sw").value/100, img=document.createElement("img"); img.src=S.sig.url; img.alt="Signature";
  img.style.width=(w*100)+"%"; img.style.left=`calc(${pos.x*100}% - ${w*50}%)`;
  const cv=$("canvas",pl); const hFrac=w*S.sig.ar*cv.width/cv.height;
  img.style.top=`calc(${pos.y*100}% - ${hFrac*50}%)`; pl.appendChild(img);
  S.pages.forEach(p=>p.el.classList.toggle("sel", p.i===S.cur || !!S.place[p.i]));
}

/* ---------- run ---------- */
function clearResult(){ const r=$("#resultBox"); if(r) r.innerHTML=""; const e=$("#runErr"); if(e) e.hidden=true; }
function progress(done,total,txt){ $("#progWrap").hidden=false; $("#prog").style.width=(100*done/total)+"%"; if(txt) $("#progTxt").textContent=txt; }
const radio = n => $(`input[name="${n}"]:checked`)?.value;
const num = (id,d) => { const v=parseFloat($("#"+id)?.value); return isNaN(v)? d : v; };

async function run(){
  if(S.busy) return;
  const btn=$("#runBtn"), err=$("#runErr"); clearResult();
  S.busy=true; btn.disabled=true; btn.textContent="Working…";
  try{
    const out = S.t.kind==="server" ? await serverConvert() : await RUN[S.t.id]();
    showResult(out);
  }catch(e){ if(!S) return; err.textContent=e.message || "Something went wrong while processing this file."; err.hidden=false; }
  finally{ if(!S) return; S.busy=false; S.xhr=null; btn.disabled=false; btn.textContent=ACTION[S.t.id]; $("#progWrap").hidden=true; $("#prog").parentElement.classList.remove("busy"); }
}
function showResult(res){
  const box=$("#resultBox");
  const items=res.files.map(f=>{ const u=URL.createObjectURL(f.blob); S.urls.push(u); return `<a class="dl" href="${u}" download="${esc(f.name)}">${svg("dl",18)}<span>${esc(f.name)}</span><small>${fmt(f.blob.size)}</small></a>`; });
  box.innerHTML = `<div class="result"><h4>${res.title||"Done! Your file is ready."}</h4>${res.note?`<p class="hint">${res.note}</p>`:""}
    ${res.text!=null?`<textarea class="out" readonly id="txtOut"></textarea><button class="btn ghost" type="button" id="copyTxt">Copy text</button>`:""}
    ${res.files.length>1?`<button class="btn" type="button" id="zipAll">${svg("dl",18)} Download all as ZIP</button>`:""}
    <div class="dlist">${items.join("")}</div></div>`;
  if(res.text!=null){ $("#txtOut").value=res.text; $("#copyTxt").addEventListener("click",async e=>{ try{ await navigator.clipboard.writeText(res.text); e.target.textContent="Copied"; }catch(_){ $("#txtOut").select(); e.target.textContent="Press Ctrl+C to copy"; } }); }
  if(res.files.length>1) $("#zipAll").addEventListener("click", async e=>{
    e.target.disabled=true; e.target.textContent="Building ZIP…";
    const zip=new JSZip(); res.files.forEach(f=>zip.file(f.name,f.blob));
    const blob=await zip.generateAsync({type:"blob"}); const u=URL.createObjectURL(blob); S.urls.push(u);
    const a=document.createElement("a"); a.href=u; a.download=(res.zipName||"pagecraft")+".zip"; document.body.appendChild(a); a.click(); a.remove();
    e.target.disabled=false; e.target.innerHTML=`${svg("dl",18)} Download all as ZIP`;
  });
  if(res.files.length===1) $(".dl",box).click();
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
}

const one = (bytes,name,extra={}) => ({files:[{blob:pdfBlob(bytes),name}], ...extra});
const src = () => S.files[0];
function pagesFromInput(max){ const v=$("#o-ranges")?.value.trim(); if(v){ return [...new Set(parseRanges(v,max).flat())].sort((a,b)=>a-b); } return S.pages.filter(p=>p.sel).map(p=>p.i).sort((a,b)=>a-b); }

const RUN = {
  async merge(){
    const good=S.files.filter(f=>!f.bad);
    if(good.length<2) throw new Error("Add at least two PDF files to merge.");
    const out=await PDFDocument.create();
    for(const [k,f] of good.entries()){
      progress(k,good.length,`Adding ${f.name}`);
      const d=await openPdfLib(f.bytes); (await out.copyPages(d,d.getPageIndices())).forEach(p=>out.addPage(p)); await tick();
    }
    return one(await out.save(),"merged.pdf",{title:`Merged ${good.length} files into one PDF.`});
  },
  async split(){
    const n=S.pages.length, mode=radio("sm"), b=baseName(src().name); let groups;
    if(mode==="all") groups=S.pages.map(p=>[p.i]);
    else if(mode==="ranges") groups=parseRanges($("#o-ranges").value,n);
    else { const k=Math.max(1,Math.floor(num("o-every",2))); groups=[]; for(let i=0;i<n;i+=k) groups.push(Array.from({length:Math.min(k,n-i)},(_,j)=>i+j)); }
    if(n===1 && mode==="all") throw new Error("This PDF has only one page, so there is nothing to split.");
    const files=[];
    for(const [k,g] of groups.entries()){
      progress(k,groups.length,`Creating file ${k+1} of ${groups.length}`);
      const label=g.length===1? `${g[0]+1}` : `${g[0]+1}-${g[g.length-1]+1}`;
      files.push({blob:pdfBlob(await copyInto(src().bytes,g.map(i=>({i})))), name:`${b}_p${label}.pdf`}); await tick();
    }
    return {files, zipName:b+"_split", title:`Split into ${files.length} files.`};
  },
  async remove(){
    const n=S.pages.length, rm=new Set(pagesFromInput(n));
    if(!rm.size) throw new Error("Select at least one page to remove.");
    if(rm.size>=n) throw new Error("You can't remove every page. Leave at least one.");
    const keep=S.pages.map(p=>p.i).filter(i=>!rm.has(i)).map(i=>({i}));
    return one(await copyInto(src().bytes,keep), baseName(src().name)+"_edited.pdf",{title:`Removed ${rm.size} page${rm.size>1?"s":""}. ${keep.length} left.`});
  },
  async extract(){
    const pick=pagesFromInput(S.pages.length), b=baseName(src().name);
    if(!pick.length) throw new Error("Select at least one page to extract.");
    if(radio("xm")==="sep"){
      const files=[]; for(const i of pick) files.push({blob:pdfBlob(await copyInto(src().bytes,[{i}])),name:`${b}_page${i+1}.pdf`});
      return {files, zipName:b+"_pages"};
    }
    return one(await copyInto(src().bytes,pick.map(i=>({i}))), `${b}_extract.pdf`,{title:`Extracted ${pick.length} page${pick.length>1?"s":""}.`});
  },
  async organize(){
    const list=S.pages.filter(p=>!p.del).map(p=>({i:p.i,rot:p.rot}));
    if(!list.length) throw new Error("Every page is marked for deletion. Keep at least one.");
    return one(await copyInto(src().bytes,list), baseName(src().name)+"_organized.pdf");
  },
  async rotate(){
    if(S.pages.every(p=>!p.rot)) throw new Error("No pages are rotated yet. Click a page or use the buttons above.");
    return one(await copyInto(src().bytes,S.pages.map(p=>({i:p.i,rot:p.rot}))), baseName(src().name)+"_rotated.pdf");
  },
  async compress(){
    const L={low:[1.7,.78],med:[1.3,.62],high:[1,.45]}[radio("cl")];
    const out=await PDFDocument.create(), n=S.doc.numPages;
    for(let i=1;i<=n;i++){
      progress(i-1,n,`Compressing page ${i} of ${n}`);
      const page=await S.doc.getPage(i), vp=page.getViewport({scale:1,rotation:page.rotate});
      const c=await renderPage(S.doc,i,{scale:L[0]});
      const img=await out.embedJpg(await canvasBytes(c,"image/jpeg",L[1]));
      out.addPage([vp.width,vp.height]).drawImage(img,{x:0,y:0,width:vp.width,height:vp.height});
      c.width=c.height=0;
    }
    const bytes=await out.save(), before=src().size, after=bytes.length;
    if(after>=before) return {files:[{blob:new Blob([src().bytes],{type:"application/pdf"}),name:src().name}], title:"This PDF is already well optimized.", note:`Compressing would make it larger (${fmt(after)}), so we kept your original at ${fmt(before)}. Try the Strong level for a smaller result.`};
    return one(bytes, baseName(src().name)+"_compressed.pdf",{title:`Reduced by ${Math.round(100-100*after/before)}%`, note:`${fmt(before)} → ${fmt(after)}`});
  },
  async crop(){
    const t=mm(num("o-t",0)),b=mm(num("o-b",0)),l=mm(num("o-l",0)),r=mm(num("o-r",0));
    if(t+b+l+r<=0) throw new Error("Enter a margin larger than 0 for at least one edge.");
    const d=await openPdfLib(src().bytes);
    for(const p of d.getPages()){
      const c=p.getCropBox(); const w=c.width-l-r, h=c.height-t-b;
      if(w<20||h<20) throw new Error("Those margins are larger than the page. Use smaller values.");
      p.setCropBox(c.x+l,c.y+b,w,h); p.setMediaBox(c.x+l,c.y+b,w,h);
    }
    return one(await d.save(), baseName(src().name)+"_cropped.pdf");
  },
  async img2pdf(){
    if(!S.files.length) throw new Error("Add at least one image.");
    const out=await PDFDocument.create(), size=$("#o-size").value, orient=radio("or"), margin=+$("#o-margin").value;
    for(const [k,f] of S.files.entries()){
      progress(k,S.files.length,`Adding image ${k+1} of ${S.files.length}`);
      const bmp=await createImageBitmap(f.file).catch(()=>{ throw new Error(`"${f.name}" couldn't be opened as an image.`); });
      const c=document.createElement("canvas"); c.width=bmp.width; c.height=bmp.height;
      const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(bmp,0,0);
      const img=await out.embedJpg(await canvasBytes(c,"image/jpeg",.92));
      let pw,ph;
      if(size==="fit"){ pw=bmp.width*.75+margin*2; ph=bmp.height*.75+margin*2; }
      else { [pw,ph]= size==="a4"?[595.28,841.89]:[612,792]; const land = orient==="l" || (orient==="auto" && bmp.width>bmp.height); if(land) [pw,ph]=[ph,pw]; }
      const aw=pw-margin*2, ah=ph-margin*2, s=Math.min(aw/bmp.width, ah/bmp.height);
      const w=bmp.width*s, h=bmp.height*s;
      out.addPage([pw,ph]).drawImage(img,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
      bmp.close(); await tick();
    }
    return one(await out.save(), S.files.length===1? baseName(S.files[0].name)+".pdf" : "images.pdf", {title:`Created a ${S.files.length}-page PDF.`});
  },
  async pdf2img(){
    const png=radio("fmt")==="png", sc=+$("#o-dpi").value, n=S.doc.numPages, b=baseName(src().name), files=[];
    for(let i=1;i<=n;i++){
      progress(i-1,n,`Converting page ${i} of ${n}`);
      const c=await renderPage(S.doc,i,{scale:sc});
      files.push({blob:new Blob([await canvasBytes(c,png?"image/png":"image/jpeg",.92)],{type:png?"image/png":"image/jpeg"}), name:`${b}_page${String(i).padStart(String(n).length,"0")}.${png?"png":"jpg"}`});
      c.width=c.height=0;
    }
    return {files, zipName:b+"_images", title:`Converted ${n} page${n>1?"s":""} to images.`};
  },
  async text(){
    const n=S.doc.numPages; let all="";
    for(let i=1;i<=n;i++){
      progress(i-1,n,`Reading page ${i} of ${n}`);
      const pg=await S.doc.getPage(i), tc=await pg.getTextContent(); let s="";
      for(const it of tc.items){ s+=it.str; if(it.hasEOL) s+="\n"; }
      all+=(n>1?`--- Page ${i} ---\n`:"")+s.trim()+"\n\n";
    }
    all=all.trim();
    if(!all.replace(/--- Page \d+ ---/g,"").trim()) throw new Error("No text was found. This PDF is probably a scan made of images.");
    return {files:[{blob:new Blob([all],{type:"text/plain;charset=utf-8"}),name:baseName(src().name)+".txt"}], text:all, title:"Text extracted."};
  },
  async numbers(){
    const d=await openPdfLib(src().bytes), font=await d.embedFont(StandardFonts.Helvetica);
    const pages=d.getPages(), pos=$("#o-pos").value, f=$("#o-fmtn").value, fs=num("o-fs",11), col=hexRgb($("#o-col").value);
    const first=Math.max(1,Math.floor(num("o-first",1))), start=Math.floor(num("o-start",1));
    if(first>pages.length) throw new Error(`This PDF has ${pages.length} pages. Choose a start page within that.`);
    const total=pages.length-first+start, m=28;
    pages.forEach((p,k)=>{
      if(k+1<first) return;
      const txt=f.replace("{n}",k+1-first+start).replace("{t}",total), tw=font.widthOfTextAtSize(txt,fs), b=p.getCropBox();
      const x = pos[1]==="l"? b.x+m : pos[1]==="r"? b.x+b.width-m-tw : b.x+(b.width-tw)/2;
      const y = pos[0]==="b"? b.y+m-fs/2 : b.y+b.height-m-fs/2;
      p.drawText(txt,{x,y,size:fs,font,color:col});
    });
    return one(await d.save(), baseName(src().name)+"_numbered.pdf");
  },
  async watermark(){
    const txt=$("#o-wt").value.trim(); if(!txt) throw new Error("Type the watermark text first.");
    const d=await openPdfLib(src().bytes), font=await d.embedFont(StandardFonts.HelveticaBold);
    const size=num("o-ws",64), op=num("o-wo",25)/100, col=hexRgb($("#o-wc").value), ang=+radio("wa"), a=ang*Math.PI/180;
    for(const p of d.getPages()){
      const b=p.getCropBox(); let s=size, tw=font.widthOfTextAtSize(txt,s);
      const maxW=(ang? Math.hypot(b.width,b.height) : b.width)*.85; if(tw>maxW){ s=s*maxW/tw; tw=maxW; }
      const cx=b.x+b.width/2, cy=b.y+b.height/2, hgt=s*.35;
      p.drawText(txt,{x:cx-(tw/2)*Math.cos(a)+hgt*Math.sin(a), y:cy-(tw/2)*Math.sin(a)-hgt*Math.cos(a), size:s, font, color:col, opacity:op, rotate:degrees(ang)});
    }
    return one(await d.save(), baseName(src().name)+"_watermarked.pdf");
  },
  async ocr(){
    const lang=$("#o-lang").value, latin=!["hin","guj","mar"].includes(lang), n=S.doc.numPages;
    progress(0,1,"Loading the OCR engine…");
    await loadScript(TESS_URL);
    let cur=0;
    const failMsg="The OCR language data couldn't be downloaded. Check your internet connection and try again.";
    const worker=await Promise.race([
      Tesseract.createWorker(lang,1,{errorHandler:()=>{}, logger:m=>{ if(m.status==="recognizing text") progress(cur+m.progress,n,`Reading page ${cur+1} of ${n}`); else if(/load/i.test(m.status)) progress(0,1,"Downloading language data…"); }}),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error(failMsg)),120000))
    ]).catch(()=>{ throw new Error(failMsg); });
    const d=await openPdfLib(src().bytes), font=await d.embedFont(StandardFonts.Helvetica), pages=d.getPages();
    let all="", words=0;
    try{
      for(cur=0;cur<n;cur++){
        const pg=await S.doc.getPage(cur+1), sc=2.5, vp=pg.getViewport({scale:sc, rotation:pg.rotate});
        const c=await renderPage(S.doc,cur+1,{scale:sc});
        const {data}=await worker.recognize(c);
        all+=(n>1?`--- Page ${cur+1} ---\n`:"")+data.text.trim()+"\n\n";
        if(latin && pg.rotate===0){
          for(const w of data.words||[]){
            const t=w.text.trim(); if(!t || w.confidence<35) continue;
            const [ax,ay]=vp.convertToPdfPoint(w.bbox.x0,w.bbox.y1), [bx,by]=vp.convertToPdfPoint(w.bbox.x1,w.bbox.y0);
            const x=Math.min(ax,bx), y=Math.min(ay,by), wd=Math.abs(bx-ax), ht=Math.abs(by-ay);
            try{ const u=font.widthOfTextAtSize(t,1); if(!u) continue; const size=Math.min(wd/u, ht*1.6);
              pages[cur].drawText(t,{x, y:y+ht*.15, size, font, opacity:0}); words++; }catch(_){}
          }
        }
        c.width=c.height=0;
      }
    } finally { await worker.terminate(); }
    all=all.trim(); const b=baseName(src().name);
    const files=[{blob:new Blob([all],{type:"text/plain;charset=utf-8"}),name:b+"_ocr.txt"}];
    if(latin && words) files.unshift({blob:pdfBlob(await d.save()),name:b+"_searchable.pdf"});
    if(!all.replace(/--- Page \d+ ---/g,"").trim()) throw new Error("No text was recognized. Check the language setting, or try a clearer scan.");
    return {files, zipName:b+"_ocr", title: latin? `Recognized ${words.toLocaleString()} words.` : "Text recognized.", note: latin? "The PDF now has searchable, copyable text." : "Your text is ready to download."};
  },
  async protect(){
    const pw=$("#o-pw").value; if(pw.length<4) throw new Error("Use a password with at least 4 characters.");
    if(pw!==$("#o-pw2").value) throw new Error("The two passwords don't match. Type them again.");
    const d=await openPdfLib(src().bytes), edit=$("#o-edit").checked;
    const owner=Array.from(crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,"0")).join("");
    d.encrypt({userPassword:pw, ownerPassword:owner, permissions:{
      printing:$("#o-print").checked?"highResolution":false, copying:$("#o-copy").checked, modifying:edit, annotating:edit,
      fillingForms:true, contentAccessibility:true, documentAssembly:edit }});
    return one(await d.save(), baseName(src().name)+"_protected.pdf",{title:"Your PDF is password-protected.", note:"Anyone opening it will be asked for the password."});
  },
  async unlock(){
    const f=src();
    if(f.locked===0) throw new Error("This PDF isn't protected, so there is nothing to unlock.");
    let d;
    try{ d=await PDFDocument.load(f.bytes,{password: f.locked===1? "" : $("#o-upw").value}); }
    catch(e){ throw new Error(/password/i.test(e.message)? "That password is incorrect. Check it and try again." : "This file couldn't be unlocked. It may use an encryption type we don't support."); }
    return one(await d.save(), baseName(f.name)+"_unlocked.pdf",{title:"Password and restrictions removed."});
  },
  async html2pdf(){
    const html=$("#htmlSrc").value.trim(); if(!html) throw new Error("Paste some HTML code or load an .html file first.");
    progress(0,1,"Preparing…"); await loadScript(H2C_URL);
    let [pw,ph]= $("#o-size").value==="a4"?[595.28,841.89]:[612,792]; if(radio("or")==="l") [pw,ph]=[ph,pw];
    const m=+$("#o-margin").value, cwPx=Math.round((pw-2*m)/.75);
    const fr=document.createElement("iframe"); fr.setAttribute("sandbox","allow-same-origin");
    fr.style.cssText=`position:fixed;left:-20000px;top:0;width:${cwPx}px;height:200px;border:0;background:#fff`;
    document.body.appendChild(fr);
    try{
      await new Promise(r=>{ fr.onload=r; fr.srcdoc=html; });
      const doc=fr.contentDocument;
      await Promise.race([Promise.all([...doc.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}))), new Promise(r=>setTimeout(r,6000))]);
      try{ await doc.fonts.ready; }catch(_){}
      const H=Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight||0); fr.style.height=H+"px";
      progress(.3,1,"Rendering…");
      const scale=2;
      const full=await html2canvas(doc.documentElement,{scale, useCORS:true, backgroundColor:"#ffffff", width:cwPx, height:H, windowWidth:cwPx, windowHeight:H, logging:false});
      const out=await PDFDocument.create(), sliceH=Math.floor((ph-2*m)/.75*scale), n=Math.ceil(full.height/sliceH);
      for(let k=0;k<n;k++){
        progress(.3+.7*k/n,1,`Building page ${k+1} of ${n}`);
        const h=Math.min(sliceH, full.height-k*sliceH), c=document.createElement("canvas"); c.width=full.width; c.height=h;
        const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,h); x.drawImage(full,0,k*sliceH,full.width,h,0,0,full.width,h);
        const img=await out.embedJpg(await canvasBytes(c,"image/jpeg",.92)), dw=pw-2*m, dh=h/scale*.75;
        out.addPage([pw,ph]).drawImage(img,{x:m, y:ph-m-dh, width:dw, height:dh});
      }
      return one(await out.save(), (S.htmlName||"document")+".pdf",{title:`Created a ${n}-page PDF.`});
    } finally { fr.remove(); }
  },
  async sign(){
    if(!S.sig) throw new Error("Draw or upload your signature first.");
    const idx=Object.keys(S.place).map(Number); if(!idx.length) throw new Error("Choose a page and click on its preview to place your signature.");
    const d=await openPdfLib(src().bytes), png=await d.embedPng(S.sig.url), w=+$("#o-sw").value/100, pages=d.getPages();
    for(const i of idx){
      const p=pages[i], b=p.getCropBox(), pos=S.place[i], iw=b.width*w, ih=iw*S.sig.ar;
      p.drawImage(png,{x:b.x+pos.x*b.width-iw/2, y:b.y+b.height-pos.y*b.height-ih/2, width:iw, height:ih});
    }
    return one(await d.save(), baseName(src().name)+"_signed.pdf",{title:`Signed ${idx.length} page${idx.length>1?"s":""}.`});
  },
};

route();
