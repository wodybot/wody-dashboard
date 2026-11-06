// Module pages for Counting, Statistics, Battle Pass and Theme Studio.
// English and Romanian carry the full page (with audience, pains and extra questions); the other languages carry the
// localized hero, description, introduction, features and questions, in the same shape as the other localized module pages.

export const NEW_EN = {
  counting: {
    heroTitle: 'Discord Counting Bot, a Counting Game with Streaks and Saves',
    heroSubtitle: 'Turn any channel into a counting game: 13 modes, streaks, saves, power-ups, challenges and a leaderboard. Free on every server.',
    metaTitle: 'Wody - Discord Counting Bot | Counting Game, Saves and Leaderboard',
    metaDescription: 'A Discord counting bot with 13 counting modes, streaks, saves, power-ups, challenges and a leaderboard. Clear notices on every mistake. Free on every server.',
    ogTitle: 'Discord Counting Game with Streaks, Saves and Leaderboard, Powered by Wody',
    ogDescription: 'Classic, binary, roman, words, fibonacci and more. Saves, power-ups, challenges and clear notices on every mistake.',
    intro: [
      'A counting channel is one of the simplest games a community can play, and one of the most addictive. It only works when the bot is reliable: every number checked, every mistake explained, and the count never lost.',
      'Wody Counting checks each number, reacts to it, and when someone breaks the count it says exactly what went wrong and which number comes next. Saves can bring the count back, streaks and records keep people coming back, and if Wody was offline for a moment it says which number was saved last so the game continues cleanly.',
    ],
    features: [
      '13 modes: classic, reverse, increment, decimal, negative, binary, hexadecimal, roman, alphabet, words, fibonacci, multiplication and your own sequence',
      'A clear notice on every mistake with the reason and the correct next number',
      'Saves, streak shields, hints and other power-ups members earn by playing',
      'Rules against counting twice in a row, edited or deleted numbers and fast mistake bursts',
      'Challenges, competitions, milestones, records and a server leaderboard',
      'After Wody comes back online it announces the last saved number and the next one',
    ],
    faq: [
      { q: 'Is the Wody counting bot free?', a: 'Yes. Counting is free on every server. Premium servers only get a few extra comforts, such as more stored saves.' },
      { q: 'What happens when someone sends a wrong number?', a: 'Wody reacts, posts a notice that names the reason (wrong number, same member twice, and so on) and gives the correct next number. Depending on your rules the count resets or a save is used.' },
      { q: 'What if Wody cannot write in the counting channel?', a: 'The notice goes to the channel you chose for counting notices, or to your mod log channel, so a mistake is never silent.' },
      { q: 'What happens if Wody was offline?', a: 'When it comes back it checks the counting channels. If members kept counting meanwhile, it announces the last saved number and the number to continue with.' },
    ],
  },
  statistics: {
    heroTitle: 'Discord Server Statistics Bot, Activity and Community Health',
    heroSubtitle: 'Channel activity, active members, growth and community health for your server, built from aggregate counters only. Free.',
    metaTitle: 'Wody - Discord Server Statistics | Activity and Growth',
    metaDescription: 'Discord server statistics with channel activity, active members, growth trends and community health. Built from aggregate counters, never message content. Free.',
    ogTitle: 'Discord Server Statistics and Community Health, Powered by Wody',
    ogDescription: 'See which channels are alive, how many members take part and how the server is growing, without storing what anyone wrote.',
    intro: [
      'Owners want to know if their server is growing, which channels people actually use and when the community is most active. Most statistics tools answer that by reading and storing every message.',
      'Wody Statistics counts activity instead of keeping it. It builds charts of messages, active members, channels and growth from aggregate counters only, with a retention period you choose, and shows them to staff in the dashboard and through /statistics.',
    ],
    features: [
      'Messages, active members and busiest channels per day, week and month',
      'Growth trends and a community health overview',
      'Aggregate counters only, message content is never stored',
      'Retention period you choose, with one click to erase everything',
      'Access limited to staff by default',
      'The /statistics command for a quick look inside Discord',
    ],
    faq: [
      { q: 'Does Wody read or store messages for statistics?', a: 'No. Statistics are built from counters such as how many messages were sent in a channel per hour. The text of messages is never stored.' },
      { q: 'Who can see the statistics?', a: 'Staff by default. You choose the access level in the dashboard.' },
      { q: 'How long is the data kept?', a: 'For the retention period you set. Older counters are removed automatically and you can erase all of them at any time.' },
      { q: 'Is it free?', a: 'Yes, Statistics is free on every server.' },
    ],
  },
  battlepass: {
    heroTitle: 'Discord Battle Pass Bot, Seasons, Levels and Rewards',
    heroSubtitle: 'Seasonal progress for your members: XP from messages and voice, levels, rewards, quests, achievements and a page of its own.',
    metaTitle: 'Wody - Discord Battle Pass | Seasons, Levels and Rewards',
    metaDescription: 'A Discord Battle Pass with seasons, levels, XP from messages and voice, rewards, quests, achievements, collections and a public page. Server seasons with Premium.',
    ogTitle: 'Discord Battle Pass with Seasons, Quests and Rewards, Powered by Wody',
    ogDescription: 'Run seasons with levels, rewards and quests, and give your members a page to follow their progress.',
    intro: [
      'Levels alone get stale: after a few months the same people sit at the top and nobody else has a reason to try. A season gives everyone a fresh start, a goal and rewards to work towards.',
      'Wody Battle Pass runs seasons with levels, XP from messages and voice, rewards, quests, achievements, collections and badges. Every member follows the Wody Global season, and Premium servers can run their own server seasons with their own rewards and page design.',
    ],
    features: [
      'Seasons with a start, an end and a level curve you control',
      'XP from messages and voice with daily and season limits against farming',
      'Rewards, badges, quests, achievements and collections',
      'A public season page with progress, leaderboard and rewards',
      'Page design with colors, sections and your own artwork',
      'Server seasons on Premium servers, next to the Wody Global season',
    ],
    faq: [
      { q: 'How do members earn XP?', a: 'By chatting and by spending time in voice channels, inside the limits of the season, plus the XP from quests.' },
      { q: 'Can my server run its own season?', a: 'Yes, Premium servers can create server seasons with their own levels, rewards and page. Every server can follow the Wody Global season.' },
      { q: 'Where do members see their progress?', a: 'With /battlepass progress in Discord and on the season page on the website.' },
      { q: 'Can people farm XP with spam?', a: 'XP has cooldowns and daily and season limits, and the protection settings refuse repeated or very short messages.' },
    ],
  },
  theme_studio: {
    heroTitle: 'Discord Server Themes, Style Your Wody Server Pages',
    heroSubtitle: 'Pick an official theme and give your server pages their own look: colors, scenes, light and effects. Premium.',
    metaTitle: 'Wody - Theme Studio | Themes for Your Discord Server Pages',
    metaDescription: 'Theme Studio styles your Wody server pages: Battle Pass, leaderboard, counting and server page. Official themes with colors, scenes and effects. Premium.',
    ogTitle: 'Themes for Your Discord Server Pages, Powered by Wody',
    ogDescription: 'Official themes with colors, scenes and effects for your server pages, with full control over where they show.',
    intro: [
      'The pages of a server on the web often look exactly like everybody else’s. Members notice when a server has its own identity, and they notice it again every time they open its page.',
      'Theme Studio lets a Premium server choose an official theme and apply it to its Wody pages: the Battle Pass page, the leaderboard, the counting page and the server page, and if you want, the dashboard background. You decide where it shows, and visitors can always turn effects off.',
    ],
    features: [
      'Official themes with their own colors, scenes, light and effects',
      'Choose where the theme shows: Battle Pass, leaderboard, counting, server page and dashboard',
      'Save a draft and publish when it is ready',
      'Effects respect reduced motion, and visitors can turn them off',
      'Premium module',
    ],
    faq: [
      { q: 'Which pages does a theme change?', a: 'The server’s pages on the Wody website, such as the Battle Pass, leaderboard, counting and server page, and the dashboard background if you turn that on.' },
      { q: 'Is Theme Studio free?', a: 'Theme Studio is a Premium module.' },
      { q: 'Can visitors turn the effects off?', a: 'Yes. Effects also stay off for anyone who asks their device for reduced motion.' },
    ],
  },
};

