const SEED_TEXT = document.getElementById('seed').textContent;
const KEY = 'mobilata-demo-v2';
const PAY = { card: 'Card online', ramburs: 'Ramburs la livrare', transfer: 'Transfer bancar' };
const PAY_HINT = {
  card: 'Plătești pe pagina următoare. Acum e doar o simulare, fără bani reali.',
  ramburs: 'Plătești curierului când primești coletul.',
  transfer: 'Primești datele pentru transfer după ce plasezi comanda.',
};
const STATUS = { asteptare_plata: 'În așteptare plată', platita: 'Plătită', confirmata: 'Confirmată', livrata: 'Livrată', anulata: 'Anulată' };
const IN_PROGRESS = ['asteptare_plata', 'platita', 'confirmata'];
const ROLES = { admin: 'Administrator', manager: 'Gestionar produse' };
const FREE_FROM = 1500, SHIPPING = 99;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const app = document.getElementById('app');

// ---------- Ajutoare ----------
const pad = n => String(n).padStart(2, '0');
function now() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const lei = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' lei';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const firstName = name => String(name).split(' ')[0];
const avg = p => p.reviews.length ? p.reviews.reduce((a, r) => a + r.rating, 0) / p.reviews.length : 0;
function slugify(text) {
  return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'produs';
}
function stars(rating, count) {
  const full = Math.round(rating);
  let s = `<span class="stars" aria-label="${rating.toFixed(1)} din 5 stele">`;
  for (let i = 0; i < 5; i++) s += `<span class="star${i < full ? ' on' : ''}">★</span>`;
  s += '</span>';
  if (count !== undefined) s += `<span class="star-count">(${count})</span>`;
  return s;
}

// ---------- Datele demo (rămân doar în acest browser) ----------
function freshDb() {
  const seed = JSON.parse(SEED_TEXT), t = now();
  return {
    categories: seed.categories,
    products: seed.products.map(p => ({ ...p, created_at: t })),
    credits: seed.credits,
    users: [{ id: 1, username: 'admin', password: 'admin', role: 'admin', created_at: t }],
    customers: [], addresses: [], orders: [], logs: [],
    seq: { product: Math.max(...seed.products.map(p => p.id)) + 1, user: 2, customer: 1, address: 1, order: 1, log: 1 },
  };
}
const freshSession = () => ({ cart: {}, customerId: null, staff: null, myOrders: [], flash: [], origin: null, clientQuery: '', afterLogin: null, afterStaff: null });
function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
let db = load(KEY) || freshDb();
let sess = Object.assign(freshSession(), load(KEY + '-sesiune') || {});
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); localStorage.setItem(KEY + '-sesiune', JSON.stringify(sess)); } catch (e) {}
}
const nextId = t => db.seq[t]++;
const cat = slug => db.categories.find(c => c.slug === slug);
const product = id => db.products.find(p => p.id === id);
const customer = () => db.customers.find(c => c.id === sess.customerId) || null;
const staff = () => (sess.staff && db.users.find(u => u.id === sess.staff.id)) || null;
const addressesOf = cid => db.addresses.filter(a => a.customer_id === cid).sort((a, b) => b.is_default - a.is_default || a.id - b.id);
const ordersOf = cid => db.orders.filter(o => o.customer_id === cid).sort((a, b) => b.id - a.id);

