// Data produk & pengaturan toko.
// Edit file ini untuk menambah/mengubah produk. Tidak perlu build.

window.STORE = {
  name: "Starhope Sport",
  // Nomor WhatsApp admin, format internasional tanpa "+" / spasi. GANTI dengan nomor asli.
  whatsapp: "6281234567890",
  currency: "IDR",
  // Ongkir flat sementara (tahap 1). 0 = dihitung manual oleh admin.
  shippingFlat: 0,
};

// Kategori yang muncul di filter.
window.CATEGORIES = [
  { id: "klub", label: "Klub" },
  { id: "timnas", label: "Timnas" },
  { id: "retro", label: "Retro" },
  { id: "custom", label: "Custom / Team" },
];

// Setiap produk:
// - id: unik, huruf kecil-strip
// - colors: [warna utama, warna kedua, warna aksen] untuk ilustrasi jersey (dipakai kalau "image" kosong)
// - image: path/URL foto produk (opsional). Contoh: "img/home-merah.jpg"
// - sizes: ukuran yang tersedia; stock per ukuran (0 = habis)
window.PRODUCTS = [
  {
    id: "home-merah-hitam-2526",
    name: "Jersey Home Merah Hitam 25/26",
    category: "klub",
    price: 185000,
    oldPrice: 225000,
    colors: ["#c8102e", "#111111", "#ffffff"],
    pattern: "stripes",
    badge: "Best Seller",
    stock: { S: 5, M: 10, L: 8, XL: 4, XXL: 2 },
    description: "Bahan dri-fit grade ori, ringan dan cepat kering. Cocok untuk main maupun harian.",
  },
  {
    id: "away-putih-biru-2526",
    name: "Jersey Away Putih Biru 25/26",
    category: "klub",
    price: 175000,
    colors: ["#ffffff", "#1d3f8f", "#1d3f8f"],
    pattern: "sash",
    stock: { S: 3, M: 6, L: 6, XL: 3, XXL: 0 },
    description: "Jersey tandang warna putih dengan selempang biru. Bahan jacquard berpori.",
  },
  {
    id: "home-biru-langit-2526",
    name: "Jersey Home Biru Langit 25/26",
    category: "klub",
    price: 185000,
    colors: ["#6cabdd", "#ffffff", "#1c2c5b"],
    pattern: "plain",
    badge: "Baru",
    stock: { S: 4, M: 8, L: 8, XL: 5, XXL: 2 },
    description: "Warna biru langit klasik, kerah V, logo bordir.",
  },
  {
    id: "third-hijau-neon-2526",
    name: "Jersey Third Hijau Neon 25/26",
    category: "klub",
    price: 179000,
    colors: ["#39ff14", "#0b0b0b", "#0b0b0b"],
    pattern: "hoops",
    stock: { S: 2, M: 5, L: 5, XL: 2, XXL: 1 },
    description: "Jersey ketiga warna neon, mencolok di lapangan.",
  },
  {
    id: "timnas-merah-putih-home",
    name: "Jersey Timnas Merah Putih Home",
    category: "timnas",
    price: 199000,
    colors: ["#e31b23", "#ffffff", "#ffffff"],
    pattern: "plain",
    badge: "Best Seller",
    stock: { S: 10, M: 20, L: 20, XL: 10, XXL: 5 },
    description: "Dukung tim kebanggaan dengan jersey merah putih. Bahan adem, jahitan rapi.",
  },
  {
    id: "timnas-putih-away",
    name: "Jersey Timnas Putih Away",
    category: "timnas",
    price: 199000,
    colors: ["#ffffff", "#e31b23", "#e31b23"],
    pattern: "sash",
    stock: { S: 6, M: 12, L: 12, XL: 6, XXL: 3 },
    description: "Versi tandang warna putih dengan aksen merah.",
  },
  {
    id: "timnas-oranye-home",
    name: "Jersey Timnas Oranye Home",
    category: "timnas",
    price: 189000,
    colors: ["#ff7f00", "#000000", "#000000"],
    pattern: "plain",
    stock: { S: 0, M: 4, L: 4, XL: 2, XXL: 0 },
    description: "Oranye cerah, kerah bulat, bahan dri-fit.",
  },
  {
    id: "retro-kuning-hijau-98",
    name: "Jersey Retro Kuning Hijau 1998",
    category: "retro",
    price: 210000,
    oldPrice: 250000,
    colors: ["#ffdf00", "#009c3b", "#009c3b"],
    pattern: "plain",
    badge: "Retro",
    stock: { S: 2, M: 4, L: 4, XL: 2, XXL: 1 },
    description: "Desain klasik akhir 90-an. Kerah polo, bahan katun-poly.",
  },
  {
    id: "retro-garis-biru-hitam-94",
    name: "Jersey Retro Garis Biru Hitam 1994",
    category: "retro",
    price: 210000,
    colors: ["#0068a8", "#000000", "#ffffff"],
    pattern: "stripes",
    stock: { S: 1, M: 3, L: 3, XL: 1, XXL: 0 },
    description: "Garis vertikal biru-hitam ikonik era 90-an.",
  },
  {
    id: "custom-team-printing",
    name: "Jersey Custom Team (Printing Full)",
    category: "custom",
    price: 135000,
    colors: ["#7b2cbf", "#ffd60a", "#ffffff"],
    pattern: "hoops",
    badge: "Custom",
    stock: { S: 99, M: 99, L: 99, XL: 99, XXL: 99 },
    description: "Desain bebas full printing untuk tim futsal/bola. Minimal order 12 pcs. Detail desain dikonfirmasi via WhatsApp.",
    customizable: true,
  },
];