export const NEW_RO = {
  counting: {
    heroTitle: 'Bot de numărat pentru Discord, joc cu serii și salvări',
    heroSubtitle: 'Transformă orice canal într-un joc de numărat: 13 moduri, serii, salvări, puteri, provocări și clasament. Gratuit pe orice server.',
    metaTitle: 'Wody - Bot de numărat Discord | Joc, salvări și clasament',
    metaDescription: 'Bot de numărat pentru Discord cu 13 moduri, serii, salvări, puteri, provocări și clasament. Mesaj clar la fiecare greșeală. Gratuit pe orice server.',
    ogTitle: 'Joc de numărat pe Discord cu serii, salvări și clasament, de la Wody',
    ogDescription: 'Clasic, binar, roman, cuvinte, fibonacci și altele. Salvări, puteri, provocări și mesaj clar la fiecare greșeală.',
    intro: [
      'Un canal de numărat este unul dintre cele mai simple jocuri pentru o comunitate și unul dintre cele mai captivante. Funcționează doar dacă botul e de încredere: fiecare număr verificat, fiecare greșeală explicată, iar numărătoarea nu se pierde niciodată.',
      'Wody Counting verifică fiecare număr, reacționează la el, iar când cineva greșește spune exact ce s-a întâmplat și care este numărul următor. Salvările pot readuce numărătoarea, seriile și recordurile îi aduc pe membri înapoi, iar dacă Wody a fost offline spune care a fost ultimul număr salvat, ca jocul să continue corect.',
    ],
    features: [
      '13 moduri: clasic, invers, cu pas, zecimal, negativ, binar, hexazecimal, roman, alfabet, cuvinte, fibonacci, înmulțire și secvența ta',
      'Mesaj clar la fiecare greșeală, cu motivul și numărul corect următor',
      'Salvări, scuturi de serie, indicii și alte puteri câștigate jucând',
      'Reguli împotriva numărării de două ori la rând, a numerelor editate sau șterse și a greșelilor în rafală',
      'Provocări, competiții, praguri, recorduri și clasamentul serverului',
      'După ce Wody revine online anunță ultimul număr salvat și pe cel următor',
    ],
    faq: [
      { q: 'Botul de numărat Wody este gratuit?', a: 'Da. Counting este gratuit pe orice server. Serverele Premium primesc doar câteva avantaje în plus, de exemplu mai multe salvări păstrate.' },
      { q: 'Ce se întâmplă când cineva trimite un număr greșit?', a: 'Wody reacționează, scrie un mesaj cu motivul (număr greșit, același membru de două ori și altele) și spune numărul corect următor. În funcție de reguli, numărătoarea se resetează sau se folosește o salvare.' },
      { q: 'Ce se întâmplă dacă Wody nu poate scrie în canalul de numărat?', a: 'Mesajul ajunge în canalul ales pentru notificările de numărat sau în canalul de mod log, astfel încât nicio greșeală nu trece neanunțată.' },
      { q: 'Ce se întâmplă dacă Wody a fost offline?', a: 'Când revine verifică canalele de numărat. Dacă membrii au continuat între timp, anunță ultimul număr salvat și numărul cu care se continuă.' },
    ],
  },
  statistics: {
    heroTitle: 'Bot de statistici pentru Discord, activitate și sănătatea comunității',
    heroSubtitle: 'Activitatea canalelor, membrii activi, creșterea și sănătatea comunității, calculate doar din contoare agregate. Gratuit.',
    metaTitle: 'Wody - Statistici server Discord | Activitate și creștere',
    metaDescription: 'Statistici pentru serverul de Discord: activitatea canalelor, membri activi, creștere și sănătatea comunității. Doar contoare agregate, fără conținutul mesajelor. Gratuit.',
    ogTitle: 'Statistici pentru serverul de Discord și sănătatea comunității, de la Wody',
    ogDescription: 'Vezi ce canale sunt active, câți membri participă și cum crește serverul, fără să se păstreze ce a scris cineva.',
    intro: [
      'Proprietarii vor să știe dacă serverul crește, ce canale sunt folosite cu adevărat și când comunitatea e cea mai activă. Multe unelte de statistici răspund citind și păstrând fiecare mesaj.',
      'Wody Statistics numără activitatea în loc să o păstreze. Construiește grafice pentru mesaje, membri activi, canale și creștere doar din contoare agregate, cu o perioadă de păstrare aleasă de tine, și le arată staff-ului în dashboard și prin /statistics.',
    ],
    features: [
      'Mesaje, membri activi și cele mai active canale pe zi, săptămână și lună',
      'Tendințe de creștere și o imagine de ansamblu a sănătății comunității',
      'Doar contoare agregate, conținutul mesajelor nu este păstrat niciodată',
      'Perioadă de păstrare aleasă de tine și ștergere completă dintr-un clic',
      'Acces doar pentru staff în mod implicit',
      'Comanda /statistics pentru o privire rapidă în Discord',
    ],
    faq: [
      { q: 'Wody citește sau păstrează mesajele pentru statistici?', a: 'Nu. Statisticile se fac din contoare, de exemplu câte mesaje au fost trimise într-un canal pe oră. Textul mesajelor nu este păstrat.' },
      { q: 'Cine poate vedea statisticile?', a: 'Staff-ul, în mod implicit. Nivelul de acces se alege din dashboard.' },
      { q: 'Cât timp sunt păstrate datele?', a: 'Pe perioada aleasă de tine. Contoarele mai vechi se șterg automat și le poți șterge pe toate oricând.' },
      { q: 'Este gratuit?', a: 'Da, Statistics este gratuit pe orice server.' },
    ],
  },
  battlepass: {
    heroTitle: 'Battle Pass pentru Discord, sezoane, niveluri și recompense',
    heroSubtitle: 'Progres pe sezoane pentru membri: XP din mesaje și voce, niveluri, recompense, misiuni, realizări și o pagină proprie.',
    metaTitle: 'Wody - Battle Pass Discord | Sezoane, niveluri și recompense',
    metaDescription: 'Battle Pass pentru Discord cu sezoane, niveluri, XP din mesaje și voce, recompense, misiuni, realizări, colecții și pagină publică. Sezoane de server cu Premium.',
    ogTitle: 'Battle Pass pe Discord cu sezoane, misiuni și recompense, de la Wody',
    ogDescription: 'Organizează sezoane cu niveluri, recompense și misiuni și oferă membrilor o pagină în care își urmăresc progresul.',
    intro: [
      'Nivelurile simple se învechesc: după câteva luni aceiași oameni sunt în top și ceilalți nu mai au motiv să încerce. Un sezon oferă tuturor un nou început, un obiectiv și recompense.',
      'Wody Battle Pass organizează sezoane cu niveluri, XP din mesaje și voce, recompense, misiuni, realizări, colecții și insigne. Fiecare membru urmează sezonul Wody Global, iar serverele Premium își pot crea propriile sezoane, cu recompensele și designul lor.',
    ],
    features: [
      'Sezoane cu început, sfârșit și o curbă de niveluri controlată de tine',
      'XP din mesaje și voce, cu limite zilnice și pe sezon împotriva abuzurilor',
      'Recompense, insigne, misiuni, realizări și colecții',
      'O pagină publică a sezonului cu progres, clasament și recompense',
      'Design de pagină cu culori, secțiuni și grafică proprie',
      'Sezoane de server pe serverele Premium, alături de sezonul Wody Global',
    ],
    faq: [
      { q: 'Cum câștigă membrii XP?', a: 'Scriind și stând pe canalele de voce, în limitele sezonului, plus XP-ul din misiuni.' },
      { q: 'Serverul meu poate avea propriul sezon?', a: 'Da, serverele Premium pot crea sezoane de server cu niveluri, recompense și pagină proprie. Orice server poate urma sezonul Wody Global.' },
      { q: 'Unde își văd membrii progresul?', a: 'Cu /battlepass progress în Discord și pe pagina sezonului de pe site.' },
      { q: 'Se poate obține XP prin spam?', a: 'XP-ul are pauze și limite zilnice și pe sezon, iar setările de protecție refuză mesajele repetate sau foarte scurte.' },
    ],
  },
  theme_studio: {
    heroTitle: 'Teme pentru serverul de Discord, paginile Wody în stilul tău',
    heroSubtitle: 'Alege o temă oficială și dă paginilor serverului un aspect propriu: culori, scene, lumină și efecte. Premium.',
    metaTitle: 'Wody - Theme Studio | Teme pentru paginile serverului Discord',
    metaDescription: 'Theme Studio stilizează paginile Wody ale serverului: Battle Pass, clasament, numărat și pagina serverului. Teme oficiale cu culori, scene și efecte. Premium.',
    ogTitle: 'Teme pentru paginile serverului de Discord, de la Wody',
    ogDescription: 'Teme oficiale cu culori, scene și efecte pentru paginile serverului, cu control complet asupra locului în care apar.',
    intro: [
      'Paginile web ale unui server arată adesea exact ca ale tuturor celorlalți. Membrii observă când un server are o identitate proprie și o observă de fiecare dată când îi deschid pagina.',
      'Theme Studio permite unui server Premium să aleagă o temă oficială și să o aplice paginilor Wody: pagina Battle Pass, clasamentul, pagina de numărat și pagina serverului, iar dacă vrei și fundalul dashboard-ului. Tu alegi unde apare, iar vizitatorii pot opri oricând efectele.',
    ],
    features: [
      'Teme oficiale cu culori, scene, lumină și efecte proprii',
      'Alegi unde apare tema: Battle Pass, clasament, numărat, pagina serverului și dashboard',
      'Salvezi o ciornă și publici când e gata',
      'Efectele respectă mișcarea redusă, iar vizitatorii le pot opri',
      'Modul Premium',
    ],
    faq: [
      { q: 'Ce pagini schimbă o temă?', a: 'Paginile serverului de pe site-ul Wody, cum ar fi Battle Pass, clasamentul, numărătoarea și pagina serverului, plus fundalul dashboard-ului dacă activezi asta.' },
      { q: 'Theme Studio este gratuit?', a: 'Theme Studio este un modul Premium.' },
      { q: 'Vizitatorii pot opri efectele?', a: 'Da. Efectele rămân oprite și pentru cei care au cerut mișcare redusă din setările dispozitivului.' },
    ],
  },
};