function flash(msg, kind = 'success') { sess.flash.push([kind, msg]); }
function go(hash) {
  if (location.hash.slice(1) === hash) route(); else location.hash = hash;
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- Coș ----------
function cartLines() {
  const items = [];
  for (const [id, qty] of Object.entries(sess.cart)) {
    const p = product(+id);
    const q = p ? Math.min(qty, p.stock) : 0;
    if (q > 0) items.push({ p, qty: q, line: p.price * q });
  }
  const subtotal = items.reduce((a, i) => a + i.line, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_FROM ? 0 : SHIPPING;
  return { items, subtotal, shipping, total: subtotal + shipping };
}
function addToCart(id, qty) {
  const p = product(id);
  const current = sess.cart[id] || 0, next = Math.min(current + qty, p.stock);
  if (next <= current) { toast(`Nu mai avem „${p.name}” în stoc în cantitatea cerută.`); return; }
  sess.cart[id] = next; save(); renderHeader(); toast(`Am adăugat „${p.name}” în coș.`);
}

// ---------- Bucăți comune ----------
function productCard(p) {
  return `<article class="product-card">
    <a href="#p-${p.slug}" class="product-card-link">
      <div class="product-card-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div>
      <div class="product-card-body"><h3>${esc(p.name)}</h3><p class="product-card-desc">${esc(p.short_desc)}</p>
        <div class="product-card-rating">${stars(avg(p), p.reviews.length)}</div></div>
    </a>
    <div class="product-card-foot"><span class="price">${lei(p.price)}</span>
      ${p.stock > 0 ? `<button type="button" class="btn btn-small" data-add="${p.id}">Adaugă în coș</button>` : '<span class="out-of-stock">Stoc epuizat</span>'}
    </div></article>`;
}
function orderRows(orders, origin, clientId) {
  return `<div class="order-list">${orders.map(o => {
    const n = o.items.reduce((a, i) => a + i.qty, 0);
    return `<a href="#comanda-${o.id}" class="order-row" data-origin="${origin}" data-client="${clientId || ''}">
      <span class="order-id">#${o.id}</span>
      <span class="order-what"><strong>${esc(o.items[0]?.name || 'Comandă')}${n > 1 ? ` <span class="muted">și încă ${plural(n - 1, 'produs', 'produse')}</span>` : ''}</strong>
        <span class="muted small">${o.created_at} · ${PAY[o.payment_method]}</span></span>
      <span class="status-pill status-${o.status}">${STATUS[o.status]}</span>
      <span class="order-total">${lei(o.total)}</span></a>`;
  }).join('')}</div>`;
}
const errorsBox = errors => errors.length ? `<div class="flash flash-error"><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
const googleButton = () => `<button type="button" class="btn btn-google btn-block" data-action="google">
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
  Continuă cu Google</button>
  <p class="muted small center">În demo, butonul te conectează cu un cont Google de probă.</p>`;

// ---------- Magazin ----------
function viewHome() {
  return `<section class="hero"><div class="container hero-grid"><div class="hero-text">
      <p class="eyebrow">Magazin online de mobilă</p><h1>MobilaTa</h1><p class="slogan">Mobila ta, de la noi.</p>
      <p class="hero-lede">Canapele, paturi, mese și tot ce-ți trebuie pentru casă, grădină și birou. Alegi online, noi îți aducem acasă.</p>
      <a href="#categorii" class="btn btn-large" data-scroll="categorii">Alege o categorie</a></div>
    <div class="hero-img"><img src="img/hero.jpg" alt="Living modern cu canapea gri și fereastră mare"></div></div></section>
  <section class="categories" id="categorii"><div class="container">
    <div class="section-head"><h2>Ce cauți azi?</h2><p class="muted">Alege o cameră și vezi toate produsele din ea.</p></div>
    <div class="cat-grid">${db.categories.map(c => {
      const n = db.products.filter(p => p.cat === c.slug).length;
      return `<a href="#c-${c.slug}" class="cat-tile"><img src="${c.image}" alt="" loading="lazy">
        <span class="cat-tile-label"><span class="cat-tile-name">${esc(c.name)}</span><span class="cat-tile-count">${plural(n, 'produs', 'produse')}</span></span>
        <span class="cat-tile-arrow" aria-hidden="true">→</span></a>`;
    }).join('')}</div></div></section>
  <section class="perks"><div class="container perks-grid">
    <div class="perk"><h3>Livrare gratuită</h3><p class="muted">La comenzile de peste 1.500 lei. Sub această sumă, livrarea costă 99 lei.</p></div>
    <div class="perk"><h3>Plătești cum vrei</h3><p class="muted">Cu cardul online, ramburs la livrare sau prin transfer bancar.</p></div>
    <div class="perk"><h3>Retur în 14 zile</h3><p class="muted">Dacă produsul nu ți se potrivește, îl poți returna.</p></div>
  </div></section>`;
}

function viewCategory(slug) {
  const c = cat(slug);
  if (!c) return viewError(404);
  const list = db.products.filter(p => p.cat === slug);
  return `<section class="page-head" style="--head-img: url('${c.image}')"><div class="container">
      <nav class="breadcrumb"><a href="#acasa">Acasă</a> <span>/</span> ${esc(c.name)}</nav>
      <h1>${esc(c.name)}</h1><p>${esc(c.description)}</p></div></section>
    <section class="container product-section">${list.length
      ? `<p class="muted result-count">${plural(list.length, 'produs', 'produse')}</p><div class="product-grid">${list.map(productCard).join('')}</div>`
      : `<div class="empty-state"><h2>Încă nu avem produse aici</h2><p class="muted">Revino curând sau uită-te în celelalte categorii.</p><a href="#categorii" class="btn">Toate categoriile</a></div>`}
    </section>`;
}

function viewProduct(slug) {
  const p = db.products.find(x => x.slug === slug);
  if (!p) return viewError(404);
  const c = cat(p.cat), a = avg(p);
  const related = db.products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 3);
  const stock = p.stock <= 0 ? '<p class="stock stock-out">Stoc epuizat</p>'
    : `<p class="stock ${p.stock <= 3 ? 'stock-low' : ''}">${p.stock <= 3 ? `Doar ${p.stock} în stoc` : 'În stoc'}</p>
       <form novalidate class="add-form" data-form="add"><input type="hidden" name="id" value="${p.id}">
         <label for="qty">Cantitate</label><input type="number" id="qty" name="qty" value="1" min="1" max="${p.stock}">
         <button type="submit" class="btn btn-large">Adaugă în coș</button></form>`;
  return `<div class="container">
    <nav class="breadcrumb breadcrumb-plain"><a href="#acasa">Acasă</a> <span>/</span> <a href="#c-${c.slug}">${esc(c.name)}</a> <span>/</span> ${esc(p.name)}</nav>
    <section class="product-detail">
      <div class="product-detail-img"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <div class="product-detail-info"><h1>${esc(p.name)}</h1>
        <a href="#recenzii" class="rating-link" data-scroll="recenzii">${stars(a, p.reviews.length)} <span>${a.toFixed(1)} din 5</span></a>
        <p class="price price-big">${lei(p.price)}</p><p class="lead">${esc(p.short_desc)}</p>${stock}
        <dl class="specs"><div><dt>Material</dt><dd>${esc(p.material || '–')}</dd></div><div><dt>Dimensiuni</dt><dd>${esc(p.dimensions || '–')}</dd></div><div><dt>Culoare</dt><dd>${esc(p.color || '–')}</dd></div></dl>
      </div></section>
    ${p.description ? `<section class="product-description"><h2>Despre produs</h2><p>${esc(p.description)}</p></section>` : ''}
    <section class="reviews" id="recenzii">
      <div class="reviews-head"><h2>Recenzii</h2><p>${stars(a)} <strong>${a.toFixed(1)}</strong> din 5, ${plural(p.reviews.length, 'recenzie', 'recenzii')}</p></div>
      <div class="reviews-grid"><div class="review-list">${p.reviews.length ? p.reviews.slice().reverse().map(r =>
        `<article class="review"><header><strong>${esc(r.author)}</strong>${stars(r.rating)}</header><p>${esc(r.text)}</p></article>`).join('')
        : '<p class="muted">Încă nu există recenzii. Fii primul care scrie una.</p>'}</div>
        <form novalidate class="review-form card" data-form="review"><h3>Scrie o recenzie</h3><input type="hidden" name="id" value="${p.id}">
          <label for="author">Numele tău</label><input type="text" id="author" name="author" maxlength="60">
          <fieldset class="rating-fieldset"><legend>Nota ta</legend><div class="rating-input">
            ${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="rating-${n}" name="rating" value="${n}"${n === 5 ? ' checked' : ''}><label for="rating-${n}" title="${n} ${n === 1 ? 'stea' : 'stele'}">★</label>`).join('')}
          </div></fieldset>
          <label for="text">Părerea ta</label><textarea id="text" name="text" rows="4" maxlength="1000"></textarea>
          <button type="submit" class="btn">Publică recenzia</button></form></div></section>
    ${related.length ? `<section class="related"><h2>Din aceeași categorie</h2><div class="product-grid product-grid-3">${related.map(productCard).join('')}</div></section>` : ''}
  </div>`;
}

function viewCart() {
  const { items, subtotal, shipping, total } = cartLines();
  if (!items.length) return `<div class="container narrow-page"><h1>Coșul meu</h1><div class="empty-state"><h2>Coșul tău e gol</h2><p class="muted">Alege o categorie și adaugă ce-ți place.</p><a href="#categorii" class="btn">Vezi categoriile</a></div></div>`;
  return `<div class="container narrow-page"><h1>Coșul meu</h1><div class="cart-layout"><div class="cart-items">
    ${items.map(({ p, qty, line }) => `<article class="cart-item">
      <a href="#p-${p.slug}" class="cart-item-img"><img src="${esc(p.image)}" alt="${esc(p.name)}"></a>
      <div class="cart-item-info"><a href="#p-${p.slug}" class="cart-item-name">${esc(p.name)}</a><span class="muted">${lei(p.price)} / buc.</span></div>
      <form novalidate class="qty-form" data-form="cart-qty"><input type="hidden" name="id" value="${p.id}"><label class="sr-only" for="qty-${p.id}">Cantitate</label>
        <input type="number" id="qty-${p.id}" name="qty" value="${qty}" min="1" max="${p.stock}"><button type="submit" class="btn btn-ghost btn-small">Actualizează</button></form>
      <span class="cart-item-total">${lei(line)}</span>
      <button type="button" class="link-button" data-action="cart-remove" data-id="${p.id}">Scoate</button></article>`).join('')}
    </div>
    <aside class="summary card"><h2>Sumar</h2><dl>
      <div><dt>Produse</dt><dd>${lei(subtotal)}</dd></div><div><dt>Livrare</dt><dd>${shipping ? lei(shipping) : 'Gratuită'}</dd></div>
      <div class="summary-total"><dt>Total</dt><dd>${lei(total)}</dd></div></dl>
      ${shipping ? `<p class="muted small">Mai adaugă produse de ${lei(FREE_FROM - subtotal)} și livrarea devine gratuită.</p>` : ''}
      <a href="#comanda" class="btn btn-large btn-block">Continuă spre comandă</a><a href="#categorii" class="btn btn-ghost btn-block">Mai cumpăr</a></aside></div></div>`;
}

let checkoutState = { form: null, errors: [] };
function viewCheckout() {
  const { items, subtotal, shipping, total } = cartLines();
  if (!items.length) { flash('Coșul tău e gol.', 'error'); return redirect('cos'); }
  const c = customer(), addrs = c ? addressesOf(c.id) : [];
  let f = checkoutState.form;
  if (!f) {
    const d = addrs[0];
    f = c ? { name: c.name, email: c.email, phone: c.phone || '', address: d ? d.address : '', city: d ? d.city : '', payment: c.preferred_payment || 'card' }
      : { name: '', email: '', phone: '', address: '', city: '', payment: 'card' };
  }
  const errors = checkoutState.errors;
  checkoutState = { form: null, errors: [] };
  return `<div class="container narrow-page"><h1>Finalizează comanda</h1>
    ${errors.length ? `<div class="flash flash-error"><strong>Mai ai de completat:</strong><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}
    <div class="cart-layout"><form novalidate class="checkout-form card" data-form="checkout">
      ${c ? '' : `<p class="login-hint">Ai cont? <a href="#cont-autentificare" data-after="comanda">Intră în cont</a> și completăm noi datele. Sau comandă mai departe fără cont.</p>`}
      <h2>Date de livrare</h2>
      ${addrs.length > 1 ? `<div class="field"><label for="saved-address">Alege o adresă salvată</label><select id="saved-address">${addrs.map(a =>
        `<option data-address="${esc(a.address)}" data-city="${esc(a.city)}"${a.address === f.address && a.city === f.city ? ' selected' : ''}>${esc(a.label)}: ${esc(a.address)}, ${esc(a.city)}</option>`).join('')}</select></div>` : ''}
      <div class="field-grid">
        <div class="field field-wide"><label for="name">Nume complet</label><input type="text" id="name" name="name" value="${esc(f.name)}" autocomplete="name"></div>
        <div class="field"><label for="email">Email</label><input type="email" id="email" name="email" value="${esc(f.email)}" autocomplete="email"></div>
        <div class="field"><label for="phone">Telefon</label><input type="tel" id="phone" name="phone" value="${esc(f.phone)}" autocomplete="tel"></div>
        <div class="field field-wide"><label for="address">Adresă (stradă, număr, bloc, apartament)</label><input type="text" id="address" name="address" value="${esc(f.address)}" autocomplete="street-address"></div>
        <div class="field"><label for="city">Oraș</label><input type="text" id="city" name="city" value="${esc(f.city)}" autocomplete="address-level2"></div>
      </div>
      ${c ? `<label class="check"><input type="checkbox" name="save_address" value="1"${addrs.length ? '' : ' checked'}><span>Salvează adresa în contul meu</span></label>` : ''}
      <h2>Metodă de plată</h2><div class="pay-options">${Object.entries(PAY).map(([k, v]) =>
        `<label class="pay-option"><input type="radio" name="payment" value="${k}"${f.payment === k ? ' checked' : ''}><span><strong>${v}</strong><span class="muted small">${PAY_HINT[k]}</span></span></label>`).join('')}</div>
      <button type="submit" class="btn btn-large btn-block">Plasează comanda</button></form>
    <aside class="summary card"><h2>Comanda ta</h2><ul class="summary-items">${items.map(i => `<li><span>${i.qty} × ${esc(i.p.name)}</span><span>${lei(i.line)}</span></li>`).join('')}</ul>
      <dl><div><dt>Produse</dt><dd>${lei(subtotal)}</dd></div><div><dt>Livrare</dt><dd>${shipping ? lei(shipping) : 'Gratuită'}</dd></div>
      <div class="summary-total"><dt>Total</dt><dd>${lei(total)}</dd></div></dl></aside></div></div>`;
}

function canSeeOrder(o) {
  const c = customer(), s = staff();
  return sess.myOrders.includes(o.id) || (s && s.role === 'admin') || (c && o.customer_id === c.id);
}
function viewPayment(id) {
  const o = db.orders.find(x => x.id === id);
  if (!o || !canSeeOrder(o)) return viewError(404);
  if (o.payment_method !== 'card' || o.status !== 'asteptare_plata') return redirect(`comanda-${id}`);
  return `<div class="container narrow-page small-page"><div class="card payment-card">
    <p class="eyebrow">Comanda #${o.id}</p><h1>Plată cu cardul</h1><p class="price price-big">${lei(o.total)}</p>
    <div class="sim-note"><strong>Simulare.</strong> Aici va veni formularul unui procesator de plăți (de exemplu Stripe sau Netopia). Pentru moment nu se introduc date de card și nu se plătesc bani reali. Alege ce vrei să testezi:</div>
    <form novalidate class="payment-actions" data-form="payment"><input type="hidden" name="id" value="${o.id}">
      <button type="submit" name="result" value="ok" class="btn btn-large">Simulează plată reușită</button>
      <button type="submit" name="result" value="fail" class="btn btn-ghost">Simulează plată refuzată</button></form></div></div>`;
}
function viewOrder(id) {
  const o = db.orders.find(x => x.id === id);
  if (!o || !canSeeOrder(o)) return viewError(404);
  const origin = sess.origin || {}, s = staff(), c = customer();
  const fromAccount = origin.from === 'cont' || origin.from === 'admin';
  let head;
  if (fromAccount) {
    let back = '<a href="#contul-meu" class="back-link">← Comenzile mele</a>';
    if (origin.from === 'admin' && s && s.role === 'admin') {
      const cid = origin.client || o.customer_id;
      back = cid && db.customers.some(x => x.id === cid) ? `<a href="#admin-client-${cid}" class="back-link">← Fișa clientului</a>` : '<a href="#admin-comenzi" class="back-link">← Toate comenzile</a>';
    }
    head = `${back}<p class="eyebrow">Plasată pe ${o.created_at}</p><h1>Comanda #${o.id}</h1>`;
  } else {
    head = `<p class="eyebrow">Comanda #${o.id}</p><h1>Mulțumim, ${esc(firstName(o.customer_name))}!</h1>`;
  }
  let note = '';
  if (o.payment_method === 'card' && o.status === 'platita') note = '<p>Plata a fost primită. Îți pregătim comanda.</p>';
  else if (o.payment_method === 'ramburs') note = `<p>Plătești ${lei(o.total)} curierului, la livrare.</p>`;
  else if (o.payment_method === 'transfer') note = `<p>Fă un transfer de <strong>${lei(o.total)}</strong> cu mențiunea <strong>Comanda ${o.id}</strong>. Datele contului bancar le completăm când magazinul are un cont real.</p>`;
  let actions = '';
  if (o.payment_method === 'card' && o.status === 'asteptare_plata') actions = `<a href="#plata-${o.id}" class="btn">Plătește acum</a>`;
  else if (!fromAccount) actions = `<div class="done-actions"><a href="#acasa" class="btn">Înapoi în magazin</a>${c ? '<a href="#contul-meu" class="btn btn-ghost">Vezi comenzile mele</a>' : ''}</div>`;
  return `<div class="container narrow-page small-page"><div class="card done-card">${head}
    <p class="status-pill status-${o.status}">${STATUS[o.status]}</p>${note}
    <h2>Ce ai comandat</h2><ul class="summary-items">${o.items.map(i => `<li><span>${i.qty} × ${esc(i.name)}</span><span>${lei(i.price * i.qty)}</span></li>`).join('')}</ul>
    <dl class="summary"><div><dt>Livrare</dt><dd>${o.shipping ? lei(o.shipping) : 'Gratuită'}</dd></div><div class="summary-total"><dt>Total</dt><dd>${lei(o.total)}</dd></div></dl>
    <p class="muted small">Livrare la: ${esc(o.address)}, ${esc(o.city)}. Te sunăm la ${esc(o.phone)}.</p>${actions}</div></div>`;
}

