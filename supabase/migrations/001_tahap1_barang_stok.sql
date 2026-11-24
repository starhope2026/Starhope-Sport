-- =====================================================================
-- Starhope Sport — Tahap 1: Dasar & Admin (barang, stok per ukuran)
-- Jalankan SEKALI di Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- =====================================================================

-- ---------- Staf / admin ----------
-- Akun login dibuat di Supabase Auth; tabel ini menentukan siapa yang admin
-- dan perannya. owner = pemilik (lihat harga modal), staf = gudang.
create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('owner', 'staf')),
  created_at timestamptz not null default now()
);

create or replace function public.staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'owner')
$$;

-- ---------- Kategori ----------
create table public.categories (
  id     bigint generated always as identity primary key,
  name   text not null unique check (length(trim(name)) > 0),
  sort   int not null default 0,
  active boolean not null default true
);

insert into public.categories (name, sort) values
  ('NRL', 1), ('AFL', 2), ('FOOTBALL PREMIUM', 3), ('FOOTBALL LOKAL', 4),
  ('NBA', 5), ('NBA KIDS', 6), ('FOOTBALL KIDS', 7);

-- ---------- Produk (artikel) ----------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,                        -- kode artikel (opsional, unik)
  name            text not null check (length(trim(name)) > 0),
  team            text,                               -- model / tim
  category_id     bigint references public.categories (id) on delete restrict,
  description     text,
  photo_path      text,                               -- path di storage bucket product-photos
  retail_price    int not null check (retail_price >= 0),     -- eceran
  wholesale_price int check (wholesale_price >= 0),           -- grosir
  bulk_price      int check (bulk_price >= 0),                -- partai
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Harga modal dipisah supaya TIDAK PERNAH bisa dibaca pelanggan / staf gudang.
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price int not null check (cost_price >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- Varian (stok per ukuran) ----------
create table public.variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size       text not null check (length(trim(size)) > 0),
  sort       int not null default 0,
  stock      int not null default 0 check (stock >= 0),     -- stok fisik
  reserved   int not null default 0 check (reserved >= 0),  -- dikunci checkout (tahap 3)
  min_stock  int not null default 0 check (min_stock >= 0), -- batas peringatan restok
  unique (product_id, size),
  check (reserved <= stock)
);
create index on public.variants (product_id);

