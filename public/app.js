import { buildPdf } from "./pdf.js";

const $ = (id) => document.getElementById(id);
const grid = $("grid"), empty = $("empty"), status = $("status");
const exportBtn = $("exportBtn"), clearBtn = $("clearBtn"), count = $("count");

let items = [];
let nextId = 1;
let dragId = null;

const ic = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
function say(msg) { status.textContent = msg; }

function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ id: nextId++, blob, url, img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

async function addBlobs(blobs) {
  const imgs = blobs.filter((b) => b && b.type.startsWith("image/"));
  if (!imgs.length) { say("No se encontró ninguna imagen para añadir."); return; }
  let ok = 0;
  for (const b of imgs) {
    try { items.push({ ...(await loadImage(b)), fresh: true }); ok++; } catch { /* skip unreadable */ }
  }
  say(ok ? `${ok} ${ok > 1 ? "imágenes añadidas" : "imagen añadida"}. Total: ${items.length}.` : "No se pudo leer la imagen.");
  render();
}

function move(from, to) {
  if (to < 0 || to >= items.length || from === to) return;
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  render();
}

function render() {
  const prev = new Map([...grid.children].map((n) => [n.dataset.id, n.getBoundingClientRect()]));
  grid.textContent = "";
  items.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = "item" + (it.fresh ? " pop" : "");
    it.fresh = false;
    li.draggable = true;
    li.dataset.id = it.id;
    li.innerHTML = `<span class="num"></span><span class="grip" title="Arrastra para reordenar">${ic("M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01")}</span><div class="thumb"><img alt=""></div>
      <div class="acts"><button class="l" title="Mover antes" aria-label="Mover antes">${ic("m15 18-6-6 6-6")}</button>
      <button class="r" title="Mover después" aria-label="Mover después">${ic("m9 18 6-6-6-6")}</button>
      <button class="del" title="Eliminar" aria-label="Eliminar">${ic("M18 6 6 18M6 6l12 12")}</button></div>`;
    li.querySelector(".num").textContent = i + 1;
    const img = li.querySelector("img");
    img.src = it.url;
    img.alt = `Página ${i + 1}`;
    const l = li.querySelector(".l"), r = li.querySelector(".r");
    l.disabled = i === 0;
    r.disabled = i === items.length - 1;
    l.onclick = () => move(i, i - 1);
    r.onclick = () => move(i, i + 1);
    li.querySelector(".del").onclick = () => {
      URL.revokeObjectURL(it.url);
      items.splice(i, 1);
      say("Imagen eliminada.");
      render();
    };
    li.addEventListener("dragstart", (e) => {
      dragId = it.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(it.id));
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => {
      dragId = null;
      li.classList.remove("dragging");
      grid.querySelectorAll(".over").forEach((n) => n.classList.remove("over"));
    });
    li.addEventListener("dragover", (e) => {
      if (dragId === null) return;
      e.preventDefault();
      li.classList.add("over");
    });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", (e) => {
      if (dragId === null) return;
      e.preventDefault();
      e.stopPropagation();
      const from = items.findIndex((x) => x.id === dragId);
      move(from, i);
    });
    grid.appendChild(li);
  });
  const n = items.length;
  {
    for (const li of grid.children) {
      const a = prev.get(li.dataset.id);
      if (!a) continue;
      const b = li.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) li.animate(
        [{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }],
        { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    }
  }
  empty.hidden = n > 0;
  exportBtn.disabled = clearBtn.disabled = n === 0;
  count.textContent = n;
}

// Paste (Ctrl+V anywhere)
document.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files || [])];
  const fromItems = [...(e.clipboardData?.items || [])]
    .filter((x) => x.kind === "file").map((x) => x.getAsFile());
  const blobs = files.length ? files : fromItems;
  if (blobs.length) { e.preventDefault(); addBlobs(blobs); }
  else say("El portapapeles no contiene una imagen.");
});

