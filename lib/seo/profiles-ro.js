// Profiluri de cumpărător pentru paginile de module, română. Fără em dash (stilul textelor site-ului).
// Același format ca profiles-en.js: audience, pains, faqMore.
export const PROFILES_RO = {
  tickets: {
    audience: [
      'Proprietari de servere de suport, gaming și magazine, unde staff-ul răspunde zilnic la aceleași tipuri de cereri',
      'Comunități mici care vor un sistem de tickete fără să plătească înainte să știe dacă li se potrivește',
      'Servere în creștere unde ticketul trebuie să se deschidă de fiecare dată, chiar și când serverul e cel mai aglomerat',
    ],
    pains: [
      'Transcriptele, statisticile și rating-urile lipsesc sau sunt într-un plan plătit, deci evidența conversației dispare când se închide canalul',
      'Staff-ul se încurcă: doi moderatori răspund aceluiași membru pentru că nimeni nu vede cine a preluat tichetul',
      'Multe boturi fac doar tickete, așa că un server care are nevoie și de verificare sau giveaway-uri ajunge să ruleze trei sau patru boturi',
      'Configurare care seamănă cu un formular din 2015, cu comenzi de ținut minte înainte să meargă primul panou',
    ],
    faqMore: [
      { q: 'Am nevoie de un bot separat pentru tickete și altul pentru restul serverului?', a: 'Nu. Ticketele sunt un modul Wody, alături de moderare, automod, welcome și altele, deci o invitație și un singur dashboard acoperă tot serverul.' },
    ],
  },
  automod: {
    audience: [
      'Proprietari de servere publice care au crescut mai repede decât echipa de moderatori',
      'Admini care folosesc deja AutoMod-ul Discord și vor nivelurile pe care nu le are',
      'Moderatori raiduiți noaptea, care vor ca serverul să se apere singur până se trezește cineva',
    ],
    pains: [
      'Un filtru de cuvinte nu e o apărare împotriva raid-urilor: un val de conturi noi care postează același link de scam în fiecare canal poate trece direct',
      'Pragurile prea stricte pedepsesc oameni reali, de exemplu un membru primește mute pentru două mesaje rapide la rând',
      'Alertele ajung într-un singur canal, fără istoric, iar moderatorul nu știe dacă e prima sau a cincea abatere',
      'Mai multe boturi de protecție la un loc creează pedepse suprapuse și reguli care se bat cap în cap',
    ],
    faqMore: [
      { q: 'Mai am nevoie de AutoMod-ul Discord?', a: 'Pot rula împreună. Wody adaugă niveluri precum detectarea raid-urilor, a mesajelor duplicate și whitelist de roluri pentru staff, peste ce filtrează Discord nativ.' },
      { q: 'Pot fi lovite de filtre propriile mele roluri de staff?', a: 'Nu, dacă le pui pe whitelist. Rolurile de pe whitelist sunt ignorate de toate regulile.' },
    ],
  },
  moderation: {
    audience: [
      'Proprietari care vor ca toată echipa de staff să folosească aceleași unelte și să lase aceeași urmă',
      'Moderatori șefi care judecă contestații și au nevoie de istoricul unui membru într-un singur loc',
      'Comunități care pleacă de la un bot mare all in one și vor comenzile esențiale fără paywall',
    ],
    pains: [
      'Deciziile devin inconsistente când moderatorul nu vede dacă membrul e la prima abatere sau la a cincea',
      'Contestațiile sunt greu de judecat corect fără o evidență scrisă a ceea ce s-a făcut și de ce',
      'Acțiunile făcute de mână sau în alt bot nu lasă nicio urmă în propriul tău server',
    ],
    faqMore: [
      { q: 'Cum verific un membru înainte să decid pedeapsa?', a: 'Fiecare avertisment este salvat per membru, deci staff-ul poate citi tot istoricul înainte să aleagă între avertisment, timeout sau ban.' },
    ],
  },
  reaction_roles: {
    audience: [
      'Proprietari care lasă membrii să-și aleagă pronume, jocuri, regiuni sau roluri de notificări',
      'Admini de servere cu multe roluri care vor un meniu ordonat',
      'Oricine are un meniu de roluri care a încetat să meargă și vrea unul ușor de reparat',
    ],
    pains: [
      'Cea mai des întâlnită problemă nu e botul: Discord permite unui bot să dea doar roluri aflate sub cel mai înalt rol al lui, iar Administrator nu schimbă asta',
      'Un mesaj poate avea cel mult 20 de emoji-uri diferite, deci meniurile mari trebuie împărțite sau mutate pe butoane',
      'Ștergerea mesajului cu panoul strică configurarea, iar un bot offline nu face nimic',
      'Un meniu care nu poate limita la o singură alegere face dintr-un selector de culoare sau echipă un haos',
    ],
    faqMore: [
      { q: 'De ce nu dă botul rolul?', a: 'Aproape mereu e ordinea rolurilor. Mută rolul Wody deasupra tuturor rolurilor pe care trebuie să le dea și verifică permisiunea Manage Roles, inclusiv în canalul panoului.' },
      { q: 'Ce fac dacă am nevoie de mai mult de 20 de alegeri?', a: 'Discord limitează un mesaj la 20 de emoji-uri diferite. Folosește butoane sau împarte alegerile în mai multe meniuri.' },
    ],
  },
  levels: {
    audience: [
      'Proprietari de comunități care vor ca membrii activi să se simtă văzuți',
      'Admini care au folosit un bot mare de leveling și nu vor să plătească lunar, per server, pentru lucrurile de bază',
      'Servere de gaming și creatori unde un clasament ține vie competiția prietenoasă',
    ],
    pains: [
      'În cel mai mare bot de leveling, lucruri pe care proprietarii le așteaptă, precum mesaje de level-up personalizate, roluri-recompensă și multiplicatori, sunt într-un abonament lunar plătit pentru fiecare server',
      'XP-ul poate fi farmat prin spam dacă botul nu are cooldown, iar în unele unelte și acele controale sunt plătite',
      'Trecerea la alt bot înseamnă să pornești toți membrii de la zero, de care proprietarii se tem',
    ],
    faqMore: [
      { q: 'Se poate farma XP prin spam?', a: 'Nu. Între mesajele care dau XP există un cooldown scurt, deci o rafală de mesaje nu umflă nivelul.' },
      { q: 'Plătesc pentru clasament?', a: 'Nu. XP-ul, anunțurile de level-up, /rank și /leaderboard sunt gratuite pe orice server.' },
    ],
  },
  welcome: {
    audience: [
      'Proprietari care au citit despre carduri de bun venit și le-au găsit blocate într-un plan premium',
      'Servere care vor un DM și un rol de start în momentul intrării',
      'Creatori și comunități de gaming unde primul minut decide dacă noul venit rămâne',
    ],
    pains: [
      'Imaginea de bun venit, setul complet de variabile și fundalul cardului sunt premium în mai multe boturi populare',
      'Un mesaj simplu într-un canal aglomerat dispare din ecran înainte să-l citească noul venit',
      'Configurările de welcome se declanșează uneori și pentru boturi sau arată un număr de membri depășit cu un moment',
      'Proprietarii nu pot previzualiza rezultatul, așa că testează ieșind și intrând cu un cont secundar',
    ],
    faqMore: [
      { q: 'Pot vedea mesajul înainte să fie live?', a: 'Da. Dashboardul arată o previzualizare live a mesajului sau a cardului, deci nu ai nevoie de un cont secundar ca să testezi.' },
    ],
  },
  goodbye: {
    audience: [
      'Proprietari care vor ca membrii care pleacă să fie băgați în seamă în același stil ca cei care vin',
      'Moderatori care urmăresc plecările ca să observe raid-uri și plecări rapide',
    ],
    pains: [
      'Un bot separat pentru un singur mesaj e exact genul de risipă de unelte de care se plâng proprietarii',
      'Mesaje de intrare și de ieșire care par să vină de pe două servere diferite',
    ],
    faqMore: [
      { q: 'Are nevoie mesajul de la revedere de un bot propriu?', a: 'Nu. Se potrivește cu mesajul de bun venit Wody și le configurezi pe amândouă din același dashboard.' },
    ],
  },
  captcha: {
    audience: [
      'Proprietari de servere publice, de giveaway-uri și de trading, care atrag conturi automate',
      'Admini care au fost raiduiți o dată, de obicei în miez de noapte, și nu vor să se repete',
      'Comunități care vor o poartă în fața canalelor fără să pună noii veniți la treburi',
    ],
    pains: [
      'Fiecare pas în plus de verificare scoate și oameni reali, deci o poartă grea costă creștere',
      'Verificarea contează cel mai mult în timpul unui atac, dar costul ei se plătește în fiecare zi normală',
      'Raid-urile vin adesea ca un grup de conturi foarte noi care intră în același moment',
      'Unii membri nu au încredere în verificări de la terți, deci pașii trebuie să fie scurți și bine explicați',
    ],
    faqMore: [
      { q: 'Să las verificarea pornită tot timpul?', a: 'Pentru un server public e o setare implicită bună. Dacă preferi mai puțină fricțiune, combină-o cu modul de raid din Automod, ca drumul mai strict să se folosească doar când ceva pare în neregulă.' },
    ],
  },
  giveaways: {
    audience: [
      'Community manageri care fac trageri la sorți ca să readucă membrii',
      'Streameri și creatori care dau coduri, abonamente sau merch',
      'Servere care vor ca intrarea să fie simplă pe telefon',
    ],
    pains: [
      'Giveaway-urile prin reacții sunt ușor de botat și de păcălit cu conturi secundare',
      'Cerințele de intrare și tragerile programate sunt adesea funcții plătite în boturile obișnuite',
      'Când câștigătorul nu răspunde, tragerea nu are o cale curată de a alege pe altcineva',
      'Tragerile manuale nu au timer, deci se termină târziu sau deloc',
    ],
    faqMore: [
      { q: 'Cum țin conturile false departe de o tragere?', a: 'Folosește Captcha, ca conturile automate să nu primească niciun rol, și ține giveaway-ul într-un canal pe care îl văd doar membrii verificați.' },
    ],
  },
  pools: {
    audience: [
      'Proprietari care lasă comunitatea să aleagă seri de joc, evenimente și reguli',
      'Staff care vrea să afle ce cred membrii înainte de o schimbare',
    ],
    pains: [
      'Sondajele prin reacții lasă o persoană să voteze mai multe opțiuni, deci rezultatul nu e de încredere',
      'Un sondaj pe care nu-l închide nimeni continuă să adune voturi și nimeni nu postează rezultatul',
      'Rezultatele sunt împrăștiate într-un șir de reacții, nu într-un rezumat clar',
    ],
    faqMore: [
      { q: 'Pot face un sondaj cu mai mult de două răspunsuri?', a: 'Da. Un sondaj poate avea mai multe răspunsuri, iar tu alegi când se închide.' },
    ],
  },
  suggestions: {
    audience: [
      'Proprietari care vor ca ideile membrilor să ajungă la staff, nu să se piardă în chat-ul general',
      'Comunități de jocuri și produse care păstrează vizibil ce s-a acceptat',
    ],
    pains: [
      'Aceeași idee e postată iar și iar pentru că nimeni nu o găsește pe cea veche',
      'Un refuz fără status vizibil pare ignorare, deci membrii nu mai trimit idei',
      'Voturile prin simplă reacție pot fi umflate cu conturi în plus',
      'Canalul devine un morman de idei pe jumătate votate pe care nu le citește nimeni',
    ],
    faqMore: [
      { q: 'Cum află membrii ce s-a întâmplat cu ideea lor?', a: 'Fiecare sugestie arată un status clar după ce un moderator o aprobă sau o respinge cu un buton, iar embed-ul rămâne în canal ca istoric.' },
    ],
  },
  auto_responses: {
    audience: [
      'Proprietari care răspund de zeci de ori pe zi la aceeași întrebare',
      'Admini care vor un răspuns la un cuvânt, fără prefix',
    ],
    pains: [
      'În unele boturi mari, răspunsurile automate sunt doar în varianta premium',
      'Planurile gratuite cu doar câteva reguli sunt greu de folosit pentru un FAQ real',
      'Uneltele bazate pe cod sau șabloane îi sperie pe proprietarii care vor doar un răspuns',
    ],
    faqMore: [
      { q: 'Când folosesc un răspuns automat și când o comandă proprie?', a: 'Folosește răspunsul automat când răspunsul trebuie să apară de îndată ce cineva scrie un cuvânt. Folosește comanda proprie când membrul trebuie să întrebe intenționat, cu un prefix precum !rules.' },
    ],
  },
  custom_commands: {
    audience: [
      'Proprietari care vor comenzi de tip !rules, !info, !partners și !ip',
      'Staff care s-a săturat să lipească același link în chat',
    ],
    pains: [
      'Un bot popular permite doar câteva comenzi proprii în planul gratuit, ceea ce nu ajunge pentru un server real',
      'Unele alternative cer cunoștințe de programare și dau mesaje de eroare criptice',
      'Comenzile făcute într-un bot nu pot fi duse pe următorul server pe care îl administrezi',
    ],
    faqMore: [
      { q: 'Plătesc per comandă?', a: 'Nu. Comenzile proprii sunt gratuite pe orice server și le faci din dashboard, fără cod.' },
    ],
  },
  embeds: {
    audience: [
      'Proprietari care construiesc un canal de reguli, info sau roluri și vor să arate profesionist',
      'Staff care anunță noutăți și nu vrea să scrie JSON',
    ],
    pains: [
      'Dacă botul nu are Embed Links într-un canal, embed-ul apare ca text simplu și nimeni nu vede o eroare',
      'Un canal poate refuza Send Messages botului chiar dacă rolul la nivel de server îl permite, deci postările eșuează în tăcere',
      'Uneltele cu webhook postează exact ce primesc și nu mai merg dacă adresa e ștearsă sau scursă',
    ],
    faqMore: [
      { q: 'De ce a apărut embed-ul ca text simplu?', a: 'Botul nu are permisiunea Embed Links în acel canal. Permite-o în permisiunile canalului și trimite din nou.' },
    ],
  },
  scheduled_messages: {
    audience: [
      'Proprietari cu evenimente săptămânale, memento-uri și anunțuri recurente',
      'Comunități cu fusuri orare diferite, unde ora potrivită contează',
    ],
    pains: [
      'O postare de la ora nouă poate ajunge la altă oră dacă fusul orar e greșit',
      'Check-in-urile zilnice și rezumatele săptămânale se copiază de mână până când cineva uită',
      'O permisiune lipsă pe canal face ca o postare programată să eșueze fără nicio eroare vizibilă',
    ],
    faqMore: [
      { q: 'Ce poate conține un mesaj programat?', a: 'Text simplu sau un embed, trimis o dată sau la un interval care se repetă.' },
    ],
  },
  forums: {
    audience: [
      'Proprietari de servere de suport și feedback care folosesc canale forum',
      'Moderatori care își petrec seara etichetând postări de mână',
    ],
    pains: [
      'Postările fără etichetă și fără răspuns fac un forum să pară abandonat, iar apoi oamenii nu mai postează',
      'Aceleași întrebări revin ca postări noi când nimeni nu le poate sorta',
      'Rapoartele de bug fără etichetă nu ajung la cei care le rezolvă',
    ],
    faqMore: [
      { q: 'Ajută la întrebările duplicate?', a: 'Etichetarea automată și cooldown-ul dintre postări țin forumul sortat și mai calm, deci întrebările repetate se observă și se unesc mai ușor.' },
    ],
  },
  logging: {
    audience: [
      'Moderatori care trebuie să știe ce s-a spus înainte să fie șters un mesaj',
      'Proprietari care rezolvă dispute și vor o evidență care nu depinde de memorie',
      'Admini care vor să verifice schimbările de roluri și porecle',
    ],
    pains: [
      'Jurnalul de audit Discord păstrează evenimentele o perioadă limitată și nu reține ce scria un mesaj șters sau editat',
      'Fără evidență, o dispută între doi membri devine cuvânt contra cuvânt',
      'Acțiunile de moderare făcute în locuri diferite nu lasă un istoric unic',
      'Un canal de log pe care îl citește oricine devine o problemă de confidențialitate',
    ],
    faqMore: [
      { q: 'Cine ar trebui să vadă canalul de log?', a: 'Doar staff-ul. Ține canalul de log privat pentru moderatori și admini, pentru că poate conține mesaje șterse.' },
    ],
  },
  birthdays: {
    audience: [
      'Comunități prietenoase unde membrilor le place să fie ținuți minte',
      'Servere mari care vor zile de naștere fără ca anul să fie public',
    ],
    pains: [
      'Zilele de naștere ținute într-un tabel sau în capul cuiva se uită',
      'Fusurile orare fac sărbătoarea să pice în ziua greșită pentru unii membri',
      'Membrii nu își spun data dacă se tem că anul se vede pentru toți',
    ],
    faqMore: [
      { q: 'Poate tot serverul să-mi vadă vârsta?', a: 'Membrii își controlează singuri confidențialitatea, deci își pot ascunde detaliile zilei de naștere din listă.' },
    ],
  },
  invite_tracking: {
    audience: [
      'Proprietari care fac o campanie de creștere și vor să știe care invitație a mers',
      'Creatori care dau recompense pe invitații și au nevoie de o numărătoare corectă',
      'Moderatori care urmăresc raid-urile prin plecări rapide și conturi foarte noi',
    ],
    pains: [
      'Discord nu îi spune unui bot ce invitație a folosit un membru în momentul intrării, deci orice tracker trebuie să deducă',
      'Când mai multe persoane intră în aceeași secundă, crește contorul mai multor invitații și răspunsul e ambiguu',
      'Linkurile vanity nu apar în lista obișnuită de invitații, deci multe trackere le ratează',
      'Un tracker care ghicește în tăcere le dă proprietarilor cifre în care nu pot avea încredere',
    ],
    faqMore: [
      { q: 'De ce unele intrări arată un invitator necunoscut?', a: 'Pentru că Discord nu raportează invitația la intrare. Când Wody nu e sigur, spune asta, în loc să dea creditul persoanei greșite.' },
    ],
  },
  lookups: {
    audience: [
      'Comunități de gaming care cer zilnic statusul unui server Minecraft sau profiluri Steam și Roblox',
      'Servere de muzică, anime și tehnologie unde membrii împart linkuri și statistici',
      'Proprietari care vor comenzi utile fără să adauge cinci boturi cu un singur scop',
    ],
    pains: [
      'Fiecare serviciu are botul lui, iar fiecare bot în plus înseamnă încă o invitație, un rol și un dashboard',
      'Boturile mici, cu o singură funcție, sunt adesea abandonate și nu mai răspund fără să anunțe',
      'Unele căutări cer un cont sau o cheie, pe care proprietarii nu vor să le gestioneze',
    ],
    faqMore: [
      { q: 'Au membrii nevoie de cont pe acele servicii?', a: 'Nu. Wody citește informații publice prin interfețe oficiale sau deschis documentate și le arată în Discord.' },
    ],
  },
  feeds: {
    audience: [
      'Proprietari care urmăresc creatori, subreddit-uri, bloguri și depozite de cod și vor noutățile într-un canal',
      'Comunități de streameri, muzică și dezvoltatori',
      'Admini care au încercat mai multe boturi de notificări și s-au săturat de alerte întârziate sau lipsă',
    ],
    pains: [
      'Alertele care vin cu minute întârziere sunt aproape inutile pentru un live',
      'Boturile care menționează pe toată lumea îi învață pe membri să dea mute canalului',
      'API-urile se schimbă, iar un bot abandonat poate înceta să posteze fără să spună nimănui',
      'Un feed e ușor de adăugat, dar greu de reparat când se strică, pentru că botul nu spune niciodată de ce',
    ],
    faqMore: [
      { q: 'Cum aflu că un feed are o problemă?', a: 'Dashboardul arată statusul și motivul. Un feed care eșuează în continuu așteaptă tot mai mult și se oprește singur, în loc să încerce la nesfârșit.' },
    ],
  },
  community: {
    audience: [
      'Proprietari de servere noi și mici, care trebuie să fie găsite',
      'Servere care vor o pagină publică cu propriul aspect',
    ],
    pains: [
      'Multe site-uri de listare ordonează după mărime, deci un server nou rămâne invizibil',
      'Directoarele sunt pline de servere inactive sau prost administrate, iar vizitatorii învață să nu le mai creadă',
      'O listare fără o pagină clară îi face pe vizitatori să plece imediat',
    ],
    faqMore: [
      { q: 'De ce este serverul meu verificat înainte să apară?', a: 'Echipa Wody verifică fiecare profil public, ca vizitatorii să găsească comunități reale, active și sigure.' },
    ],
  },
  bump: {
    audience: [
      'Proprietari care cresc prin directoare de servere',
      'Servere mici care nu își permit reclame',
    ],
    pains: [
      'Alte directoare răsplătesc pe cine dă bump cel mai des, deci o zi sărită te coboară',
      'Bump-ul se uită ușor, iar o singură zi ratată ajunge ca să pierzi locul din top',
      'Bump-ul automat e împotriva regulilor celui mai mare director, deci nu e o scurtătură sigură',
    ],
    faqMore: [
      { q: 'Bump-ul e același lucru cu reclama?', a: 'Nu. Un bump mută serverul tău în vârful listei Recently bumped din Wody Discovery pentru o vreme. Ajută oamenii să te găsească, dar nu înlocuiește un profil public bun.' },
    ],
  },
  economy: {
    audience: [
      'Proprietari care vor ca membrii să revină în fiecare zi',
      'Servere de roleplay, gaming și chat care iubesc o lume virtuală comună',
    ],
    pains: [
      'O economie fără limite se umflă repede și apoi nimic nu mai valorează nimic',
      'Membrii farmează monede prin spam dacă câștigul nu e controlat',
      'Proprietarii se tem de funcțiile de pariuri și de ce se întâmplă când începe o dispută',
    ],
    faqMore: [
      { q: 'Pot vedea ce s-a întâmplat dacă doi membri se ceartă pe monede?', a: 'Da. Jurnalele pentru admini și uneltele de resetare le permit staff-ului să verifice activitatea și să repare un sold.' },
    ],
  },
  blackjack: {
    audience: [
      'Servere cărora le plac jocurile de tip cazino între prieteni',
      'Proprietari care vor un rost pentru monedele din modulul Economy',
    ],
    pains: [
      'Pariurile fără plafon lasă un singur norocos cu toate monedele',
      'Proprietarii se tem de orice seamănă cu jocuri de noroc reale',
    ],
    faqMore: [
      { q: 'Pot membrii să piardă bani reali?', a: 'Nu. Totul folosește doar monedă virtuală, iar fiecare joc are propria limită de pariu.' },
    ],
  },
  backups: {
    audience: [
      'Proprietari care au petrecut săptămâni cu canale, roluri și permisiuni',
      'Admini care vor o plasă de siguranță înainte de o schimbare mare',
    ],
    pains: [
      'Un server este de obicei distrus printr-o greșeală de permisiuni, de exemplu un rol care a adunat în timp Manage Roles și Ban',
      'Fără backup nu există cale de a recupera canale șterse, doar de a reconstrui de mână',
      'Ultimul snapshot poate conține deja stricăciunea, deci contează un punct de restaurare dinainte',
      'Niciun backup nu poate aduce înapoi membrii care au plecat, deci invitația trebuie dată din nou',
    ],
    faqMore: [
      { q: 'Când ar trebui să fac un backup?', a: 'Înainte de orice schimbare mare de roluri sau canale, și din nou după ce noua structură funcționează.' },
    ],
  },
  temporary_voice: {
    audience: [
      'Echipe de gaming și grupuri de studiu care vor propria cameră la cerere',
      'Servere sociale cu un canal hub care creează o cameră pentru fiecare',
    ],
    pains: [
      'O listă fixă de canale vocale e ori aglomerată, ori plină de camere goale',
      'Membrii vor aceleași câteva controale: redenumire, încuiere, limită de persoane',
      'Mai multe boturi cu o singură funcție adaugă fiecare un rol, o invitație și un risc de pană',
    ],
    faqMore: [
      { q: 'Ce se întâmplă cu camera când pleacă toți?', a: 'Este ștearsă automat, deci lista de canale rămâne ordonată.' },
    ],
  },
  youtube_notify: {
    audience: [
      'Creatori YouTube și servere de fani care vor fiecare încărcare anunțată',
      'Proprietari care au nevoie de alertă în canalul potrivit',
    ],
    pains: [
      'O alertă care vine târziu pierde din valoare, iar membrii ratează premiera',
      'Boturile care menționează pe toată lumea îi fac pe membri să dea mute canalului',
      'Schimbările de API pot opri un bot abandonat fără nicio înștiințare',
    ],
    faqMore: [
      { q: 'Există o variantă gratuită de a urmări un canal YouTube?', a: 'Da. YouTube este și o sursă gratuită în Feeds, care postează videoclipuri noi după un program, de la fiecare 5 minute.' },
    ],
  },
  stream_notifications: {
    audience: [
      'Streameri și comunități care vor membrii în cameră când începe live-ul',
      'Servere care urmăresc un creator pe Twitch și TikTok',
    ],
    pains: [
      'O alertă la 5 minute după începerea live-ului e aproape inutilă',
      'Alertele care menționează pe toată lumea duc la canale cu mute, deci un rol cu opt-in merge mai bine',
      'Platformele își schimbă interfețele, iar un bot neîntreținut încetează să posteze fără să te anunțe',
    ],
    faqMore: [
      { q: 'Există o alternativă gratuită pentru Twitch?', a: 'Twitch și Kick sunt surse gratuite în Feeds. Stream Notifications este modulul Premium, cu TikTok și mesaje personalizate.' },
    ],
  },
};
