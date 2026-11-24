import * as api from "@api";
import { state, reload, catName, go, currentPage } from "./main.js";
import { $, $$, esc, rupiah, toInt, toast, openModal, confirmDialog, busy, resizeImage } from "./ui.js";

const PRESETS = {
  Dewasa: ["S", "M", "L", "XL", "XXL", "3XL"],
  Anak: ["4", "6", "8", "10", "12", "14", "16"],
};

const filters = { q: "", cat: "", view: "aktif" };

// Muat ulang data, lalu gambar ulang hanya kalau admin masih di halaman Barang.
async function refresh(main) {
  await reload();
  if (main.isConnected && currentPage() === "barang") renderProducts(main);
}

const needsRestock = (v) => v.min_stock > 0 && v.stock - v.reserved <= v.min_stock;
const totalStock = (p) => p.variants.reduce((a, v) => a + v.stock, 0);

export function renderProducts(main) {
  const owner = state.isOwner;
  const active = state.products.filter((p) => p.active);
  const restockCount = active.filter((p) => p.variants.some(needsRestock)).length;
  const pcs = active.reduce((a, p) => a + totalStock(p), 0);
  const stockValue = active.reduce((a, p) => a + (p.cost_price || 0) * totalStock(p), 0);

  main.innerHTML = `
    <div class="stats">
      <div class="stat"><span>Artikel aktif</span><b>${active.length}</b></div>
      <div class="stat"><span>Total stok</span><b>${pcs.toLocaleString("id-ID")} pcs</b></div>
      <div class="stat ${restockCount ? "warn" : ""}"><span>Perlu restok</span><b>${restockCount}</b></div>
      ${owner ? `<div class="stat"><span>Nilai stok (modal)</span><b>${rupiah(stockValue)}</b></div>` : ""}
    </div>
    <div class="toolbar">
      <input type="search" id="pq" placeholder="Cari nama, kode, tim…" value="${esc(filters.q)}" />
      <select id="pcat"><option value="">Semua kategori</option>${state.categories
        .map((c) => `<option value="${c.id}" ${String(c.id) === filters.cat ? "selected" : ""}>${esc(c.name)}</option>`)
        .join("")}</select>
      <select id="pview">
        <option value="aktif">Aktif</option>
        <option value="restok">Perlu restok</option>
        <option value="arsip">Diarsipkan</option>
      </select>
      <button class="btn primary" id="addProduct">+ Barang</button>
    </div>
    <div id="plist" class="plist"></div>`;

  $("#pview").value = filters.view;
  $("#pq").addEventListener("input", (e) => ((filters.q = e.target.value), drawList()));
  $("#pcat").addEventListener("change", (e) => ((filters.cat = e.target.value), drawList()));
  $("#pview").addEventListener("change", (e) => ((filters.view = e.target.value), drawList()));
  $("#addProduct").addEventListener("click", () => openProductForm(null, main));
  $("#plist").addEventListener("click", (e) => onListClick(e, main));
  drawList();
}

function drawList() {
  const q = filters.q.trim().toLowerCase();
  const list = state.products.filter((p) => {
    if (filters.view === "arsip" ? p.active : !p.active) return false;
    if (filters.view === "restok" && !p.variants.some(needsRestock)) return false;
    if (filters.cat && String(p.category_id) !== filters.cat) return false;
    if (q && ![p.name, p.code, p.team].some((x) => x && x.toLowerCase().includes(q))) return false;
    return true;
  });
  const el = $("#plist");
  if (!list.length) {
    el.innerHTML = `<p class="empty">${state.products.length ? "Tidak ada barang yang cocok." : "Belum ada barang. Klik <b>+ Barang</b> atau pakai <b>Impor Excel</b>."}</p>`;
    return;
  }
  el.innerHTML = list.map(productCard).join("");
}

function productCard(p) {
  const url = api.photoUrl(p.photo_path);
  const chips = p.variants.length
    ? p.variants
        .map((v) => {
          const cls = v.stock === 0 ? "zero" : needsRestock(v) ? "low" : "";
          return `<span class="chip ${cls}" title="Min ${v.min_stock}${v.reserved ? `, dipesan ${v.reserved}` : ""}">${esc(v.size)} <b>${v.stock}</b></span>`;
        })
        .join("")
    : `<span class="muted">Belum ada ukuran</span>`;
  return `<article class="pcard" data-id="${p.id}">
    <div class="thumb">${url ? `<img src="${esc(url)}" alt="" loading="lazy" />` : `<span>Tanpa foto</span>`}</div>
    <div class="pinfo">
      <h4>${esc(p.name)}</h4>
      <div class="muted">${[p.code, p.team, catName(p.category_id)].filter(Boolean).map(esc).join(" · ")}</div>
      <div class="prices">
        <span>Eceran <b>${rupiah(p.retail_price)}</b></span>
        <span>Grosir <b>${rupiah(p.wholesale_price)}</b></span>
        <span>Partai <b>${rupiah(p.bulk_price)}</b></span>
        ${state.isOwner ? `<span class="cost">Modal <b>${rupiah(p.cost_price)}</b></span>` : ""}
      </div>
      <div class="chips">${chips}<span class="muted total">Total ${totalStock(p)}</span></div>
    </div>
    <div class="pactions">
      <button class="btn small" data-act="edit">Edit</button>
      <button class="btn small" data-act="stock">Stok</button>
      ${p.active
        ? `<button class="btn small ghost" data-act="archive">Arsipkan</button>`
        : `<button class="btn small ghost" data-act="unarchive">Aktifkan</button>
           ${state.isOwner ? `<button class="btn small danger" data-act="delete">Hapus</button>` : ""}`}
    </div>
  </article>`;
}