function viewPolicy() {
  return `<div class="container narrow-page prose"><h1>Politica de confidențialitate</h1>
    <p class="draft-note"><strong>Schiță.</strong> Textul de mai jos e un punct de plecare pentru un magazin demonstrativ. Înainte de lansarea unui magazin real, trebuie completat cu datele firmei și verificat de un specialist în protecția datelor.</p>
    <h2>Cine suntem</h2><p>MobilaTa este operatorul datelor tale. Datele de identificare ale firmei (denumire, CUI, adresă, email de contact) se completează la lansare.</p>
    <h2>Ce date colectăm</h2><ul><li><strong>Date de cont:</strong> nume, email, telefon, parola (salvată doar criptat) sau identificatorul contului Google.</li><li><strong>Adrese de livrare</strong> pe care alegi să le salvezi.</li><li><strong>Comenzi:</strong> produsele cumpărate, sumele, metoda de plată și statusul.</li><li><strong>Recenzii:</strong> numele afișat și textul pe care îl publici.</li></ul>
    <p>Nu salvăm datele cardului tău. Plățile cu cardul sunt procesate de un procesator de plăți autorizat.</p>
    <h2>De ce le folosim</h2><ul><li>Ca să livrăm comenzile și să te contactăm despre ele.</li><li>Ca să emitem documentele contabile cerute de lege.</li><li>Ca să-ți trimitem oferte pe email, doar dacă ai fost de acord.</li></ul>
    <h2>Cookie-uri</h2><p>Folosim doar un cookie strict necesar, care ține minte coșul și dacă ești conectat. Nu folosim cookie-uri de reclamă sau de analiză.</p>
    <h2>Drepturile tale</h2><p>Ai dreptul să îți vezi datele, să le corectezi, să le descarci, să îți retragi acordul de marketing și să ceri ștergerea contului. Toate se pot face direct din <a href="#contul-meu-confidentialitate">Contul meu → Confidențialitate</a>. Poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP).</p>
    <h2>Cât timp păstrăm datele</h2><p>Datele contului, până îl ștergi. Datele din comenzi, cât cer obligațiile legale de contabilitate. Perioada exactă se completează la lansare.</p></div>`;
}
function viewCredits() {
  return `<div class="container narrow-page"><h1>Credite foto</h1>
    <p class="muted">Toate fotografiile sunt de pe <a href="https://unsplash.com" rel="noopener" target="_blank">Unsplash</a>, folosite sub licența Unsplash. Mulțumim fotografilor:</p>
    <ul class="credits-list">${db.credits.map(([file, author]) => `<li><img src="img/${file}" alt="" loading="lazy"><span>${esc(author)}</span></li>`).join('')}</ul></div>`;
}
function viewError(code) {
  const msg = code === 403 ? 'Contul tău nu are acces la această pagină.' : 'Pagina pe care o cauți nu există.';
  return `<div class="container narrow-page small-page"><div class="empty-state"><p class="eyebrow">Eroare ${code}</p><h1>${msg}</h1><a href="#acasa" class="btn">Înapoi acasă</a></div></div>`;
}