export const NEW_PROFILES_EN = {
  counting: {
    audience: [
      'Community servers that want a simple game members return to every day',
      'Owners whose current counting bot stays silent on mistakes or loses the count',
      'Servers that want harder modes than 1, 2, 3 for their regulars',
    ],
    pains: [
      'The bot reacts with a cross and says nothing, so nobody knows what the right number was',
      'A restart or an outage silently breaks the count and the channel argues about where it was',
      'One member counts alone in a loop or edits numbers to troll the game',
    ],
    faqMore: [
      { q: 'Can I run more than one counting game?', a: 'Yes, every counting channel has its own game, mode, rules and leaderboard.' },
    ],
  },
  statistics: {
    audience: [
      'Owners who want to see if their server is really growing',
      'Staff teams that plan events and want to know when members are online',
      'Communities that care about privacy and do not want their messages stored',
    ],
    pains: [
      'Statistics bots that log every message to build a chart',
      'Member count goes up but nobody can tell if people actually talk',
      'Dead channels nobody notices until the server feels empty',
    ],
    faqMore: [
      { q: 'Do I need another bot for statistics?', a: 'No. Statistics is one module of Wody, next to moderation, levels and the rest, in the same dashboard.' },
    ],
  },
  battlepass: {
    audience: [
      'Active servers that want a reason for members to come back every season',
      'Gaming communities used to battle passes in the games they play',
      'Owners who want rewards that feel earned instead of handed out',
    ],
    pains: [
      'Classic levels where the same members stay on top forever',
      'Rewards that are easy to farm with spam or idle voice',
      'Seasonal events that take hours of manual work every time',
    ],
    faqMore: [
      { q: 'Does it work next to the Levels module?', a: 'Yes. Levels and Battle Pass are separate: one is your permanent rank, the other a season with its own rewards.' },
    ],
  },
  theme_studio: {
    audience: [
      'Premium servers that want their pages to match their brand',
      'Communities with a strong theme such as gaming, music or anime',
      'Owners who share their server page and want it to stand out',
    ],
    pains: [
      'Every server page looking identical to the next one',
      'Custom styling that needs code or hosting a website',
      'Heavy effects that slow pages down or bother sensitive visitors',
    ],
    faqMore: [
      { q: 'Does a theme change how Wody looks in Discord?', a: 'No, themes style the server’s pages on the website. Messages in Discord keep their usual look.' },
    ],
  },
};

