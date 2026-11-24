# Starhope-Sport

Toko online jersey grosir Starhope Sport. Rencana lengkap: dokumen "Rencana Toko Online Jersey Grosir" (5 tahap).

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1. Dasar & admin | Database, login admin, menu Barang, stok per ukuran, impor Excel | ✅ kode siap — setup: [docs/SETUP.md](docs/SETUP.md) |
| 2. Pelanggan & katalog | Daftar/masuk nomor HP + OTP, katalog dari database, keranjang | ⏳ |
| 3. Pembayaran | Checkout, Xendit/Midtrans, konfirmasi lunas otomatis, kunci stok | ⏳ |
| 4. Proses pesanan | Tahapan kemas, resi, Pesanan saya, notifikasi admin | ⏳ |
| 5. Laporan | Penjualan, terlaris, restok, akses staf, ongkir | ⏳ |

## Isi repo

- `admin/`, `src/admin/` — halaman admin (`/admin/`): Barang, Stok (masuk & koreksi/opname), Riwayat, Kategori, Impor Excel
- `supabase/migrations/` — skema database + aturan keamanan (dijalankan di Supabase SQL Editor)
- `index.html`, `public/` — etalase lama (data contoh, order via WhatsApp); diganti katalog dari database di tahap 2

### Aturan penting yang dijaga database
- Stok **hanya** berubah lewat fungsi stok, dan setiap perubahan tercatat di riwayat (siapa, kapan, alasan).
- Stok tidak bisa minus; ukuran yang masih ada stoknya tidak bisa dihapus.
- **Harga modal** disimpan terpisah dan hanya bisa dibaca pemilik — tidak pernah sampai ke pelanggan atau staf gudang.
- Impor Excel semua-atau-tidak: kalau satu baris salah, tidak ada yang tersimpan. Impor file yang sama dua kali aman.

## Pengembangan

```bash
npm install
npm run dev                 # butuh .env.local berisi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev -- --mode mock  # coba admin dengan data tiruan, tanpa Supabase
                            # login: email apa saja, password: rahasia123
npm run build
```