// ---------- Conturi de clienți ----------
let formState = {};
function viewLogin() {
  if (customer()) return redirect('contul-meu');
  const st = formState.login || {}; formState.login = null;
  return `<div class="container narrow-page small-page"><div class="card login-card">
    <h1>Intră în cont</h1><p class="muted">Vezi comenzile tale, adresele salvate și datele contului.</p>
    ${googleButton()}<p class="or-divider"><span>sau cu email</span></p>
    <form novalidate data-form="login">${st.error ? `<p class="flash flash-error">${esc(st.error)}</p>` : ''}
      <label for="email">Email</label><input type="email" id="email" name="email" value="${esc(st.email || '')}" autocomplete="email">
      <label for="password">Parolă</label><input type="password" id="password" name="password" autocomplete="current-password">
      <p class="muted small field-note">În demo, nu folosi o parolă pe care o ai și în altă parte.</p>
      <button type="submit" class="btn btn-large btn-block">Intră în cont</button></form>
    <p class="login-switch">Nu ai cont? <a href="#cont-inregistrare">Creează unul acum</a></p></div></div>`;
}
function viewRegister() {
  if (customer()) return redirect('contul-meu');
  const st = formState.register || { errors: [] }; formState.register = null;
  return `<div class="container narrow-page small-page"><div class="card login-card">
    <h1>Creează-ți cont</h1><p class="muted">Cu un cont urmărești comenzile și comanzi mai repede data viitoare.</p>
    ${googleButton()}<p class="muted small center">Continuând cu Google, accepți <a href="#confidentialitate">politica de confidențialitate</a>.</p>
    <p class="or-divider"><span>sau cu email</span></p>${errorsBox(st.errors)}
    <form novalidate data-form="register">
      <label for="name">Nume complet</label><input type="text" id="name" name="name" value="${esc(st.name || '')}" autocomplete="name">
      <label for="email">Email</label><input type="email" id="email" name="email" value="${esc(st.email || '')}" autocomplete="email">
      <label for="password">Parolă (minimum 8 caractere)</label><input type="password" id="password" name="password" autocomplete="new-password">
      <label for="password2">Repetă parola</label><input type="password" id="password2" name="password2" autocomplete="new-password">
      <p class="muted small field-note">În demo, nu folosi o parolă pe care o ai și în altă parte.</p>
      <label class="check"><input type="checkbox" name="terms" value="1"${st.terms ? ' checked' : ''}><span>Accept <a href="#confidentialitate">politica de confidențialitate</a> și termenii magazinului. <em class="muted">(obligatoriu)</em></span></label>
      <label class="check"><input type="checkbox" name="marketing" value="1"${st.marketing ? ' checked' : ''}><span>Vreau să primesc pe email oferte și noutăți. <em class="muted">(opțional, poți renunța oricând)</em></span></label>
      <button type="submit" class="btn btn-large btn-block">Creează contul</button></form>
    <p class="login-switch">Ai deja cont? <a href="#cont-autentificare">Intră în cont</a></p></div></div>`;
}
function accountLayout(active, content) {
  const c = customer();
  const link = (hash, key, label) => `<a href="#${hash}" class="${active === key ? 'active' : ''}">${label}</a>`;
  return `<div class="container account-layout"><aside class="account-side">
      <p class="account-hello"><span class="muted small">Salut,</span><strong>${esc(c.name)}</strong></p>
      <nav class="account-nav" aria-label="Contul meu">${link('contul-meu', 'comenzi', 'Comenzile mele')}${link('contul-meu-adrese', 'adrese', 'Adrese')}${link('contul-meu-plata', 'plata', 'Plată')}${link('contul-meu-date', 'date', 'Datele mele')}${link('contul-meu-confidentialitate', 'confidentialitate', 'Confidențialitate')}</nav>
      <button type="button" class="btn btn-ghost btn-small btn-block" data-action="customer-logout">Ieși din cont</button>
    </aside><section class="account-main">${content}</section></div>`;
}
function viewAccOrders() {
  const orders = ordersOf(customer().id);
  const current = orders.filter(o => IN_PROGRESS.includes(o.status)), past = orders.filter(o => !IN_PROGRESS.includes(o.status));
  return accountLayout('comenzi', `<h1>Comenzile mele</h1>
    <section class="account-section"><h2>În curs</h2>${current.length ? orderRows(current, 'cont') : '<p class="muted">Nu ai comenzi în curs.</p>'}</section>
    <section class="account-section"><h2>Istoric</h2>${past.length ? orderRows(past, 'cont') : '<p class="muted">Comenzile livrate sau anulate vor apărea aici.</p>'}</section>
    ${orders.length ? '' : '<a href="#categorii" class="btn">Începe cumpărăturile</a>'}`);
}
function addressFields(prefix, a = {}) {
  return `<div class="field-grid">
    <div class="field"><label for="${prefix}-label">Nume adresă</label><input type="text" id="${prefix}-label" name="label" value="${esc(a.label || '')}" placeholder="ex. Acasă, Birou" maxlength="40"></div>
    <div class="field"><label for="${prefix}-city">Oraș</label><input type="text" id="${prefix}-city" name="city" value="${esc(a.city || '')}"></div>
    <div class="field field-wide"><label for="${prefix}-address">Adresă (stradă, număr, bloc, apartament)</label><input type="text" id="${prefix}-address" name="address" value="${esc(a.address || '')}"></div></div>`;
}
function viewAccAddresses() {
  const addrs = addressesOf(customer().id);
  return accountLayout('adrese', `<h1>Adrese</h1><div class="address-grid">${addrs.length ? addrs.map(a => `
    <article class="card address-card ${a.is_default ? 'is-default' : ''}"><header><strong>${esc(a.label)}</strong>${a.is_default ? '<span class="role-pill role-admin">Principală</span>' : ''}</header>
      <p>${esc(a.address)}<br>${esc(a.city)}</p><div class="address-actions">
      ${a.is_default ? '' : `<form novalidate data-form="address" data-owner="me"><input type="hidden" name="action" value="default"><input type="hidden" name="address_id" value="${a.id}"><button type="submit" class="btn btn-ghost btn-small">Fă-o principală</button></form>`}
      <form novalidate data-form="address" data-owner="me"><input type="hidden" name="action" value="delete"><input type="hidden" name="address_id" value="${a.id}"><button type="submit" class="btn btn-danger btn-small">Șterge</button></form></div></article>`).join('')
    : '<p class="muted">Nu ai adrese salvate. Adaugă una aici sau bifează „Salvează adresa” când plasezi o comandă.</p>'}</div>
    <form novalidate class="card address-form" data-form="address" data-owner="me"><h2>Adaugă o adresă</h2><input type="hidden" name="action" value="add">${addressFields('new')}
      <button type="submit" class="btn">Salvează adresa</button></form>`);
}
function viewAccPayment() {
  const c = customer();
  return accountLayout('plata', `<h1>Plată</h1>
    <form novalidate class="card account-section" data-form="acc-payment"><h2>Metoda preferată</h2><p class="muted">O alegem automat pentru tine când plasezi o comandă. O poți schimba oricând.</p>
      <div class="pay-options">${Object.entries(PAY).map(([k, v]) => `<label class="pay-option"><input type="radio" name="preferred_payment" value="${k}"${c.preferred_payment === k ? ' checked' : ''}><span><strong>${v}</strong></span></label>`).join('')}</div>
      <button type="submit" class="btn">Salvează</button></form>
    <section class="card account-section"><h2>Carduri salvate</h2><div class="empty-inline"><p><strong>Nu ai carduri salvate.</strong></p>
      <p class="muted">Când plata online va fi activă, vei putea salva un card la prima plată. Datele cardului le păstrează procesatorul de plăți, nu MobilaTa. Noi vedem doar tipul cardului și ultimele 4 cifre, de exemplu „Visa ···· 4242”.</p></div></section>`);
}
function viewAccProfile() {
  const c = customer();
  return accountLayout('date', `<h1>Datele mele</h1>
    <form novalidate class="card account-section" data-form="acc-profile"><h2>Date personale</h2><div class="field-grid">
      <div class="field"><label for="p-name">Nume complet</label><input type="text" id="p-name" name="name" value="${esc(c.name)}" autocomplete="name"></div>
      <div class="field"><label for="p-phone">Telefon</label><input type="tel" id="p-phone" name="phone" value="${esc(c.phone || '')}" autocomplete="tel"></div>
      <div class="field field-wide"><label for="p-email">Email</label><input type="email" id="p-email" value="${esc(c.email)}" disabled>
        <p class="muted small field-note">Emailul e folosit pentru autentificare și nu se poate schimba din cont.${c.google ? ' Contul e conectat cu Google.' : ''}</p></div></div>
      <button type="submit" class="btn">Salvează</button></form>
    <form novalidate class="card account-section" data-form="acc-password"><h2>${c.password ? 'Schimbă parola' : 'Setează o parolă'}</h2>
      ${c.password ? '' : '<p class="muted">Acum intri doar cu Google. Dacă setezi o parolă, vei putea intra și cu emailul.</p>'}
      <div class="field-grid">${c.password ? '<div class="field field-wide"><label for="pw-current">Parola actuală</label><input type="password" id="pw-current" name="current" autocomplete="current-password"></div>' : ''}
        <div class="field"><label for="pw-new">Parola nouă (minimum 8 caractere)</label><input type="password" id="pw-new" name="new1" autocomplete="new-password"></div>
        <div class="field"><label for="pw-new2">Repetă parola nouă</label><input type="password" id="pw-new2" name="new2" autocomplete="new-password"></div></div>
      <button type="submit" class="btn">${c.password ? 'Schimbă parola' : 'Setează parola'}</button></form>`);
}
function customerExport(c) {
  return JSON.stringify({
    exportat_la: now(),
    cont: { nume: c.name, email: c.email, telefon: c.phone || null, conectat_cu_google: !!c.google, are_parola: !!c.password,
      metoda_plata_preferata: PAY[c.preferred_payment] || null, accept_marketing: !!c.marketing, termeni_acceptati_la: c.terms_at, cont_creat_la: c.created_at },
    adrese: addressesOf(c.id).map(a => ({ label: a.label, address: a.address, city: a.city, principala: !!a.is_default })),
    comenzi: ordersOf(c.id).map(o => ({ id: o.id, data: o.created_at, status: STATUS[o.status], plata: PAY[o.payment_method], total: o.total, produse: o.items })),
  }, null, 2);
}
function viewAccPrivacy() {
  const c = customer();
  return accountLayout('confidentialitate', `<h1>Confidențialitate și date personale</h1>
    <p class="muted">Conform GDPR, ai control asupra datelor tale. Detalii în <a href="#confidentialitate">politica de confidențialitate</a>.</p>
    <form novalidate class="card account-section" data-form="acc-marketing"><h2>Acordurile tale</h2>
      <p><strong>Termeni și confidențialitate:</strong> acceptați pe ${c.terms_at}.</p>
      <label class="check"><input type="checkbox" name="marketing" value="1"${c.marketing ? ' checked' : ''}><span>Vreau să primesc pe email oferte și noutăți de la MobilaTa.</span></label>
      <button type="submit" class="btn">Salvează preferințele</button></form>
    <section class="card account-section"><h2>Descarcă datele tale</h2>
      <p class="muted">Primești toate datele pe care le avem despre tine: cont, adrese și comenzi. În demo le vezi aici și le poți copia.</p>
      <button type="button" class="btn btn-ghost" data-action="toggle-export">Vezi datele (JSON)</button>
      <div id="export-box" hidden><pre class="json-box" id="export-json">${esc(customerExport(c))}</pre>
        <button type="button" class="btn btn-ghost btn-small" data-action="copy-export">Copiază</button></div></section>
    <form novalidate class="card account-section danger-zone" data-form="acc-delete"><h2>Șterge contul</h2>
      <p>Ștergem contul, adresele salvate și preferințele tale. <strong>Acțiunea nu se poate anula.</strong></p>
      <p class="muted small">Comenzile deja plasate rămân în evidența magazinului, fără legătură cu vreun cont, pentru obligațiile legale de contabilitate.</p>
      <label for="del-confirm">Scrie <strong>ȘTERGE</strong> ca să confirmi</label><input type="text" id="del-confirm" name="confirm" autocomplete="off">
      ${c.password ? '<label for="del-password">Parola ta</label><input type="password" id="del-password" name="password" autocomplete="current-password">' : ''}
      <button type="submit" class="btn btn-danger-solid">Șterge definitiv contul</button></form>`);
}