-- ---------- Riwayat stok ----------
create table public.stock_movements (
  id          bigint generated always as identity primary key,
  variant_id  uuid not null references public.variants (id) on delete cascade,
  change      int not null check (change <> 0),
  reason      text not null check (reason in ('awal', 'masuk', 'koreksi', 'penjualan', 'pembatalan')),
  note        text,
  stock_after int not null,
  actor       uuid references public.staff (user_id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index on public.stock_movements (variant_id, created_at desc);
create index on public.stock_movements (created_at desc);

-- ---------- updated_at otomatis ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Fungsi stok. Stok HANYA berubah lewat fungsi ini, selalu tercatat di riwayat.
-- =====================================================================

-- Internal: dipakai fungsi lain, tidak bisa dipanggil langsung dari aplikasi.
create or replace function public._apply_stock(p_variant uuid, p_change int, p_reason text, p_note text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_stock int; v_reserved int; v_size text; v_name text;
begin
  if p_change = 0 then return null; end if;

  select v.stock, v.reserved, v.size, p.name into v_stock, v_reserved, v_size, v_name
  from variants v join products p on p.id = v.product_id
  where v.id = p_variant for update of v;
  if not found then raise exception 'Varian tidak ditemukan'; end if;

  if v_stock + p_change < v_reserved then
    raise exception 'Stok % ukuran % tidak cukup (stok %, sedang dipesan %)', v_name, v_size, v_stock, v_reserved;
  end if;

  update variants set stock = stock + p_change where id = p_variant returning stock into v_stock;
  insert into stock_movements (variant_id, change, reason, note, stock_after)
  values (p_variant, p_change, p_reason, nullif(trim(p_note), ''), v_stock);
  return v_stock;
end $$;

-- Stok masuk / koreksi beberapa ukuran sekaligus (satu transaksi).
-- p_items: [{"variant_id": "...", "change": 5}, ...]
create or replace function public.adjust_stock(p_items jsonb, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if not is_staff() then raise exception 'Tidak diizinkan' using errcode = '42501'; end if;
  if p_reason not in ('masuk', 'koreksi') then raise exception 'Alasan tidak valid'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tidak ada perubahan stok';
  end if;
  if p_reason = 'masuk' and exists (
    select 1 from jsonb_array_elements(p_items) x where (x->>'change')::int < 0
  ) then
    raise exception 'Stok masuk tidak boleh minus. Gunakan koreksi stok.';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    perform _apply_stock((it->>'variant_id')::uuid, (it->>'change')::int, p_reason, p_note);
  end loop;
end $$;

-- Simpan produk + ukuran dalam satu transaksi.
-- p: { id?, code, name, team, category_id, description, photo_path,
--      retail_price, wholesale_price, bulk_price, active,
--      cost_price?        (hanya owner),
--      replace_variants   (true = ukuran yang tidak dikirim dihapus),
--      variants: [{ size, min_stock?, stock? }] }
-- variants[].stock = stok SEBENARNYA. Ukuran baru → dicatat "awal";
-- ukuran lama → selisihnya dicatat "koreksi".
create or replace function public.save_product(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_sizes text[];
  v jsonb; v_ord bigint; v_size text; v_var uuid; v_inserted boolean;
  v_cur int; v_target int; v_note text := coalesce(nullif(trim(p->>'stock_note'), ''), null);
  r record;
begin
  if not is_staff() then raise exception 'Tidak diizinkan' using errcode = '42501'; end if;
  if coalesce(trim(p->>'name'), '') = '' then raise exception 'Nama barang wajib diisi'; end if;
  if nullif(p->>'retail_price', '') is null then raise exception 'Harga eceran wajib diisi'; end if;

  if v_id is null then
    insert into products (code, name, team, category_id, description, photo_path,
                          retail_price, wholesale_price, bulk_price, active)
    values (nullif(trim(p->>'code'), ''), trim(p->>'name'), nullif(trim(p->>'team'), ''),
            nullif(p->>'category_id', '')::bigint, nullif(trim(p->>'description'), ''),
            nullif(p->>'photo_path', ''), (p->>'retail_price')::int,
            nullif(p->>'wholesale_price', '')::int, nullif(p->>'bulk_price', '')::int,
            coalesce((p->>'active')::boolean, true))
    returning id into v_id;
  else
    -- Hanya kolom yang dikirim yang diubah (impor Excel tidak menghapus foto, dll).
    update products set
      code            = case when p ? 'code' then nullif(trim(p->>'code'), '') else code end,
      name            = trim(p->>'name'),
      team            = case when p ? 'team' then nullif(trim(p->>'team'), '') else team end,
      category_id     = case when p ? 'category_id' then nullif(p->>'category_id', '')::bigint else category_id end,
      description     = case when p ? 'description' then nullif(trim(p->>'description'), '') else description end,
      photo_path      = case when p ? 'photo_path' then nullif(p->>'photo_path', '') else photo_path end,
      retail_price    = (p->>'retail_price')::int,
      wholesale_price = case when p ? 'wholesale_price' then nullif(p->>'wholesale_price', '')::int else wholesale_price end,
      bulk_price      = case when p ? 'bulk_price' then nullif(p->>'bulk_price', '')::int else bulk_price end,
      active          = coalesce((p->>'active')::boolean, active)
    where id = v_id;
    if not found then raise exception 'Barang tidak ditemukan'; end if;
  end if;

  if p ? 'cost_price' then
    if not is_owner() then raise exception 'Hanya pemilik yang bisa mengubah harga modal'; end if;
    if nullif(p->>'cost_price', '') is null then
      delete from product_costs where product_id = v_id;
    else
      insert into product_costs (product_id, cost_price) values (v_id, (p->>'cost_price')::int)
      on conflict (product_id) do update set cost_price = excluded.cost_price, updated_at = now();
    end if;
  end if;

  -- Ukuran
  select array_agg(upper(trim(x->>'size'))) into v_sizes
  from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb)) x;
  v_sizes := coalesce(v_sizes, '{}');

  if exists (select 1 from unnest(v_sizes) s where s is null or s = '') then
    raise exception 'Ukuran tidak boleh kosong';
  end if;
  if cardinality(v_sizes) <> (select count(distinct s) from unnest(v_sizes) s) then
    raise exception 'Ada ukuran yang dobel';
  end if;

  if coalesce((p->>'replace_variants')::boolean, false) then
    for r in select id, size, stock, reserved from variants
             where product_id = v_id and not (size = any (v_sizes)) loop
      if r.stock > 0 or r.reserved > 0 then
        raise exception 'Ukuran % tidak bisa dihapus karena masih ada stok (%). Koreksi stok ke 0 dulu.', r.size, r.stock;
      end if;
      delete from variants where id = r.id;
    end loop;
  end if;

  for v, v_ord in select * from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb)) with ordinality loop
    v_size := upper(trim(v->>'size'));
    insert into variants (product_id, size, sort, min_stock)
    values (v_id, v_size, v_ord::int, coalesce(nullif(v->>'min_stock', '')::int, 0))
    on conflict (product_id, size) do update
      set sort = excluded.sort,
          min_stock = coalesce(nullif(v->>'min_stock', '')::int, variants.min_stock)
    returning id, (xmax = 0), stock into v_var, v_inserted, v_cur;

    v_target := nullif(v->>'stock', '')::int;
    if v_target is not null then
      if v_target < 0 then raise exception 'Stok ukuran % tidak boleh minus', v_size; end if;
      perform _apply_stock(v_var, v_target - v_cur,
                           case when v_inserted then 'awal' else 'koreksi' end, v_note);
    end if;
  end loop;

  return v_id;
end $$;

-- Impor banyak produk sekaligus (dari Excel). Semua atau tidak sama sekali.
-- rows: array objek seperti save_product; dicocokkan dengan kode artikel.
create or replace function public.import_products(rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare r jsonb; v_n int := 0; v_idx int := 0; v_id uuid;
begin
  if not is_staff() then raise exception 'Tidak diizinkan' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    v_idx := v_idx + 1;
    if coalesce(trim(r->>'code'), '') = '' then
      raise exception 'Baris %: kode artikel wajib diisi untuk impor', v_idx;
    end if;
    select id into v_id from products where code = trim(r->>'code');
    begin
      perform save_product(r || jsonb_build_object(
        'id', v_id, 'replace_variants', false, 'stock_note', 'Impor Excel'));
    exception when others then
      raise exception 'Baris % (%): %', v_idx, r->>'code', sqlerrm;
    end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- =====================================================================
-- Keamanan (Row Level Security)
-- =====================================================================
alter table public.staff           enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_costs   enable row level security;
alter table public.variants        enable row level security;
alter table public.stock_movements enable row level security;

-- Staf: sesama admin bisa lihat nama & peran (untuk riwayat stok).
-- Tambah staf lewat SQL (lihat docs/SETUP.md).
create policy staff_read on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Kategori: publik bisa lihat yang aktif (untuk katalog), staf kelola.
create policy categories_read on public.categories for select to anon, authenticated
  using (active or public.is_staff());
create policy categories_write on public.categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Produk: publik lihat yang aktif. Tambah/ubah lewat save_product; staf boleh
-- arsip/aktifkan langsung; hapus hanya owner.
create policy products_read on public.products for select to anon, authenticated
  using (active or public.is_staff());
create policy products_update on public.products for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy products_delete on public.products for delete to authenticated
  using (public.is_owner());

-- Harga modal: hanya owner.
create policy costs_owner on public.product_costs for select to authenticated
  using (public.is_owner());

-- Varian: publik lihat varian produk aktif. Tidak ada tulis langsung — stok
-- hanya berubah lewat fungsi di atas.
create policy variants_read on public.variants for select to anon, authenticated
  using (public.is_staff() or exists (
    select 1 from public.products p where p.id = product_id and p.active));

-- Riwayat stok: hanya staf, hanya baca.
create policy movements_read on public.stock_movements for select to authenticated
  using (public.is_staff());

-- Hak akses tabel & fungsi
grant select on public.categories, public.products, public.variants to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant update (active) on public.products to authenticated;
grant delete on public.products to authenticated;
grant select on public.product_costs, public.stock_movements, public.staff to authenticated;

revoke execute on function public._apply_stock(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.adjust_stock(jsonb, text, text) from public, anon;
revoke execute on function public.save_product(jsonb) from public, anon;
revoke execute on function public.import_products(jsonb) from public, anon;
grant execute on function public.adjust_stock(jsonb, text, text) to authenticated;
grant execute on function public.save_product(jsonb) to authenticated;
grant execute on function public.import_products(jsonb) to authenticated;

-- =====================================================================
-- Foto produk (Supabase Storage)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy photos_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and public.is_staff());
create policy photos_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and public.is_staff());
create policy photos_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and public.is_staff());
