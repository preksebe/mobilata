"""Genereaza supabase/schema_si_date.sql (PostgreSQL) din seed_data.py.
Rulare, din folderul mobilata:  python supabase/build_sql.py
"""
import os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import seed_data


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "produs"


def q(v):
    return "'" + str(v).replace("'", "''") + "'"


SCHEMA = """-- MobilaTa: schema pentru Supabase (PostgreSQL). Se ruleaza o singura data, in SQL Editor.
create table if not exists categories (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  description text,
  image text,
  sort integer not null default 0
);
create table if not exists products (
  id bigint generated always as identity primary key,
  category_id bigint not null references categories(id),
  slug text unique not null,
  name text not null,
  short_desc text,
  description text,
  price integer not null,
  material text,
  dimensions text,
  color text,
  stock integer not null default 0,
  image text,
  created_at timestamptz not null default now()
);
create table if not exists reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  author text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null,
  created_at timestamptz not null default now()
);
create table if not exists orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  customer_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  city text not null,
  payment_method text not null,
  status text not null,
  subtotal integer not null,
  shipping integer not null,
  total integer not null
);
create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id bigint references products(id) on delete set null,
  name text not null,
  price integer not null,
  qty integer not null
);

-- Securitate: oricine (cheia publica) poate CITI catalogul si recenziile, nimic altceva.
-- Comenzile nu au nicio regula de acces, deci raman inchise pentru cheia publica.
alter table categories enable row level security;
alter table products enable row level security;
alter table reviews enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
create policy "citire publica categorii" on categories for select using (true);
create policy "citire publica produse" on products for select using (true);
create policy "citire publica recenzii" on reviews for select using (true);
"""

out = [SCHEMA, "\n-- Date de pornire (aceleasi ca in seed_data.py)\n"]
for i, c in enumerate(seed_data.CATEGORIES):
    out.append("insert into categories (slug, name, description, image, sort) values (%s, %s, %s, %s, %d);\n"
               % (q(c["slug"]), q(c["name"]), q(c["description"]), q(c["image"]), i))
pool = seed_data.REVIEW_POOL
for i, p in enumerate(seed_data.PRODUCTS):
    out.append(
        "insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) "
        "values ((select id from categories where slug = %s), %s, %s, %s, %s, %d, %s, %s, %s, %d, %s);\n"
        % (q(p["category"]), q(slugify(p["name"])), q(p["name"]), q(p["short_desc"]), q(p["description"]),
           p["price"], q(p["material"]), q(p["dimensions"]), q(p["color"]), p["stock"], q(p["image"])))
    for j in range(2 + i % 2):
        author, rating, text = pool[(i * 3 + j) % len(pool)]
        out.append(
            "insert into reviews (product_id, author, rating, text) values ((select id from products where slug = %s), %s, %d, %s);\n"
            % (q(slugify(p["name"])), q(author), rating, q(text)))

dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema_si_date.sql")
with open(dest, "w", encoding="utf-8") as f:
    f.write("".join(out))
print("Scris:", dest, "| categorii:", len(seed_data.CATEGORIES), "| produse:", len(seed_data.PRODUCTS))