// ---------- Administrare ----------
function adminLayout(active, content) {
  const s = staff();
  const link = (hash, key, label) => `<a href="#${hash}" class="${active === key ? 'active' : ''}">${label}</a>`;
  return `<div class="container admin-layout"><aside class="admin-side">
      <p class="admin-user"><strong>${esc(s.username)}</strong><span class="muted small">${ROLES[s.role]}</span></p>
      <nav class="admin-nav">${link('admin-produse', 'produse', 'Produse')}${s.role === 'admin' ? link('admin-comenzi', 'comenzi', 'Comenzi') + link('admin-clienti', 'clienti', 'Clienți') + link('admin-utilizatori', 'utilizatori', 'Utilizatori') : ''}<a href="#acasa">Vezi magazinul</a></nav>
      <button type="button" class="btn btn-ghost btn-small btn-block" data-action="staff-logout">Ieși din administrare</button>
    </aside><section class="admin-main">${content}</section></div>`;
}
function viewAdminLogin() {
  if (staff()) return redirect('admin-produse');
  const st = formState.admin || {}; formState.admin = null;
  return `<div class="container narrow-page small-page"><form novalidate class="card login-card" data-form="admin-login">
    <p class="eyebrow">Acces echipă</p><h1>Administrare MobilaTa</h1>
    <p class="muted">Doar pentru echipă: gestionezi produsele, comenzile și utilizatorii. Clienții intră din butonul „Cont” de sus.</p>
    <p class="demo-hint">În demo: utilizator <strong>admin</strong>, parola <strong>admin</strong>.</p>
    ${st.error ? `<p class="flash flash-error">${esc(st.error)}</p>` : ''}
    <label for="username">Utilizator</label><input type="text" id="username" name="username" autocomplete="username">
    <label for="password">Parolă</label><input type="password" id="password" name="password" autocomplete="current-password">
    <button type="submit" class="btn btn-large btn-block">Intră</button></form></div>`;
}
function viewAdminProducts() {
  const order = Object.fromEntries(db.categories.map((c, i) => [c.slug, i]));
  const list = db.products.slice().sort((a, b) => order[a.cat] - order[b.cat] || a.name.localeCompare(b.name, 'ro'));
  return adminLayout('produse', `<div class="admin-head"><h1>Produse <span class="muted">(${list.length})</span></h1><a href="#admin-produs-nou" class="btn">+ Adaugă produs</a></div>
    <div class="table-wrap"><table class="admin-table"><thead><tr><th></th><th>Produs</th><th>Categorie</th><th class="num">Preț</th><th class="num">Stoc</th><th></th></tr></thead><tbody>
    ${list.length ? list.map(p => `<tr><td><img src="${esc(p.image)}" alt="" class="thumb"></td><td><a href="#p-${p.slug}">${esc(p.name)}</a></td><td>${esc(cat(p.cat).name)}</td>
      <td class="num">${lei(p.price)}</td><td class="num ${p.stock === 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : ''}">${p.stock}</td>
      <td class="row-actions"><a href="#admin-produs-${p.id}" class="btn btn-ghost btn-small">Editează</a>
        <button type="button" class="btn btn-danger btn-small" data-action="product-delete" data-id="${p.id}" data-confirm="Sigur? Apasă din nou">Scoate</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">Nu există produse. Adaugă primul produs.</td></tr>'}</tbody></table></div>`);
}
function viewProductForm(id) {
  const existing = id ? product(id) : null;
  if (id && !existing) return viewError(404);
  const st = formState.product; formState.product = null;
  const d = st ? st.data : (existing ? { ...existing } : { cat: db.categories[0].slug });
  const errors = st ? st.errors : [];
  const f = (key, label, extra = '') => `<div class="field ${extra}"><label for="f-${key}">${label}</label><input type="text" id="f-${key}" name="${key}" value="${esc(d[key] ?? '')}"></div>`;
  return adminLayout('produse', `<div class="admin-head"><h1>${existing ? 'Editează produsul' : 'Produs nou'}</h1><a href="#admin-produse" class="btn btn-ghost">Înapoi la listă</a></div>
    ${errorsBox(errors)}
    <form novalidate class="card product-form" data-form="product"><input type="hidden" name="id" value="${existing ? existing.id : ''}">
      <input type="hidden" name="image" id="f-image-data" value="${esc(d.image || '')}"><div class="field-grid">
      ${f('name', 'Nume produs', 'field-wide')}
      <div class="field"><label for="f-cat">Categorie</label><select id="f-cat" name="cat">${db.categories.map(c => `<option value="${c.slug}"${c.slug === d.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="f-price">Preț (lei)</label><input type="number" id="f-price" name="price" value="${esc(d.price ?? '')}" min="1" step="1"></div>
      <div class="field"><label for="f-stock">Stoc (bucăți)</label><input type="number" id="f-stock" name="stock" value="${esc(d.stock ?? '')}" min="0" step="1"></div>
      ${f('color', 'Culoare')}${f('material', 'Material')}${f('dimensions', 'Dimensiuni')}
      ${f('short_desc', 'Descriere scurtă (apare pe cardul produsului)', 'field-wide')}
      <div class="field field-wide"><label for="f-description">Descriere completă</label><textarea id="f-description" name="description" rows="5">${esc(d.description || '')}</textarea></div>
      <div class="field field-wide image-field"><img src="${esc(d.image || '')}" alt="Poza produsului" class="thumb-large" id="f-image-preview"${d.image ? '' : ' hidden'}>
        <div><label for="f-image">${d.image ? 'Schimbă poza' : 'Poză produs'}</label><input type="file" id="f-image" accept=".jpg,.jpeg,.png,.webp">
        <p class="muted small">JPG, PNG sau WEBP. În demo, poza rămâne doar în acest browser.</p></div></div>
    </div><button type="submit" class="btn btn-large">${existing ? 'Salvează modificările' : 'Adaugă produsul'}</button></form>`);
}
function viewAdminOrders() {
  const list = db.orders.slice().sort((a, b) => b.id - a.id);
  return adminLayout('comenzi', `<div class="admin-head"><h1>Comenzi <span class="muted">(${list.length})</span></h1></div>
    <div class="table-wrap"><table class="admin-table"><thead><tr><th>#</th><th>Data</th><th>Client</th><th>Plată</th><th class="num">Produse</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
    ${list.length ? list.map(o => `<tr><td><a href="#comanda-${o.id}" data-origin="admin">${o.id}</a></td><td>${o.created_at}</td>
      <td>${o.customer_id ? `<a href="#admin-client-${o.customer_id}">${esc(o.customer_name)}</a>` : `${esc(o.customer_name)} <span class="muted small">(fără cont)</span>`}<br><span class="muted small">${esc(o.email)} · ${esc(o.phone)}</span></td>
      <td>${PAY[o.payment_method]}</td><td class="num">${o.items.reduce((a, i) => a + i.qty, 0)}</td><td class="num">${lei(o.total)}</td>
      <td><label class="sr-only" for="status-${o.id}">Status comanda ${o.id}</label><select id="status-${o.id}" data-status="${o.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === o.status ? ' selected' : ''}>${v}</option>`).join('')}</select></td></tr>`).join('')
      : '<tr><td colspan="7" class="muted">Încă nu există comenzi.</td></tr>'}</tbody></table></div>`);
}
function viewAdminCustomers() {
  const q = sess.clientQuery.toLowerCase();
  const list = db.customers.filter(c => !q || [c.name, c.email, c.phone || ''].some(v => v.toLowerCase().includes(q))).sort((a, b) => b.id - a.id);
  return adminLayout('clienti', `<div class="admin-head"><h1>Clienți <span class="muted">(${list.length})</span></h1>
    <form novalidate class="search-form" role="search" data-form="client-search"><label class="sr-only" for="q">Caută client</label>
      <input type="search" id="q" name="q" value="${esc(sess.clientQuery)}" placeholder="Caută după nume, email sau telefon"><button type="submit" class="btn btn-ghost">Caută</button>
      ${q ? '<button type="button" class="link-button" data-action="clear-search">Toți clienții</button>' : ''}</form></div>
    <div class="table-wrap"><table class="admin-table"><thead><tr><th>Client</th><th>Telefon</th><th>Intră cu</th><th class="num">Comenzi</th><th class="num">Total cumpărat</th><th>Cont creat</th></tr></thead><tbody>
    ${list.length ? list.map(c => { const os = ordersOf(c.id); return `<tr><td><a href="#admin-client-${c.id}">${esc(c.name)}</a><br><span class="muted small">${esc(c.email)}</span></td>
      <td>${esc(c.phone || '–')}</td><td>${c.password ? '<span class="role-pill">Parolă</span> ' : ''}${c.google ? '<span class="role-pill role-admin">Google</span>' : ''}</td>
      <td class="num">${os.length}</td><td class="num">${lei(os.reduce((a, o) => a + o.total, 0))}</td><td>${c.created_at}</td></tr>`; }).join('')
      : `<tr><td colspan="6" class="muted">${q ? 'Niciun client nu se potrivește căutării.' : 'Încă nu există clienți cu cont. Creează unul din butonul „Cont” de sus.'}</td></tr>`}</tbody></table></div>`);
}
function viewAdminCustomer(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return viewError(404);
  const addrs = addressesOf(id), orders = ordersOf(id), log = db.logs.filter(l => l.customer_id === id).sort((a, b) => b.id - a.id).slice(0, 30);
  const addrForm = (action, a, inner) => `<form novalidate data-form="address" data-owner="${id}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="address_id" value="${a ? a.id : ''}">${inner}</form>`;
  return adminLayout('clienti', `<a href="#admin-clienti" class="back-link">← Toți clienții</a>
    <div class="admin-head"><h1>${esc(c.name)}</h1><div class="pill-row">${c.password ? '<span class="role-pill">Intră cu parolă</span>' : ''}${c.google ? '<span class="role-pill role-admin">Conectat cu Google</span>' : ''}<span class="muted small">Client din ${c.created_at}</span></div></div>
    <div class="customer-grid"><div class="customer-col">
      <form novalidate class="card account-section" data-form="client-profile" data-id="${id}"><h2>Date de contact</h2><div class="field-grid">
        <div class="field"><label for="c-name">Nume</label><input type="text" id="c-name" name="name" value="${esc(c.name)}"></div>
        <div class="field"><label for="c-phone">Telefon</label><input type="tel" id="c-phone" name="phone" value="${esc(c.phone || '')}"></div>
        <div class="field field-wide"><label for="c-email">Email</label><input type="email" id="c-email" name="email" value="${esc(c.email)}"><p class="muted small field-note">Schimbă emailul doar la cererea clientului. Cu el intră în cont.</p></div>
        <div class="field field-wide"><label for="c-pay">Metoda de plată preferată</label><select id="c-pay" name="preferred_payment"><option value="">Nealeasă</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}"${c.preferred_payment === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div></div>
        <button type="submit" class="btn">Salvează datele</button></form>
      <section class="card account-section" id="adrese"><h2>Adrese</h2>
        ${addrs.length ? addrs.map(a => `<details class="address-edit"><summary><span><strong>${esc(a.label)}</strong>${a.is_default ? ' <span class="role-pill role-admin">Principală</span>' : ''}<br><span class="muted">${esc(a.address)}, ${esc(a.city)}</span></span><span class="link-like">Modifică</span></summary>
          ${addrForm('edit', a, `<div class="address-edit-form">${addressFields('a' + a.id, a)}<button type="submit" class="btn btn-small">Salvează adresa</button></div>`)}
          <div class="address-actions">${a.is_default ? '' : addrForm('default', a, '<button type="submit" class="btn btn-ghost btn-small">Fă-o principală</button>')}
            ${addrForm('delete', a, '<button type="submit" class="btn btn-danger btn-small" data-confirm="Sigur? Apasă din nou">Șterge adresa</button>')}</div></details>`).join('')
          : '<p class="muted">Clientul nu are adrese salvate.</p>'}
        <details class="address-edit address-new"><summary><span><strong>+ Adaugă o adresă</strong></span></summary>
          ${addrForm('add', null, `<div class="address-edit-form">${addressFields('anew')}<button type="submit" class="btn btn-small">Adaugă adresa</button></div>`)}</details></section>
      <section class="account-section"><h2>Comenzi (${orders.length})</h2>${orders.length ? orderRows(orders, 'admin', id) : '<p class="muted">Clientul nu are comenzi.</p>'}</section>
    </div><div class="customer-col">
      <form novalidate class="card account-section" data-form="client-password" data-id="${id}"><h2>Parolă temporară</h2>
        <p class="muted small">Parola clientului nu se poate vedea. Dacă a uitat-o, setează una temporară, spune-i-o pe telefon și roagă-l să o schimbe din „Datele mele”.</p>
        <label for="c-newpw">Parolă nouă (minimum 8 caractere)</label><input type="text" id="c-newpw" name="password" autocomplete="off">
        <button type="submit" class="btn btn-ghost btn-block">Setează parola temporară</button></form>
      <section class="card account-section" id="gdpr"><h2>Acorduri și GDPR</h2>
        <p class="small"><strong>Termeni acceptați:</strong> ${c.terms_at}</p><p class="small"><strong>Emailuri de marketing:</strong> ${c.marketing ? 'Da' : 'Nu'}</p>
        ${c.marketing ? `<button type="button" class="btn btn-ghost btn-small" data-action="client-marketing" data-id="${id}">Retrage acordul (la cererea clientului)</button>` : ''}
        <p class="muted small">Acordul de marketing îl poate da doar clientul, din contul lui.</p>
        <form novalidate class="danger-inline" data-form="client-delete" data-id="${id}"><h3>Șterge contul</h3><p class="muted small">Doar la cererea clientului. Comenzile rămân în evidență, fără legătură cu contul.</p>
          <label for="c-confirm">Scrie emailul clientului ca să confirmi</label><input type="text" id="c-confirm" name="email" autocomplete="off">
          <button type="submit" class="btn btn-danger-solid btn-block">Șterge contul</button></form></section>
      <section class="card account-section"><h2>Istoric modificări</h2>${log.length ? `<ul class="log-list">${log.map(l => `<li><span>${esc(l.action)}</span><span class="muted small">${esc(l.staff)} · ${l.created_at}</span></li>`).join('')}</ul>` : '<p class="muted small">Echipa nu a modificat încă nimic la acest client.</p>'}</section>
    </div></div>`);
}
function viewAdminUsers() {
  const s = staff();
  return adminLayout('utilizatori', `<div class="admin-head"><h1>Utilizatori</h1></div><div class="admin-split">
    <div class="table-wrap"><table class="admin-table"><thead><tr><th>Utilizator</th><th>Rol</th><th>Creat</th><th></th></tr></thead><tbody>
    ${db.users.map(u => `<tr><td>${esc(u.username)}${u.id === s.id ? ' <span class="muted small">(tu)</span>' : ''}</td><td><span class="role-pill role-${u.role}">${ROLES[u.role]}</span></td><td>${u.created_at}</td>
      <td class="row-actions">${u.id === s.id ? '' : `<button type="button" class="btn btn-danger btn-small" data-action="user-delete" data-id="${u.id}" data-confirm="Sigur? Apasă din nou">Șterge</button>`}</td></tr>`).join('')}</tbody></table></div>
    <form novalidate class="card user-form" data-form="user-new"><h2>Cont nou</h2>
      <label for="u-name">Utilizator</label><input type="text" id="u-name" name="username">
      <label for="u-pass">Parolă</label><input type="password" id="u-pass" name="password" autocomplete="new-password">
      <label for="u-role">Rol</label><select id="u-role" name="role"><option value="manager">Gestionar produse (doar produse)</option><option value="admin">Administrator (acces total)</option></select>
      <button type="submit" class="btn btn-block">Creează contul</button></form></div>`);
}

// ---------- Rutare ----------
let pendingRedirect = null;
function redirect(hash) { pendingRedirect = hash; return null; }
function needCustomer(view) {
  if (customer()) return view();
  sess.afterLogin = location.hash.slice(1);
  return redirect('cont-autentificare');
}
function needStaff(roles, view) {
  const s = staff();
  if (!s) { sess.staff = null; sess.afterStaff = location.hash.slice(1); return redirect('admin-autentificare'); }
  if (!roles.includes(s.role)) return viewError(403);
  return view();
}
const ROUTES = [
  [/^(acasa|categorii)?$/, () => viewHome()],
  [/^c-(.+)$/, m => viewCategory(m[1])],
  [/^p-(.+)$/, m => viewProduct(m[1])],
  [/^cos$/, () => viewCart()],
  [/^comanda$/, () => viewCheckout()],
  [/^plata-(\d+)$/, m => viewPayment(+m[1])],
  [/^comanda-(\d+)$/, m => viewOrder(+m[1])],
  [/^confidentialitate$/, () => viewPolicy()],
  [/^credite$/, () => viewCredits()],
  [/^cont-autentificare$/, () => viewLogin()],
  [/^cont-inregistrare$/, () => viewRegister()],
  [/^contul-meu$/, () => needCustomer(viewAccOrders)],
  [/^contul-meu-adrese$/, () => needCustomer(viewAccAddresses)],
  [/^contul-meu-plata$/, () => needCustomer(viewAccPayment)],
  [/^contul-meu-date$/, () => needCustomer(viewAccProfile)],
  [/^contul-meu-confidentialitate$/, () => needCustomer(viewAccPrivacy)],
  [/^admin-autentificare$/, () => viewAdminLogin()],
  [/^admin(-produse)?$/, () => needStaff(['admin', 'manager'], viewAdminProducts)],
  [/^admin-produs-nou$/, () => needStaff(['admin', 'manager'], () => viewProductForm(null))],
  [/^admin-produs-(\d+)$/, m => needStaff(['admin', 'manager'], () => viewProductForm(+m[1]))],
  [/^admin-comenzi$/, () => needStaff(['admin'], viewAdminOrders)],
  [/^admin-clienti$/, () => needStaff(['admin'], viewAdminCustomers)],
  [/^admin-client-(\d+)$/, m => needStaff(['admin'], () => viewAdminCustomer(+m[1]))],
  [/^admin-utilizatori$/, () => needStaff(['admin'], viewAdminUsers)],
];
let scrollTarget = null;
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  let html = null;
  for (const [re, view] of ROUTES) { const m = h.match(re); if (m) { html = view(m); break; } }
  if (html === null && pendingRedirect === null) html = viewError(404);
  if (pendingRedirect !== null) { const to = pendingRedirect; pendingRedirect = null; save(); location.replace('#' + to); return; }
  const flashes = sess.flash.splice(0);
  app.innerHTML = (flashes.length ? `<div class="container flash-stack">${flashes.map(([k, m]) => `<p class="flash flash-${k}">${esc(m)}</p>`).join('')}</div>` : '') + html;
  save(); renderHeader();
  const target = scrollTarget || (h === 'categorii' ? 'categorii' : null);
  scrollTarget = null;
  if (target && document.getElementById(target)) document.getElementById(target).scrollIntoView();
  else window.scrollTo(0, 0);
}
function renderHeader() {
  const h = location.hash.slice(1);
  const activeCat = h.startsWith('c-') ? h.slice(2) : (h.startsWith('p-') ? (db.products.find(p => p.slug === h.slice(2)) || {}).cat : '');
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.toggle('active', a.dataset.cat === activeCat));
  const c = customer(), s = staff();
  const n = Object.values(sess.cart).reduce((a, b) => a + b, 0);
  document.getElementById('actions').innerHTML =
    (s ? `<a href="#admin" class="icon-link staff-link" title="Administrare"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span class="icon-label">Admin</span></a>` : '') +
    `<a href="#${c ? 'contul-meu' : 'cont-autentificare'}" class="icon-link" title="Contul meu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg><span class="icon-label">${c ? esc(firstName(c.name)) : 'Cont'}</span></a>` +
    `<a href="#cos" class="icon-link cart-link" title="Coșul de cumpărături"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/></svg><span class="icon-label">Coș</span>${n ? `<span class="cart-badge">${n}</span>` : ''}</a>`;
  if (typeof fitNav === 'function') fitNav();
}

