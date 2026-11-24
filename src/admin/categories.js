import * as api from "@api";
import { state, reload, currentPage } from "./main.js";
import { $, esc, toast, confirmDialog } from "./ui.js";

async function refresh(main) {
  await reload();
  if (main.isConnected && currentPage() === "kategori") renderCategories(main);
}

export function renderCategories(main) {
  const used = (id) => state.products.filter((p) => p.category_id === id).length;
  main.innerHTML = `
    <section class="panel narrow">
      <h3>Kategori</h3>
      <p class="hint">Urutan menentukan posisi di katalog. Kategori nonaktif tidak tampil ke pelanggan.</p>
      <table class="data cats">
        <thead><tr><th>Nama</th><th>Urutan</th><th>Aktif</th><th>Barang</th><th></th></tr></thead>
        <tbody>${state.categories
          .map(
            (c) => `<tr data-id="${c.id}">
            <td><input class="cn" value="${esc(c.name)}" /></td>
            <td><input class="cs" inputmode="numeric" value="${c.sort}" /></td>
            <td><input type="checkbox" class="ca" ${c.active ? "checked" : ""} /></td>
            <td>${used(c.id)}</td>
            <td class="row-actions"><button class="btn small" data-act="save">Simpan</button>
              <button class="btn small ghost" data-act="del" ${used(c.id) ? "disabled title='Masih dipakai barang'" : ""}>Hapus</button></td></tr>`
          )
          .join("")}</tbody>
      </table>
      <form id="catAdd" class="toolbar">
        <input name="name" placeholder="Nama kategori baru" required />
        <button class="btn primary">+ Tambah</button>
      </form>
    </section>`;

  main.querySelector("tbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = Number(tr.dataset.id);
    try {
      if (btn.dataset.act === "save") {
        const name = $(".cn", tr).value.trim().toUpperCase();
        if (!name) return toast("Nama kategori wajib diisi", "error");
        await api.updateCategory(id, { name, sort: Number($(".cs", tr).value) || 0, active: $(".ca", tr).checked });
      } else {
        if (!(await confirmDialog("Hapus kategori ini?", "Hapus"))) return;
        await api.deleteCategory(id);
      }
      await refresh(main);
      toast(btn.dataset.act === "save" ? "Kategori disimpan" : "Kategori dihapus");
    } catch (err) {
      toast(/categories_name_key/.test(err.message) ? "Nama kategori sudah ada" : err.message, "error");
    }
  });

  $("#catAdd").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim().toUpperCase();
    if (!name) return;
    try {
      await api.addCategory(name, Math.max(0, ...state.categories.map((c) => c.sort)) + 1);
      await refresh(main);
      toast("Kategori ditambahkan");
    } catch (err) {
      toast(/categories_name_key/.test(err.message) ? "Nama kategori sudah ada" : err.message, "error");
    }
  });
}
