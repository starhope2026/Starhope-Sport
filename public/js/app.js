(function () {
  "use strict";

  const STORE = window.STORE;
  const PRODUCTS = window.PRODUCTS;
  const CATEGORIES = window.CATEGORIES;
  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const CART_KEY = "starhope_cart_v1";

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const rupiah = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");
  const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || id;
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const totalStock = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0);
  const sizesOf = (p) => Object.keys(p.stock).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));

  // ---------- Ilustrasi jersey (SVG) ----------
  let svgUid = 0;
  function jerseySVG(colors, pattern) {
    const [main, second, accent] = colors;
    const id = "j" + svgUid++;
    const body =
      "M60 20 L85 10 Q100 22 115 10 L140 20 L180 50 L162 82 L145 72 L145 190 L55 190 L55 72 L38 82 L20 50 Z";
    let deco = "";
    if (pattern === "stripes") {
      for (let x = 62; x < 145; x += 22) deco += `<rect x="${x}" y="0" width="11" height="200" fill="${second}"/>`;
    } else if (pattern === "hoops") {
      for (let y = 60; y < 190; y += 30) deco += `<rect x="0" y="${y}" width="200" height="14" fill="${second}"/>`;
    } else if (pattern === "sash") {
      deco = `<polygon points="40,40 75,40 175,200 140,200" fill="${second}"/>`;
    }
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>
      <path d="${body}" fill="${main}"/>
      <g clip-path="url(#${id})">${deco}</g>
      <path d="${body}" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/>
      <path d="M85 10 Q100 30 115 10" fill="none" stroke="${accent}" stroke-width="5"/>
      <path d="M20 50 L38 82 M180 50 L162 82" stroke="${accent}" stroke-width="5"/>
    </svg>`;
  }
  const productArt = (p) =>
    p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />` : jerseySVG(p.colors, p.pattern);

  // ---------- Cart state ----------
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY)) || [];
      // Buang item yang produknya sudah tidak ada.
      return raw.filter((i) => byId(i.id) && byId(i.id).stock[i.size] !== undefined);
    } catch {
      return [];
    }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }
  const lineKey = (i) => `${i.id}|${i.size}|${i.custom || ""}`;
  // Jumlah total untuk produk+ukuran tertentu di keranjang (semua kustomisasi).
  const qtyInCart = (id, size, exceptKey) =>
    cart.filter((i) => i.id === id && i.size === size && lineKey(i) !== exceptKey).reduce((a, i) => a + i.qty, 0);

  function addToCart(id, size, qty, custom) {
    const p = byId(id);
    const available = p.stock[size] - qtyInCart(id, size);
    if (qty > available) return `Stok ukuran ${size} tersisa ${Math.max(available, 0)}.`;
    const key = lineKey({ id, size, custom });
    const existing = cart.find((i) => lineKey(i) === key);
    if (existing) existing.qty += qty;
    else cart.push({ id, size, qty, custom: custom || "" });
    saveCart();
    return null;
  }
  function setQty(key, qty) {
    const item = cart.find((i) => lineKey(i) === key);
    if (!item) return;
    const max = byId(item.id).stock[item.size] - qtyInCart(item.id, item.size, key);
    item.qty = Math.max(1, Math.min(qty, max));
    saveCart();
  }
  function removeItem(key) {
    cart = cart.filter((i) => lineKey(i) !== key);
    saveCart();
  }
  const subtotal = () => cart.reduce((a, i) => a + byId(i.id).price * i.qty, 0);

  // ---------- Catalog ----------
  const filters = { category: "all", q: "", sort: "default" };

  function renderChips() {
    const all = [{ id: "all", label: "Semua" }, ...CATEGORIES];
    $("#categoryChips").innerHTML = all
      .map((c) => `<button class="chip ${filters.category === c.id ? "active" : ""}" data-cat="${c.id}">${esc(c.label)}</button>`)
      .join("");
  }

  function renderGrid() {
    const q = filters.q.trim().toLowerCase();
    let list = PRODUCTS.filter(
      (p) =>
        (filters.category === "all" || p.category === filters.category) &&
        (!q || p.name.toLowerCase().includes(q) || catLabel(p.category).toLowerCase().includes(q))
    );
    if (filters.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (filters.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (filters.sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "id"));

    $("#productGrid").innerHTML = list
      .map((p) => {
        const soldOut = totalStock(p) === 0;
        const badge = soldOut
          ? `<span class="badge soldout">Habis</span>`
          : p.badge
          ? `<span class="badge">${esc(p.badge)}</span>`
          : "";
        return `<button class="card" data-id="${p.id}">
          <div class="card-art">${badge}${productArt(p)}</div>
          <div class="card-body">
            <span class="tag">${esc(catLabel(p.category))}</span>
            <h3>${esc(p.name)}</h3>
            <div class="price">${rupiah(p.price)}${p.oldPrice ? `<s>${rupiah(p.oldPrice)}</s>` : ""}</div>
          </div>
        </button>`;
      })
      .join("");
    $("#emptyState").hidden = list.length > 0;
  }

  // ---------- Overlays ----------
  function openOverlay(el) {
    el.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeOverlay(el) {
    el.hidden = true;
    if (!document.querySelector(".overlay:not([hidden])")) document.body.style.overflow = "";
  }
  document.querySelectorAll(".overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-close]")) closeOverlay(ov);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".overlay:not([hidden])").forEach(closeOverlay);
  });

  // ---------- Product modal ----------
  let current = null;
  let selectedSize = null;

  function openProduct(id) {
    const p = byId(id);
    current = p;
    selectedSize = null;
    $("#pmArt").innerHTML = productArt(p);
    $("#pmCat").textContent = catLabel(p.category);
    $("#pmName").textContent = p.name;
    $("#pmPrice").innerHTML = rupiah(p.price) + (p.oldPrice ? `<s>${rupiah(p.oldPrice)}</s>` : "");
    $("#pmDesc").textContent = p.description || "";
    $("#pmSizes").innerHTML = sizesOf(p)
      .map((s) => {
        const left = p.stock[s];
        const hint = left === 0 ? "habis" : left <= 3 ? `sisa ${left}` : "";
        return `<button type="button" class="size" data-size="${s}" ${left === 0 ? "disabled" : ""}>${s}${hint ? `<small>${hint}</small>` : ""}</button>`;
      })
      .join("");
    $("#pmCustomWrap").hidden = !p.customizable;
    $("#pmCustom").value = "";
    $("#pmQty").value = 1;
    $("#pmError").hidden = true;
    $("#pmAdd").disabled = totalStock(p) === 0;
    $("#pmAdd").textContent = totalStock(p) === 0 ? "Stok Habis" : "Tambah ke Keranjang";
    openOverlay($("#productModal"));
  }

  $("#pmSizes").addEventListener("click", (e) => {
    const btn = e.target.closest(".size");
    if (!btn || btn.disabled) return;
    selectedSize = btn.dataset.size;
    document.querySelectorAll("#pmSizes .size").forEach((b) => b.classList.toggle("active", b === btn));
    $("#pmError").hidden = true;
  });
  const pmQty = () => Math.max(1, parseInt($("#pmQty").value, 10) || 1);
  $("#pmMinus").addEventListener("click", () => ($("#pmQty").value = Math.max(1, pmQty() - 1)));
  $("#pmPlus").addEventListener("click", () => ($("#pmQty").value = pmQty() + 1));

  $("#pmAdd").addEventListener("click", () => {
    const err = $("#pmError");
    if (!selectedSize) {
      err.textContent = "Pilih ukuran dulu ya.";
      err.hidden = false;
      return;
    }
    const msg = addToCart(current.id, selectedSize, pmQty(), $("#pmCustom").value.trim());
    if (msg) {
      err.textContent = msg;
      err.hidden = false;
      return;
    }
    closeOverlay($("#productModal"));
    toast("Ditambahkan ke keranjang ✓");
  });

  // ---------- Cart drawer ----------
  function renderCart() {
    const count = cart.reduce((a, i) => a + i.qty, 0);
    $("#cartCount").textContent = count;
    $("#cartSubtotal").textContent = rupiah(subtotal());
    $("#toCheckout").disabled = cart.length === 0;

    if (!cart.length) {
      $("#cartItems").innerHTML = `<p class="cart-empty">Keranjang masih kosong.</p>`;
      return;
    }
    $("#cartItems").innerHTML = cart
      .map((i) => {
        const p = byId(i.id);
        const key = esc(lineKey(i));
        return `<div class="cart-item" data-key="${key}">
          <div class="thumb">${productArt(p)}</div>
          <div>
            <h4>${esc(p.name)}</h4>
            <div class="meta">Ukuran ${esc(i.size)}${i.custom ? ` · ${esc(i.custom)}` : ""} · ${rupiah(p.price)}</div>
            <div class="qty" style="margin-top:6px">
              <button type="button" data-act="dec">−</button>
              <input type="number" value="${i.qty}" min="1" data-act="set" />
              <button type="button" data-act="inc">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <strong>${rupiah(p.price * i.qty)}</strong><br />
            <button class="remove" data-act="remove">Hapus</button>
          </div>
        </div>`;
      })
      .join("");
  }

  $("#cartItems").addEventListener("click", (e) => {
    const act = e.target.dataset.act;
    const row = e.target.closest(".cart-item");
    if (!act || !row) return;
    const key = row.dataset.key;
    const item = cart.find((i) => lineKey(i) === key);
    if (act === "inc") setQty(key, item.qty + 1);
    if (act === "dec") setQty(key, item.qty - 1);
    if (act === "remove") removeItem(key);
  });
  $("#cartItems").addEventListener("change", (e) => {
    if (e.target.dataset.act !== "set") return;
    setQty(e.target.closest(".cart-item").dataset.key, parseInt(e.target.value, 10) || 1);
  });

  $("#cartOpen").addEventListener("click", () => openOverlay($("#cartDrawer")));
  $("#toCheckout").addEventListener("click", () => {
    closeOverlay($("#cartDrawer"));
    renderSummary();
    $("#coError").hidden = true;
    $("#coDone").hidden = true;
    $("#checkoutForm").hidden = false;
    openOverlay($("#checkoutModal"));
  });

  // ---------- Checkout ----------
  function renderSummary() {
    const rows = cart
      .map((i) => {
        const p = byId(i.id);
        return `<div class="row"><span>${esc(p.name)} (${esc(i.size)}) ×${i.qty}</span><span>${rupiah(p.price * i.qty)}</span></div>`;
      })
      .join("");
    const ship = STORE.shippingFlat
      ? `<div class="row"><span>Ongkir</span><span>${rupiah(STORE.shippingFlat)}</span></div>`
      : `<div class="row"><span>Ongkir</span><span>Dikonfirmasi admin</span></div>`;
    $("#coSummary").innerHTML =
      rows + ship + `<div class="row total"><span>Total</span><span>${rupiah(subtotal() + (STORE.shippingFlat || 0))}</span></div>`;
  }

  function buildWhatsAppMessage(d) {
    const lines = cart.map((i, n) => {
      const p = byId(i.id);
      return `${n + 1}. ${p.name}\n   Ukuran: ${i.size}${i.custom ? ` | Custom: ${i.custom}` : ""}\n   ${i.qty} x ${rupiah(p.price)} = ${rupiah(p.price * i.qty)}`;
    });
    const total = subtotal() + (STORE.shippingFlat || 0);
    return [
      `Halo ${STORE.name}, saya mau order:`,
      "",
      ...lines,
      "",
      `Subtotal: ${rupiah(subtotal())}`,
      STORE.shippingFlat ? `Ongkir: ${rupiah(STORE.shippingFlat)}` : "Ongkir: mohon dihitungkan",
      `Total: ${rupiah(total)}`,
      "",
      "*Data Pengiriman*",
      `Nama: ${d.name}`,
      `HP: ${d.phone}`,
      `Alamat: ${d.address}`,
      `Kota: ${d.city}${d.zip ? " " + d.zip : ""}`,
      `Kurir: ${d.courier}`,
      d.note ? `Catatan: ${d.note}` : "",
    ]
      .filter((l, idx, arr) => !(l === "" && idx === arr.length - 1))
      .join("\n");
  }

  $("#checkoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const d = Object.fromEntries(new FormData(f).entries());
    Object.keys(d).forEach((k) => (d[k] = String(d[k]).trim()));
    const err = $("#coError");
    if (!d.name || !d.phone || !d.address || !d.city) {
      err.textContent = "Lengkapi nama, no. HP, alamat, dan kota.";
      err.hidden = false;
      return;
    }
    if (!/^(\+?62|0)8\d{7,12}$/.test(d.phone.replace(/[\s-]/g, ""))) {
      err.textContent = "Nomor HP tidak valid (contoh: 081234567890).";
      err.hidden = false;
      return;
    }
    // Pakai link biasa (bukan window.open) supaya tidak kena popup blocker.
    $("#waSend").href = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(buildWhatsAppMessage(d))}`;
    f.hidden = true;
    $("#coDone").hidden = false;
  });

  $("#waSend").addEventListener("click", () => {
    cart = [];
    saveCart();
    $("#checkoutForm").reset();
    closeOverlay($("#checkoutModal"));
    toast("Terima kasih! Lanjutkan kirim pesan di WhatsApp.");
  });
  $("#coBack").addEventListener("click", () => {
    $("#coDone").hidden = true;
    $("#checkoutForm").hidden = false;
  });

  // ---------- Misc ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  $("#categoryChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filters.category = chip.dataset.cat;
    renderChips();
    renderGrid();
  });
  $("#search").addEventListener("input", (e) => {
    filters.q = e.target.value;
    renderGrid();
  });
  $("#sort").addEventListener("change", (e) => {
    filters.sort = e.target.value;
    renderGrid();
  });
  $("#productGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) openProduct(card.dataset.id);
  });

  $("#heroArt").innerHTML = jerseySVG(["#c8102e", "#111", "#fff"], "stripes") + jerseySVG(["#fff", "#1d3f8f", "#1d3f8f"], "sash");
  $("#waLink").href = `https://wa.me/${STORE.whatsapp}`;
  $("#year").textContent = new Date().getFullYear();

  renderChips();
  renderGrid();
  renderCart();
})();