// ---------- Acțiuni ----------
function logChange(customerId, action) {
  db.logs.push({ id: nextId('log'), customer_id: customerId, staff: staff().username, action, created_at: now() });
}
function deleteCustomer(id) {
  db.orders.forEach(o => { if (o.customer_id === id) o.customer_id = null; });
  db.addresses = db.addresses.filter(a => a.customer_id !== id);
  db.logs = db.logs.filter(l => l.customer_id !== id);
  db.customers = db.customers.filter(c => c.id !== id);
  if (sess.customerId === id) sess.customerId = null;
}
function afterLogin(fallback) { const to = sess.afterLogin || fallback; sess.afterLogin = null; return to; }
function handleAddress(customerId, fd, allowEdit) {
  const action = fd.action, addrId = +fd.address_id;
  const owned = db.addresses.find(a => a.id === addrId && a.customer_id === customerId);
  const label = (fd.label || '').trim().slice(0, 40) || 'Adresă', address = (fd.address || '').trim(), city = (fd.city || '').trim();
  if ((action === 'add' || action === 'edit') && (!address || !city)) { flash('Completează adresa și orașul.', 'error'); return null; }
  if (action === 'add') {
    const hasAny = db.addresses.some(a => a.customer_id === customerId);
    db.addresses.push({ id: nextId('address'), customer_id: customerId, label, address, city, is_default: hasAny ? 0 : 1 });
    flash('Adresa a fost salvată.'); return `A adăugat adresa „${label}”`;
  }
  if (action === 'edit' && allowEdit && owned) { Object.assign(owned, { label, address, city }); flash('Adresa a fost modificată.'); return `A modificat adresa „${label}”`; }
  if (action === 'default' && owned) { db.addresses.forEach(a => { if (a.customer_id === customerId) a.is_default = a.id === addrId ? 1 : 0; }); flash('Am schimbat adresa principală.'); return 'A schimbat adresa principală'; }
  if (action === 'delete' && owned) {
    db.addresses = db.addresses.filter(a => a.id !== addrId);
    const rest = db.addresses.filter(a => a.customer_id === customerId);
    if (rest.length && !rest.some(a => a.is_default)) rest.sort((a, b) => a.id - b.id)[0].is_default = 1;
    flash('Adresa a fost ștearsă.'); return 'A șters o adresă';
  }
  return null;
}

