# Panduan Setup Tahap 1 (Supabase + Vercel)

Ikuti urutannya. Total sekitar 15 menit. **Jangan pernah kirim password atau kunci rahasia lewat chat.**

## 1. Buat database (Supabase)

1. Buka project Supabase kamu → menu kiri **SQL Editor** → **New query**.
2. Buka file [`supabase/migrations/001_tahap1_barang_stok.sql`](../supabase/migrations/001_tahap1_barang_stok.sql) di GitHub, klik ikon **Copy raw file**.
3. Tempel di SQL Editor → klik **Run**. Harus muncul *Success. No rows returned*.
   Cukup dijalankan **sekali**. Kalau dijalankan dua kali akan muncul error "already exists" — itu tidak merusak apa-apa.

## 2. Matikan pendaftaran umum

Supaya orang lain tidak bisa bikin akun sendiri:

**Authentication** → **Sign In / Providers** (atau **Settings**) → matikan **Allow new users to sign up** → **Save**.

(Pendaftaran pelanggan dengan nomor HP + OTP akan disiapkan terpisah di tahap 2.)

## 3. Buat akun admin

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Isi email dan password kamu, centang **Auto Confirm User** → **Create user**.

## 4. Daftarkan akun tadi sebagai pemilik

Di **SQL Editor** → **New query**, tempel ini (ganti email & nama), lalu **Run**:

```sql
insert into public.staff (user_id, name, role)
select id, 'Maulana', 'owner' from auth.users where email = 'email-kamu@contoh.com';
```

Harus muncul *Success. 1 row affected*. Kalau *0 rows*, emailnya belum sama persis dengan langkah 3.

Untuk staf gudang nanti: buat user di langkah 3, lalu jalankan SQL yang sama dengan `'staf'` sebagai ganti `'owner'`.
Staf bisa mengelola barang & stok, tapi **tidak bisa melihat harga modal**.

## 5. Ambil alamat & kunci publik Supabase

**Project Settings** (ikon gerigi) → **API Keys** / **Data API**. Catat dua nilai:

- **Project URL** — seperti `https://abcdxyz.supabase.co`
- **Publishable key** (atau **anon public** key) — teks panjang

Dua nilai ini memang dirancang untuk dipakai di website (aman, data dilindungi aturan database).
**Jangan** pakai `secret` / `service_role` key.

## 6. Pasang website di Vercel

1. Buka https://vercel.com/new → pilih repo **Starhope-Sport** → **Import**.
2. *Framework Preset* otomatis terbaca **Vite**. Biarkan pengaturan build apa adanya.
3. Buka **Environment Variables**, tambahkan:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL dari langkah 5 |
   | `VITE_SUPABASE_ANON_KEY` | Publishable / anon key dari langkah 5 |
4. Klik **Deploy**. Tunggu 1–2 menit.
5. Buka `https://<nama-project>.vercel.app/admin/` → login dengan akun dari langkah 3.

Kalau env var diubah belakangan, perlu **Redeploy** (Deployments → titik tiga → Redeploy).

## 7. Rapikan GitHub

Setelah Vercel jalan, GitHub Pages tidak dipakai lagi:

1. **Settings → Pages** → *Source*: **None** (atau Unpublish).
2. **Settings → Danger Zone → Change visibility → Private** (opsional, Vercel tetap jalan).

## Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| Halaman admin: "Supabase belum diatur" | Env var di langkah 6 belum diisi / belum redeploy |
| "Email atau password salah" | Cek langkah 3; password minimal 6 karakter |
| "Akun … belum terdaftar sebagai admin" | Langkah 4 belum jalan atau email beda |
| Foto gagal diunggah | Langkah 1 belum jalan lengkap (bucket `product-photos`) |
