# Construiește versiunea demo (doar HTML + JS, fără server) în docs/index.html,
# pentru GitHub Pages. Rulează: python demo/build.py
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE_CSS = os.path.join(ROOT, "static", "css", "style.css")
NAV_JS = os.path.join(ROOT, "static", "js", "nav.js")

css = open(SITE_CSS, encoding="utf-8").read()
css = css.replace(
    ".site-header { background: var(--white); border-bottom: 1px solid var(--grey-100); position: sticky; top: 0;",
    ".site-header { background: var(--white); border-bottom: 1px solid var(--grey-100); position: sticky; top: env(safe-area-inset-top, 0px);",
)
css += """
/* ---------- Doar pentru demo ---------- */
[hidden] { display: none !important; }
.demo-bar { background: var(--blue-soft); color: var(--blue-dark); font-size: 13.5px; text-align: center; padding: 7px 16px; }
.demo-hint { background: var(--blue-soft); color: var(--blue-dark); padding: 10px 14px; border-radius: var(--radius-small); }
.toast { position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); background: var(--ink); color: var(--white); padding: 12px 18px; border-radius: var(--radius-small); box-shadow: var(--shadow); font-weight: 600; z-index: 30; max-width: calc(100% - 32px); }
.json-box { background: var(--grey-50); border: 1px solid var(--grey-100); border-radius: var(--radius-small); padding: 12px; font-size: 13px; max-height: 320px; overflow: auto; white-space: pre-wrap; word-break: break-word; margin: 14px 0 10px; }
button[data-armed] { background: var(--danger); border-color: var(--danger); color: var(--white); }
.footer-note { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.footer-note .link-button { color: #9aa3ae; font-size: 13px; }
.footer-note .link-button:hover { color: var(--white); }
"""

seed = json.load(open(os.path.join(HERE, "data.json"), encoding="utf-8"))
seed["credits"] = json.load(open(os.path.join(HERE, "credits.json"), encoding="utf-8"))
seed_json = json.dumps(seed, ensure_ascii=False).replace("</", "<\\/")
app_js = open(os.path.join(HERE, "app.js"), encoding="utf-8").read()
nav_js = open(NAV_JS, encoding="utf-8").read().replace("window.setupCategoryNav();", "")

html = f"""<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MobilaTa · Mobila ta, de la noi.</title>
<meta name="description" content="MobilaTa, magazin online de mobilă. Versiune demo, proiect de practică.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Nunito+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
{css}
</style>
</head>
<body>

<div class="demo-bar"><strong>Versiune demo.</strong> Totul funcționează, dar datele rămân doar în acest browser. Nu se trimite nicio comandă și nu se plătește nimic.</div>

<header class="site-header">
  <div class="container header-row">
    <a href="#acasa" class="logo" aria-label="MobilaTa, pagina principală">Mobila<span>Ta</span></a>
    <nav class="main-nav" aria-label="Categorii">
      <button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="nav-links">
        Categorii
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="nav-links" id="nav-links"></div>
    </nav>
    <div class="header-actions" id="actions"></div>
  </div>
</header>

<main id="app"></main>

<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <p class="logo logo-footer">Mobila<span>Ta</span></p>
      <p class="muted">Mobila ta, de la noi.</p>
    </div>
    <div>
      <h4>Categorii</h4>
      <ul id="footer-cats"></ul>
    </div>
    <div>
      <h4>Magazin</h4>
      <ul>
        <li><a href="#cos">Coșul meu</a></li>
        <li><a href="#contul-meu">Contul meu</a></li>
        <li><a href="#confidentialitate">Confidențialitate</a></li>
        <li><a href="#credite">Credite foto</a></li>
        <li><a href="#admin-autentificare">Acces echipă</a></li>
      </ul>
    </div>
  </div>
  <div class="container footer-note">
    <span>Magazin demonstrativ, proiect de practică. Produsele, prețurile și recenziile sunt exemple.</span>
    <button type="button" class="link-button" data-action="reset" data-confirm="Sigur? Apasă din nou">Resetează demo-ul</button>
  </div>
</footer>

<div class="toast" id="toast" role="status" hidden></div>

<script type="application/json" id="seed">{seed_json}</script>
<script>
{nav_js}
{app_js}
</script>
</body>
</html>
"""

os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
open(os.path.join(ROOT, "docs", "index.html"), "w", encoding="utf-8").write(html)
open(os.path.join(ROOT, "docs", ".nojekyll"), "w").close()
print("docs/index.html:", len(html) // 1024, "KB")