export const NEW_PROFILES_RO = {
  counting: {
    audience: [
      'Servere de comunitate care vor un joc simplu la care membrii revin zilnic',
      'Proprietari al căror bot de numărat tace la greșeli sau pierde numărătoarea',
      'Servere care vor moduri mai grele decât 1, 2, 3 pentru membrii vechi',
    ],
    pains: [
      'Botul pune un X și nu spune nimic, așa că nimeni nu știe care era numărul corect',
      'O repornire sau o pană strică numărătoarea și canalul se ceartă unde rămăsese',
      'Un membru numără singur în buclă sau editează numere ca să strice jocul',
    ],
    faqMore: [
      { q: 'Pot avea mai multe jocuri de numărat?', a: 'Da, fiecare canal de numărat are jocul, modul, regulile și clasamentul lui.' },
    ],
  },
  statistics: {
    audience: [
      'Proprietari care vor să vadă dacă serverul chiar crește',
      'Echipe de staff care planifică evenimente și vor să știe când sunt membrii online',
      'Comunități atente la confidențialitate care nu vor ca mesajele să fie păstrate',
    ],
    pains: [
      'Boți de statistici care salvează fiecare mesaj ca să facă un grafic',
      'Numărul de membri crește, dar nimeni nu știe dacă oamenii chiar vorbesc',
      'Canale moarte pe care nu le observă nimeni până serverul pare gol',
    ],
    faqMore: [
      { q: 'Am nevoie de alt bot pentru statistici?', a: 'Nu. Statistics este un modul Wody, alături de moderare, niveluri și restul, în același dashboard.' },
    ],
  },
  battlepass: {
    audience: [
      'Servere active care vor un motiv ca membrii să revină în fiecare sezon',
      'Comunități de gaming obișnuite cu battle pass-urile din jocuri',
      'Proprietari care vor recompense câștigate, nu împărțite',
    ],
    pains: [
      'Niveluri clasice în care aceiași membri rămân pe primul loc pentru totdeauna',
      'Recompense ușor de obținut prin spam sau stat degeaba pe voce',
      'Evenimente de sezon care cer ore de muncă manuală de fiecare dată',
    ],
    faqMore: [
      { q: 'Merge alături de modulul Levels?', a: 'Da. Levels și Battle Pass sunt separate: unul este rangul permanent, celălalt un sezon cu recompensele lui.' },
    ],
  },
  theme_studio: {
    audience: [
      'Servere Premium care vor ca paginile să se potrivească identității lor',
      'Comunități cu o temă puternică, de gaming, muzică sau anime',
      'Proprietari care își distribuie pagina serverului și vor să iasă în evidență',
    ],
    pains: [
      'Fiecare pagină de server arată identic cu următoarea',
      'Stilizare care cere cod sau găzduirea unui site',
      'Efecte grele care încetinesc paginile sau deranjează vizitatorii sensibili',
    ],
    faqMore: [
      { q: 'O temă schimbă aspectul lui Wody în Discord?', a: 'Nu, temele stilizează paginile serverului de pe site. Mesajele din Discord își păstrează aspectul obișnuit.' },
    ],
  },
};

// The same pages in full for every other language live in new-modules-intl.js.
export { NEW_INTL } from './new-modules-intl';
