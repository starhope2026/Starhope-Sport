import * as api from "@api";
import { state, reload, currentPage } from "./main.js";
import { $, esc, rupiah, toInt, toast, busy } from "./ui.js";

const BASE_COLS = ["Kode", "Nama", "Tim/Model", "Kategori", "Harga Modal", "Harga Eceran", "Harga Grosir", "Harga Partai", "Stok Minimal"];
const TEMPLATE_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"];

let parsed = null; // { rows: [{payload, errors, view}] }

export function renderImport(main) {
  main.innerHTML = `
    <section class="panel">
      <h3>Impor barang dari Excel</h3>
      <ol class="hint steps">
        <li>Unduh template, isi satu baris per artikel. <b>Kode</b>, <b>Nama</b>, dan <b>Harga Eceran</b> wajib.</li>
        <li>Kolom <b>Stok S</b>, <b>Stok M</b>, dst. berisi <b>stok sebenarnya</b> saat ini. Kosongkan kalau ukuran itu tidak ada.
          Mau ukuran lain (cth. anak)? Tambah kolom dengan judul <b>Stok 8</b>, <b>Stok 10</b>, dst.</li>
        <li>Kode yang sudah ada akan <b>diperbarui</b> (harga & stok disamakan dengan file). Kode baru akan <b>ditambahkan</b>.
          Mengimpor file yang sama dua kali aman.</li>
        ${state.isOwner ? "" : "<li>Kolom <b>Harga Modal</b> hanya bisa diisi oleh pemilik; biarkan kosong.</li>"}
      </ol>
      <div class="toolbar">
        <button class="btn" id="tplBtn">Unduh template</button>
        <label class="btn primary">Pilih file Excel (.xlsx)<input type="file" id="xlsInput" accept=".xlsx" hidden /></label>
      </div>
      <div id="preview"></div>
    </section>`;
  $("#tplBtn").addEventListener("click", (e) => downloadTemplate(e.target));
  $("#xlsInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { readSheet } = await import("read-excel-file/browser");
      parsed = parseRows(await readSheet(file));
      drawPreview(main);
    } catch (err) {
      toast("File tidak bisa dibaca: " + err.message, "error");
    }
  });
}

async function downloadTemplate(btn) {
  await busy(btn, async () => {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const header = [...BASE_COLS, ...TEMPLATE_SIZES.map((s) => `Stok ${s}`)].map((value) => ({ value, fontWeight: "bold" }));
    const example = ["NRL-BRO-25", "Jersey NRL Broncos Home 2025", "Broncos", state.categories[0]?.name || "", 180000, 285000, 250000, 230000, 2, 4, 10, 6, 3, "", ""];
    const cats = [[{ value: "Daftar kategori yang valid:", fontWeight: "bold" }], ...state.categories.map((c) => [c.name])];
    await writeExcelFile(
      [
        { sheet: "Barang", data: [header, example], columns: header.map((_, i) => ({ width: i === 1 ? 34 : 14 })) },
        { sheet: "Kategori", data: cats, columns: [{ width: 30 }] },
      ]
    ).toFile("template-barang-starhope.xlsx");
  }).catch((e) => toast(e.message, "error"));
}