const FORMS = {
  add(fd) { addToCart(+fd.id, Math.max(1, +fd.qty || 1)); },
  review(fd) {
    const p = product(+fd.id), author = (fd.author || '').trim().slice(0, 60), text = (fd.text || '').trim().slice(0, 1000), rating = +fd.rating;
    if (!author || text.length < 3 || !(rating >= 1 && rating <= 5)) flash('Completează numele, nota și un mesaj de cel puțin 3 caractere.', 'error');
    else { p.reviews.push({ author, rating, text }); flash('Mulțumim! Recenzia ta a fost publicată.'); }
    scrollTarget = 'recenzii'; route();
  },
  'cart-qty'(fd) { const p = product(+fd.id), q = Math.min(+fd.qty || 0, p ? p.stock : 0); if (q > 0) sess.cart[fd.id] = q; else delete sess.cart[fd.id]; route(); },
  checkout(fd) {
    const { items, subtotal, shipping, total } = cartLines(), c = customer(), errors = [];
    const f = { name: (fd.name || '').trim(), email: (fd.email || '').trim(), phone: (fd.phone || '').trim(), address: (fd.address || '').trim(), city: (fd.city || '').trim(), payment: fd.payment };
    if (!f.name) errors.push('Scrie numele complet.');
    if (!EMAIL_RE.test(f.email)) errors.push('Scrie o adresă de email validă.');
    if (f.phone.replace(/\D/g, '').length < 10) errors.push('Scrie un număr de telefon de cel puțin 10 cifre.');
    if (!f.address || !f.city) errors.push('Completează adresa și orașul.');
    if (!PAY[f.payment]) errors.push('Alege o metodă de plată.');
    if (errors.length) { checkoutState = { form: f, errors }; route(); return; }
    const id = nextId('order');
    db.orders.push({ id, created_at: now(), customer_name: f.name, email: f.email, phone: f.phone, address: f.address, city: f.city,
      payment_method: f.payment, status: f.payment === 'ramburs' ? 'confirmata' : 'asteptare_plata', subtotal, shipping, total,
      customer_id: c ? c.id : null, items: items.map(i => ({ name: i.p.name, price: i.p.price, qty: i.qty })) });
    items.forEach(i => { i.p.stock -= i.qty; });
    if (c && fd.save_address && !db.addresses.some(a => a.customer_id === c.id && a.address === f.address && a.city === f.city)) {
      db.addresses.push({ id: nextId('address'), customer_id: c.id, label: 'Adresă de livrare', address: f.address, city: f.city, is_default: addressesOf(c.id).length ? 0 : 1 });
    }
    sess.cart = {}; sess.myOrders.push(id); sess.origin = null;
    go(f.payment === 'card' ? `plata-${id}` : `comanda-${id}`);
  },
  payment(fd, submitter) {
    const o = db.orders.find(x => x.id === +fd.id);
    if (submitter && submitter.value === 'ok') { o.status = 'platita'; go(`comanda-${o.id}`); }
    else { flash('Plata nu a trecut (simulare). Poți încerca din nou.', 'error'); route(); }
  },
  register(fd) {
    const name = (fd.name || '').trim(), email = (fd.email || '').trim().toLowerCase(), errors = [];
    if (!name) errors.push('Scrie-ți numele.');
    if (!EMAIL_RE.test(email)) errors.push('Scrie o adresă de email validă.');
    if ((fd.password || '').length < 8) errors.push('Parola trebuie să aibă cel puțin 8 caractere.');
    else if (fd.password !== fd.password2) errors.push('Cele două parole nu sunt identice.');
    if (!fd.terms) errors.push('Ca să-ți faci cont, trebuie să accepți termenii și politica de confidențialitate.');
    if (!errors.length && db.customers.some(c => c.email === email)) errors.push('Există deja un cont cu acest email. Intră în cont sau folosește Google.');
    if (errors.length) { formState.register = { errors, name, email: fd.email, terms: fd.terms, marketing: fd.marketing }; route(); return; }
    const id = nextId('customer'), t = now();
    db.customers.push({ id, email, name, password: fd.password, google: false, phone: '', preferred_payment: null, marketing: !!fd.marketing, terms_at: t, created_at: t });
    sess.customerId = id; flash(`Bine ai venit, ${firstName(name)}! Contul tău a fost creat.`);
    go(afterLogin('contul-meu'));
  },
  login(fd) {
    const email = (fd.email || '').trim().toLowerCase(), c = db.customers.find(x => x.email === email);
    let error = null;
    if (c && !c.password) error = 'Acest cont folosește autentificarea cu Google. Apasă „Continuă cu Google”.';
    else if (!c || c.password !== fd.password) error = 'Email sau parolă greșită.';
    if (error) { formState.login = { error, email }; route(); return; }
    sess.customerId = c.id; go(afterLogin('contul-meu'));
  },
  'address'(fd, submitter, form) {
    const owner = form.dataset.owner;
    if (owner === 'me') { handleAddress(customer().id, fd, false); route(); return; }
    const cid = +owner, change = handleAddress(cid, fd, true);
    if (change) logChange(cid, change);
    scrollTarget = 'adrese'; route();
  },
  'acc-payment'(fd) { if (PAY[fd.preferred_payment]) { customer().preferred_payment = fd.preferred_payment; flash(`Metoda preferată e acum: ${PAY[fd.preferred_payment]}.`); } route(); },
  'acc-profile'(fd) {
    const name = (fd.name || '').trim();
    if (!name) flash('Numele nu poate rămâne gol.', 'error'); else { Object.assign(customer(), { name, phone: (fd.phone || '').trim() }); flash('Datele tale au fost salvate.'); }
    route();
  },
  'acc-password'(fd) {
    const c = customer();
    if (c.password && fd.current !== c.password) flash('Parola actuală nu e corectă.', 'error');
    else if ((fd.new1 || '').length < 8) flash('Parola nouă trebuie să aibă cel puțin 8 caractere.', 'error');
    else if (fd.new1 !== fd.new2) flash('Cele două parole noi nu sunt identice.', 'error');
    else { c.password = fd.new1; flash('Parola a fost schimbată.'); }
    route();
  },
  'acc-marketing'(fd) { customer().marketing = !!fd.marketing; flash(fd.marketing ? 'Am salvat preferințele tale.' : 'Nu îți mai trimitem emailuri de marketing.'); route(); },
  'acc-delete'(fd) {
    const c = customer(), word = (fd.confirm || '').trim().toUpperCase().replace('Ș', 'S');
    if (word !== 'STERGE') { flash('Ca să-ți ștergi contul, scrie cuvântul ȘTERGE în căsuță.', 'error'); route(); return; }
    if (c.password && fd.password !== c.password) { flash('Parola nu e corectă, contul nu a fost șters.', 'error'); route(); return; }
    deleteCustomer(c.id); flash('Contul tău și datele din el au fost șterse.'); go('acasa');
  },
  'admin-login'(fd) {
    const u = db.users.find(x => x.username === (fd.username || '').trim());
    if (!u || u.password !== fd.password) { formState.admin = { error: 'Utilizator sau parolă greșită.' }; route(); return; }
    sess.staff = { id: u.id, username: u.username, role: u.role }; const to = sess.afterStaff || 'admin-produse'; sess.afterStaff = null; go(to);
  },
  product(fd) {
    const existing = fd.id ? product(+fd.id) : null, errors = [];
    const data = { name: (fd.name || '').trim(), cat: fd.cat, color: (fd.color || '').trim(), material: (fd.material || '').trim(), dimensions: (fd.dimensions || '').trim(),
      short_desc: (fd.short_desc || '').trim().slice(0, 140), description: (fd.description || '').trim(), image: fd.image, price: fd.price, stock: fd.stock };
    const price = Number(fd.price), stock = Number(fd.stock);
    if (!Number.isInteger(price) || price <= 0) errors.push('Prețul trebuie să fie un număr întreg mai mare ca 0.');
    if (fd.stock === '' || !Number.isInteger(stock) || stock < 0) errors.push('Stocul trebuie să fie un număr întreg, 0 sau mai mare.');
    if (!data.name) errors.push('Produsul are nevoie de un nume.');
    if (!cat(data.cat)) errors.push('Alege o categorie.');
    if (errors.length) { formState.product = { data, errors }; route(); return; }
    let slug = slugify(data.name), n = 2;
    while (db.products.some(p => p.slug === slug && p !== existing)) slug = `${slugify(data.name)}-${n++}`;
    const values = { ...data, price, stock, slug, image: data.image || 'img/hero.jpg' };
    if (existing) { Object.assign(existing, values); flash(`Am salvat modificările la „${data.name}”.`); }
    else { db.products.push({ id: nextId('product'), reviews: [], created_at: now(), ...values }); flash(`Am adăugat produsul „${data.name}”.`); }
    go('admin-produse');
  },
  'client-search'(fd) { sess.clientQuery = (fd.q || '').trim(); route(); },
  'client-profile'(fd, s, form) {
    const id = +form.dataset.id, c = db.customers.find(x => x.id === id);
    const name = (fd.name || '').trim(), email = (fd.email || '').trim().toLowerCase(), phone = (fd.phone || '').trim(), pay = fd.preferred_payment || null;
    if (!name || !EMAIL_RE.test(email)) flash('Numele și un email valid sunt obligatorii.', 'error');
    else if (db.customers.some(x => x.email === email && x.id !== id)) flash('Există deja alt client cu acest email.', 'error');
    else {
      const changed = [['name', 'nume', name], ['email', 'email', email], ['phone', 'telefon', phone], ['preferred_payment', 'metoda de plată', pay]]
        .filter(([k, , v]) => (c[k] || '') !== (v || '')).map(([, label]) => label);
      if (changed.length) { Object.assign(c, { name, email, phone, preferred_payment: pay }); logChange(id, 'A modificat: ' + changed.join(', ')); flash('Datele clientului au fost salvate.'); }
      else flash('Nu era nimic de schimbat.');
    }
    route();
  },
  'client-password'(fd, s, form) {
    const id = +form.dataset.id;
    if ((fd.password || '').length < 8) flash('Parola temporară trebuie să aibă cel puțin 8 caractere.', 'error');
    else { db.customers.find(x => x.id === id).password = fd.password; logChange(id, 'A setat o parolă temporară'); flash('Parola temporară a fost setată. Spune-i clientului să o schimbe din contul lui.'); }
    route();
  },
  'client-delete'(fd, s, form) {
    const id = +form.dataset.id, c = db.customers.find(x => x.id === id);
    if ((fd.email || '').trim().toLowerCase() !== c.email) { flash('Emailul de confirmare nu se potrivește. Contul nu a fost șters.', 'error'); scrollTarget = 'gdpr'; route(); return; }
    deleteCustomer(id); flash(`Contul clientului ${c.name} a fost șters.`); go('admin-clienti');
  },
  'user-new'(fd) {
    const username = (fd.username || '').trim();
    if (!username || (fd.password || '').length < 4 || !ROLES[fd.role]) flash('Completează utilizatorul, o parolă de minim 4 caractere și rolul.', 'error');
    else if (db.users.some(u => u.username === username)) flash(`Există deja un cont cu numele „${username}”.`, 'error');
    else { db.users.push({ id: nextId('user'), username, password: fd.password, role: fd.role, created_at: now() }); flash(`Am creat contul „${username}” (${ROLES[fd.role]}).`); }
    route();
  },
};

