# MobilaTa

*Mobila ta, de la noi.* Magazin online de mobilă, proiect de practică.

Flask + SQLite: catalog pe categorii, pagini de produs cu recenzii, coș, comandă
și plată simulată, conturi de client (inclusiv login cu Google) cu zonă GDPR,
plus panou de administrare pentru produse, comenzi, clienți și utilizatori.

**Demo online:** https://preksebe.github.io/mobilata/ (versiune doar în browser,
datele rămân la fiecare vizitator; se construiește cu `python demo/build.py`)

## Pornire

```bash
pip install flask
python server.py
```

Site-ul pornește pe http://localhost:8835. Baza de date se creează singură la
prima pornire, cu produsele demonstrative.
