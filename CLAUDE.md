# MobilaTa, magazin online de mobilă (proiect de practică)

Slogan: „Mobila ta, de la noi.” Culori: albastru pentru accente (`--blue`), gri pentru fundaluri.

## Stack
- Flask + SQLite. Pornire: `python server.py`, apoi http://localhost:8835
- `server.py` rute și logică, `seed_data.py` categorii și produse demo, `templates/` pagini Jinja,
  `static/css/style.css` stil, `static/img/` poze Unsplash (credite în `seed_data.CREDITS`),
  `static/uploads/` poze încărcate din admin
- Baza `data/mobilata.db` se creează singură; dacă o ștergi, la pornire revin datele demo

## Conturi și roluri
- Echipa (tabela `users`), login la `/admin/autentificare` (link „Acces echipă” în subsol):
  - `admin` / `admin` (doar pentru dezvoltare locală): acces total
  - `manager` = „Gestionar produse”: doar adaugă, editează și scoate produse
- Clienții (tabela `customers`) sunt separați de echipă: butonul „Cont” din antet, `/cont/...` și `/contul-meu/...`
  - înregistrare cu email și parolă sau Google (OAuth fără bibliotecă externă, cu `urllib`)
  - Google e activ doar dacă există `google_client_secret.json` în folder sau variabilele
    `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; redirect URI: `http://localhost:8835/cont/google/callback`
  - contul are: comenzi (în curs / istoric), adrese, metodă de plată preferată, date personale,
    confidențialitate (acord marketing, export JSON, ștergere cont)
  - la ștergerea contului, comenzile rămân, dar fără legătură cu clientul (`customer_id = NULL`)
- Admin → Clienți (`/admin/clienti`, doar rolul admin): căutare, fișa clientului (date, adrese, comenzi),
  parolă temporară, retragere acord marketing, ștergere la cerere. Nu se afișează hash-ul parolei sau ID-ul Google.
  Fiecare modificare a echipei se scrie în `customer_log` (cine, ce, când).
- Confirmările de ștergere folosesc `data-confirm="..."` (script în `base.html`). Nu pune text de la utilizator
  în `onsubmit`/`onclick`, pentru că ar deschide o breșă XSS.
- Nu stocăm date de card. „Carduri salvate” se activează doar prin procesatorul de plăți (ex. Stripe).
- Politica de confidențialitate (`/confidentialitate`) e o schiță, trebuie verificată de un specialist.

## Încă în linii mari
- Plata cu cardul e simulare (fără procesator real, fără date de card)
- Transfer bancar: IBAN-ul nu e completat
- Prețuri în lei, numere întregi; livrare 99 lei, gratuită de la 1.500 lei
