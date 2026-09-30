import json
import os
import re
import secrets
import sqlite3
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, Response, abort, flash, g, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

import seed_data

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "data", "mobilata.db")
UPLOAD_DIR = os.path.join(HERE, "static", "uploads")
ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "webp"}

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin"

ROLES = {"admin": "Administrator", "manager": "Gestionar produse"}
PAYMENT_METHODS = {
    "card": "Card online",
    "ramburs": "Ramburs la livrare",
    "transfer": "Transfer bancar",
}
ORDER_STATUSES = {
    "asteptare_plata": "În așteptare plată",
    "platita": "Plătită",
    "confirmata": "Confirmată",
    "livrata": "Livrată",
    "anulata": "Anulată",
}
IN_PROGRESS_STATUSES = ("asteptare_plata", "platita", "confirmata")
FREE_SHIPPING_FROM = 1500
SHIPPING_COST = 99

GOOGLE_CREDENTIALS_FILE = os.path.join(HERE, "google_client_secret.json")


def load_google_credentials():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if client_id and client_secret:
        return client_id, client_secret
    if os.path.isfile(GOOGLE_CREDENTIALS_FILE):
        with open(GOOGLE_CREDENTIALS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        data = data.get("web", data)
        if data.get("client_id") and data.get("client_secret"):
            return data["client_id"], data["client_secret"]
    return None, None

app = Flask(__name__)
app.secret_key = os.environ.get("MOBILATA_SECRET", "mobilata-dev-secret-schimba-ma")
app.config.update(
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=8 * 1024 * 1024,
)


# ---------- Baza de date ----------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "produs"


def unique_slug(db, base, exclude_id=None):
    slug, n = base, 2
    while True:
        row = db.execute("SELECT id FROM products WHERE slug = ?", (slug,)).fetchone()
        if row is None or row["id"] == exclude_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            image TEXT,
            sort INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            short_desc TEXT,
            description TEXT,
            price INTEGER NOT NULL,
            material TEXT,
            dimensions TEXT,
            color TEXT,
            stock INTEGER NOT NULL DEFAULT 0,
            image TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            author TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            text TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            created_at TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            status TEXT NOT NULL,
            subtotal INTEGER NOT NULL,
            shipping INTEGER NOT NULL,
            total INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            qty INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT,
            google_sub TEXT UNIQUE,
            phone TEXT,
            preferred_payment TEXT,
            marketing_opt_in INTEGER NOT NULL DEFAULT 0,
            terms_accepted_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS customer_log (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            staff_username TEXT NOT NULL,
            action TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    """)
    order_columns = [r["name"] for r in db.execute("PRAGMA table_info(orders)")]
    if "customer_id" not in order_columns:
        db.execute("ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL")

    if db.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
        for i, c in enumerate(seed_data.CATEGORIES):
            db.execute(
                "INSERT INTO categories (slug, name, description, image, sort) VALUES (?, ?, ?, ?, ?)",
                (c["slug"], c["name"], c["description"], c["image"], i),
            )

    if db.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
        cat_ids = {r["slug"]: r["id"] for r in db.execute("SELECT id, slug FROM categories")}
        pool = seed_data.REVIEW_POOL
        for i, p in enumerate(seed_data.PRODUCTS):
            cur = db.execute(
                """INSERT INTO products (category_id, slug, name, short_desc, description, price,
                   material, dimensions, color, stock, image, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (cat_ids[p["category"]], slugify(p["name"]), p["name"], p["short_desc"], p["description"],
                 p["price"], p["material"], p["dimensions"], p["color"], p["stock"], p["image"], now()),
            )
            for j in range(2 + i % 2):
                author, rating, text = pool[(i * 3 + j) % len(pool)]
                db.execute(
                    "INSERT INTO reviews (product_id, author, rating, text, created_at) VALUES (?, ?, ?, ?, ?)",
                    (cur.lastrowid, author, rating, text, now()),
                )

    if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        db.execute(
            "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
            (DEFAULT_ADMIN_USERNAME, generate_password_hash(DEFAULT_ADMIN_PASSWORD), now()),
        )
    db.commit()
    db.close()


# ---------- Ajutoare pentru șabloane ----------

@app.template_filter("lei")
def format_lei(value):
    return f"{int(value):,}".replace(",", ".") + " lei"


@app.template_filter("img")
def image_url(path):
    if not path:
        return url_for("static", filename="img/hero.jpg")
    return url_for("static", filename=path)


def current_customer():
    if "customer" not in g:
        g.customer = None
        cid = session.get("customer_id")
        if cid:
            g.customer = get_db().execute("SELECT * FROM customers WHERE id = ?", (cid,)).fetchone()
            if g.customer is None:
                session.pop("customer_id", None)
    return g.customer


@app.context_processor
def inject_globals():
    cart = session.get("cart", {})
    categories = get_db().execute("SELECT slug, name FROM categories ORDER BY sort").fetchall()
    return {
        "cart_count": sum(cart.values()),
        "nav_categories": categories,
        "customer": current_customer(),
        "ROLES": ROLES,
        "PAYMENT_METHODS": PAYMENT_METHODS,
        "ORDER_STATUSES": ORDER_STATUSES,
    }


def safe_next(default):
    target = request.form.get("next") or request.args.get("next") or ""
    if target.startswith("/") and not target.startswith("//"):
        return target
    return default


# ---------- Autentificare și roluri ----------

STAFF_KEYS = ("user_id", "username", "role")


def role_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get("role"):
                return redirect(url_for("admin_login", next=request.path))
            if session["role"] not in roles:
                abort(403)
            return view(*args, **kwargs)
        return wrapped
    return decorator


@app.route("/admin/autentificare", methods=["GET", "POST"])
def admin_login():
    if session.get("role"):
        return redirect(url_for("admin_home"))
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if user and check_password_hash(user["password_hash"], password):
            session.permanent = True
            session.update(user_id=user["id"], username=user["username"], role=user["role"])
            return redirect(safe_next(url_for("admin_home")))
        error = "Utilizator sau parolă greșită."
    return render_template("admin/login.html", error=error)


@app.route("/admin/iesire", methods=["POST"])
def logout():
    for key in STAFF_KEYS:
        session.pop(key, None)
    return redirect(url_for("index"))


# ---------- Magazin ----------

PRODUCT_LIST_SQL = """
    SELECT p.*, c.slug AS category_slug, c.name AS category_name,
           COALESCE(AVG(r.rating), 0) AS avg_rating, COUNT(r.id) AS review_count
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN reviews r ON r.product_id = p.id
"""


@app.route("/")
def index():
    categories = get_db().execute("""
        SELECT c.*, COUNT(p.id) AS product_count
        FROM categories c LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id ORDER BY c.sort
    """).fetchall()
    return render_template("index.html", categories=categories)


@app.route("/categorie/<slug>")
def category(slug):
    db = get_db()
    cat = db.execute("SELECT * FROM categories WHERE slug = ?", (slug,)).fetchone()
    if cat is None:
        abort(404)
    products = db.execute(
        PRODUCT_LIST_SQL + " WHERE c.id = ? GROUP BY p.id ORDER BY p.created_at, p.id", (cat["id"],)
    ).fetchall()
    return render_template("category.html", category=cat, products=products)


@app.route("/produs/<slug>")
def product(slug):
    db = get_db()
    item = db.execute(PRODUCT_LIST_SQL + " WHERE p.slug = ? GROUP BY p.id", (slug,)).fetchone()
    if item is None:
        abort(404)
    reviews = db.execute(
        "SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC", (item["id"],)
    ).fetchall()
    related = db.execute(
        PRODUCT_LIST_SQL + " WHERE c.id = ? AND p.id != ? GROUP BY p.id ORDER BY RANDOM() LIMIT 3",
        (item["category_id"], item["id"]),
    ).fetchall()
    return render_template("product.html", product=item, reviews=reviews, related=related)


@app.route("/produs/<slug>/recenzie", methods=["POST"])
def add_review(slug):
    db = get_db()
    item = db.execute("SELECT id FROM products WHERE slug = ?", (slug,)).fetchone()
    if item is None:
        abort(404)
    author = request.form.get("author", "").strip()[:60]
    text = request.form.get("text", "").strip()[:1000]
    try:
        rating = int(request.form.get("rating", 0))
    except ValueError:
        rating = 0
    if not author or len(text) < 3 or not 1 <= rating <= 5:
        flash("Completează numele, nota și un mesaj de cel puțin 3 caractere.", "error")
    else:
        db.execute(
            "INSERT INTO reviews (product_id, author, rating, text, created_at) VALUES (?, ?, ?, ?, ?)",
            (item["id"], author, rating, text, now()),
        )
        db.commit()
        flash("Mulțumim! Recenzia ta a fost publicată.", "success")
    return redirect(url_for("product", slug=slug) + "#recenzii")


@app.route("/credite")
def credits():
    return render_template("credits.html", credits=seed_data.CREDITS)


# ---------- Coș de cumpărături ----------

def load_cart():
    cart = session.get("cart", {})
    if not cart:
        return [], 0, 0, 0
    db = get_db()
    ids = [int(pid) for pid in cart]
    rows = db.execute(
        f"SELECT * FROM products WHERE id IN ({','.join('?' * len(ids))})", ids
    ).fetchall()
    items, subtotal = [], 0
    for row in rows:
        qty = min(cart[str(row["id"])], row["stock"])
        if qty <= 0:
            continue
        line = row["price"] * qty
        subtotal += line
        items.append({"product": row, "qty": qty, "line_total": line})
    shipping = 0 if subtotal >= FREE_SHIPPING_FROM or subtotal == 0 else SHIPPING_COST
    return items, subtotal, shipping, subtotal + shipping


def set_cart_qty(product_id, qty):
    cart = dict(session.get("cart", {}))
    if qty <= 0:
        cart.pop(str(product_id), None)
    else:
        cart[str(product_id)] = qty
    session["cart"] = cart


@app.route("/cos")
def cart():
    items, subtotal, shipping, total = load_cart()
    return render_template(
        "cart.html", items=items, subtotal=subtotal, shipping=shipping, total=total,
        free_from=FREE_SHIPPING_FROM,
    )


@app.route("/cos/adauga", methods=["POST"])
def cart_add():
    try:
        pid = int(request.form.get("product_id", 0))
        qty = max(1, int(request.form.get("qty", 1)))
    except ValueError:
        abort(400)
    item = get_db().execute("SELECT id, name, stock FROM products WHERE id = ?", (pid,)).fetchone()
    if item is None:
        abort(404)
    current = session.get("cart", {}).get(str(pid), 0)
    new_qty = min(current + qty, item["stock"])
    if new_qty <= current:
        flash(f"Nu mai avem „{item['name']}” în stoc în cantitatea cerută.", "error")
    else:
        set_cart_qty(pid, new_qty)
        flash(f"Am adăugat „{item['name']}” în coș.", "success")
    return redirect(safe_next(url_for("cart")))


@app.route("/cos/actualizeaza", methods=["POST"])
def cart_update():
    try:
        pid = int(request.form.get("product_id", 0))
        qty = int(request.form.get("qty", 0))
    except ValueError:
        abort(400)
    item = get_db().execute("SELECT stock FROM products WHERE id = ?", (pid,)).fetchone()
    set_cart_qty(pid, min(qty, item["stock"]) if item else 0)
    return redirect(url_for("cart"))


# ---------- Comandă și plată ----------

@app.route("/comanda", methods=["GET", "POST"])
def checkout():
    items, subtotal, shipping, total = load_cart()
    if not items:
        flash("Coșul tău e gol.", "error")
        return redirect(url_for("cart"))

    customer = current_customer()
    addresses = []
    if customer:
        addresses = get_db().execute(
            "SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id", (customer["id"],)
        ).fetchall()

    form = {k: request.form.get(k, "").strip() for k in ("name", "email", "phone", "address", "city", "payment")}
    errors = []
    if request.method == "GET" and customer:
        default = addresses[0] if addresses else None
        form.update(
            name=customer["name"], email=customer["email"], phone=customer["phone"] or "",
            address=default["address"] if default else "", city=default["city"] if default else "",
            payment=customer["preferred_payment"] or "",
        )
    if request.method == "POST":
        if not form["name"]:
            errors.append("Scrie numele complet.")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", form["email"]):
            errors.append("Scrie o adresă de email validă.")
        if len(re.sub(r"\D", "", form["phone"])) < 10:
            errors.append("Scrie un număr de telefon de cel puțin 10 cifre.")
        if not form["address"] or not form["city"]:
            errors.append("Completează adresa și orașul.")
        if form["payment"] not in PAYMENT_METHODS:
            errors.append("Alege o metodă de plată.")

        if not errors:
            db = get_db()
            status = "asteptare_plata" if form["payment"] in ("card", "transfer") else "confirmata"
            cur = db.execute(
                """INSERT INTO orders (created_at, customer_name, email, phone, address, city,
                   payment_method, status, subtotal, shipping, total, customer_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (now(), form["name"], form["email"], form["phone"], form["address"], form["city"],
                 form["payment"], status, subtotal, shipping, total, customer["id"] if customer else None),
            )
            order_id = cur.lastrowid
            if customer and request.form.get("save_address"):
                already = db.execute(
                    "SELECT 1 FROM addresses WHERE customer_id = ? AND address = ? AND city = ?",
                    (customer["id"], form["address"], form["city"]),
                ).fetchone()
                if not already:
                    db.execute(
                        "INSERT INTO addresses (customer_id, label, address, city, is_default) VALUES (?, ?, ?, ?, ?)",
                        (customer["id"], "Adresă de livrare", form["address"], form["city"], 0 if addresses else 1),
                    )
            for it in items:
                p = it["product"]
                db.execute(
                    "INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
                    (order_id, p["id"], p["name"], p["price"], it["qty"]),
                )
                db.execute("UPDATE products SET stock = stock - ? WHERE id = ?", (it["qty"], p["id"]))
            db.commit()
            session["cart"] = {}
            session["my_orders"] = session.get("my_orders", []) + [order_id]
            if form["payment"] == "card":
                return redirect(url_for("payment", order_id=order_id))
            return redirect(url_for("order_done", order_id=order_id))

    return render_template(
        "checkout.html", items=items, subtotal=subtotal, shipping=shipping, total=total,
        form=form, errors=errors, addresses=addresses,
    )


def own_order_or_404(order_id):
    order = get_db().execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if order is None:
        abort(404)
    customer = current_customer()
    allowed = (
        order_id in session.get("my_orders", [])
        or session.get("role") == "admin"
        or (customer is not None and order["customer_id"] == customer["id"])
    )
    if not allowed:
        abort(404)
    return order


@app.route("/plata/<int:order_id>", methods=["GET", "POST"])
def payment(order_id):
    order = own_order_or_404(order_id)
    if order["payment_method"] != "card" or order["status"] != "asteptare_plata":
        return redirect(url_for("order_done", order_id=order_id))
    if request.method == "POST":
        if request.form.get("result") == "ok":
            db = get_db()
            db.execute("UPDATE orders SET status = 'platita' WHERE id = ?", (order_id,))
            db.commit()
            return redirect(url_for("order_done", order_id=order_id))
        flash("Plata nu a trecut (simulare). Poți încerca din nou.", "error")
    return render_template("payment.html", order=order)


@app.route("/comanda/<int:order_id>")
def order_done(order_id):
    order = own_order_or_404(order_id)
    items = get_db().execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    return render_template("order_done.html", order=order, items=items)


# ---------- Conturi de clienți ----------

EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
CUSTOMER_KEYS = ("customer_id",)


def customer_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_customer() is None:
            return redirect(url_for("customer_login", next=request.path))
        return view(*args, **kwargs)
    return wrapped


def log_in_customer(customer_id):
    session.permanent = True
    session["customer_id"] = customer_id


@app.route("/cont/inregistrare", methods=["GET", "POST"])
def customer_register():
    if current_customer():
        return redirect(url_for("account_orders"))
    form = {k: request.form.get(k, "").strip() for k in ("name", "email")}
    errors = []
    if request.method == "POST":
        email = form["email"].lower()
        password = request.form.get("password", "")
        if not form["name"]:
            errors.append("Scrie-ți numele.")
        if not EMAIL_RE.fullmatch(email):
            errors.append("Scrie o adresă de email validă.")
        if len(password) < 8:
            errors.append("Parola trebuie să aibă cel puțin 8 caractere.")
        elif password != request.form.get("password2", ""):
            errors.append("Cele două parole nu sunt identice.")
        if not request.form.get("terms"):
            errors.append("Ca să-ți faci cont, trebuie să accepți termenii și politica de confidențialitate.")
        db = get_db()
        if not errors and db.execute("SELECT 1 FROM customers WHERE email = ?", (email,)).fetchone():
            errors.append("Există deja un cont cu acest email. Intră în cont sau folosește Google.")
        if not errors:
            cur = db.execute(
                """INSERT INTO customers (email, name, password_hash, marketing_opt_in, terms_accepted_at, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (email, form["name"], generate_password_hash(password),
                 1 if request.form.get("marketing") else 0, now(), now()),
            )
            db.commit()
            log_in_customer(cur.lastrowid)
            flash(f"Bine ai venit, {form['name'].split(' ')[0]}! Contul tău a fost creat.", "success")
            return redirect(safe_next(url_for("account_orders")))
    return render_template("account/register.html", form=form, errors=errors,
                           google_enabled=load_google_credentials()[0] is not None)


@app.route("/cont/autentificare", methods=["GET", "POST"])
def customer_login():
    if current_customer():
        return redirect(url_for("account_orders"))
    error = None
    email = request.form.get("email", "").strip().lower()
    if request.method == "POST":
        row = get_db().execute("SELECT * FROM customers WHERE email = ?", (email,)).fetchone()
        if row and not row["password_hash"]:
            error = "Acest cont folosește autentificarea cu Google. Apasă „Continuă cu Google”."
        elif row and check_password_hash(row["password_hash"], request.form.get("password", "")):
            log_in_customer(row["id"])
            return redirect(safe_next(url_for("account_orders")))
        else:
            error = "Email sau parolă greșită."
    return render_template("account/login.html", error=error, email=email,
                           google_enabled=load_google_credentials()[0] is not None)


@app.route("/cont/iesire", methods=["POST"])
def customer_logout():
    for key in CUSTOMER_KEYS:
        session.pop(key, None)
    flash("Ai ieșit din cont.", "success")
    return redirect(url_for("index"))


@app.route("/cont/google")
def google_start():
    client_id, _ = load_google_credentials()
    if not client_id:
        flash("Autentificarea cu Google nu e configurată încă pe acest magazin.", "error")
        return redirect(url_for("customer_login"))
    state = secrets.token_urlsafe(24)
    session["oauth_state"] = state
    session["oauth_next"] = safe_next(url_for("account_orders"))
    params = {
        "client_id": client_id,
        "redirect_uri": url_for("google_callback", _external=True),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params))


def fetch_json(url, data=None, headers=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


@app.route("/cont/google/callback")
def google_callback():
    expected_state = session.pop("oauth_state", None)
    next_url = session.pop("oauth_next", url_for("account_orders"))
    if not expected_state or request.args.get("state") != expected_state or "code" not in request.args:
        flash("Autentificarea cu Google a fost anulată sau a expirat. Încearcă din nou.", "error")
        return redirect(url_for("customer_login"))

    client_id, client_secret = load_google_credentials()
    try:
        token = fetch_json("https://oauth2.googleapis.com/token", data={
            "code": request.args["code"],
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": url_for("google_callback", _external=True),
            "grant_type": "authorization_code",
        })
        info = fetch_json("https://openidconnect.googleapis.com/v1/userinfo",
                          headers={"Authorization": f"Bearer {token['access_token']}"})
    except (urllib.error.URLError, KeyError, ValueError):
        flash("Nu am putut vorbi cu Google. Încearcă din nou peste câteva minute.", "error")
        return redirect(url_for("customer_login"))

    if not info.get("email_verified") or not info.get("email"):
        flash("Contul Google nu are un email confirmat.", "error")
        return redirect(url_for("customer_login"))

    db = get_db()
    email = info["email"].lower()
    row = db.execute("SELECT id FROM customers WHERE google_sub = ?", (info["sub"],)).fetchone()
    if row is None:
        row = db.execute("SELECT id FROM customers WHERE email = ?", (email,)).fetchone()
        if row:
            db.execute("UPDATE customers SET google_sub = ? WHERE id = ?", (info["sub"], row["id"]))
        else:
            row = {"id": db.execute(
                """INSERT INTO customers (email, name, google_sub, terms_accepted_at, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (email, info.get("name") or email.split("@")[0], info["sub"], now(), now()),
            ).lastrowid}
            flash("Contul tău a fost creat cu Google.", "success")
        db.commit()
    log_in_customer(row["id"])
    return redirect(next_url)


def orders_with_summary(customer_id):
    return get_db().execute("""
        SELECT o.*, COALESCE(SUM(i.qty), 0) AS item_count, MIN(i.name) AS first_item
        FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
        WHERE o.customer_id = ? GROUP BY o.id ORDER BY o.id DESC
    """, (customer_id,)).fetchall()


@app.route("/contul-meu")
@customer_required
def account_orders():
    orders = orders_with_summary(current_customer()["id"])
    current = [o for o in orders if o["status"] in IN_PROGRESS_STATUSES]
    past = [o for o in orders if o["status"] not in IN_PROGRESS_STATUSES]
    return render_template("account/orders.html", current=current, past=past, active="comenzi")


def customer_addresses(customer_id):
    return get_db().execute(
        "SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id", (customer_id,)
    ).fetchall()


def handle_address_action(customer_id, allow_edit=False):
    """Aplică acțiunea din formular pe adresele clientului. Întoarce o descriere pentru istoric, sau None."""
    db = get_db()
    action = request.form.get("action")
    addr_id = request.form.get("address_id", type=int)
    owned = addr_id is not None and db.execute(
        "SELECT 1 FROM addresses WHERE id = ? AND customer_id = ?", (addr_id, customer_id)
    ).fetchone()
    label = request.form.get("label", "").strip()[:40] or "Adresă"
    address = request.form.get("address", "").strip()
    city = request.form.get("city", "").strip()

    if action in ("add", "edit") and (not address or not city):
        flash("Completează adresa și orașul.", "error")
        return None
    if action == "add":
        has_any = db.execute("SELECT 1 FROM addresses WHERE customer_id = ?", (customer_id,)).fetchone()
        db.execute(
            "INSERT INTO addresses (customer_id, label, address, city, is_default) VALUES (?, ?, ?, ?, ?)",
            (customer_id, label, address, city, 0 if has_any else 1),
        )
        flash("Adresa a fost salvată.", "success")
        return f"A adăugat adresa „{label}”"
    if action == "edit" and allow_edit and owned:
        db.execute("UPDATE addresses SET label = ?, address = ?, city = ? WHERE id = ?",
                   (label, address, city, addr_id))
        flash("Adresa a fost modificată.", "success")
        return f"A modificat adresa „{label}”"
    if action == "default" and owned:
        db.execute("UPDATE addresses SET is_default = (id = ?) WHERE customer_id = ?", (addr_id, customer_id))
        flash("Am schimbat adresa principală.", "success")
        return "A schimbat adresa principală"
    if action == "delete" and owned:
        db.execute("DELETE FROM addresses WHERE id = ?", (addr_id,))
        if not db.execute("SELECT 1 FROM addresses WHERE customer_id = ? AND is_default = 1",
                          (customer_id,)).fetchone():
            db.execute("""UPDATE addresses SET is_default = 1 WHERE id =
                          (SELECT MIN(id) FROM addresses WHERE customer_id = ?)""", (customer_id,))
        flash("Adresa a fost ștearsă.", "success")
        return "A șters o adresă"
    return None


@app.route("/contul-meu/adrese", methods=["GET", "POST"])
@customer_required
def account_addresses():
    customer = current_customer()
    if request.method == "POST":
        handle_address_action(customer["id"])
        get_db().commit()
        return redirect(url_for("account_addresses"))
    return render_template("account/addresses.html", addresses=customer_addresses(customer["id"]),
                           active="adrese")


@app.route("/contul-meu/plata", methods=["GET", "POST"])
@customer_required
def account_payment():
    customer = current_customer()
    if request.method == "POST":
        method = request.form.get("preferred_payment")
        if method in PAYMENT_METHODS:
            db = get_db()
            db.execute("UPDATE customers SET preferred_payment = ? WHERE id = ?", (method, customer["id"]))
            db.commit()
            flash(f"Metoda preferată e acum: {PAYMENT_METHODS[method]}.", "success")
        return redirect(url_for("account_payment"))
    return render_template("account/payment.html", active="plata")


@app.route("/contul-meu/date", methods=["GET", "POST"])
@customer_required
def account_profile():
    customer = current_customer()
    if request.method == "POST":
        db = get_db()
        if request.form.get("action") == "profile":
            name = request.form.get("name", "").strip()
            phone = request.form.get("phone", "").strip()
            if not name:
                flash("Numele nu poate rămâne gol.", "error")
            else:
                db.execute("UPDATE customers SET name = ?, phone = ? WHERE id = ?", (name, phone, customer["id"]))
                flash("Datele tale au fost salvate.", "success")
        elif request.form.get("action") == "password":
            new = request.form.get("new_password", "")
            if customer["password_hash"] and not check_password_hash(
                    customer["password_hash"], request.form.get("current_password", "")):
                flash("Parola actuală nu e corectă.", "error")
            elif len(new) < 8:
                flash("Parola nouă trebuie să aibă cel puțin 8 caractere.", "error")
            elif new != request.form.get("new_password2", ""):
                flash("Cele două parole noi nu sunt identice.", "error")
            else:
                db.execute("UPDATE customers SET password_hash = ? WHERE id = ?",
                           (generate_password_hash(new), customer["id"]))
                flash("Parola a fost schimbată.", "success")
        db.commit()
        return redirect(url_for("account_profile"))
    return render_template("account/profile.html", active="date")


@app.route("/contul-meu/confidentialitate", methods=["GET", "POST"])
@customer_required
def account_privacy():
    customer = current_customer()
    if request.method == "POST":
        opt_in = 1 if request.form.get("marketing") else 0
        db = get_db()
        db.execute("UPDATE customers SET marketing_opt_in = ? WHERE id = ?", (opt_in, customer["id"]))
        db.commit()
        flash("Am salvat preferințele tale." if opt_in else "Nu îți mai trimitem emailuri de marketing.", "success")
        return redirect(url_for("account_privacy"))
    return render_template("account/privacy.html", active="confidentialitate")


@app.route("/contul-meu/export")
@customer_required
def account_export():
    customer = current_customer()
    db = get_db()
    orders = []
    for o in db.execute("SELECT * FROM orders WHERE customer_id = ? ORDER BY id", (customer["id"],)):
        order = dict(o)
        order["status"] = ORDER_STATUSES.get(order["status"], order["status"])
        order["items"] = [dict(i) for i in db.execute(
            "SELECT name, price, qty FROM order_items WHERE order_id = ?", (o["id"],))]
        orders.append(order)
    data = {
        "exportat_la": now(),
        "cont": {
            "nume": customer["name"],
            "email": customer["email"],
            "telefon": customer["phone"],
            "conectat_cu_google": customer["google_sub"] is not None,
            "are_parola": customer["password_hash"] is not None,
            "metoda_plata_preferata": PAYMENT_METHODS.get(customer["preferred_payment"]),
            "accept_marketing": bool(customer["marketing_opt_in"]),
            "termeni_acceptati_la": customer["terms_accepted_at"],
            "cont_creat_la": customer["created_at"],
        },
        "adrese": [dict(a) for a in db.execute(
            "SELECT label, address, city, is_default FROM addresses WHERE customer_id = ?", (customer["id"],))],
        "comenzi": orders,
    }
    return Response(
        json.dumps(data, ensure_ascii=False, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=datele-mele-mobilata.json"},
    )


def delete_customer(customer_id):
    db = get_db()
    db.execute("UPDATE orders SET customer_id = NULL WHERE customer_id = ?", (customer_id,))
    db.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    db.commit()


@app.route("/contul-meu/sterge", methods=["POST"])
@customer_required
def account_delete():
    customer = current_customer()
    confirm_text = request.form.get("confirm", "").strip().upper().replace("Ș", "S")
    if confirm_text != "STERGE":
        flash("Ca să-ți ștergi contul, scrie cuvântul ȘTERGE în căsuță.", "error")
        return redirect(url_for("account_privacy") + "#sterge")
    if customer["password_hash"] and not check_password_hash(
            customer["password_hash"], request.form.get("password", "")):
        flash("Parola nu e corectă, contul nu a fost șters.", "error")
        return redirect(url_for("account_privacy") + "#sterge")
    delete_customer(customer["id"])
    for key in CUSTOMER_KEYS:
        session.pop(key, None)
    flash("Contul tău și datele din el au fost șterse.", "success")
    return redirect(url_for("index"))


@app.route("/confidentialitate")
def privacy_policy():
    return render_template("privacy_policy.html")


# ---------- Administrare ----------

@app.route("/admin")
@role_required("admin", "manager")
def admin_home():
    return redirect(url_for("admin_products"))


@app.route("/admin/produse")
@role_required("admin", "manager")
def admin_products():
    products = get_db().execute("""
        SELECT p.*, c.name AS category_name FROM products p
        JOIN categories c ON c.id = p.category_id
        ORDER BY c.sort, p.name
    """).fetchall()
    return render_template("admin/products.html", products=products, active="produse")


def save_upload(file):
    if not file or not file.filename:
        return None
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXT:
        raise ValueError("Poza trebuie să fie JPG, PNG sau WEBP.")
    name = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(UPLOAD_DIR, name))
    return f"uploads/{name}"


def read_product_form():
    f = request.form
    data = {k: f.get(k, "").strip() for k in
            ("name", "short_desc", "description", "material", "dimensions", "color")}
    errors = []
    try:
        data["category_id"] = int(f.get("category_id", 0))
    except ValueError:
        data["category_id"] = 0
    try:
        data["price"] = int(f.get("price", ""))
        if data["price"] <= 0:
            raise ValueError
    except ValueError:
        errors.append("Prețul trebuie să fie un număr întreg mai mare ca 0.")
        data["price"] = f.get("price", "")
    try:
        data["stock"] = int(f.get("stock", ""))
        if data["stock"] < 0:
            raise ValueError
    except ValueError:
        errors.append("Stocul trebuie să fie un număr întreg, 0 sau mai mare.")
        data["stock"] = f.get("stock", "")
    if not data["name"]:
        errors.append("Produsul are nevoie de un nume.")
    if not get_db().execute("SELECT 1 FROM categories WHERE id = ?", (data["category_id"],)).fetchone():
        errors.append("Alege o categorie.")
    return data, errors


def delete_uploaded_image(path):
    if path and path.startswith("uploads/"):
        full = os.path.join(HERE, "static", path)
        if os.path.isfile(full):
            os.remove(full)


@app.route("/admin/produse/nou", methods=["GET", "POST"])
@app.route("/admin/produse/<int:product_id>/editeaza", methods=["GET", "POST"])
@role_required("admin", "manager")
def admin_product_form(product_id=None):
    db = get_db()
    existing = None
    if product_id is not None:
        existing = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if existing is None:
            abort(404)
    categories = db.execute("SELECT id, name FROM categories ORDER BY sort").fetchall()
    data = dict(existing) if existing else {"category_id": categories[0]["id"]}
    errors = []

    if request.method == "POST":
        data, errors = read_product_form()
        image = existing["image"] if existing else None
        if not errors:
            try:
                uploaded = save_upload(request.files.get("image"))
                if uploaded:
                    if existing:
                        delete_uploaded_image(existing["image"])
                    image = uploaded
            except ValueError as e:
                errors.append(str(e))
        if not errors:
            slug = unique_slug(db, slugify(data["name"]), exclude_id=product_id)
            values = (data["category_id"], slug, data["name"], data["short_desc"], data["description"],
                      data["price"], data["material"], data["dimensions"], data["color"], data["stock"], image)
            if existing:
                db.execute("""UPDATE products SET category_id=?, slug=?, name=?, short_desc=?, description=?,
                              price=?, material=?, dimensions=?, color=?, stock=?, image=? WHERE id=?""",
                           values + (product_id,))
                flash(f"Am salvat modificările la „{data['name']}”.", "success")
            else:
                db.execute("""INSERT INTO products (category_id, slug, name, short_desc, description, price,
                              material, dimensions, color, stock, image, created_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", values + (now(),))
                flash(f"Am adăugat produsul „{data['name']}”.", "success")
            db.commit()
            return redirect(url_for("admin_products"))
        data["image"] = image

    return render_template("admin/product_form.html", data=data, errors=errors,
                           categories=categories, editing=existing is not None, active="produse")


@app.route("/admin/produse/<int:product_id>/sterge", methods=["POST"])
@role_required("admin", "manager")
def admin_product_delete(product_id):
    db = get_db()
    item = db.execute("SELECT name, image FROM products WHERE id = ?", (product_id,)).fetchone()
    if item:
        db.execute("DELETE FROM products WHERE id = ?", (product_id,))
        db.commit()
        delete_uploaded_image(item["image"])
        cart = dict(session.get("cart", {}))
        cart.pop(str(product_id), None)
        session["cart"] = cart
        flash(f"Am scos produsul „{item['name']}”.", "success")
    return redirect(url_for("admin_products"))


def log_customer_change(customer_id, action):
    get_db().execute(
        "INSERT INTO customer_log (customer_id, staff_username, action, created_at) VALUES (?, ?, ?, ?)",
        (customer_id, session["username"], action, now()),
    )


def customer_or_404(customer_id):
    row = get_db().execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if row is None:
        abort(404)
    return row


@app.route("/admin/clienti")
@role_required("admin")
def admin_customers():
    q = request.args.get("q", "").strip()
    sql = """
        SELECT c.id, c.name, c.email, c.phone, c.created_at,
               c.password_hash IS NOT NULL AS has_password, c.google_sub IS NOT NULL AS has_google,
               COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_spent
        FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    """
    params = ()
    if q:
        sql += " WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?"
        params = (f"%{q}%",) * 3
    sql += " GROUP BY c.id ORDER BY c.id DESC"
    customers = get_db().execute(sql, params).fetchall()
    return render_template("admin/customers.html", customers=customers, q=q, active="clienti")


@app.route("/admin/clienti/<int:customer_id>", methods=["GET", "POST"])
@role_required("admin")
def admin_customer(customer_id):
    c = customer_or_404(customer_id)
    db = get_db()
    if request.method == "POST":
        section = request.form.get("section")
        change = None

        if section == "profile":
            name = request.form.get("name", "").strip()
            email = request.form.get("email", "").strip().lower()
            phone = request.form.get("phone", "").strip()
            payment = request.form.get("preferred_payment") or None
            if not name or not EMAIL_RE.fullmatch(email):
                flash("Numele și un email valid sunt obligatorii.", "error")
            elif payment is not None and payment not in PAYMENT_METHODS:
                flash("Metoda de plată nu e validă.", "error")
            elif db.execute("SELECT 1 FROM customers WHERE email = ? AND id != ?", (email, customer_id)).fetchone():
                flash("Există deja alt client cu acest email.", "error")
            else:
                changed = [label for field, label, value in (
                    ("name", "nume", name), ("email", "email", email),
                    ("phone", "telefon", phone), ("preferred_payment", "metoda de plată", payment),
                ) if (c[field] or "") != (value or "")]
                if changed:
                    db.execute("UPDATE customers SET name = ?, email = ?, phone = ?, preferred_payment = ? WHERE id = ?",
                               (name, email, phone, payment, customer_id))
                    change = "A modificat: " + ", ".join(changed)
                    flash("Datele clientului au fost salvate.", "success")
                else:
                    flash("Nu era nimic de schimbat.", "success")

        elif section == "address":
            change = handle_address_action(customer_id, allow_edit=True)

        elif section == "password":
            new = request.form.get("new_password", "")
            if len(new) < 8:
                flash("Parola temporară trebuie să aibă cel puțin 8 caractere.", "error")
            else:
                db.execute("UPDATE customers SET password_hash = ? WHERE id = ?",
                           (generate_password_hash(new), customer_id))
                change = "A setat o parolă temporară"
                flash("Parola temporară a fost setată. Spune-i clientului să o schimbe din contul lui.", "success")

        elif section == "marketing" and c["marketing_opt_in"]:
            db.execute("UPDATE customers SET marketing_opt_in = 0 WHERE id = ?", (customer_id,))
            change = "A retras acordul de marketing, la cererea clientului"
            flash("Clientul nu mai primește emailuri de marketing.", "success")

        elif section == "delete":
            if request.form.get("confirm_email", "").strip().lower() != c["email"]:
                flash("Emailul de confirmare nu se potrivește. Contul nu a fost șters.", "error")
            else:
                delete_customer(customer_id)
                flash(f"Contul clientului {c['name']} a fost șters.", "success")
                return redirect(url_for("admin_customers"))

        if change:
            log_customer_change(customer_id, change)
        db.commit()
        anchor = {"address": "#adrese", "password": "#parola", "marketing": "#gdpr", "delete": "#gdpr"}
        return redirect(url_for("admin_customer", customer_id=customer_id) + anchor.get(section, ""))

    orders = orders_with_summary(customer_id)
    log = db.execute("SELECT * FROM customer_log WHERE customer_id = ? ORDER BY id DESC LIMIT 30",
                     (customer_id,)).fetchall()
    return render_template("admin/customer_detail.html", c=c, addresses=customer_addresses(customer_id),
                           orders=orders, log=log, active="clienti")


@app.route("/admin/comenzi")
@role_required("admin")
def admin_orders():
    db = get_db()
    orders = db.execute("""
        SELECT o.*, COALESCE(SUM(i.qty), 0) AS item_count FROM orders o
        LEFT JOIN order_items i ON i.order_id = o.id
        GROUP BY o.id ORDER BY o.id DESC
    """).fetchall()
    return render_template("admin/orders.html", orders=orders, active="comenzi")


@app.route("/admin/comenzi/<int:order_id>/status", methods=["POST"])
@role_required("admin")
def admin_order_status(order_id):
    status = request.form.get("status")
    if status in ORDER_STATUSES:
        db = get_db()
        db.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
        db.commit()
        flash(f"Comanda #{order_id} e acum „{ORDER_STATUSES[status]}”.", "success")
    return redirect(url_for("admin_orders"))


@app.route("/admin/utilizatori")
@role_required("admin")
def admin_users():
    users = get_db().execute("SELECT id, username, role, created_at FROM users ORDER BY id").fetchall()
    return render_template("admin/users.html", users=users, active="utilizatori")


@app.route("/admin/utilizatori/nou", methods=["POST"])
@role_required("admin")
def admin_user_create():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    role = request.form.get("role", "")
    if not username or len(password) < 4 or role not in ROLES:
        flash("Completează utilizatorul, o parolă de minim 4 caractere și rolul.", "error")
    else:
        db = get_db()
        try:
            db.execute(
                "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
                (username, generate_password_hash(password), role, now()),
            )
            db.commit()
            flash(f"Am creat contul „{username}” ({ROLES[role]}).", "success")
        except sqlite3.IntegrityError:
            flash(f"Există deja un cont cu numele „{username}”.", "error")
    return redirect(url_for("admin_users"))


@app.route("/admin/utilizatori/<int:user_id>/sterge", methods=["POST"])
@role_required("admin")
def admin_user_delete(user_id):
    if user_id == session.get("user_id"):
        flash("Nu îți poți șterge propriul cont cât ești conectat cu el.", "error")
        return redirect(url_for("admin_users"))
    db = get_db()
    user = db.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    if user:
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        db.commit()
        flash(f"Am șters contul „{user['username']}”.", "success")
    return redirect(url_for("admin_users"))


@app.errorhandler(403)
def forbidden(_e):
    return render_template("error.html", code=403,
                           message="Contul tău nu are acces la această pagină."), 403


@app.errorhandler(404)
def not_found(_e):
    return render_template("error.html", code=404,
                           message="Pagina pe care o cauți nu există."), 404


if __name__ == "__main__":
    init_db()
    print("MobilaTa pornit -> http://localhost:8835/")
    app.run(host="127.0.0.1", port=8835, debug=True)