async function onListClick(e, main) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const p = state.products.find((x) => x.id === btn.closest(".pcard").dataset.id);
  const act = btn.dataset.act;
  try {
    if (act === "edit") return openProductForm(p, main);
    if (act === "stock") {
      state.stockProductId = p.id;
      return go("stok");
    }
    let msg;
    if (act === "archive" || act === "unarchive") {
      await api.setProductActive(p.id, act === "unarchive");
      msg = act === "archive" ? "Barang diarsipkan (tidak tampil ke pelanggan)" : "Barang diaktifkan lagi";
    }
    if (act === "delete") {
      if (!(await confirmDialog(`Hapus permanen "${p.name}" beserta riwayat stoknya?`, "Hapus"))) return;
      await api.deleteProduct(p.id);
      await api.removePhoto(p.photo_path).catch(() => {});
      msg = "Barang dihapus";
    }
    await refresh(main);
    toast(msg);
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------- Form tambah / edit ----------
function openProductForm(p, main) {
  const isNew = !p;
  const owner = state.isOwner;
  const m = openModal(isNew ? "Tambah Barang" : "Edit Barang", `
    <form id="pform" novalidate>
      <div class="photo-row">
        <div class="photo-preview" id="photoPreview">${p?.photo_path ? `<img src="${esc(api.photoUrl(p.photo_path))}" alt="" />` : "<span>Belum ada foto</span>"}</div>
        <div>
          <label class="btn small">Pilih foto<input type="file" id="photoInput" accept="image/*" hidden /></label>
          ${p?.photo_path ? `<button type="button" class="btn small ghost" id="photoRemove">Hapus foto</button>` : ""}
          <p class="hint">Foto otomatis dikecilkan sebelum diunggah.</p>
        </div>
      </div>
      <div class="grid2">
        <label>Nama barang *<input name="name" required value="${esc(p?.name)}" /></label>
        <label>Kode artikel<input name="code" value="${esc(p?.code)}" placeholder="cth: NRL-BRO-25" /></label>
        <label>Model / tim<input name="team" value="${esc(p?.team)}" /></label>
        <label>Kategori<select name="category_id"><option value="">— pilih —</option>${state.categories
          .filter((c) => c.active || c.id === p?.category_id)
          .map((c) => `<option value="${c.id}" ${c.id === p?.category_id ? "selected" : ""}>${esc(c.name)}</option>`)
          .join("")}</select></label>
      </div>
      <label>Deskripsi<textarea name="description" rows="2">${esc(p?.description)}</textarea></label>
      <h4>Harga</h4>
      <div class="grid4">
        ${owner ? `<label>Modal<input name="cost_price" inputmode="numeric" value="${p?.cost_price ?? ""}" /></label>` : ""}
        <label>Eceran *<input name="retail_price" inputmode="numeric" value="${p?.retail_price ?? ""}" /></label>
        <label>Grosir<input name="wholesale_price" inputmode="numeric" value="${p?.wholesale_price ?? ""}" /></label>
        <label>Partai<input name="bulk_price" inputmode="numeric" value="${p?.bulk_price ?? ""}" /></label>
      </div>
      <h4>Ukuran & stok</h4>
      <p class="hint">${isNew ? "Isi stok awal per ukuran." : "Stok diubah lewat menu <b>Stok</b> (stok masuk / koreksi) supaya tercatat di riwayat. Ukuran baru boleh diisi stok awal."}
      Stok minimal = batas peringatan restok.</p>
      <div class="preset">Tambah cepat: ${Object.keys(PRESETS).map((k) => `<button type="button" class="btn small ghost" data-preset="${k}">${k}</button>`).join("")}</div>
      <table class="sizes-table"><thead><tr><th>Ukuran</th><th>Stok min.</th><th>Stok</th><th></th></tr></thead><tbody id="sizeRows"></tbody></table>
      <button type="button" class="btn small" id="addSize">+ Ukuran</button>
      <p class="error-box" id="pformErr" hidden></p>
      <div class="actions"><button type="button" class="btn" data-close>Batal</button><button class="btn primary" type="submit">Simpan</button></div>
    </form>`, { wide: true });

  const rows = $("#sizeRows", m.el);
  const addRow = (v = {}) => {
    const existing = Boolean(v.id);
    const tr = document.createElement("tr");
    if (existing) tr.dataset.existing = "1";
    tr.innerHTML = `
      <td><input class="sz" value="${esc(v.size)}" ${existing ? "readonly" : ""} placeholder="M" /></td>
      <td><input class="mn" inputmode="numeric" value="${v.min_stock ?? 0}" /></td>
      <td>${existing ? `<span class="cur">${v.stock}</span>` : `<input class="st" inputmode="numeric" placeholder="0" />`}</td>
      <td><button type="button" class="icon-btn" data-del title="Hapus ukuran">×</button></td>`;
    rows.appendChild(tr);
  };
  (p?.variants || []).forEach(addRow);
  if (isNew) PRESETS.Dewasa.forEach((s) => addRow({ size: s }));

  rows.addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const tr = e.target.closest("tr");
    if (tr.dataset.existing && Number($(".cur", tr).textContent) > 0) {
      return toast("Ukuran ini masih ada stoknya. Koreksi stok ke 0 dulu di menu Stok.", "error");
    }
    tr.remove();
  });
  $("#addSize", m.el).addEventListener("click", () => {
    addRow();
    $$(".sz", rows).at(-1).focus();
  });
  m.el.addEventListener("click", (e) => {
    const k = e.target.dataset.preset;
    if (!k) return;
    const have = new Set($$(".sz", rows).map((i) => i.value.trim().toUpperCase()));
    PRESETS[k].filter((s) => !have.has(s)).forEach((s) => addRow({ size: s }));
  });

  // Foto
  let photoBlob = null;
  let removePhoto = false;
  $("#photoInput", m.el).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoBlob = await resizeImage(file);
    removePhoto = false;
    $("#photoPreview", m.el).innerHTML = `<img src="${URL.createObjectURL(photoBlob)}" alt="" />`;
  });
  $("#photoRemove", m.el)?.addEventListener("click", () => {
    photoBlob = null;
    removePhoto = true;
    $("#photoPreview", m.el).innerHTML = "<span>Belum ada foto</span>";
  });

  $("#pform", m.el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const err = $("#pformErr", m.el);
    const fail = (msg) => ((err.textContent = msg), (err.hidden = false));
    err.hidden = true;

    const prices = {};
    for (const k of ["cost_price", "retail_price", "wholesale_price", "bulk_price"]) {
      if (k === "cost_price" && !owner) continue;
      const n = toInt(f.get(k));
      if (Number.isNaN(n) || n < 0) return fail("Harga harus berupa angka.");
      prices[k] = n;
    }
    if (!f.get("name").trim()) return fail("Nama barang wajib diisi.");
    if (prices.retail_price === null) return fail("Harga eceran wajib diisi.");

    const variants = [];
    for (const tr of $$("tr", rows)) {
      const size = $(".sz", tr).value.trim().toUpperCase();
      if (!size) continue;
      const min = toInt($(".mn", tr).value) ?? 0;
      const st = $(".st", tr) ? toInt($(".st", tr).value) : null;
      if (Number.isNaN(min) || min < 0 || Number.isNaN(st) || st < 0) return fail(`Angka stok ukuran ${size} tidak valid.`);
      variants.push({ size, min_stock: min, ...(st !== null ? { stock: st } : {}) });
    }

    const btn = e.submitter || $("button[type=submit]", m.el);
    await busy(btn, async () => {
      let photo_path = removePhoto ? null : p?.photo_path ?? null;
      if (photoBlob) photo_path = await api.uploadPhoto(photoBlob);
      await api.saveProduct({
        id: p?.id ?? null,
        code: f.get("code").trim(),
        name: f.get("name").trim(),
        team: f.get("team").trim(),
        category_id: f.get("category_id") ? Number(f.get("category_id")) : null,
        description: f.get("description").trim(),
        photo_path,
        ...prices,
        replace_variants: true,
        variants,
        stock_note: isNew ? "Stok awal" : "Ukuran baru",
      });
      if (p?.photo_path && p.photo_path !== photo_path) api.removePhoto(p.photo_path).catch(() => {});
      m.close();
      await refresh(main);
      toast(isNew ? "Barang ditambahkan" : "Perubahan disimpan");
    }).catch((e2) => {
      if (/products_code_key/.test(e2.message)) fail("Kode artikel sudah dipakai barang lain.");
      else fail(e2.message);
    });
  });
}