const ACTIONS = {
  google() {
    let c = db.customers.find(x => x.email === 'client.google@gmail.com');
    if (!c) {
      const t = now();
      c = { id: nextId('customer'), email: 'client.google@gmail.com', name: 'Client Google', password: null, google: true, phone: '', preferred_payment: null, marketing: false, terms_at: t, created_at: t };
      db.customers.push(c); flash('În demo, te-am conectat cu un cont Google de probă.');
    }
    sess.customerId = c.id; go(afterLogin('contul-meu'));
  },
  'customer-logout'() { sess.customerId = null; flash('Ai ieșit din cont.'); go('acasa'); },
  'staff-logout'() { sess.staff = null; go('acasa'); },
  'cart-remove'(el) { delete sess.cart[el.dataset.id]; route(); },
  'product-delete'(el) {
    const p = product(+el.dataset.id);
    db.products = db.products.filter(x => x !== p); delete sess.cart[p.id];
    flash(`Am scos produsul „${p.name}”.`); route();
  },
  'user-delete'(el) {
    const u = db.users.find(x => x.id === +el.dataset.id);
    db.users = db.users.filter(x => x !== u); flash(`Am șters contul „${u.username}”.`); route();
  },
  'client-marketing'(el) {
    const id = +el.dataset.id; db.customers.find(x => x.id === id).marketing = false;
    logChange(id, 'A retras acordul de marketing, la cererea clientului'); flash('Clientul nu mai primește emailuri de marketing.');
    scrollTarget = 'gdpr'; route();
  },
  'clear-search'() { sess.clientQuery = ''; route(); },
  'toggle-export'() { const b = document.getElementById('export-box'); b.hidden = !b.hidden; },
  'copy-export'(el) {
    const text = document.getElementById('export-json').textContent;
    navigator.clipboard.writeText(text).then(() => { el.textContent = 'Copiat'; }).catch(() => {
      const r = document.createRange(); r.selectNodeContents(document.getElementById('export-json'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); el.textContent = 'Selectat, apasă Ctrl+C';
    });
  },
  reset() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '-sesiune'); } catch (e) {}
    db = freshDb(); sess = freshSession(); flash('Demo-ul a fost resetat la produsele inițiale.'); go('acasa');
  },
};

// ---------- Evenimente ----------
function armed(el) {
  if (!el.dataset.confirm || el.dataset.armed) return true;
  const original = el.textContent;
  el.dataset.armed = '1'; el.textContent = el.dataset.confirm;
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = original; } }, 4000);
  return false;
}
document.addEventListener('click', e => {
  const el = e.target.closest('a, button');
  if (!el) return;
  if (el.dataset.confirm && !armed(el)) { e.preventDefault(); return; }
  if (el.dataset.scroll) {
    const t = document.getElementById(el.dataset.scroll);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); return; }
  }
  if (el.dataset.origin) sess.origin = { from: el.dataset.origin, client: +el.dataset.client || null };
  if (el.dataset.after) sess.afterLogin = el.dataset.after;
  if (el.dataset.add) { addToCart(+el.dataset.add, 1); return; }
  if (el.dataset.action && ACTIONS[el.dataset.action]) { e.preventDefault(); ACTIONS[el.dataset.action](el); save(); }
});
document.addEventListener('submit', e => {
  const form = e.target, handler = FORMS[form.dataset.form];
  if (!handler) return;
  e.preventDefault();
  const fd = {}; new FormData(form).forEach((v, k) => { fd[k] = typeof v === 'string' ? v : ''; });
  if (e.submitter && e.submitter.name) fd[e.submitter.name] = e.submitter.value;
  handler(fd, e.submitter, form);
  save();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.status) {
    const o = db.orders.find(x => x.id === +el.dataset.status);
    o.status = el.value; flash(`Comanda #${o.id} e acum „${STATUS[o.status]}”.`); save(); route();
  }
  if (el.id === 'saved-address') {
    const opt = el.selectedOptions[0];
    document.getElementById('address').value = opt.dataset.address; document.getElementById('city').value = opt.dataset.city;
  }
  if (el.id === 'f-image' && el.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL('image/jpeg', 0.8);
        document.getElementById('f-image-data').value = url;
        const pv = document.getElementById('f-image-preview'); pv.src = url; pv.hidden = false;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(el.files[0]);
  }
});

document.getElementById('nav-links').innerHTML = db.categories.map(c => `<a href="#c-${c.slug}" data-cat="${c.slug}">${esc(c.name)}</a>`).join('');
document.getElementById('footer-cats').innerHTML = db.categories.map(c => `<li><a href="#c-${c.slug}">${esc(c.name)}</a></li>`).join('');
const fitNav = window.setupCategoryNav();
window.addEventListener('hashchange', route);
route();
