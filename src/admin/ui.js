// Helper tampilan kecil yang dipakai semua halaman admin.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const rupiah = (n) => (n === null || n === undefined || n === "" ? "–" : "Rp" + Math.round(n).toLocaleString("id-ID"));

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Angka dari input / sel Excel: terima "185.000", "Rp 185,000", 185000.
export function toInt(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).replace(/rp/i, "").replace(/[.,\s]/g, "").trim();
  if (s === "") return null;
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : NaN;
}

let toastTimer;
export function toast(msg, type = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), type === "error" ? 6000 : 2500);
}

// Modal sederhana. Mengembalikan elemen body modal; close() menutup.
export function openModal(title, html, { wide = false } = {}) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Tutup">×</button></div>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";
  const close = () => {
    ov.remove();
    if (!$(".overlay")) document.body.style.overflow = "";
  };
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest("[data-close]")) close();
  });
  return { el: $(".modal-body", ov), close };
}

export function confirmDialog(message, okLabel = "Ya") {
  return new Promise((resolve) => {
    const m = openModal("Konfirmasi", `<p>${esc(message)}</p>
      <div class="actions"><button class="btn" data-close>Batal</button><button class="btn danger" id="cfOk">${esc(okLabel)}</button></div>`);
    $("#cfOk", m.el).addEventListener("click", () => {
      m.close();
      resolve(true);
    });
    m.el.closest(".overlay").addEventListener("click", (e) => {
      if (e.target.closest("[data-close]") || e.target.classList.contains("overlay")) resolve(false);
    });
  });
}

// Tombol jadi "Menyimpan..." selama proses async. Error diteruskan ke pemanggil.
export async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Menyimpan…";
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// Kecilkan foto dari HP (bisa 5–10 MB) jadi JPEG maks 1200px sebelum diunggah.
export async function resizeImage(file, max = 1200) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}
