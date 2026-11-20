# Starhope-Sport

Toko jersey online Starhope Sport — **Tahap 1: storefront + order via WhatsApp**.

## Fitur tahap 1
- Katalog jersey dengan filter kategori (Klub, Timnas, Retro, Custom), pencarian, dan urutan harga/nama
- Detail produk: pilih ukuran (stok per ukuran, ukuran habis otomatis nonaktif), jumlah, nama/nomor punggung untuk produk custom
- Keranjang tersimpan di browser (localStorage), jumlah dibatasi sesuai stok
- Checkout: form data pengiriman → pesanan otomatis jadi pesan WhatsApp ke admin
- Responsif (HP & desktop), tanpa build/dependency

## Menjalankan
Buka `index.html` langsung di browser, atau:

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

## Mengatur toko
Semua data ada di `js/products.js`:
- `STORE.whatsapp` — **ganti dengan nomor WhatsApp admin** (format `628xxxxxxxxxx`)
- `STORE.shippingFlat` — ongkir flat; `0` = ongkir dikonfirmasi admin
- `PRODUCTS` — daftar produk. Isi `image: "img/nama-file.jpg"` untuk memakai foto asli; kalau kosong, ilustrasi jersey dibuat dari `colors` + `pattern` (`plain`, `stripes`, `hoops`, `sash`).

## Deploy
Bisa langsung dipasang di GitHub Pages (Settings → Pages → branch `main`, folder `/`), Netlify, atau Vercel.

## Rencana tahap berikutnya (usulan)
- Tahap 2: halaman produk sendiri (URL per produk), foto asli, panduan ukuran, cek ongkir
- Tahap 3: backend + admin panel (kelola produk/stok/pesanan), payment gateway (Midtrans/Xendit)
