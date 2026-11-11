-- MobilaTa: schema pentru Supabase (PostgreSQL). Se ruleaza o singura data, in SQL Editor.
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

-- Date de pornire (aceleasi ca in seed_data.py)
insert into categories (slug, name, description, image, sort) values ('living', 'Living', 'Canapele, fotolii și mese pentru camera în care stai cel mai mult.', 'img/cat-living.jpg', 0);
insert into categories (slug, name, description, image, sort) values ('dormitor', 'Dormitor', 'Paturi, noptiere și dulapuri pentru un somn liniștit.', 'img/cat-dormitor.jpg', 1);
insert into categories (slug, name, description, image, sort) values ('bucatarie-dining', 'Bucătărie și dining', 'Mese, scaune și bufete pentru mesele în familie.', 'img/cat-dining.jpg', 2);
insert into categories (slug, name, description, image, sort) values ('gradina', 'Grădină', 'Mobilier de exterior pentru terasă, grădină și balcon.', 'img/cat-gradina.jpg', 3);
insert into categories (slug, name, description, image, sort) values ('birou', 'Birou', 'Birouri, scaune și biblioteci pentru lucrul de acasă.', 'img/cat-birou.jpg', 4);
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'living'), 'canapea-oslo-3-locuri', 'Canapea Oslo, 3 locuri', 'Canapea pe trei locuri, cu perne moi și picioare din lemn masiv.', 'Oslo are linii simple și un șezut adânc, bun pentru serile lungi de film. Pernele de spătar sunt detașabile, iar husa se curăță ușor cu o lavetă umedă.', 3299, 'Stofă țesută, cadru din lemn de pin, picioare din stejar', '220 × 92 × 84 cm', 'Gri deschis', 6, 'img/canapea.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'canapea-oslo-3-locuri'), 'Andreea M.', 5, 'Exact ca în poze. Livrarea a venit la timp, iar montajul a durat mai puțin decât mă așteptam.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'canapea-oslo-3-locuri'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'living'), 'fotoliu-bergen', 'Fotoliu Bergen', 'Fotoliu clasic cu spătar înalt, pentru colțul tău de citit.', 'Bergen combină un design clasic cu un șezut ferm, care își păstrează forma în timp. Se potrivește lângă o bibliotecă sau lângă fereastră.', 1499, 'Piele ecologică, cadru din lemn de fag', '78 × 80 × 98 cm', 'Maro coniac', 8, 'img/fotoliu.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'fotoliu-bergen'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'fotoliu-bergen'), 'Elena S.', 5, 'Arată superb în casă și se simte solid. Am primit multe complimente.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'fotoliu-bergen'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'living'), 'masuta-de-cafea-nordic', 'Măsuță de cafea Nordic', 'Blat din sticlă și raft din stejar pentru reviste și cărți.', 'Nordic are un blat transparent care face camera să pară mai aerisită. Raftul de jos îți ține la îndemână telecomanda, cărțile și revistele.', 899, 'Stejar masiv și sticlă securizată de 8 mm', '110 × 60 × 45 cm', 'Stejar natur', 12, 'img/masuta-cafea.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'masuta-de-cafea-nordic'), 'Alina C.', 5, 'Al doilea produs pe care îl iau de aici. Aceeași calitate bună.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'masuta-de-cafea-nordic'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'living'), 'comoda-tv-linea', 'Comodă TV Linea', 'Comodă joasă pentru televizor, cu spațiu ascuns pentru cabluri.', 'Linea are două uși cu închidere lentă și un orificiu în spate pentru cabluri. Suportă televizoare de până la 65 de inch.', 1199, 'PAL melaminat, picioare din lemn de fag', '160 × 40 × 55 cm', 'Alb mat', 5, 'img/comoda-tv.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'comoda-tv-linea'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'comoda-tv-linea'), 'Ioana R.', 5, 'Calitate foarte bună pentru preț. Îl recomand fără ezitare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'comoda-tv-linea'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'dormitor'), 'pat-matrimonial-aria-160-200', 'Pat matrimonial Aria, 160 × 200', 'Pat jos, din lemn masiv, pentru saltele de 160 × 200 cm.', 'Aria are o structură joasă, în stil japonez, și un somier din lamele de lemn. Salteaua nu este inclusă.', 2799, 'Lemn masiv de pin', '170 × 210 × 30 cm', 'Lemn natur', 4, 'img/pat.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'pat-matrimonial-aria-160-200'), 'Elena S.', 5, 'Arată superb în casă și se simte solid. Am primit multe complimente.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'pat-matrimonial-aria-160-200'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'dormitor'), 'noptiera-luna', 'Noptieră Luna', 'Noptieră cu trei sertare și mânere din alamă.', 'Luna aduce o pată de culoare în dormitor. Sertarele glisează pe șine metalice și au loc pentru cărți, ochelari și încărcătoare.', 549, 'MDF vopsit, mânere din alamă', '50 × 40 × 62 cm', 'Albastru petrol', 15, 'img/noptiera.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'noptiera-luna'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'noptiera-luna'), 'Andreea M.', 5, 'Exact ca în poze. Livrarea a venit la timp, iar montajul a durat mai puțin decât mă așteptam.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'noptiera-luna'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'dormitor'), 'dulap-sofia-2-usi', 'Dulap Sofia, 2 uși', 'Dulap cu două uși, bară de haine și sertar la bază.', 'Sofia are o bară pentru umerașe, un raft interior și un sertar larg la bază. Vine cu kit de prindere de perete.', 2399, 'Lemn masiv de nuc', '100 × 58 × 190 cm', 'Nuc', 3, 'img/dulap.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'dulap-sofia-2-usi'), 'Ioana R.', 5, 'Calitate foarte bună pentru preț. Îl recomand fără ezitare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'dulap-sofia-2-usi'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'dormitor'), 'comoda-vera-6-sertare', 'Comodă Vera, 6 sertare', 'Comodă largă cu șase sertare, pentru haine și lenjerii.', 'Vera are sertare adânci, cu îmbinări clasice în coadă de rândunică. Blatul e destul de lat pentru o oglindă și câteva decorațiuni.', 1899, 'Lemn masiv de mango', '140 × 45 × 80 cm', 'Maro mediu', 7, 'img/comoda.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'comoda-vera-6-sertare'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'comoda-vera-6-sertare'), 'Alina C.', 5, 'Al doilea produs pe care îl iau de aici. Aceeași calitate bună.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'comoda-vera-6-sertare'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'bucatarie-dining'), 'masa-extensibila-toscana', 'Masă extensibilă Toscana', 'Masă pentru 6 persoane, extensibilă la 8.', 'Toscana se lungește de la 160 la 200 cm cu o placă ascunsă sub blat. E destul de solidă pentru mesele de sărbători.', 2499, 'Lemn masiv de fag', '160–200 × 90 × 76 cm', 'Fag natur', 5, 'img/masa-dining.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'masa-extensibila-toscana'), 'Andreea M.', 5, 'Exact ca în poze. Livrarea a venit la timp, iar montajul a durat mai puțin decât mă așteptam.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'masa-extensibila-toscana'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'bucatarie-dining'), 'scaun-tapitat-milano', 'Scaun tapițat Milano', 'Scaun comod, cu spătar rotunjit și picioare din stejar.', 'Milano are spătar ergonomic și un șezut tapițat gros. Se asortează cu masa Toscana.', 459, 'Stofă, picioare din lemn de stejar', '52 × 58 × 92 cm', 'Gri', 24, 'img/scaun-tapitat.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-tapitat-milano'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-tapitat-milano'), 'Elena S.', 5, 'Arată superb în casă și se simte solid. Am primit multe complimente.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-tapitat-milano'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'bucatarie-dining'), 'bufet-provence', 'Bufet Provence', 'Bufet în stil rustic, cu două uși și două sertare.', 'Provence ține la vedere vesela frumoasă și ascunde restul. Finisajul alb antic merge bine cu mesele din lemn natur.', 1699, 'Lemn de pin vopsit, blat din lemn', '110 × 40 × 85 cm', 'Alb antic', 4, 'img/bufet.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'bufet-provence'), 'Alina C.', 5, 'Al doilea produs pe care îl iau de aici. Aceeași calitate bună.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'bufet-provence'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'bucatarie-dining'), 'scaun-de-bar-loft', 'Scaun de bar Loft', 'Scaun înalt pentru insula din bucătărie sau pentru bar.', 'Loft are un suport pentru picioare și un șezut rotund tapițat. Înălțimea de 75 cm se potrivește la blaturile de bar standard.', 389, 'Șezut tapițat, cadru metalic', '40 × 40 × 75 cm', 'Roșu cărămiziu', 18, 'img/scaun-bar.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-de-bar-loft'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-de-bar-loft'), 'Ioana R.', 5, 'Calitate foarte bună pentru preț. Îl recomand fără ezitare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-de-bar-loft'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'gradina'), 'set-lounge-riviera', 'Set lounge Riviera', 'Canapea de exterior din ratan, pentru terasă sau balcon.', 'Riviera rezistă la soare și ploaie, iar husele pernelor se scot și se spală. Pune-o pe terasă și ai un living în aer liber.', 4299, 'Ratan sintetic, perne cu husă impermeabilă', 'Canapea de 180 cm și perne decorative', 'Gri antracit', 3, 'img/set-lounge.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'set-lounge-riviera'), 'Elena S.', 5, 'Arată superb în casă și se simte solid. Am primit multe complimente.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'set-lounge-riviera'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'gradina'), 'sezlong-costa-set-de-2', 'Șezlong Costa, set de 2', 'Două șezlonguri din lemn, cu spătar reglabil.', 'Costa are spătarul reglabil în patru poziții. Lemnul de salcâm e tratat cu ulei și rezistă bine afară.', 1299, 'Lemn de salcâm tratat pentru exterior', '190 × 60 × 35 cm (fiecare)', 'Lemn natur', 6, 'img/sezlong.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'sezlong-costa-set-de-2'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'sezlong-costa-set-de-2'), 'Andreea M.', 5, 'Exact ca în poze. Livrarea a venit la timp, iar montajul a durat mai puțin decât mă așteptam.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'sezlong-costa-set-de-2'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'gradina'), 'banca-de-gradina-parc', 'Bancă de grădină Parc', 'Bancă clasică de parc, pentru trei persoane.', 'Parc are un cadru greu din fontă, care nu se clatină. Scândurile de pin sunt tratate împotriva umezelii.', 799, 'Lemn de pin tratat, cadru din fontă', '150 × 60 × 80 cm', 'Maro', 9, 'img/banca.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'banca-de-gradina-parc'), 'Ioana R.', 5, 'Calitate foarte bună pentru preț. Îl recomand fără ezitare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'banca-de-gradina-parc'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'gradina'), 'set-masa-de-gradina-terra', 'Set masă de grădină Terra', 'Masă de exterior pentru 6 persoane, cu scaune incluse.', 'Terra e ușoară, dar stabilă, datorită cadrului din aluminiu. Scaunele se stivuiesc pentru depozitarea pe timpul iernii.', 3499, 'Aluminiu și lemn tratat', 'Masă de 180 × 90 cm și 6 scaune', 'Alb', 2, 'img/set-masa-gradina.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'set-masa-de-gradina-terra'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'set-masa-de-gradina-terra'), 'Alina C.', 5, 'Al doilea produs pe care îl iau de aici. Aceeași calitate bună.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'set-masa-de-gradina-terra'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'birou'), 'birou-studio', 'Birou Studio', 'Birou simplu, cu blat din stejar masiv.', 'Studio are un blat lat, cu loc pentru un monitor mare și laptop. Picioarele au bucșe reglabile pentru podelele denivelate.', 1099, 'Blat din stejar masiv, picioare metalice', '140 × 70 × 75 cm', 'Stejar', 10, 'img/birou.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'birou-studio'), 'Andreea M.', 5, 'Exact ca în poze. Livrarea a venit la timp, iar montajul a durat mai puțin decât mă așteptam.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'birou-studio'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'birou'), 'scaun-de-birou-flex', 'Scaun de birou Flex', 'Scaun cu înălțime reglabilă, pentru lucrul de acasă.', 'Flex are un mecanism de înclinare cu blocare și înălțime reglabilă pe gaz. Roțile sunt potrivite pentru parchet.', 899, 'Piele ecologică, bază cu roți', '62 × 60 × 88–98 cm', 'Maro coniac', 14, 'img/scaun-birou.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-de-birou-flex'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-de-birou-flex'), 'Elena S.', 5, 'Arată superb în casă și se simte solid. Am primit multe complimente.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'scaun-de-birou-flex'), 'Radu T.', 3, 'E ok, dar a ajuns cu o săptămână mai târziu decât era estimat.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'birou'), 'biblioteca-archiva', 'Bibliotecă Archiva', 'Bibliotecă mare, cu 20 de compartimente deschise.', 'Archiva are rafturi groase, care nu se îndoaie sub greutatea cărților. Se prinde de perete pentru siguranță.', 1999, 'Lemn masiv de stejar', '200 × 35 × 200 cm', 'Stejar natur', 4, 'img/biblioteca.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'biblioteca-archiva'), 'Alina C.', 5, 'Al doilea produs pe care îl iau de aici. Aceeași calitate bună.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'biblioteca-archiva'), 'Bogdan V.', 4, 'Solid și comod. Aș fi vrut să aibă și alte variante de culoare.');
insert into products (category_id, slug, name, short_desc, description, price, material, dimensions, color, stock, image) values ((select id from categories where slug = 'birou'), 'birou-reglabil-rise', 'Birou reglabil Rise', 'Birou electric, lucrezi și în picioare, și așezat.', 'Rise își schimbă înălțimea dintr-un buton și ține minte trei poziții. Motoarele sunt silențioase și ridică până la 100 kg.', 2699, 'Blat din nuc, cadru electric cu două motoare', '140 × 70 × 62–127 cm', 'Nuc și negru', 6, 'img/birou-reglabil.jpg');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'birou-reglabil-rise'), 'Mihai P.', 4, 'Frumos și bine făcut. Culoarea e puțin mai închisă decât în poză.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'birou-reglabil-rise'), 'Ioana R.', 5, 'Calitate foarte bună pentru preț. Îl recomand fără ezitare.');
insert into reviews (product_id, author, rating, text) values ((select id from products where slug = 'birou-reglabil-rise'), 'Cristian D.', 4, 'Mulțumit în general, doar instrucțiunile de montaj puteau fi mai clare.');