// Paste button (Clipboard API)
function askCount(total) {
  const dlg = $("dlg"), n = $("dlgN");
  $("dlgMsg").textContent = `Se detectaron ${total} imágenes en el portapapeles.`;
  n.max = total; n.value = total;
  return new Promise((resolve) => {
    const done = (v) => { dlg.onclose = null; resolve(v); };
    dlg.onclose = () => done(dlg.returnValue === "ok" ? Math.min(total, Math.max(1, parseInt(n.value, 10) || 1)) : 0);
    $("dlgCancel").onclick = () => dlg.close("cancel");
    $("dlgForm").onsubmit = () => { dlg.returnValue = "ok"; };
    dlg.showModal();
    n.select();
  });
}

$("pasteBtn").onclick = async () => {
  if (!navigator.clipboard?.read) { say("Tu navegador no permite este botón; usa Ctrl+V."); return; }
  try {
    const blobs = [];
    for (const ci of await navigator.clipboard.read()) {
      const type = ci.types.find((t) => t.startsWith("image/"));
      if (type) blobs.push(await ci.getType(type));
    }
    if (!blobs.length) { say("El portapapeles no contiene imágenes."); return; }
    const n = blobs.length === 1 ? 1 : await askCount(blobs.length);
    if (n) await addBlobs(blobs.slice(-n));
  } catch { say("No hay permiso para leer el portapapeles. Usa Ctrl+V."); }
};

$("fileInput").onchange = (e) => { addBlobs([...e.target.files]); e.target.value = ""; };

// Drop files from the OS
const drop = $("drop");
let depth = 0;
const hasFiles = (e) => e.dataTransfer?.types?.includes("Files");
document.addEventListener("dragenter", (e) => { if (hasFiles(e)) { depth++; drop.hidden = false; } });
document.addEventListener("dragleave", (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; drop.hidden = true; } });
document.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  depth = 0; drop.hidden = true;
  addBlobs([...e.dataTransfer.files]);
});

clearBtn.onclick = () => {
  if (!confirm("¿Vaciar todas las imágenes?")) return;
  items.forEach((it) => URL.revokeObjectURL(it.url));
  items = [];
  say("Lista vaciada.");
  render();
};

const A4 = { w: 595.28, h: 841.89, m: 28 };
const MAX_PX = 4000;

async function toJpeg(it) {
  const s = Math.min(1, MAX_PX / Math.max(it.w, it.h));
  const w = Math.max(1, Math.round(it.w * s)), h = Math.max(1, Math.round(it.h * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(it.img, 0, 0, w, h);
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), imgW: w, imgH: h };
}

exportBtn.onclick = async () => {
  if (!items.length) return;
  exportBtn.disabled = true;
  say("Generando PDF…");
  try {
    const mode = $("pageMode").value;
    const pages = [];
    for (const it of items) {
      const j = await toJpeg(it);
      let p;
      if (mode === "a4") {
        const k = Math.min((A4.w - 2 * A4.m) / it.w, (A4.h - 2 * A4.m) / it.h);
        const w = it.w * k, h = it.h * k;
        p = { pageW: A4.w, pageH: A4.h, w, h, x: (A4.w - w) / 2, y: (A4.h - h) / 2 };
      } else {
        const k = Math.min(1, 14400 / Math.max(it.w, it.h) / 0.75) * 0.75; // px→pt, PDF max 14400pt
        p = { pageW: it.w * k, pageH: it.h * k, w: it.w * k, h: it.h * k, x: 0, y: 0 };
      }
      pages.push({ ...j, ...p });
    }
    const blob = buildPdf(pages);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `documento-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    say(`PDF exportado con ${pages.length} página${pages.length > 1 ? "s" : ""}.`);
  } catch (err) {
    say("Error al generar el PDF: " + err.message);
  } finally {
    exportBtn.disabled = items.length === 0;
  }
};

window.addEventListener("beforeunload", (e) => {
  if (items.length) { e.preventDefault(); e.returnValue = ""; }
});

render();
