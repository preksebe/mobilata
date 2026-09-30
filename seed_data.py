CATEGORIES = [
    {"slug": "living", "name": "Living", "image": "img/cat-living.jpg",
     "description": "Canapele, fotolii și mese pentru camera în care stai cel mai mult."},
    {"slug": "dormitor", "name": "Dormitor", "image": "img/cat-dormitor.jpg",
     "description": "Paturi, noptiere și dulapuri pentru un somn liniștit."},
    {"slug": "bucatarie-dining", "name": "Bucătărie și dining", "image": "img/cat-dining.jpg",
     "description": "Mese, scaune și bufete pentru mesele în familie."},
    {"slug": "gradina", "name": "Grădină", "image": "img/cat-gradina.jpg",
     "description": "Mobilier de exterior pentru terasă, grădină și balcon."},
    {"slug": "birou", "name": "Birou", "image": "img/cat-birou.jpg",
     "description": "Birouri, scaune și biblioteci pentru lucrul de acasă."},
]

PRODUCTS = [
    # Living
    {"category": "living", "name": "Canapea Oslo, 3 locuri", "price": 3299, "stock": 6,
     "image": "img/canapea.jpg", "color": "Gri deschis", "dimensions": "220 × 92 × 84 cm",
     "material": "Stofă țesută, cadru din lemn de pin, picioare din stejar",
     "short_desc": "Canapea pe trei locuri, cu perne moi și picioare din lemn masiv.",
     "description": "Oslo are linii simple și un șezut adânc, bun pentru serile lungi de film. "
                    "Pernele de spătar sunt detașabile, iar husa se curăță ușor cu o lavetă umedă."},
    {"category": "living", "name": "Fotoliu Bergen", "price": 1499, "stock": 8,
     "image": "img/fotoliu.jpg", "color": "Maro coniac", "dimensions": "78 × 80 × 98 cm",
     "material": "Piele ecologică, cadru din lemn de fag",
     "short_desc": "Fotoliu clasic cu spătar înalt, pentru colțul tău de citit.",
     "description": "Bergen combină un design clasic cu un șezut ferm, care își păstrează forma în timp. "
                    "Se potrivește lângă o bibliotecă sau lângă fereastră."},
    {"category": "living", "name": "Măsuță de cafea Nordic", "price": 899, "stock": 12,
     "image": "img/masuta-cafea.jpg", "color": "Stejar natur", "dimensions": "110 × 60 × 45 cm",
     "material": "Stejar masiv și sticlă securizată de 8 mm",
     "short_desc": "Blat din sticlă și raft din stejar pentru reviste și cărți.",
     "description": "Nordic are un blat transparent care face camera să pară mai aerisită. "
                    "Raftul de jos îți ține la îndemână telecomanda, cărțile și revistele."},
    {"category": "living", "name": "Comodă TV Linea", "price": 1199, "stock": 5,
     "image": "img/comoda-tv.jpg", "color": "Alb mat", "dimensions": "160 × 40 × 55 cm",
     "material": "PAL melaminat, picioare din lemn de fag",
     "short_desc": "Comodă joasă pentru televizor, cu spațiu ascuns pentru cabluri.",
     "description": "Linea are două uși cu închidere lentă și un orificiu în spate pentru cabluri. "
                    "Suportă televizoare de până la 65 de inch."},
    # Dormitor
    {"category": "dormitor", "name": "Pat matrimonial Aria, 160 × 200", "price": 2799, "stock": 4,
     "image": "img/pat.jpg", "color": "Lemn natur", "dimensions": "170 × 210 × 30 cm",
     "material": "Lemn masiv de pin",
     "short_desc": "Pat jos, din lemn masiv, pentru saltele de 160 × 200 cm.",
     "description": "Aria are o structură joasă, în stil japonez, și un somier din lamele de lemn. "
                    "Salteaua nu este inclusă."},
    {"category": "dormitor", "name": "Noptieră Luna", "price": 549, "stock": 15,
     "image": "img/noptiera.jpg", "color": "Albastru petrol", "dimensions": "50 × 40 × 62 cm",
     "material": "MDF vopsit, mânere din alamă",
     "short_desc": "Noptieră cu trei sertare și mânere din alamă.",
     "description": "Luna aduce o pată de culoare în dormitor. "
                    "Sertarele glisează pe șine metalice și au loc pentru cărți, ochelari și încărcătoare."},
    {"category": "dormitor", "name": "Dulap Sofia, 2 uși", "price": 2399, "stock": 3,
     "image": "img/dulap.jpg", "color": "Nuc", "dimensions": "100 × 58 × 190 cm",
     "material": "Lemn masiv de nuc",
     "short_desc": "Dulap cu două uși, bară de haine și sertar la bază.",
     "description": "Sofia are o bară pentru umerașe, un raft interior și un sertar larg la bază. "
                    "Vine cu kit de prindere de perete."},
    {"category": "dormitor", "name": "Comodă Vera, 6 sertare", "price": 1899, "stock": 7,
     "image": "img/comoda.jpg", "color": "Maro mediu", "dimensions": "140 × 45 × 80 cm",
     "material": "Lemn masiv de mango",
     "short_desc": "Comodă largă cu șase sertare, pentru haine și lenjerii.",
     "description": "Vera are sertare adânci, cu îmbinări clasice în coadă de rândunică. "
                    "Blatul e destul de lat pentru o oglindă și câteva decorațiuni."},
    # Bucătărie și dining
    {"category": "bucatarie-dining", "name": "Masă extensibilă Toscana", "price": 2499, "stock": 5,
     "image": "img/masa-dining.jpg", "color": "Fag natur", "dimensions": "160–200 × 90 × 76 cm",
     "material": "Lemn masiv de fag",
     "short_desc": "Masă pentru 6 persoane, extensibilă la 8.",
     "description": "Toscana se lungește de la 160 la 200 cm cu o placă ascunsă sub blat. "
                    "E destul de solidă pentru mesele de sărbători."},
    {"category": "bucatarie-dining", "name": "Scaun tapițat Milano", "price": 459, "stock": 24,
     "image": "img/scaun-tapitat.jpg", "color": "Gri", "dimensions": "52 × 58 × 92 cm",
     "material": "Stofă, picioare din lemn de stejar",
     "short_desc": "Scaun comod, cu spătar rotunjit și picioare din stejar.",
     "description": "Milano are spătar ergonomic și un șezut tapițat gros. "
                    "Se asortează cu masa Toscana."},
    {"category": "bucatarie-dining", "name": "Bufet Provence", "price": 1699, "stock": 4,
     "image": "img/bufet.jpg", "color": "Alb antic", "dimensions": "110 × 40 × 85 cm",
     "material": "Lemn de pin vopsit, blat din lemn",
     "short_desc": "Bufet în stil rustic, cu două uși și două sertare.",
     "description": "Provence ține la vedere vesela frumoasă și ascunde restul. "
                    "Finisajul alb antic merge bine cu mesele din lemn natur."},
    {"category": "bucatarie-dining", "name": "Scaun de bar Loft", "price": 389, "stock": 18,
     "image": "img/scaun-bar.jpg", "color": "Roșu cărămiziu", "dimensions": "40 × 40 × 75 cm",
     "material": "Șezut tapițat, cadru metalic",
     "short_desc": "Scaun înalt pentru insula din bucătărie sau pentru bar.",
     "description": "Loft are un suport pentru picioare și un șezut rotund tapițat. "
                    "Înălțimea de 75 cm se potrivește la blaturile de bar standard."},
    # Grădină
    {"category": "gradina", "name": "Set lounge Riviera", "price": 4299, "stock": 3,
     "image": "img/set-lounge.jpg", "color": "Gri antracit", "dimensions": "Canapea de 180 cm și perne decorative",
     "material": "Ratan sintetic, perne cu husă impermeabilă",
     "short_desc": "Canapea de exterior din ratan, pentru terasă sau balcon.",
     "description": "Riviera rezistă la soare și ploaie, iar husele pernelor se scot și se spală. "
                    "Pune-o pe terasă și ai un living în aer liber."},
    {"category": "gradina", "name": "Șezlong Costa, set de 2", "price": 1299, "stock": 6,
     "image": "img/sezlong.jpg", "color": "Lemn natur", "dimensions": "190 × 60 × 35 cm (fiecare)",
     "material": "Lemn de salcâm tratat pentru exterior",
     "short_desc": "Două șezlonguri din lemn, cu spătar reglabil.",
     "description": "Costa are spătarul reglabil în patru poziții. "
                    "Lemnul de salcâm e tratat cu ulei și rezistă bine afară."},
    {"category": "gradina", "name": "Bancă de grădină Parc", "price": 799, "stock": 9,
     "image": "img/banca.jpg", "color": "Maro", "dimensions": "150 × 60 × 80 cm",
     "material": "Lemn de pin tratat, cadru din fontă",
     "short_desc": "Bancă clasică de parc, pentru trei persoane.",
     "description": "Parc are un cadru greu din fontă, care nu se clatină. "
                    "Scândurile de pin sunt tratate împotriva umezelii."},
    {"category": "gradina", "name": "Set masă de grădină Terra", "price": 3499, "stock": 2,
     "image": "img/set-masa-gradina.jpg", "color": "Alb", "dimensions": "Masă de 180 × 90 cm și 6 scaune",
     "material": "Aluminiu și lemn tratat",
     "short_desc": "Masă de exterior pentru 6 persoane, cu scaune incluse.",
     "description": "Terra e ușoară, dar stabilă, datorită cadrului din aluminiu. "
                    "Scaunele se stivuiesc pentru depozitarea pe timpul iernii."},
    # Birou
    {"category": "birou", "name": "Birou Studio", "price": 1099, "stock": 10,
     "image": "img/birou.jpg", "color": "Stejar", "dimensions": "140 × 70 × 75 cm",
     "material": "Blat din stejar masiv, picioare metalice",
     "short_desc": "Birou simplu, cu blat din stejar masiv.",
     "description": "Studio are un blat lat, cu loc pentru un monitor mare și laptop. "
                    "Picioarele au bucșe reglabile pentru podelele denivelate."},
    {"category": "birou", "name": "Scaun de birou Flex", "price": 899, "stock": 14,
     "image": "img/scaun-birou.jpg", "color": "Maro coniac", "dimensions": "62 × 60 × 88–98 cm",
     "material": "Piele ecologică, bază cu roți",
     "short_desc": "Scaun cu înălțime reglabilă, pentru lucrul de acasă.",
     "description": "Flex are un mecanism de înclinare cu blocare și înălțime reglabilă pe gaz. "
                    "Roțile sunt potrivite pentru parchet."},
    {"category": "birou", "name": "Bibliotecă Archiva", "price": 1999, "stock": 4,
     "image": "img/biblioteca.jpg", "color": "Stejar natur", "dimensions": "200 × 35 × 200 cm",
     "material": "Lemn masiv de stejar",
     "short_desc": "Bibliotecă mare, cu 20 de compartimente deschise.",
     "description": "Archiva are rafturi groase, care nu se îndoaie sub greutatea cărților. "
                    "Se prinde de perete pentru siguranță."},
    {"category": "birou", "name": "Birou reglabil Rise", "price": 2699, "stock": 6,
     "image": "img/birou-reglabil.jpg", "color": "Nuc și negru", "dimensions": "140 × 70 × 62–127 cm",
     "material": "Blat din nuc, cadru electric cu două motoare",
     "short_desc": "Birou electric, lucrezi și în picioare, și așezat.",
     "description": "Rise își schimbă înălțimea dintr-un buton și ține minte trei poziții. "
                    "Motoarele sunt silențioase și ridică până la 100 kg."},
]

