// Lapisan data admin: semua komunikasi ke Supabase lewat file ini.
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(URL && KEY);
const sb = configured ? createClient(URL, KEY) : null;

const BUCKET = "product-photos";

function check({ data, error }) {
  if (error) throw new Error(error.message || "Terjadi kesalahan");
  return data;
}

// ---------- Auth ----------
export async function getSession() {
  return check(await sb.auth.getSession()).session;
}
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Email atau password salah" : error.message);
}
export async function signOut() {
  await sb.auth.signOut();
}
export function onAuthChange(cb) {
  sb.auth.onAuthStateChange((_event, session) => cb(session));
}
export async function getMe() {
  const session = await getSession();
  if (!session) return null;
  const rows = check(await sb.from("staff").select("user_id,name,role").eq("user_id", session.user.id));
  return { email: session.user.email, staff: rows[0] || null };
}

// ---------- Kategori ----------
export async function listCategories() {
  return check(await sb.from("categories").select("*").order("sort").order("name"));
}
export async function addCategory(name, sort) {
  check(await sb.from("categories").insert({ name, sort }));
}
export async function updateCategory(id, patch) {
  check(await sb.from("categories").update(patch).eq("id", id));
}
export async function deleteCategory(id) {
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") throw new Error("Kategori masih dipakai barang. Nonaktifkan saja.");
    throw new Error(error.message);
  }
}

// ---------- Barang ----------
export async function listProducts({ withCost }) {
  const products = check(
    await sb
      .from("products")
      .select("*, variants(id,size,sort,stock,reserved,min_stock)")
      .order("name")
  );
  if (withCost) {
    const costs = check(await sb.from("product_costs").select("product_id,cost_price"));
    const map = new Map(costs.map((c) => [c.product_id, c.cost_price]));
    products.forEach((p) => (p.cost_price = map.get(p.id) ?? null));
  }
  products.forEach((p) => p.variants.sort((a, b) => a.sort - b.sort));
  return products;
}
export async function saveProduct(payload) {
  return check(await sb.rpc("save_product", { p: payload }));
}
export async function setProductActive(id, active) {
  check(await sb.from("products").update({ active }).eq("id", id));
}
export async function deleteProduct(id) {
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function importProducts(rows) {
  return check(await sb.rpc("import_products", { rows }));
}

// ---------- Stok ----------
export async function adjustStock(items, reason, note) {
  check(await sb.rpc("adjust_stock", { p_items: items, p_reason: reason, p_note: note || null }));
}
export async function listMovements(limit = 300) {
  return check(
    await sb
      .from("stock_movements")
      .select("id,change,reason,note,stock_after,created_at, actor:staff(name), variant:variants(size, product:products(name,code))")
      .order("created_at", { ascending: false })
      .limit(limit)
  );
}

// ---------- Foto ----------
export async function uploadPhoto(blob) {
  const path = `${crypto.randomUUID()}.jpg`;
  check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" }));
  return path;
}
export async function removePhoto(path) {
  if (path) await sb.storage.from(BUCKET).remove([path]);
}
export function photoUrl(path) {
  return path ? sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;
}