function parseRows(sheet) {
  const data = sheet.filter((r) => r.some((c) => c !== null && c !== ""));
  if (data.length < 2) throw new Error("File kosong atau tidak ada baris data.");
  const header = data[0].map((h) => String(h ?? "").trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const missing = ["Kode", "Nama", "Harga Eceran"].filter((c) => idx(c) < 0);
  if (missing.length) throw new Error(`Kolom ${missing.join(", ")} tidak ditemukan. Pakai template dari tombol "Unduh template".`);

  const sizeCols = header
    .map((h, i) => ({ m: /^stok\s+(.+)$/i.exec(h), i }))
    .filter(({ m }) => m && m[1].toLowerCase() !== "minimal")
    .map(({ m, i }) => ({ size: m[1].trim().toUpperCase(), i }));
  const catByName = new Map(state.categories.map((c) => [c.name.toLowerCase(), c.id]));
  const get = (row, name) => (idx(name) >= 0 ? row[idx(name)] : null);
  const seen = new Map();

  const rows = data.slice(1).map((row, n) => {
    const errors = [];
    const line = n + 2;
    const code = String(get(row, "Kode") ?? "").trim();
    const name = String(get(row, "Nama") ?? "").trim();
    if (!code) errors.push("Kode kosong");
    if (!name) errors.push("Nama kosong");
    if (code && seen.has(code.toLowerCase())) errors.push(`Kode dobel dengan baris ${seen.get(code.toLowerCase())}`);
    seen.set(code.toLowerCase(), line);

    const num = (col) => {
      const v = toInt(get(row, col));
      if (Number.isNaN(v) || v < 0) {
        errors.push(`${col} bukan angka`);
        return null;
      }
      return v;
    };
    const payload = { code, name };
    const team = String(get(row, "Tim/Model") ?? "").trim();
    if (idx("Tim/Model") >= 0) payload.team = team;
    const catText = String(get(row, "Kategori") ?? "").trim();
    if (catText) {
      const id = catByName.get(catText.toLowerCase());
      if (id) payload.category_id = id;
      else errors.push(`Kategori "${catText}" tidak dikenal`);
    }
    payload.retail_price = num("Harga Eceran");
    if (payload.retail_price === null && !errors.some((e) => e.startsWith("Harga Eceran"))) errors.push("Harga Eceran kosong");
    for (const [col, key] of [["Harga Grosir", "wholesale_price"], ["Harga Partai", "bulk_price"]]) {
      if (idx(col) >= 0) payload[key] = num(col);
    }
    if (idx("Harga Modal") >= 0) {
      const cost = num("Harga Modal");
      if (cost !== null) {
        if (state.isOwner) payload.cost_price = cost;
        else errors.push("Harga Modal hanya boleh diisi pemilik");
      }
    }
    const min = idx("Stok Minimal") >= 0 ? num("Stok Minimal") : null;
    payload.variants = [];
    for (const { size, i } of sizeCols) {
      const raw = row[i];
      if (raw === null || raw === "") continue;
      const st = toInt(raw);
      if (Number.isNaN(st) || st < 0) {
        errors.push(`Stok ${size} bukan angka`);
        continue;
      }
      payload.variants.push({ size, stock: st, ...(min !== null ? { min_stock: min } : {}) });
    }
    const exists = state.products.some((p) => p.code && p.code.toLowerCase() === code.toLowerCase());
    if (exists) payload.code = state.products.find((p) => p.code.toLowerCase() === code.toLowerCase()).code;
    return { line, payload, errors, exists, catText };
  });
  return { rows };
}

function drawPreview(main) {
  const { rows } = parsed;
  const bad = rows.filter((r) => r.errors.length).length;
  const nNew = rows.filter((r) => !r.exists).length;
  $("#preview").innerHTML = `
    <div class="import-summary ${bad ? "warn" : "ok"}">
      ${rows.length} baris · ${nNew} barang baru · ${rows.length - nNew} diperbarui
      ${bad ? ` · <b>${bad} baris bermasalah</b> — perbaiki di Excel lalu pilih file lagi.` : " · Siap diimpor."}
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Baris</th><th>Kode</th><th>Nama</th><th>Kategori</th><th class="num">Eceran</th><th>Stok per ukuran</th><th>Status</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr class="${r.errors.length ? "row-bad" : ""}">
          <td>${r.line}</td><td>${esc(r.payload.code)}</td><td>${esc(r.payload.name)}</td><td>${esc(r.catText)}</td>
          <td class="num">${rupiah(r.payload.retail_price)}</td>
          <td>${r.payload.variants.map((v) => `${esc(v.size)}:${v.stock}`).join(" ") || "–"}</td>
          <td>${r.errors.length ? `<span class="err">${r.errors.map(esc).join("; ")}</span>` : r.exists ? "Perbarui" : "Baru"}</td></tr>`
        )
        .join("")}</tbody></table></div>
    <div class="actions"><button class="btn primary" id="doImport" ${bad ? "disabled" : ""}>Impor ${rows.length} barang</button></div>`;

  $("#doImport").addEventListener("click", async (e) => {
    await busy(e.target, async () => {
      const n = await api.importProducts(rows.map((r) => r.payload));
      parsed = null;
      await reload();
      if (main.isConnected && currentPage() === "impor") renderImport(main);
      toast(`${n} barang berhasil diimpor`);
    }).catch((err) => toast(err.message, "error"));
  });
}