REVIEW_POOL = [
    ("Andreea M.", 5, "Exact ca în poze. Livrarea a venit la timp, iar montajul a durat mai puțin decât mă așteptam."),
    ("Mihai P.", 4, "Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză."),
    ("Ioana R.", 5, "Calitate foarte bună pentru preț. Îl recomand fără ezitare."),
    ("Cristian D.", 4, "Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare."),
    ("Elena S.", 5, "Arată superb în casă și se simte solid. Am primit multe complimente."),
    ("Radu T.", 3, "E ok, dar a ajuns cu o săptămână mai târziu decât era estimat."),
    ("Alina C.", 5, "Al doilea produs pe care îl iau de aici. Aceeași calitate bună."),
    ("Bogdan V.", 4, "Solid și comod. Aș fi vrut să aibă și alte variante de culoare."),
]

CREDITS = [
    ("hero.jpg", "Prydumano Design"), ("cat-living.jpg", "Spacejoy"), ("cat-dormitor.jpg", "Spacejoy"),
    ("cat-dining.jpg", "Clay Banks"), ("cat-gradina.jpg", "sozina hope"), ("cat-birou.jpg", "Collov Home Design"),
    ("canapea.jpg", "Ambo Ampeng"), ("fotoliu.jpg", "Мария Травина"), ("masuta-cafea.jpg", "Connor Home"),
    ("comoda-tv.jpg", "JALG TV Stand"), ("pat.jpg", "Deconovo"), ("noptiera.jpg", "Megan Bucknall"),
    ("dulap.jpg", "Rumman Amin"), ("comoda.jpg", "khloe arledge"), ("masa-dining.jpg", "Costa Live"),
    ("scaun-tapitat.jpg", "Sam Moghadam"), ("bufet.jpg", "Toa Heftiba"), ("scaun-bar.jpg", "Oliver Frsh"),
    ("set-lounge.jpg", "Tomi Saputra"), ("sezlong.jpg", "roman raizen"), ("banca.jpg", "Sonder Quest"),
    ("set-masa-gradina.jpg", "Spacejoy"), ("birou.jpg", "Andrej Lišakov"), ("scaun-birou.jpg", "Kelly Sikkema"),
    ("biblioteca.jpg", "Pickawood"), ("birou-reglabil.jpg", "ergonofis"),
]
