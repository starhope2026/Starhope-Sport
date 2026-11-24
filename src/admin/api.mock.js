// Data tiruan untuk uji coba tampilan admin tanpa Supabase (`npm run dev -- --mode mock`).
// Meniru aturan di supabase/migrations: stok tidak boleh minus, ukuran ber-stok tidak bisa
// dihapus, harga modal hanya owner, impor semua-atau-tidak.
export const configured = true;

let seeding = true;
const role = () => (seeding ? "owner" : localStorage.getItem("mockRole") || "owner");
let session = sessionStorage.getItem("mockSession") ? { user: { id: "u1", email: "admin@starhope.test" } } : null;
const listeners = [];
const delay = () => new Promise((r) => setTimeout(r, 60));
const clone = (x) => structuredClone(x);
let seq = 100;
const id = () => `id-${++seq}`;

const db = {
  categories: ["NRL", "AFL", "FOOTBALL PREMIUM", "FOOTBALL LOKAL", "NBA", "NBA KIDS", "FOOTBALL KIDS"].map((name, i) => ({
    id: i + 1, name, sort: i + 1, active: true,
  })),
  products: [],
  costs: new Map(),
  variants: [],
  movements: [],
};

function applyStock(variantId, change, reason, note) {
  if (!change) return;
  const v = db.variants.find((x) => x.id === variantId);
  const p = db.products.find((x) => x.id === v.product_id);
  if (v.stock + change < v.reserved) throw new Error(`Stok ${p.name} ukuran ${v.size} tidak cukup (stok ${v.stock}, sedang dipesan ${v.reserved})`);
  v.stock += change;
  db.movements.unshift({ id: ++seq, variant_id: v.id, change, reason, note: note || null, stock_after: v.stock, created_at: new Date().toISOString(), actor: "Pemilik" });
}

function saveProductSync(p) {
  if (!p.name?.trim()) throw new Error("Nama barang wajib diisi");
  if (p.retail_price === null || p.retail_price === undefined || p.retail_price === "") throw new Error("Harga eceran wajib diisi");
  if (p.code && db.products.some((x) => x.code === p.code && x.id !== p.id)) throw new Error(`duplicate key value violates unique constraint "products_code_key"`);
  let prod = p.id && db.products.find((x) => x.id === p.id);
  if (p.id && !prod) throw new Error("Barang tidak ditemukan");
  if (!prod) {
    prod = { id: id(), active: true, created_at: new Date().toISOString() };
    db.products.push(prod);
  }
  for (const k of ["code", "team", "category_id", "description", "photo_path", "wholesale_price", "bulk_price"]) {
    if (k in p) prod[k] = p[k] === "" ? null : p[k];
  }
  prod.name = p.name.trim();
  prod.retail_price = Number(p.retail_price);
  if ("active" in p) prod.active = p.active;
  if ("cost_price" in p) {
    if (role() !== "owner") throw new Error("Hanya pemilik yang bisa mengubah harga modal");
    p.cost_price == null ? db.costs.delete(prod.id) : db.costs.set(prod.id, p.cost_price);
  }
  const sizes = (p.variants || []).map((v) => v.size.trim().toUpperCase());
  if (new Set(sizes).size !== sizes.length) throw new Error("Ada ukuran yang dobel");
  if (p.replace_variants) {
    for (const v of db.variants.filter((x) => x.product_id === prod.id && !sizes.includes(x.size))) {
      if (v.stock > 0) throw new Error(`Ukuran ${v.size} tidak bisa dihapus karena masih ada stok (${v.stock}). Koreksi stok ke 0 dulu.`);
      db.variants.splice(db.variants.indexOf(v), 1);
    }
  }
  (p.variants || []).forEach((v, i) => {
    const size = v.size.trim().toUpperCase();
    let row = db.variants.find((x) => x.product_id === prod.id && x.size === size);
    const inserted = !row;
    if (!row) {
      row = { id: id(), product_id: prod.id, size, stock: 0, reserved: 0, min_stock: 0 };
      db.variants.push(row);
    }
    row.sort = i + 1;
    if (v.min_stock !== undefined && v.min_stock !== null && v.min_stock !== "") row.min_stock = Number(v.min_stock);
    if (v.stock !== undefined && v.stock !== null && v.stock !== "") {
      if (v.stock < 0) throw new Error(`Stok ukuran ${size} tidak boleh minus`);
      applyStock(row.id, v.stock - row.stock, inserted ? "awal" : "koreksi", p.stock_note);
    }
  });
  return prod.id;
}

function transact(fn) {
  const snap = clone({ ...db, costs: [...db.costs] });
  try {
    return fn();
  } catch (e) {
    Object.assign(db, snap, { costs: new Map(snap.costs) });
    throw e;
  }
}

