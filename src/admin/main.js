import * as api from "@api";
import { $, esc, toast } from "./ui.js";
import { renderProducts } from "./products.js";
import { renderStock } from "./stock.js";
import { renderHistory } from "./history.js";
import { renderCategories } from "./categories.js";
import { renderImport } from "./import.js";

// State bersama untuk semua halaman.
export const state = {
  me: null, // { email, staff: { name, role } }
  categories: [],
  products: [],
  stockProductId: null, // produk yang dipilih saat pindah ke halaman Stok
  get isOwner() {
    return this.me?.staff?.role === "owner";
  },
};

export async function reload() {
  const [categories, products] = await Promise.all([
    api.listCategories(),
    api.listProducts({ withCost: state.isOwner }),
  ]);
  state.categories = categories;
  state.products = products;
}

export const catName = (id) => state.categories.find((c) => c.id === id)?.name || "Tanpa kategori";

const PAGES = {
  barang: { label: "Barang", render: renderProducts },
  stok: { label: "Stok", render: renderStock },
  riwayat: { label: "Riwayat", render: renderHistory },
  kategori: { label: "Kategori", render: renderCategories },
  impor: { label: "Impor Excel", render: renderImport },
};

export function go(page) {
  if (location.hash === `#${page}`) route();
  else location.hash = page;
}

export const currentPage = () => (PAGES[location.hash.slice(1)] ? location.hash.slice(1) : "barang");

function route() {
  if (!state.me?.staff) return;
  const page = currentPage();
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
  const main = $("#main");
  main.innerHTML = `<p class="loading">Memuat…</p>`;
  Promise.resolve(PAGES[page].render(main)).catch((e) => {
    main.innerHTML = `<p class="error-box">Gagal memuat: ${esc(e.message)}</p>`;
  });
}

function renderSetupMissing() {
  $("#app").innerHTML = `<div class="center-card">
    <h1 class="brand">STARHOPE<span>ADMIN</span></h1>
    <p class="error-box">Supabase belum diatur. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code>
    di Vercel (Settings → Environment Variables), lalu deploy ulang. Panduan: <code>docs/SETUP.md</code>.</p></div>`;
}

function renderLogin(message = "") {
  $("#app").innerHTML = `<form class="center-card" id="loginForm">
    <h1 class="brand">STARHOPE<span>ADMIN</span></h1>
    <label>Email<input type="email" name="email" required autocomplete="username" /></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password" /></label>
    ${message ? `<p class="error-box">${esc(message)}</p>` : ""}
    <button class="btn primary block" type="submit">Masuk</button>
  </form>`;
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Masuk…";
    const f = new FormData(e.target);
    try {
      await api.signIn(f.get("email").trim(), f.get("password"));
      await start();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function renderNotStaff() {
  $("#app").innerHTML = `<div class="center-card">
    <h1 class="brand">STARHOPE<span>ADMIN</span></h1>
    <p class="error-box">Akun <b>${esc(state.me.email)}</b> belum terdaftar sebagai admin.
    Minta pemilik toko menambahkan akun ini (lihat docs/SETUP.md, langkah "Daftarkan admin").</p>
    <button class="btn block" id="logout">Keluar</button></div>`;
  $("#logout").addEventListener("click", () => api.signOut().then(() => renderLogin()));
}

function renderShell() {
  const s = state.me.staff;
  $("#app").innerHTML = `
    <header class="topbar">
      <div class="brand">STARHOPE<span>ADMIN</span></div>
      <div class="who">${esc(s.name)} · ${s.role === "owner" ? "Pemilik" : "Staf"}
        <button class="btn small ghost" id="logout">Keluar</button></div>
    </header>
    <nav class="tabs">${Object.entries(PAGES)
      .map(([k, p]) => `<a href="#${k}" data-page="${k}">${p.label}</a>`)
      .join("")}</nav>
    <main id="main" class="container"></main>`;
  $("#logout").addEventListener("click", async () => {
    await api.signOut();
    state.me = null;
    renderLogin();
  });
}

async function start() {
  state.me = await api.getMe();
  if (!state.me) return renderLogin();
  if (!state.me.staff) return renderNotStaff();
  await reload();
  renderShell();
  route();
}

window.addEventListener("hashchange", route);

if (!api.configured) renderSetupMissing();
else
  start().catch((e) => {
    toast(e.message, "error");
    renderLogin();
  });
