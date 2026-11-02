# Imagini presetate (welcome / goodbye)

Pui fisierele direct in folderul potrivit. Numele fisierului nu conteaza si
nu trebuie numerotat, orice nume merge, sistemul le gaseste automat.

```
public/presets/welcome/             -> galeria pentru imaginea din mesajul de welcome
public/presets/goodbye/             -> galeria pentru imaginea din mesajul de goodbye
public/presets/welcome-background/  -> galeria pentru fundalul cardului de welcome
                                        (aceeași galerie e refolosită și pentru
                                        fundalul cardului de level-up, ca să nu
                                        trebuiască ținute două seturi de imagini)
```

Fisierele .gif merg la fel ca .webp/.png/.jpg, le pui in folderul potrivit si apar automat in galerie dupa ce rulezi `npm run presets:build` (sau dupa un `npm run dev` / `npm run build`, care il ruleaza automat). Pentru fundalul cardului de welcome si de level, botul pastreaza animatia si aplica acelasi design peste fiecare cadru. Daca rezultatul complet depaseste limita de upload Discord, reduce progresiv paleta, apoi numarul de cadre si abia apoi rezolutia, pastrand durata totala a animatiei. Pentru imaginea principala din mesajul de welcome/goodbye (modul "avatar"), fisierul animat este trimis ca atare.

## Format si marime recomandata

- Format: **WebP** (mai mic decat PNG/JPG la aceeasi calitate, se incarca mai
  repede pe mobil). PNG, JPG si GIF merg si ele, dar sunt de obicei mai mari.
- Dimensiune recomandata: **1200 x 630 px** (raport ~1,9:1, acelasi raport
  folosit deja de cardul de welcome din dashboard, asa ca imaginea nu se
  deformeaza in preview sau in Discord).
- Marime fisier: sub **300 KB** per imagine, ideal 50-150 KB. Un gradient
  simplu la calitate 80-85% iese de obicei sub 10 KB; o fotografie iese de
  obicei intre 80-250 KB la aceasta dimensiune.

## Dupa ce adaugi imagini

Ruleaza (o singura data, sau lasa sa ruleze automat la fiecare `npm run dev`
/ `npm run build`, e deja legat in package.json):

```
npm run presets:build
```

Asta regenereaza `public/presets/manifest.json`, fisierul mic pe care
dashboard-ul il citeste ca sa stie ce imagini exista. Manifestul se incarca
DOAR cand cineva deschide fereastra "Alege din galerie" din dashboard, nu la
intrarea in modulul Welcome/Goodbye, asa ca imaginile nu incetinesc
incarcarea paginii pentru nimeni care nu foloseste galeria. In plus,
miniaturile din galerie folosesc `loading="lazy"`, deci se incarca doar cele
vizibile pe ecran, nu toate deodata.

Momentan exista cateva imagini de test (degrade-uri simple de culoare), ca sa
poti vedea sistemul functionand. Le poti sterge oricand si le inlocuiesti cu
imaginile tale reale.
