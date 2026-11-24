import * as api from "@api";
import { $, esc, fmtDate } from "./ui.js";

const REASONS = { awal: "Stok awal", masuk: "Masuk", koreksi: "Koreksi", penjualan: "Penjualan", pembatalan: "Pembatalan" };

export async function renderHistory(main) {
  const rows = await api.listMovements(300);
  main.innerHTML = `
    <div class="toolbar">
      <input type="search" id="hq" placeholder="Cari barang / catatan…" />
      <select id="hr"><option value="">Semua jenis</option>${Object.entries(REASONS)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join("")}</select>
    </div>
    <p class="hint">Menampilkan 300 perubahan stok terakhir.</p>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Waktu</th><th>Barang</th><th>Ukuran</th><th>Jenis</th><th class="num">Perubahan</th><th class="num">Stok jadi</th><th>Catatan</th><th>Oleh</th></tr></thead>
      <tbody id="hbody"></tbody></table></div>`;

  const draw = () => {
    const q = $("#hq").value.trim().toLowerCase();
    const r = $("#hr").value;
    const list = rows.filter(
      (m) =>
        (!r || m.reason === r) &&
        (!q || [m.variant?.product?.name, m.variant?.product?.code, m.note].some((x) => x && x.toLowerCase().includes(q)))
    );
    $("#hbody").innerHTML =
      list
        .map(
          (m) => `<tr>
          <td>${fmtDate(m.created_at)}</td>
          <td>${esc(m.variant?.product?.name)}<div class="muted">${esc(m.variant?.product?.code)}</div></td>
          <td>${esc(m.variant?.size)}</td>
          <td><span class="tag ${m.reason}">${REASONS[m.reason] || m.reason}</span></td>
          <td class="num ${m.change > 0 ? "up" : "down"}">${m.change > 0 ? "+" : ""}${m.change}</td>
          <td class="num">${m.stock_after}</td>
          <td>${esc(m.note)}</td>
          <td>${esc(m.actor?.name || "–")}</td></tr>`
        )
        .join("") || `<tr><td colspan="8" class="empty">Belum ada riwayat.</td></tr>`;
  };
  $("#hq").addEventListener("input", draw);
  $("#hr").addEventListener("change", draw);
  draw();
}