// seed
transact(() => {
  saveProductSync({ code: "NRL-BRO-25", name: "Jersey NRL Broncos Home 2025", team: "Broncos", category_id: 1, retail_price: 285000, wholesale_price: 250000, bulk_price: 230000, cost_price: 180000, variants: [{ size: "S", stock: 4, min_stock: 2 }, { size: "M", stock: 10, min_stock: 3 }, { size: "L", stock: 1, min_stock: 3 }, { size: "XL", stock: 0, min_stock: 2 }] });
  saveProductSync({ code: "NBA-LAL-23", name: "Jersey NBA Lakers Icon #23", team: "Lakers", category_id: 5, retail_price: 250000, wholesale_price: 220000, cost_price: 150000, variants: [{ size: "M", stock: 6 }, { size: "L", stock: 8 }, { size: "XL", stock: 5 }] });
  saveProductSync({ code: "FBK-PER-10", name: "Jersey Anak Persija Home", team: "Persija", category_id: 7, retail_price: 120000, variants: [{ size: "6", stock: 3, min_stock: 2 }, { size: "8", stock: 2, min_stock: 2 }, { size: "10", stock: 5 }] });
});
seeding = false;

// ---------- API (sama dengan api.js) ----------
export async function getSession() { await delay(); return session; }
export async function signIn(email, password) {
  await delay();
  if (password !== "rahasia123") throw new Error("Email atau password salah");
  session = { user: { id: "u1", email } };
  sessionStorage.setItem("mockSession", "1");
  listeners.forEach((cb) => cb(session));
}
export async function signOut() { session = null; sessionStorage.removeItem("mockSession"); listeners.forEach((cb) => cb(null)); }
export function onAuthChange(cb) { listeners.push(cb); }
export async function getMe() {
  await delay();
  if (!session) return null;
  if (role() === "none") return { email: session.user.email, staff: null };
  return { email: session.user.email, staff: { user_id: "u1", name: role() === "owner" ? "Pemilik" : "Gudang", role: role() } };
}

export async function listCategories() { await delay(); return clone(db.categories).sort((a, b) => a.sort - b.sort); }
export async function addCategory(name, sort) {
  await delay();
  if (db.categories.some((c) => c.name === name)) throw new Error(`duplicate key value violates unique constraint "categories_name_key"`);
  db.categories.push({ id: ++seq, name, sort, active: true });
}
export async function updateCategory(cid, patch) { await delay(); Object.assign(db.categories.find((c) => c.id === cid), patch); }
export async function deleteCategory(cid) {
  await delay();
  if (db.products.some((p) => p.category_id === cid)) throw new Error("Kategori masih dipakai barang. Nonaktifkan saja.");
  db.categories = db.categories.filter((c) => c.id !== cid);
}

export async function listProducts({ withCost }) {
  await delay();
  return clone(db.products)
    .map((p) => ({
      ...p,
      cost_price: withCost ? db.costs.get(p.id) ?? null : undefined,
      variants: clone(db.variants.filter((v) => v.product_id === p.id)).sort((a, b) => a.sort - b.sort),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function saveProduct(payload) { await delay(); return transact(() => saveProductSync(clone(payload))); }
export async function setProductActive(pid, active) { await delay(); db.products.find((p) => p.id === pid).active = active; }
export async function deleteProduct(pid) {
  await delay();
  if (role() !== "owner") throw new Error("Tidak diizinkan");
  db.products = db.products.filter((p) => p.id !== pid);
  db.variants = db.variants.filter((v) => v.product_id !== pid);
}
export async function importProducts(rows) {
  await delay();
  return transact(() => {
    rows.forEach((r, i) => {
      if (!r.code) throw new Error(`Baris ${i + 1}: kode artikel wajib diisi untuk impor`);
      const ex = db.products.find((p) => p.code === r.code);
      try { saveProductSync({ ...r, id: ex?.id, replace_variants: false, stock_note: "Impor Excel" }); }
      catch (e) { throw new Error(`Baris ${i + 1} (${r.code}): ${e.message}`); }
    });
    return rows.length;
  });
}

export async function adjustStock(items, reason, note) {
  await delay();
  if (reason === "masuk" && items.some((i) => i.change < 0)) throw new Error("Stok masuk tidak boleh minus. Gunakan koreksi stok.");
  transact(() => items.forEach((i) => applyStock(i.variant_id, i.change, reason, note)));
}
export async function listMovements(limit = 300) {
  await delay();
  return db.movements.slice(0, limit).map((m) => {
    const v = db.variants.find((x) => x.id === m.variant_id) || {};
    const p = db.products.find((x) => x.id === v.product_id) || {};
    return { ...m, actor: { name: m.actor }, variant: { size: v.size, product: { name: p.name, code: p.code } } };
  });
}

const photos = new Map();
export async function uploadPhoto(blob) { await delay(); const path = `${id()}.jpg`; photos.set(path, URL.createObjectURL(blob)); return path; }
export async function removePhoto(path) { photos.delete(path); }
export function photoUrl(path) { return path ? photos.get(path) || null : null; }
