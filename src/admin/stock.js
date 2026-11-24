import * as api from "@api";
import { state, reload, currentPage, catName } from "./main.js";
import { $, $$, esc, toInt, toast, busy } from "./ui.js";

let mode = "masuk"; // "masuk" | "koreksi"

export function renderStock(main) {
  const selected = state.products.find((p) => p.id === state.stockProductId);
  main.innerHTML = `
    <div class="stock-page">
      <section class="panel picker">
        <h3>1. Pilih barang</h3>
        <input type="search" id="sq" placeholder="Cari nama / kode…" />
        <div id="slist" class="slist"></div>
      </section>
      <section class="panel" id="sform">${selected ? "" : `<p class="empty">Pilih barang di sebelah kiri.</p>`}</section>
    </div>`;

  const drawPicker = () => {
    const q = $("#sq").value.trim().toLowerCase();
    const list = state.products.filter(
      (p) => p.active && (!q || [p.name, p.code, p.team].some((x) => x && x.toLowerCase().includes(q)))
    );
    $("#slist").innerHTML =
      list
        .slice(0, 60)
        .map(
          (p) => `<button class="sitem ${p.id === state.stockProductId ? "active" : ""}" data-id="${p.id}">
            <b>${esc(p.name)}</b><span class="muted">${esc([p.code, catName(p.category_id)].filter(Boolean).join(" · "))}</span></button>`
        )
        .join("") || `<p class="empty">Tidak ditemukan.</p>`;
  };
  $("#sq").addEventListener("input", drawPicker);
  $("#slist").addEventListener("click", (e) => {
    const b = e.target.closest(".sitem");
    if (!b) return;
    state.stockProductId = b.dataset.id;
    drawPicker();
    drawForm(main);
  });
  drawPicker();
  if (selected) drawForm(main);
}

function drawForm(main) {
  const p = state.products.find((x) => x.id === state.stockProductId);
  const el = $("#sform");
  if (!p.variants.length) {
    el.innerHTML = `<h3>${esc(p.name)}</h3><p class="empty">Barang ini belum punya ukuran. Tambahkan lewat Edit di menu Barang.</p>`;
    return;
  }
  el.innerHTML = `
    <h3>2. ${esc(p.name)}</h3>
    <div class="seg">
      <button data-mode="masuk" class="${mode === "masuk" ? "active" : ""}">Stok masuk</button>
      <button data-mode="koreksi" class="${mode === "koreksi" ? "active" : ""}">Koreksi / stok opname</button>
    </div>
    <p class="hint">${mode === "masuk"
      ? "Isi <b>jumlah yang datang</b> per ukuran (dari supplier / produksi)."
      : "Isi <b>stok sebenarnya</b> hasil hitung fisik. Selisihnya dicatat sebagai koreksi."}</p>
    <table class="sizes-table stock-table">
      <thead><tr><th>Ukuran</th><th>Stok sekarang</th><th>${mode === "masuk" ? "Masuk (+)" : "Stok sebenarnya"}</th><th>Jadi</th></tr></thead>
      <tbody>${p.variants
        .map(
          (v) => `<tr data-id="${v.id}" data-cur="${v.stock}">
            <td><b>${esc(v.size)}</b></td><td>${v.stock}</td>
            <td><input inputmode="numeric" class="qty" ${mode === "koreksi" ? `value="${v.stock}"` : `placeholder="0"`} /></td>
            <td class="after">${v.stock}</td></tr>`
        )
        .join("")}</tbody>
    </table>
    <label>Catatan<input id="snote" placeholder="${mode === "masuk" ? "cth: Supplier A, nota 123" : "cth: hasil stok opname, barang rusak"}" /></label>
    <div class="actions"><button class="btn primary" id="ssave">Simpan</button></div>`;

  $$(".seg button", el).forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      drawForm(main);
    })
  );

  const compute = () => {
    const items = [];
    let invalid = false;
    for (const tr of $$("tbody tr", el)) {
      const cur = Number(tr.dataset.cur);
      const n = toInt($(".qty", tr).value);
      const bad = Number.isNaN(n) || (n !== null && n < 0);
      invalid ||= bad;
      const change = bad || n === null ? 0 : mode === "masuk" ? n : n - cur;
      $(".after", tr).textContent = bad ? "?" : cur + change;
      $(".after", tr).className = `after ${change > 0 ? "up" : change < 0 ? "down" : ""}`;
      if (change) items.push({ variant_id: tr.dataset.id, change });
    }
    return { items, invalid };
  };
  el.addEventListener("input", compute);

  $("#ssave", el).addEventListener("click", async (e) => {
    const { items, invalid } = compute();
    if (invalid) return toast("Isi angka 0 atau lebih.", "error");
    if (!items.length) return toast("Belum ada perubahan stok.", "error");
    await busy(e.target, async () => {
      await api.adjustStock(items, mode, $("#snote", el).value.trim());
      const total = items.reduce((a, i) => a + i.change, 0);
      await reload();
      if (main.isConnected && currentPage() === "stok") drawForm(main);
      toast(`Stok ${p.name} disimpan (${total > 0 ? "+" : ""}${total} pcs)`);
    }).catch((err) => toast(err.message, "error"));
  });
}
