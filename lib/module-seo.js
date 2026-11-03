// Content for the dedicated, indexable /modules/[slug] SEO landing pages.
//
// Why a separate file instead of extending messages/*.json:
// messages/*.json already has `landing.modulesDetail[].{key,title,desc}`
// translated into all 9 locales, that part is reused as-is (see
// app/[locale]/modules/[slug]/page.js). The *new* long-form SEO copy below
// (hero headline, meta tags, FAQ, feature bullets) only exists in English
// and Romanian for now. Every other locale automatically falls back to the
// English copy via getModuleSeoContent() below, so the pages still render
// and index correctly, they just won't be in the visitor's language until
// someone adds that locale's block to MODULE_SEO_CONTENT.
//
// Only modules with real, meaningful standalone search volume get a page
// (see MODULE_SEO_SLUGS). The rest stay inside the homepage's #modules grid.

import { EN_A } from '@/lib/seo/en-a';
import { EN_B } from '@/lib/seo/en-b';
import { RO_A } from '@/lib/seo/ro-a';
import { RO_B } from '@/lib/seo/ro-b';
import { PROFILES_EN } from '@/lib/seo/profiles-en';
import { PROFILES_RO } from '@/lib/seo/profiles-ro';

// Every module has its own page. The first five were written earlier; the others live in lib/seo/*.js (English and
// Romanian). Other languages show the English copy of those pages until someone adds their block.
import { MODULE_SEO_SLUGS } from '@/lib/module-slugs';
export { MODULE_SEO_SLUGS };

export function hasModuleSeoPage(slug) {
  return MODULE_SEO_SLUGS.includes(slug);
}

// Maps a module slug to the /commands page section it belongs to, so the
// "View commands" CTA can deep-link straight to the relevant group instead
// of just landing on /commands. `null` means the module has no dedicated
// slash-command group (e.g. automod is configured entirely from the
// dashboard), so the CTA links to /commands with no anchor.
const COMMANDS_ANCHOR = {
  tickets: 'community',
  automod: null,
  moderation: 'moderation',
  reaction_roles: 'community',
  levels: 'community',
  welcome: null,
  goodbye: null,
  captcha: null,
  giveaways: 'community',
  pools: 'community',
  suggestions: null,
  auto_responses: 'community',
  custom_commands: 'community',
  embeds: null,
  scheduled_messages: null,
  forums: null,
  logging: null,
  birthdays: 'birthdays',
  invite_tracking: 'invite_tracking',
  lookups: 'lookups',
  feeds: 'feeds',
  community: 'discovery',
  bump: 'discovery',
  economy: 'economy',
  blackjack: 'games',
  backups: 'backups',
  temporary_voice: 'tempvoice',
  youtube_notify: null,
  stream_notifications: null,
};

export function getCommandsAnchor(slug) {
  return COMMANDS_ANCHOR[slug] ?? null;
}

const MODULE_SEO_CONTENT = {
  en: {
    tickets: {
      heroTitle: 'Discord Ticket Bot, Free Support Tickets for Your Server',
      heroSubtitle: 'Let members open private support tickets with one click. Button panels, staff claiming and automatic transcripts, free on every server.',
      metaTitle: 'Wody - Discord Ticket Bot | Free Support Tickets',
      metaDescription: 'Add a free Discord ticket bot to your server. Button panels, private ticket channels, staff claiming and automatic transcripts. Invite Wody in seconds.',
      ogTitle: 'Discord Ticket Bot, Free Support Tickets, Powered by Wody',
      ogDescription: 'Button panels, private channels per user, staff claiming and automatic transcript export, set up your support system in minutes.',
      intro: [
        'Support requests scattered across DMs and random channels are hard to track and easy to lose. Wody\'s ticket module gives every member a clean, private channel for their issue, and gives your staff a system for handling it.',
        'A ticket panel goes in any channel you choose. Members click a button to open a ticket, staff claim it to avoid duplicate replies, and once it\'s resolved the channel closes with a full transcript saved automatically, so nothing gets lost even after the channel is gone.',
      ],
      features: [
        'One-click button panels, no slash command needed for members to open a ticket',
        'A private channel per ticket, visible only to the member and your staff roles',
        'Claim system so one staff member owns the conversation',
        'Automatic transcript export when a ticket is closed',
        'Closable with a reason, kept for moderation records',
      ],
      faq: [
        { q: 'Is the Wody ticket bot free?', a: 'Yes. The ticket module, including button panels, private channels, staff claiming and transcripts, is available for free on every server.' },
        { q: 'Can I customize the ticket panel?', a: 'You can set the panel\'s channel, title, description and button label from the dashboard, so it matches how your server is organized.' },
        { q: 'What happens when a ticket is closed?', a: 'The private channel closes and a transcript of the full conversation is generated automatically, so you keep a record even though the channel itself is gone.' },
        { q: 'Can staff avoid replying to the same ticket twice?', a: 'Yes, the claim system lets one staff member take ownership of a ticket so the rest of the team knows it\'s already being handled.' },
      ],
    },
    automod: {
      heroTitle: 'Discord Automod Bot, Automatic Spam & Raid Protection',
      heroSubtitle: 'Layered automod filters spam, invite links, mass mentions and raids in real time, so you\'re not moderating manually all day.',
      metaTitle: 'Wody - Discord Automod Bot | Spam & Raid Protection',
      metaDescription: 'Free Discord automod bot with spam filtering, invite-link blocking, mention-spam detection and raid protection. Set it up in minutes with Wody.',
      ogTitle: 'Discord Automod Bot, Real-Time Spam & Raid Protection',
      ogDescription: 'Layered protection for spam, invite links, mentions, raids, scams, bad words, caps and duplicates, with a role whitelist for your staff.',
      intro: [
        'Manual moderation doesn\'t scale once a server grows past a handful of active members, spam, scam links and raid attempts happen faster than any human can react. Wody\'s automod runs continuously in the background, catching what a moderator would otherwise have to spot by hand.',
        'Each protection layer can be tuned independently, and staff roles can be whitelisted so your team\'s own messages are never affected by the filters they configured.',
      ],
      features: [
        'Spam and message-flood detection',
        'Invite link and scam link filtering',
        'Mass mention and raid detection',
        'Bad word and excessive-caps filtering',
        'Duplicate message detection',
        'Role whitelist so staff are never filtered',
      ],
      faq: [
        { q: 'What does the automod bot detect?', a: 'Spam and message floods, invite links, scam links, mass mentions, raids, bad words, excessive caps and duplicate messages, each as an independent rule you can toggle.' },
        { q: 'Can I whitelist certain roles?', a: 'Yes, any role you whitelist is skipped by every automod rule, so staff and trusted members are never accidentally caught by the filters.' },
        { q: 'Will automod take action automatically?', a: 'Automod removes or blocks the offending content according to the rules you\'ve enabled, without needing a moderator online to react in real time.' },
        { q: 'Does it help during a raid?', a: 'Yes, the raid detection layer is built to catch sudden bursts of new joins or coordinated spam and respond immediately, before a human moderator could.' },
      ],
    },
    moderation: {
      heroTitle: 'Discord Moderation Bot, Free Ban, Kick, Timeout & Warn Commands',
      heroSubtitle: 'A full moderation toolkit, ban, kick, timeout, warnings and a persistent mod-log, all through simple slash commands, free.',
      metaTitle: 'Wody - Discord Moderation Bot | Free Mod Tools',
      metaDescription: 'Free Discord moderation bot with /ban, /kick, /timeout, /warn, /purge, /lock and a full mod-log with warning history. Invite Wody in seconds.',
      ogTitle: 'Discord Moderation Bot, Complete Moderation Toolkit',
      ogDescription: 'Ban, kick, timeout, warn, purge, slowmode and lock, with warning history and a persistent mod-log channel, free for every server.',
      intro: [
        'Every server eventually needs to handle rule-breakers, and doing it consistently means your whole staff team needs the same tools and the same record of what happened. Wody\'s moderation module covers the essentials as slash commands, with everything logged automatically.',
        'Warnings build a history per member instead of disappearing the moment the channel scrolls, and every action, bans, kicks, timeouts, purges, can be sent to a dedicated mod-log channel so nothing happens off the record.',
      ],
      features: [
        '/ban, /kick and /timeout with reasons',
        '/warn with a persistent per-member warning history',
        '/purge for bulk message cleanup',
        '/slowmode and /lock for fast-moving or heated channels',
        'Optional mod-log channel that records every action automatically',
      ],
      faq: [
        { q: 'Is the moderation bot free?', a: 'Yes. Ban, kick, timeout, warn, purge, slowmode, lock and the mod-log are all available for free on every server.' },
        { q: 'Does it keep a warning history?', a: 'Yes, every /warn is saved per member, so staff can see a member\'s full warning history before deciding on further action.' },
        { q: 'Can I log every moderation action?', a: 'Yes, set a mod-log channel and Wody posts an embed for every ban, kick, timeout, warn and purge automatically.' },
        { q: 'What permissions does the bot need?', a: 'Standard Discord moderation permissions (Ban Members, Kick Members, Moderate Members, Manage Messages) matching whichever commands you plan to use.' },
      ],
    },
    reaction_roles: {
      heroTitle: 'Discord Reaction Roles Bot, Self-Assignable Roles',
      heroSubtitle: 'Let members pick their own roles with a click or a reaction, four modes: normal, toggle, unique and verify.',
      metaTitle: 'Wody - Discord Reaction Roles Bot | Free Roles',
      metaDescription: 'Free Discord reaction roles bot with normal, toggle, unique and verify modes. Let members self-assign roles with reactions or buttons.',
      ogTitle: 'Discord Reaction Roles Bot, Self-Assignable Roles, 4 Modes',
      ogDescription: 'Normal, toggle, unique and verify modes for self-assignable roles, via reactions or buttons.',
      intro: [
        'Manually assigning pronoun, game or notification roles doesn\'t scale past a small server. Wody\'s reaction roles module lets members grant themselves roles directly from a message, with staff choosing exactly how permissive that should be.',
        'Four modes cover most use cases: normal lets members pick any number of roles, toggle removes a role on a second click, unique limits members to one role from the set, and verify requires a role members already have before they can claim another.',
      ],
      features: [
        'Normal mode, members can hold any combination of roles from the menu',
        'Toggle mode, clicking again removes the role',
        'Unique mode, only one role from the menu at a time',
        'Verify mode, requires an existing role before claiming a new one',
        'Works with both reactions and buttons',
      ],
      faq: [
        { q: 'What\'s the difference between the reaction role modes?', a: 'Normal allows multiple roles at once, toggle removes a role on a second click, unique restricts members to a single role from the menu, and verify requires a prerequisite role first.' },
        { q: 'Can members only pick one role?', a: 'That\'s what unique mode is for, set the menu to unique and members can hold only one role from that group at a time.' },
        { q: 'Does it support both buttons and reactions?', a: 'Yes, you choose whether a given role menu uses Discord buttons or emoji reactions when you set it up.' },
        { q: 'Is there a limit on how many role menus I can create?', a: 'You can set up as many reaction/button role menus as your server needs.' },
      ],
    },
    levels: {
      heroTitle: 'Discord Leveling Bot, XP, Ranks & Leaderboards',
      heroSubtitle: 'Reward active members with XP-per-message, level-up announcements and a server leaderboard, free on every server.',
      metaTitle: 'Wody - Discord Leveling Bot | Free XP & Ranks',
      metaDescription: 'Free Discord leveling bot with XP-per-message, level-up messages, /rank cards and a server leaderboard. Invite Wody and reward active members.',
      ogTitle: 'Discord Leveling Bot, XP, Ranks and Leaderboards',
      ogDescription: 'XP-per-message with cooldown, level-up messages in a dedicated channel, /rank and /leaderboard.',
      intro: [
        'Recognizing your most active members keeps them engaged, and a visible leaderboard gives everyone else a reason to participate. Wody\'s levels module tracks XP per message with a cooldown to prevent spam farming, and announces level-ups wherever you want them seen.',
        'Members can check their own progress with /rank, and the whole server can compare standings with /leaderboard, no extra setup required beyond picking a level-up channel.',
      ],
      features: [
        'XP earned per message, with a cooldown so it can\'t be farmed by spamming',
        'Level-up announcements posted in a channel you choose',
        '/rank shows a member\'s current level and progress',
        '/leaderboard ranks the most active members server-wide',
        'Configurable XP curve to control how fast members level up',
      ],
      faq: [
        { q: 'How is XP earned?', a: 'Members earn XP for sending messages, with a short cooldown between XP-eligible messages so it can\'t be farmed by spamming.' },
        { q: 'Can I set a dedicated level-up channel?', a: 'Yes, pick a channel and Wody posts a level-up announcement there whenever a member ranks up, instead of cluttering general chat.' },
        { q: 'Is there a cooldown between messages?', a: 'Yes, a short cooldown applies between messages that award XP, so rapid-fire messages don\'t inflate a member\'s level artificially.' },
        { q: 'Can I reset a member\'s XP?', a: 'Staff can manage a member\'s XP and level directly from the dashboard.' },
      ],
    },
  },
  ro: {
    tickets: {
      heroTitle: 'Bot Discord Tickete, Sistem de Suport Gratuit pentru Serverul Tău',
      heroSubtitle: 'Lasă membrii să deschidă tickete de suport private dintr-un singur click. Panouri cu butoane, claim de staff și transcript automat, gratuit pe orice server.',
      metaTitle: 'Wody - Bot Discord Tickete | Suport Gratuit',
      metaDescription: 'Adaugă gratuit un bot de tickete pe Discord: panouri cu butoane, canale private, claim de staff și transcript automat. Invită Wody în câteva secunde.',
      ogTitle: 'Bot Discord Tickete, Suport Gratuit, Powered by Wody',
      ogDescription: 'Panouri cu butoane, canale private per utilizator, claim de staff și export automat de transcript, pornește sistemul tău de suport în câteva minute.',
      intro: [
        'Cererile de suport împrăștiate prin DM-uri și canale la întâmplare sunt greu de urmărit și ușor de pierdut. Modulul de tickete al lui Wody oferă fiecărui membru un canal privat, curat, pentru problema lui, și oferă staff-ului un sistem clar de rezolvare.',
        'Un panou de tickete poate fi pus în orice canal alegi. Membrii dau click pe un buton pentru a deschide un tichet, staff-ul îl poate revendica pentru a evita răspunsuri duplicate, iar după rezolvare canalul se închide cu un transcript complet salvat automat, nimic nu se pierde nici după ce canalul dispare.',
      ],
      features: [
        'Panouri cu buton, membrii nu au nevoie de nicio comandă pentru a deschide un tichet',
        'Canal privat per tichet, vizibil doar pentru membru și rolurile de staff',
        'Sistem de claim, ca un singur membru din staff să preia conversația',
        'Export automat de transcript la închiderea unui tichet',
        'Se poate închide cu un motiv, păstrat pentru evidența moderării',
      ],
      faq: [
        { q: 'Este gratuit botul de tickete Wody?', a: 'Da. Modulul de tickete, inclusiv panourile cu butoane, canalele private, claim-ul de staff și transcriptele, este disponibil gratuit pe orice server.' },
        { q: 'Pot personaliza panoul de tickete?', a: 'Poți seta canalul panoului, titlul, descrierea și textul butonului direct din dashboard, ca să se potrivească cu structura serverului tău.' },
        { q: 'Ce se întâmplă când se închide un tichet?', a: 'Canalul privat se închide și se generează automat un transcript al întregii conversații, deci păstrezi o evidență chiar dacă respectivul canal dispare.' },
        { q: 'Poate staff-ul evita să răspundă de două ori la același tichet?', a: 'Da, sistemul de claim permite unui membru din staff să preia proprietatea asupra unui tichet, ca restul echipei să știe că este deja gestionat.' },
      ],
    },
    automod: {
      heroTitle: 'Bot Discord Automod, Protecție Automată Împotriva Spam-ului și Raid-urilor',
      heroSubtitle: 'Automod pe mai multe niveluri filtrează spam, linkuri de invitație, mențiuni în masă și raid-uri în timp real, ca să nu moderezi manual toată ziua.',
      metaTitle: 'Wody - Bot Discord Automod | Anti Spam și Anti Raid',
      metaDescription: 'Bot Discord automod gratuit cu filtrare spam, blocare linkuri de invitație, detectare mențiuni în masă și protecție anti-raid. Configurează-l rapid cu Wody.',
      ogTitle: 'Bot Discord Automod, Protecție în Timp Real Anti-Spam și Anti-Raid',
      ogDescription: 'Protecție pe mai multe niveluri pentru spam, linkuri de invitație, mențiuni, raid-uri, scam-uri, cuvinte interzise, caps și mesaje duplicate, cu whitelist de roluri pentru staff.',
      intro: [
        'Moderarea manuală nu mai ține pasul odată ce un server crește peste un mic grup de membri activi, spam-ul, linkurile de scam și încercările de raid se întâmplă mai repede decât poate reacționa orice om. Automod-ul Wody rulează constant în fundal, prinzând ce altfel ar trebui depistat manual de un moderator.',
        'Fiecare nivel de protecție poate fi reglat independent, iar rolurile de staff pot fi trecute pe whitelist, ca mesajele propriei echipe să nu fie afectate niciodată de filtrele pe care le-a configurat.',
      ],
      features: [
        'Detectare spam și flood de mesaje',
        'Filtrare linkuri de invitație și linkuri de scam',
        'Detectare mențiuni în masă și raid-uri',
        'Filtrare cuvinte interzise și caps excesiv',
        'Detectare mesaje duplicate',
        'Whitelist de roluri, ca staff-ul să nu fie niciodată filtrat',
      ],
      faq: [
        { q: 'Ce detectează botul de automod?', a: 'Spam și flood de mesaje, linkuri de invitație, linkuri de scam, mențiuni în masă, raid-uri, cuvinte interzise, caps excesiv și mesaje duplicate, fiecare ca regulă independentă pe care o poți activa sau dezactiva.' },
        { q: 'Pot pune anumite roluri pe whitelist?', a: 'Da, orice rol pus pe whitelist este ignorat de toate regulile de automod, ca staff-ul și membrii de încredere să nu fie prinși accidental de filtre.' },
        { q: 'Automod ia acțiune automat?', a: 'Automod elimină sau blochează conținutul care încalcă regulile activate, fără să fie nevoie ca un moderator să fie online și să reacționeze în timp real.' },
        { q: 'Ajută în timpul unui raid?', a: 'Da, nivelul de detectare a raid-urilor este construit să prindă valuri bruște de intrări noi sau spam coordonat și să reacționeze imediat, înainte ca un moderator uman să apuce.' },
      ],
    },
    moderation: {
      heroTitle: 'Bot Discord Moderare, Comenzi Gratuite de Ban, Kick, Timeout și Warn',
      heroSubtitle: 'Un set complet de moderare, ban, kick, timeout, avertismente și un mod-log persistent, toate prin comenzi slash simple, gratuit.',
      metaTitle: 'Wody - Bot Discord Moderare | Ban, Kick și Timeout',
      metaDescription: 'Bot Discord de moderare gratuit cu /ban, /kick, /timeout, /warn, /purge, /lock și un mod-log complet cu istoric de avertismente. Invită Wody în câteva secunde.',
      ogTitle: 'Bot Discord Moderare, Set Complet de Moderare',
      ogDescription: 'Ban, kick, timeout, warn, purge, slowmode și lock, cu istoric de avertismente și un canal mod-log persistent, gratuit pe orice server.',
      intro: [
        'Orice server ajunge la un moment dat să gestioneze membri care încalcă regulile, iar pentru a face asta consecvent, întreaga echipă de staff are nevoie de aceleași unelte și aceeași evidență a ce s-a întâmplat. Modulul de moderare al lui Wody acoperă esențialul prin comenzi slash, cu totul logat automat.',
        'Avertismentele construiesc un istoric per membru, în loc să dispară imediat ce canalul se derulează, iar fiecare acțiune, ban-uri, kick-uri, timeout-uri, purge-uri, poate fi trimisă într-un canal dedicat de mod-log, ca nimic să nu se întâmple fără evidență.',
      ],
      features: [
        '/ban, /kick și /timeout cu motive',
        '/warn cu istoric de avertismente persistent per membru',
        '/purge pentru curățare rapidă de mesaje în masă',
        '/slowmode și /lock pentru canale aglomerate sau tensionate',
        'Canal mod-log opțional, care înregistrează automat fiecare acțiune',
      ],
      faq: [
        { q: 'Este gratuit botul de moderare?', a: 'Da. Ban, kick, timeout, warn, purge, slowmode, lock și mod-log-ul sunt toate disponibile gratuit pe orice server.' },
        { q: 'Păstrează un istoric de avertismente?', a: 'Da, fiecare /warn este salvat per membru, ca staff-ul să poată vedea întregul istoric de avertismente al unui membru înainte de a decide ce urmează.' },
        { q: 'Pot loga fiecare acțiune de moderare?', a: 'Da, setează un canal de mod-log și Wody postează automat un embed pentru fiecare ban, kick, timeout, warn și purge.' },
        { q: 'Ce permisiuni are nevoie botul?', a: 'Permisiunile standard de moderare Discord (Ban Members, Kick Members, Moderate Members, Manage Messages), în funcție de comenzile pe care intenționezi să le folosești.' },
      ],
    },
    reaction_roles: {
      heroTitle: 'Bot Discord Reaction Roles, Roluri Auto-Atribuibile',
      heroSubtitle: 'Lasă membrii să-și aleagă singuri rolurile, cu un click sau o reacție, patru moduri: normal, toggle, unique și verify.',
      metaTitle: 'Wody - Bot Discord Reaction Roles | Roluri Gratuite',
      metaDescription: 'Bot Discord gratuit de reaction roles, cu moduri normal, toggle, unique și verify. Lasă membrii să-și atribuie singuri roluri cu reacții sau butoane.',
      ogTitle: 'Bot Discord Reaction Roles, Roluri Auto-Atribuibile, 4 Moduri',
      ogDescription: 'Moduri normal, toggle, unique și verify pentru roluri auto-atribuibile, prin reacții sau butoane.',
      intro: [
        'Atribuirea manuală de roluri pentru pronume, jocuri sau notificări nu mai ține pasul peste un server mic. Modulul de reaction roles al lui Wody permite membrilor să-și acorde singuri roluri direct dintr-un mesaj, iar staff-ul alege exact cât de permisiv trebuie să fie.',
        'Patru moduri acoperă majoritatea situațiilor: normal permite membrilor să aleagă orice număr de roluri, toggle elimină un rol la al doilea click, unique limitează membrii la un singur rol din set, iar verify cere un rol deja deținut de membru înainte să poată revendica altul.',
      ],
      features: [
        'Mod normal, membrii pot avea orice combinație de roluri din meniu',
        'Mod toggle, al doilea click elimină rolul',
        'Mod unique, un singur rol din meniu la un moment dat',
        'Mod verify, necesită un rol existent înainte de a revendica unul nou',
        'Funcționează atât cu reacții, cât și cu butoane',
      ],
      faq: [
        { q: 'Care e diferența dintre modurile de reaction roles?', a: 'Normal permite mai multe roluri simultan, toggle elimină un rol la al doilea click, unique limitează membrii la un singur rol din meniu, iar verify cere mai întâi un rol necesar.' },
        { q: 'Membrii pot alege doar un singur rol?', a: 'Pentru asta există modul unique, setezi meniul pe unique și membrii pot avea un singur rol din acel grup la un moment dat.' },
        { q: 'Suportă atât butoane, cât și reacții?', a: 'Da, alegi dacă un anumit meniu de roluri folosește butoane Discord sau reacții emoji atunci când îl configurezi.' },
        { q: 'Există o limită la câte meniuri de roluri pot crea?', a: 'Poți configura oricâte meniuri de roluri prin reacții sau butoane are nevoie serverul tău.' },
      ],
    },
    levels: {
      heroTitle: 'Bot Discord Leveling, XP, Ranguri și Clasament',
      heroSubtitle: 'Recompensează membrii activi cu XP per mesaj, anunțuri de level-up și un clasament al serverului, gratuit pe orice server.',
      metaTitle: 'Wody - Bot Discord Leveling | XP, Rang și Clasament',
      metaDescription: 'Bot Discord de leveling gratuit, cu XP per mesaj, mesaje de level-up, carduri /rank și clasament de server. Invită Wody și recompensează membrii activi.',
      ogTitle: 'Bot Discord Leveling, XP, Ranguri și Clasament',
      ogDescription: 'XP per mesaj cu cooldown, mesaje de level-up într-un canal dedicat, /rank și /leaderboard.',
      intro: [
        'Recunoașterea celor mai activi membri îi ține implicați, iar un clasament vizibil dă tuturor celorlalți un motiv să participe. Modulul de leveling al lui Wody urmărește XP per mesaj cu un cooldown care previne farmarea prin spam, și anunță level-up-urile oriunde vrei să fie văzute.',
        'Membrii își pot verifica progresul cu /rank, iar tot serverul poate compara clasamentul cu /leaderboard, fără nicio configurare suplimentară în afară de alegerea unui canal de level-up.',
      ],
      features: [
        'XP câștigat per mesaj, cu un cooldown ca să nu poată fi farmat prin spam',
        'Anunțuri de level-up postate într-un canal ales de tine',
        '/rank arată nivelul curent și progresul unui membru',
        '/leaderboard clasează cei mai activi membri de pe server',
        'Curbă de XP configurabilă, pentru a controla cât de repede urcă membrii în nivel',
      ],
      faq: [
        { q: 'Cum se câștigă XP?', a: 'Membrii câștigă XP trimițând mesaje, cu un scurt cooldown între mesajele eligibile pentru XP, ca să nu poată fi farmat prin spam.' },
        { q: 'Pot seta un canal dedicat de level-up?', a: 'Da, alegi un canal și Wody postează acolo un anunț de level-up ori de câte ori un membru urcă în nivel, în loc să aglomereze chat-ul general.' },
        { q: 'Există un cooldown între mesaje?', a: 'Da, se aplică un cooldown scurt între mesajele care acordă XP, ca mesajele trimise rapid, unul după altul, să nu umfle artificial nivelul unui membru.' },
        { q: 'Pot reseta XP-ul unui membru?', a: 'Staff-ul poate gestiona direct din dashboard XP-ul și nivelul unui membru.' },
      ],
    },
  },
};

const LOCALIZED_MODULE_SEO = {
  "de": {
    "tickets": [
      "Discord-Ticket-Bot, kostenloses Support-System",
      "Private Tickets per Klick, Team-Übernahme und automatische Transkripte.",
      "Kostenloser Discord-Ticket-Bot mit privaten Kanälen, Übernahme und Transkripten."
    ],
    "automod": [
      "Discord-Automod-Bot, Spam- und Raid-Schutz",
      "Filtert Spam, Links, Massen-Erwähnungen und Raids automatisch.",
      "Kostenloser Discord-Automod mit Spam-, Link-, Erwähnungs- und Raid-Schutz."
    ],
    "moderation": [
      "Discord-Moderations-Bot, Ban, Kick und Timeout",
      "Moderationstools und dauerhaftes Mod-Log für dein Team.",
      "Kostenloser Discord-Moderations-Bot mit Ban, Kick, Timeout, Warnungen und Mod-Log."
    ],
    "reaction_roles": [
      "Discord-Reaktionsrollen-Bot, selbst wählbare Rollen",
      "Mit Buttons oder Reaktionen wählen Mitglieder ihre Rollen selbst.",
      "Kostenloser Discord-Bot für selbst wählbare Rollen und flexible Auswahlmodi."
    ],
    "levels": [
      "Discord-Level-Bot, XP, Ränge und Bestenlisten",
      "Belohne aktive Mitglieder mit XP, Rängen und einer Bestenliste.",
      "Kostenloser Discord-Level-Bot mit XP, Rängen und Server-Bestenliste."
    ]
  },
  "tr": {
    "tickets": [
      "Discord Ticket Botu, Ücretsiz Destek Sistemi",
      "Tek tıklamayla özel ticket, ekip devralma ve otomatik kayıtlar.",
      "Özel kanallar, ekip devralma ve kayıtlarla ücretsiz Discord ticket botu."
    ],
    "automod": [
      "Discord Automod Botu, Spam ve Raid Koruması",
      "Spam, bağlantı, toplu etiketleme ve raid girişimlerini otomatik filtreleyin.",
      "Spam, bağlantı, etiketleme ve raid korumalı ücretsiz Discord automod botu."
    ],
    "moderation": [
      "Discord Moderasyon Botu, Ban, Kick ve Timeout",
      "Temel moderasyon araçları ve kalıcı mod-log tek bir yerde.",
      "Ban, kick, timeout, uyarı ve mod-log içeren ücretsiz Discord moderasyon botu."
    ],
    "reaction_roles": [
      "Discord Reaction Roles Botu, Kendi Rolünü Seç",
      "Üyeler buton veya tepkiyle kendi rollerini kolayca seçebilir.",
      "Kendi kendine rol seçimi için ücretsiz ve esnek Discord reaction roles botu."
    ],
    "levels": [
      "Discord Level Botu, XP, Rank ve Liderlik",
      "Aktif üyeleri XP, rank kartları ve liderlik tablosuyla ödüllendirin.",
      "XP, rank ve liderlik tablosuna sahip ücretsiz Discord level botu."
    ]
  },
  "it": {
    "tickets": [
      "Bot ticket Discord, supporto gratuito",
      "Ticket privati, presa in carico dello staff e trascrizioni automatiche.",
      "Bot ticket Discord gratuito con canali privati, presa in carico e trascrizioni."
    ],
    "automod": [
      "Bot Automod Discord, protezione da spam e raid",
      "Blocca automaticamente spam, link, menzioni di massa e raid.",
      "Bot Automod Discord gratuito con protezione da spam, link, menzioni e raid."
    ],
    "moderation": [
      "Bot moderazione Discord, ban, kick e timeout",
      "Strumenti di moderazione essenziali e mod-log permanente.",
      "Bot moderazione Discord gratuito con ban, kick, timeout, avvisi e mod-log."
    ],
    "reaction_roles": [
      "Bot ruoli Discord, ruoli autoassegnabili",
      "I membri scelgono i propri ruoli con reazioni o pulsanti.",
      "Bot Discord gratuito per ruoli autoassegnabili e modalità di selezione flessibili."
    ],
    "levels": [
      "Bot livelli Discord, XP, ranghi e classifiche",
      "Premia i membri attivi con XP, ranghi e classifiche del server.",
      "Bot livelli Discord gratuito con XP, ranghi e classifiche."
    ]
  },
  "fr": {
    "tickets": [
      "Bot ticket Discord, support gratuit",
      "Tickets privés, prise en charge par le staff et transcriptions automatiques.",
      "Bot ticket Discord gratuit avec salons privés, prise en charge et transcriptions."
    ],
    "automod": [
      "Bot Automod Discord, protection spam et raids",
      "Filtre automatiquement le spam, les liens, les mentions massives et les raids.",
      "Bot Automod Discord gratuit avec protection contre le spam, les liens et les raids."
    ],
    "moderation": [
      "Bot de modération Discord, ban, kick et timeout",
      "Outils de modération essentiels et journal permanent pour votre équipe.",
      "Bot de modération Discord gratuit avec ban, kick, timeout, avertissements et mod-log."
    ],
    "reaction_roles": [
      "Bot rôles Discord, rôles auto-attribuables",
      "Les membres choisissent leurs rôles avec une réaction ou un bouton.",
      "Bot Discord gratuit pour rôles auto-attribuables et modes de sélection flexibles."
    ],
    "levels": [
      "Bot de niveaux Discord, XP, rangs et classements",
      "Récompensez les membres actifs avec XP, rangs et classement du serveur.",
      "Bot de niveaux Discord gratuit avec XP, rangs et classement."
    ]
  },
  "es": {
    "tickets": [
      "Bot de tickets de Discord, soporte gratuito",
      "Tickets privados, asignación al staff y transcripciones automáticas.",
      "Bot de tickets de Discord gratuito con canales privados, asignación y transcripciones."
    ],
    "automod": [
      "Bot Automod de Discord, protección contra spam y raids",
      "Filtra automáticamente spam, enlaces, menciones masivas y raids.",
      "Bot Automod de Discord gratuito con protección contra spam, enlaces y raids."
    ],
    "moderation": [
      "Bot de moderación de Discord, ban, kick y timeout",
      "Herramientas esenciales de moderación y mod-log permanente.",
      "Bot de moderación Discord gratuito con ban, kick, timeout, avisos y mod-log."
    ],
    "reaction_roles": [
      "Bot de roles de Discord, roles autoasignables",
      "Los miembros eligen sus propios roles con una reacción o botón.",
      "Bot gratuito de Discord para roles autoasignables y modos de selección flexibles."
    ],
    "levels": [
      "Bot de niveles de Discord, XP, rangos y clasificaciones",
      "Premia a miembros activos con XP, rangos y clasificaciones.",
      "Bot de niveles Discord gratuito con XP, rangos y clasificaciones."
    ]
  },
  "nl": {
    "tickets": [
      "Discord-ticketbot, gratis supportsysteem",
      "Privétickets met één klik, teamclaiming en automatische transcripties.",
      "Gratis Discord-ticketbot met privékanalen, claiming en transcripties."
    ],
    "automod": [
      "Discord-Automod-bot, spam- en raidbescherming",
      "Filter spam, links, massale vermeldingen en raids automatisch.",
      "Gratis Discord-Automod met bescherming tegen spam, links, vermeldingen en raids."
    ],
    "moderation": [
      "Discord-moderatiebot, ban, kick en timeout",
      "Essentiële moderatietools en een permanent mod-log voor je team.",
      "Gratis Discord-moderatiebot met ban, kick, timeout, waarschuwingen en mod-log."
    ],
    "reaction_roles": [
      "Discord-rollenbot, zelf kiesbare rollen",
      "Leden kiezen hun eigen rollen met een reactie of knop.",
      "Gratis Discord-bot voor zelf kiesbare rollen en flexibele selectiemodi."
    ],
    "levels": [
      "Discord-levelbot, XP, rangen en ranglijsten",
      "Beloon actieve leden met XP, rangen en een serverranglijst.",
      "Gratis Discord-levelbot met XP, rangen en ranglijsten."
    ]
  },
  "pt": {
    "tickets": [
      "Bot de tickets do Discord, suporte gratuito",
      "Tickets privados com um clique, atribuição à equipa e transcrições automáticas.",
      "Bot de tickets do Discord gratuito com canais privados, atribuição e transcrições."
    ],
    "automod": [
      "Bot Automod do Discord, proteção contra spam e raids",
      "Filtre spam, links, menções em massa e raids automaticamente.",
      "Bot Automod Discord gratuito com proteção contra spam, links, menções e raids."
    ],
    "moderation": [
      "Bot de moderação do Discord, ban, kick e timeout",
      "Ferramentas essenciais de moderação e mod-log permanente.",
      "Bot de moderação Discord gratuito com ban, kick, timeout, avisos e mod-log."
    ],
    "reaction_roles": [
      "Bot de cargos Discord, cargos autoatribuíveis",
      "Os membros escolhem os próprios cargos com uma reação ou botão.",
      "Bot Discord gratuito para cargos autoatribuíveis e modos de seleção flexíveis."
    ],
    "levels": [
      "Bot de níveis do Discord, XP, ranks e classificações",
      "Recompense membros ativos com XP, ranks e classificações.",
      "Bot de níveis Discord gratuito com XP, ranks e classificações."
    ]
  }
};
const LOCALIZED_MODULE_CONTENT = {
  "de": {
    "tickets": {
      "intro": [
        "Supportanfragen in privaten Nachrichten gehen schnell verloren. Mit Tickets erhält jedes Anliegen einen eigenen privaten Kanal, in dem Mitglied und Team in Ruhe schreiben können.",
        "Erstelle ein Ticket-Panel im gewünschten Kanal. Das Team kann Tickets übernehmen, schließen und den Gesprächsverlauf als Transkript behalten."
      ],
      "features": [
        "Ticket-Panel mit einem Klick zum Öffnen",
        "Private Kanäle für Mitglied und berechtigte Teamrollen",
        "Übernahme eines Tickets durch ein Teammitglied",
        "Automatische Transkripte beim Schließen"
      ],
      "faq": [
        [
          "Ist das Ticket-System kostenlos?",
          "Ja, das Ticket-Modul von Wody kann kostenlos auf deinem Server verwendet werden."
        ],
        [
          "Kann ich das Ticket-Panel anpassen?",
          "Ja, Kanal, Text und verfügbare Optionen lassen sich im Dashboard anpassen."
        ],
        [
          "Was passiert beim Schließen eines Tickets?",
          "Das Ticket wird geschlossen und der Gesprächsverlauf kann als Transkript gespeichert werden."
        ],
        [
          "Können mehrere Teammitglieder dasselbe Ticket bearbeiten?",
          "Ja. Mit der Übernahmefunktion sieht das Team, wer das Ticket gerade betreut."
        ]
      ]
    },
    "automod": {
      "intro": [
        "Spam und Raid-Versuche passieren oft schneller, als ein Moderator reagieren kann. Automod prüft Nachrichten automatisch und kann problematische Inhalte sofort abfangen.",
        "Die einzelnen Schutzregeln lassen sich passend zu deinem Server konfigurieren. Vertrauenswürdige Rollen können von den Filtern ausgenommen werden."
      ],
      "features": [
        "Erkennung von Spam und Nachrichtenfluten",
        "Filter für Einladungslinks und verdächtige Links",
        "Schutz vor Massen-Erwähnungen und Raids",
        "Filter für doppelte Nachrichten, Caps und unerwünschte Wörter"
      ],
      "faq": [
        [
          "Was erkennt Automod?",
          "Automod kann unter anderem Spam, Links, Massen-Erwähnungen, doppelte Nachrichten und Raid-Aktivität erkennen."
        ],
        [
          "Kann ich Teamrollen ausnehmen?",
          "Ja, vertrauenswürdige Rollen können von den Automod-Regeln ausgeschlossen werden."
        ],
        [
          "Reagiert Automod automatisch?",
          "Ja, aktivierte Regeln greifen ohne dass ein Moderator online sein muss."
        ],
        [
          "Kann ich einzelne Schutzregeln abschalten?",
          "Ja, die verfügbaren Regeln können einzeln an deinen Server angepasst werden."
        ]
      ]
    },
    "moderation": {
      "intro": [
        "Ein gutes Moderationssystem braucht klare Werkzeuge und eine nachvollziehbare Historie. Wody bündelt wichtige Maßnahmen in einfachen Discord-Befehlen.",
        "Bans, Kicks, Timeouts und Warnungen können protokolliert werden, damit das Team auch später nachvollziehen kann, was passiert ist."
      ],
      "features": [
        "Ban, Kick und Timeout mit nachvollziehbaren Gründen",
        "Warnungen mit Verlauf pro Mitglied",
        "Schnelles Löschen vieler Nachrichten mit Purge",
        "Mod-Log für wichtige Moderationsaktionen"
      ],
      "faq": [
        [
          "Welche Moderationsaktionen unterstützt Wody?",
          "Je nach Konfiguration stehen unter anderem Ban, Kick, Timeout, Warnungen und Nachrichtenbereinigung zur Verfügung."
        ],
        [
          "Werden Maßnahmen protokolliert?",
          "Ja, wichtige Aktionen können in einem eigenen Mod-Log festgehalten werden."
        ],
        [
          "Bleiben Warnungen erhalten?",
          "Warnungen können im Verlauf eines Mitglieds gespeichert werden, damit sie nicht im Chat verloren gehen."
        ],
        [
          "Kann ich mehrere Nachrichten auf einmal löschen?",
          "Ja, mit der Purge-Funktion lassen sich Nachrichten gesammelt entfernen."
        ]
      ]
    },
    "reaction_roles": {
      "intro": [
        "Lass Mitglieder ihre Interessen, Benachrichtigungen oder Regionen selbst auswählen. Reaction Roles spart dem Team manuelle Rollenzuweisungen.",
        "Du kannst Rollen über Reaktionen oder Buttons anbieten und die Auswahl passend zur Struktur deines Servers gestalten."
      ],
      "features": [
        "Rollen per Button oder Reaktion auswählbar",
        "Mehrere Auswahlmodi für unterschiedliche Regeln",
        "Einfaches Entfernen einer selbst gewählten Rolle",
        "Geeignet für Interessen, Regionen und Benachrichtigungen"
      ],
      "faq": [
        [
          "Können Mitglieder Rollen selbst auswählen?",
          "Ja, Mitglieder können die von dir angebotenen Rollen selbst über Buttons oder Reaktionen auswählen."
        ],
        [
          "Kann eine Rolle wieder entfernt werden?",
          "Ja, je nach Auswahlmodus kann ein erneuter Klick die Rolle wieder entfernen."
        ],
        [
          "Wofür eignen sich Reaction Roles?",
          "Sie eignen sich zum Beispiel für Spiele, Regionen, Interessen oder opt-in Benachrichtigungen."
        ],
        [
          "Muss das Team Rollen manuell vergeben?",
          "Nein, die Zuweisung erfolgt automatisch über die von dir eingerichtete Auswahl."
        ]
      ]
    },
    "levels": {
      "intro": [
        "Aktive Mitglieder können XP sammeln und im Server aufsteigen. Das schafft einen sichtbaren Fortschritt, ohne dass dein Team jeden Wert manuell pflegen muss.",
        "Wody kann Level-Fortschritt und Ranglisten darstellen, sodass Mitglieder sehen, wie aktiv sie im Vergleich zur Community sind."
      ],
      "features": [
        "XP und Level für aktive Mitglieder",
        "Level-Up Nachrichten für neue Stufen",
        "Server-Rangliste für aktiven Wettbewerb",
        "Übersichtlicher Fortschritt für Mitglieder"
      ],
      "faq": [
        [
          "Wie sammeln Mitglieder XP?",
          "Aktive Teilnahme auf dem Server kann XP und Fortschritt im Level-System erzeugen."
        ],
        [
          "Gibt es eine Rangliste?",
          "Ja, das Level-System kann aktive Mitglieder in einer Server-Rangliste anzeigen."
        ],
        [
          "Kann ich Level-Up Nachrichten nutzen?",
          "Ja, Wody kann eine Nachricht senden, wenn ein Mitglied eine neue Stufe erreicht."
        ],
        [
          "Ist das Level-Modul kostenlos?",
          "Ja, das Level-System ist als Teil von Wody kostenlos verfügbar."
        ]
      ]
    }
  },
  "tr": {
    "tickets": {
      "intro": [
        "Destek istekleri özel mesajlarda kaybolabilir. Ticket sistemi her talep için üye ve yetkili ekip arasında ayrı bir özel kanal oluşturur.",
        "İstediğiniz kanala bir ticket paneli yerleştirin. Ekip ticketı üstlenebilir, kapatabilir ve konuşma kaydını saklayabilir."
      ],
      "features": [
        "Tek tıklamayla ticket açma paneli",
        "Üye ve yetkili roller için özel kanallar",
        "Bir yetkilinin ticketı üstlenmesi",
        "Ticket kapanınca otomatik konuşma kaydı"
      ],
      "faq": [
        [
          "Ticket sistemi ücretsiz mi?",
          "Evet, Wody ticket modülü sunucunuzda ücretsiz kullanılabilir."
        ],
        [
          "Ticket panelini özelleştirebilir miyim?",
          "Evet, kanal ve metin gibi seçenekleri panelden ayarlayabilirsiniz."
        ],
        [
          "Ticket kapanınca ne olur?",
          "Ticket kapatılır ve konuşma kaydı saklanabilir."
        ],
        [
          "Birden fazla yetkili aynı ticketı görebilir mi?",
          "Evet. Üstlenme sistemi, ekibin ticketla kimin ilgilendiğini görmesini sağlar."
        ]
      ]
    },
    "automod": {
      "intro": [
        "Spam ve raid girişimleri çoğu zaman moderatör tepki veremeden gerçekleşir. Automod mesajları otomatik kontrol ederek sorunlu içeriği anında yakalamaya yardımcı olur.",
        "Koruma kurallarını sunucunuza göre ayrı ayrı ayarlayabilir ve güvenilir rolleri filtrelerden hariç tutabilirsiniz."
      ],
      "features": [
        "Spam ve mesaj seli tespiti",
        "Davet ve şüpheli bağlantı filtreleri",
        "Toplu etiketleme ve raid koruması",
        "Tekrarlanan mesaj, büyük harf ve kelime filtreleri"
      ],
      "faq": [
        [
          "Automod neleri tespit eder?",
          "Spam, bağlantılar, toplu etiketleme, tekrar eden mesajlar ve raid davranışları gibi içerikleri tespit edebilir."
        ],
        [
          "Yetkili rollerini hariç tutabilir miyim?",
          "Evet, güvenilir rolleri automod kurallarından hariç tutabilirsiniz."
        ],
        [
          "Automod otomatik işlem yapar mı?",
          "Evet, etkin kurallar bir moderatör çevrimiçi olmasa da çalışır."
        ],
        [
          "Kuralları tek tek kapatabilir miyim?",
          "Evet, kullanılabilir koruma kurallarını ayrı ayrı yapılandırabilirsiniz."
        ]
      ]
    },
    "moderation": {
      "intro": [
        "Tutarlı moderasyon için doğru araçlara ve kayıtlı bir geçmişe ihtiyaç vardır. Wody önemli işlemleri kolay Discord komutlarında bir araya getirir.",
        "Ban, kick, timeout ve uyarılar kaydedilebilir. Böylece ekip daha sonra yapılan işlemleri kontrol edebilir."
      ],
      "features": [
        "Ban, kick ve timeout işlemleri",
        "Üye bazında uyarı geçmişi",
        "Purge ile toplu mesaj temizliği",
        "Önemli işlemler için mod-log kaydı"
      ],
      "faq": [
        [
          "Wody hangi moderasyon işlemlerini destekler?",
          "Yapılandırmaya göre ban, kick, timeout, uyarı ve mesaj temizleme gibi işlemler kullanılabilir."
        ],
        [
          "İşlemler kaydedilir mi?",
          "Evet, önemli moderasyon işlemleri ayrı bir mod-log kanalına gönderilebilir."
        ],
        [
          "Uyarılar saklanır mı?",
          "Uyarılar üye geçmişinde tutulabilir, böylece sohbet içinde kaybolmaz."
        ],
        [
          "Birçok mesajı aynı anda silebilir miyim?",
          "Evet, Purge özelliğiyle mesajları toplu olarak temizleyebilirsiniz."
        ]
      ]
    },
    "reaction_roles": {
      "intro": [
        "Üyelerin ilgi alanlarını, bildirimlerini veya bölgelerini kendilerinin seçmesini sağlayın. Reaction Roles, ekibin manuel rol vermesini azaltır.",
        "Rolleri buton veya tepkiyle sunabilir ve seçim davranışını sunucunuzun yapısına göre ayarlayabilirsiniz."
      ],
      "features": [
        "Buton veya tepkiyle rol seçimi",
        "Farklı kullanım için esnek seçim modları",
        "Seçilen rolü kolayca kaldırma",
        "İlgi alanları ve bildirimler için uygun"
      ],
      "faq": [
        [
          "Üyeler rolleri kendileri seçebilir mi?",
          "Evet, sunduğunuz rolleri buton veya tepkilerle seçebilirler."
        ],
        [
          "Bir rol tekrar kaldırılabilir mi?",
          "Evet, seçtiğiniz moda göre ikinci etkileşim rolü kaldırabilir."
        ],
        [
          "Reaction Roles ne için kullanılabilir?",
          "Oyunlar, bölgeler, ilgi alanları ve isteğe bağlı bildirimler için kullanılabilir."
        ],
        [
          "Ekibin rolleri manuel vermesi gerekir mi?",
          "Hayır, atama oluşturduğunuz seçim üzerinden otomatik yapılır."
        ]
      ]
    },
    "levels": {
      "intro": [
        "Aktif üyeler XP kazanabilir ve seviye atlayabilir. Böylece ilerleme görünür olur ve ekibin değerleri manuel takip etmesi gerekmez.",
        "Wody seviye ilerlemesini ve sıralamaları gösterebilir. Üyeler topluluk içindeki etkinliklerini görebilir."
      ],
      "features": [
        "Aktif üyeler için XP ve seviye sistemi",
        "Yeni seviyeler için level-up mesajları",
        "Sunucu içi liderlik tablosu",
        "Üyeler için görünür ilerleme"
      ],
      "faq": [
        [
          "Üyeler XP nasıl kazanır?",
          "Sunucudaki aktif katılım XP ve seviye ilerlemesi sağlayabilir."
        ],
        [
          "Liderlik tablosu var mı?",
          "Evet, aktif üyeleri sunucu sıralamasında gösterebilirsiniz."
        ],
        [
          "Level-up mesajı gönderebilir miyim?",
          "Evet, üye yeni seviyeye ulaştığında Wody mesaj gönderebilir."
        ],
        [
          "Level modülü ücretsiz mi?",
          "Evet, level sistemi Wody'nin ücretsiz özellikleri arasında yer alır."
        ]
      ]
    }
  },
  "it": {
    "tickets": {
      "intro": [
        "Le richieste di supporto nei messaggi privati si perdono facilmente. Con i ticket, ogni richiesta ha un canale privato dedicato.",
        "Crea il pannello nel canale che preferisci. Lo staff può prendere in carico il ticket, chiuderlo e conservare la conversazione."
      ],
      "features": [
        "Pannello per aprire un ticket con un clic",
        "Canali privati per membro e staff",
        "Presa in carico da parte dello staff",
        "Trascrizioni automatiche alla chiusura"
      ],
      "faq": [
        {
          "q": "Il sistema ticket è gratuito?",
          "a": "Sì, il modulo ticket di Wody è disponibile gratuitamente."
        },
        {
          "q": "Posso personalizzare il pannello?",
          "a": "Sì, puoi configurare canale, testo e opzioni dal dashboard."
        },
        {
          "q": "Cosa succede quando chiudo un ticket?",
          "a": "Il ticket viene chiuso e la conversazione può essere conservata come trascrizione."
        },
        {
          "q": "Più membri dello staff possono gestire lo stesso ticket?",
          "a": "Sì. La presa in carico mostra chiaramente chi sta seguendo la richiesta."
        }
      ]
    },
    "automod": {
      "intro": [
        "Spam e raid possono arrivare prima che un moderatore riesca a intervenire. Automod controlla i messaggi automaticamente e blocca ciò che hai scelto di filtrare.",
        "Puoi configurare ogni protezione separatamente e escludere i ruoli fidati dai filtri."
      ],
      "features": [
        "Rilevamento di spam e raffiche di messaggi",
        "Filtri per inviti e link sospetti",
        "Protezione da menzioni di massa e raid",
        "Controllo di duplicati, maiuscole e parole indesiderate"
      ],
      "faq": [
        {
          "q": "Cosa rileva Automod?",
          "a": "Può rilevare spam, link, menzioni di massa, messaggi duplicati e attività legate ai raid."
        },
        {
          "q": "Posso escludere i ruoli dello staff?",
          "a": "Sì, i ruoli fidati possono essere esclusi dalle regole Automod."
        },
        {
          "q": "Automod agisce da solo?",
          "a": "Sì, le regole attive funzionano anche quando nessun moderatore è online."
        },
        {
          "q": "Posso disattivare singole regole?",
          "a": "Sì, puoi configurare ogni protezione separatamente."
        }
      ]
    },
    "moderation": {
      "intro": [
        "Una moderazione coerente richiede strumenti chiari e uno storico consultabile. Wody raccoglie le azioni principali in semplici comandi Discord.",
        "Ban, kick, timeout e avvisi possono essere registrati per aiutare lo staff a ricostruire ciò che è successo."
      ],
      "features": [
        "Ban, kick e timeout con motivazione",
        "Cronologia degli avvisi per ogni membro",
        "Pulizia rapida dei messaggi con purge",
        "Mod-log per le azioni importanti"
      ],
      "faq": [
        {
          "q": "Quali azioni supporta Wody?",
          "a": "In base alla configurazione puoi usare ban, kick, timeout, avvisi e pulizia dei messaggi."
        },
        {
          "q": "Le azioni vengono registrate?",
          "a": "Sì, le azioni importanti possono essere inviate a un canale mod-log."
        },
        {
          "q": "Gli avvisi restano salvati?",
          "a": "Possono essere mantenuti nella cronologia del membro."
        },
        {
          "q": "Posso eliminare molti messaggi insieme?",
          "a": "Sì, la funzione purge permette una pulizia in blocco."
        }
      ]
    },
    "reaction_roles": {
      "intro": [
        "Permetti ai membri di scegliere da soli interessi, notifiche o regioni. Reaction Roles riduce il lavoro manuale dello staff.",
        "Puoi offrire i ruoli con pulsanti o reazioni e adattare la selezione alla struttura del server."
      ],
      "features": [
        "Scelta dei ruoli con pulsanti o reazioni",
        "Modalità di selezione flessibili",
        "Rimozione semplice di un ruolo scelto",
        "Ideale per interessi e notifiche"
      ],
      "faq": [
        {
          "q": "I membri possono scegliere i ruoli da soli?",
          "a": "Sì, possono selezionare i ruoli che hai reso disponibili."
        },
        {
          "q": "Possono rimuovere un ruolo?",
          "a": "Sì, in base alla modalità una nuova interazione può rimuoverlo."
        },
        {
          "q": "A cosa serve Reaction Roles?",
          "a": "È utile per interessi, giochi, regioni e notifiche opzionali."
        },
        {
          "q": "Lo staff deve assegnare i ruoli manualmente?",
          "a": "No, l'assegnazione avviene automaticamente tramite la selezione configurata."
        }
      ]
    },
    "levels": {
      "intro": [
        "I membri attivi possono guadagnare XP e salire di livello. Il progresso resta visibile senza dover aggiornare tutto manualmente.",
        "Wody può mostrare livelli e classifiche, così i membri vedono la propria attività nella community."
      ],
      "features": [
        "Sistema XP e livelli per i membri attivi",
        "Messaggi quando viene raggiunto un nuovo livello",
        "Classifica del server",
        "Progresso chiaro per ogni membro"
      ],
      "faq": [
        {
          "q": "Come si guadagna XP?",
          "a": "La partecipazione attiva sul server può contribuire ai progressi nel sistema XP."
        },
        {
          "q": "C'è una classifica?",
          "a": "Sì, puoi mostrare i membri più attivi in una classifica del server."
        },
        {
          "q": "Posso inviare messaggi di level up?",
          "a": "Sì, Wody può inviare un messaggio quando viene raggiunto un nuovo livello."
        },
        {
          "q": "Il modulo livelli è gratuito?",
          "a": "Sì, il sistema livelli è disponibile gratuitamente in Wody."
        }
      ]
    }
  },
  "fr": {
    "tickets": {
      "intro": [
        "Les demandes de support se perdent facilement dans les messages privés. Avec les tickets, chaque demande dispose de son propre salon privé.",
        "Placez un panneau dans le salon de votre choix. Le staff peut prendre un ticket, le fermer et conserver la conversation."
      ],
      "features": [
        "Ouverture d'un ticket en un clic",
        "Salons privés pour le membre et le staff",
        "Prise en charge par un membre du staff",
        "Transcriptions automatiques à la fermeture"
      ],
      "faq": [
        {
          "q": "Le système de tickets est-il gratuit ?",
          "a": "Oui, le module tickets de Wody est disponible gratuitement."
        },
        {
          "q": "Puis-je personnaliser le panneau ?",
          "a": "Oui, vous pouvez régler le salon, le texte et les options depuis le tableau de bord."
        },
        {
          "q": "Que se passe-t-il à la fermeture ?",
          "a": "Le ticket est fermé et la conversation peut être conservée sous forme de transcription."
        },
        {
          "q": "Plusieurs membres du staff peuvent-ils suivre un ticket ?",
          "a": "Oui. La prise en charge indique clairement qui s'occupe de la demande."
        }
      ]
    },
    "automod": {
      "intro": [
        "Le spam et les raids peuvent arriver avant qu'un modérateur ait le temps de réagir. Automod vérifie automatiquement les messages et applique vos règles.",
        "Chaque protection peut être réglée séparément et les rôles de confiance peuvent être exclus des filtres."
      ],
      "features": [
        "Détection du spam et des rafales de messages",
        "Filtres pour invitations et liens suspects",
        "Protection contre les mentions massives et les raids",
        "Filtre des doublons, majuscules et mots indésirables"
      ],
      "faq": [
        {
          "q": "Que détecte Automod ?",
          "a": "Il peut détecter le spam, les liens, les mentions massives, les doublons et les activités liées aux raids."
        },
        {
          "q": "Puis-je exclure les rôles du staff ?",
          "a": "Oui, les rôles de confiance peuvent être exclus des règles Automod."
        },
        {
          "q": "Automod agit-il automatiquement ?",
          "a": "Oui, les règles actives fonctionnent même lorsqu'aucun modérateur n'est en ligne."
        },
        {
          "q": "Puis-je désactiver une règle précise ?",
          "a": "Oui, chaque protection peut être configurée séparément."
        }
      ]
    },
    "moderation": {
      "intro": [
        "Une modération cohérente demande des outils clairs et un historique fiable. Wody réunit les actions essentielles dans des commandes Discord simples.",
        "Les bans, kicks, timeouts et avertissements peuvent être enregistrés pour que le staff puisse retrouver ce qui s'est passé."
      ],
      "features": [
        "Ban, kick et timeout avec motif",
        "Historique des avertissements par membre",
        "Suppression groupée avec purge",
        "Mod-log pour les actions importantes"
      ],
      "faq": [
        {
          "q": "Quelles actions sont disponibles ?",
          "a": "Selon votre configuration, vous pouvez utiliser ban, kick, timeout, avertissements et nettoyage de messages."
        },
        {
          "q": "Les actions sont-elles enregistrées ?",
          "a": "Oui, les actions importantes peuvent être envoyées dans un salon mod-log."
        },
        {
          "q": "Les avertissements sont-ils conservés ?",
          "a": "Ils peuvent rester dans l'historique du membre."
        },
        {
          "q": "Puis-je supprimer plusieurs messages ?",
          "a": "Oui, la fonction purge permet un nettoyage groupé."
        }
      ]
    },
    "reaction_roles": {
      "intro": [
        "Laissez les membres choisir eux-mêmes leurs centres d'intérêt, notifications ou régions. Reaction Roles réduit les attributions manuelles.",
        "Vous pouvez proposer les rôles avec des boutons ou des réactions et adapter le choix à votre serveur."
      ],
      "features": [
        "Choix des rôles avec boutons ou réactions",
        "Modes de sélection flexibles",
        "Retrait simple d'un rôle choisi",
        "Adapté aux intérêts et notifications"
      ],
      "faq": [
        {
          "q": "Les membres peuvent-ils choisir leurs rôles ?",
          "a": "Oui, ils peuvent sélectionner les rôles que vous proposez."
        },
        {
          "q": "Peuvent-ils retirer un rôle ?",
          "a": "Oui, selon le mode, une nouvelle interaction peut retirer le rôle."
        },
        {
          "q": "À quoi sert Reaction Roles ?",
          "a": "Il convient aux intérêts, jeux, régions et notifications facultatives."
        },
        {
          "q": "Le staff doit-il attribuer les rôles ?",
          "a": "Non, l'attribution se fait automatiquement avec la sélection configurée."
        }
      ]
    },
    "levels": {
      "intro": [
        "Les membres actifs peuvent gagner de l'XP et monter de niveau. La progression reste visible sans gestion manuelle.",
        "Wody peut afficher les niveaux et le classement pour montrer l'activité de chacun dans la communauté."
      ],
      "features": [
        "XP et niveaux pour les membres actifs",
        "Messages lors d'un passage de niveau",
        "Classement du serveur",
        "Progression visible pour chaque membre"
      ],
      "faq": [
        {
          "q": "Comment les membres gagnent-ils de l'XP ?",
          "a": "La participation active sur le serveur peut faire progresser les membres dans le système XP."
        },
        {
          "q": "Existe-t-il un classement ?",
          "a": "Oui, vous pouvez afficher les membres les plus actifs dans le classement du serveur."
        },
        {
          "q": "Puis-je envoyer un message de passage de niveau ?",
          "a": "Oui, Wody peut publier un message lorsqu'un membre atteint un nouveau niveau."
        },
        {
          "q": "Le module niveaux est-il gratuit ?",
          "a": "Oui, le système de niveaux est disponible gratuitement avec Wody."
        }
      ]
    }
  },
  "es": {
    "tickets": {
      "intro": [
        "Las solicitudes de soporte se pierden fácilmente entre mensajes privados. Con los tickets, cada consulta tiene su propio canal privado.",
        "Coloca un panel en el canal que prefieras. El equipo puede hacerse cargo del ticket, cerrarlo y conservar la conversación."
      ],
      "features": [
        "Panel para abrir tickets con un clic",
        "Canales privados para el miembro y el equipo",
        "Asignación clara a un miembro del staff",
        "Transcripciones automáticas al cerrar"
      ],
      "faq": [
        {
          "q": "¿El sistema de tickets es gratuito?",
          "a": "Sí, el módulo de tickets de Wody está disponible gratis."
        },
        {
          "q": "¿Puedo personalizar el panel?",
          "a": "Sí, puedes ajustar el canal, el texto y las opciones desde el panel."
        },
        {
          "q": "¿Qué ocurre al cerrar un ticket?",
          "a": "El ticket se cierra y la conversación puede conservarse como transcripción."
        },
        {
          "q": "¿Puede trabajar más de una persona en un ticket?",
          "a": "Sí. La asignación deja claro quién está atendiendo la solicitud."
        }
      ]
    },
    "automod": {
      "intro": [
        "El spam y los raids pueden aparecer antes de que un moderador tenga tiempo de reaccionar. Automod revisa los mensajes automáticamente y aplica tus reglas.",
        "Puedes configurar cada protección por separado y excluir los roles de confianza de los filtros."
      ],
      "features": [
        "Detección de spam y ráfagas de mensajes",
        "Filtros para invitaciones y enlaces sospechosos",
        "Protección contra menciones masivas y raids",
        "Control de duplicados, mayúsculas y palabras no deseadas"
      ],
      "faq": [
        {
          "q": "¿Qué detecta Automod?",
          "a": "Puede detectar spam, enlaces, menciones masivas, mensajes duplicados y actividad relacionada con raids."
        },
        {
          "q": "¿Puedo excluir roles del staff?",
          "a": "Sí, puedes excluir los roles de confianza de las reglas de Automod."
        },
        {
          "q": "¿Automod actúa automáticamente?",
          "a": "Sí, las reglas activas funcionan aunque no haya un moderador conectado."
        },
        {
          "q": "¿Puedo desactivar una regla concreta?",
          "a": "Sí, cada protección se puede configurar por separado."
        }
      ]
    },
    "moderation": {
      "intro": [
        "Una moderación coherente necesita herramientas claras y un historial consultable. Wody reúne las acciones principales en comandos sencillos.",
        "Los bans, kicks, timeouts y advertencias pueden quedar registrados para que el equipo sepa qué ocurrió."
      ],
      "features": [
        "Ban, kick y timeout con motivo",
        "Historial de advertencias por miembro",
        "Limpieza masiva de mensajes con purge",
        "Registro mod-log para acciones importantes"
      ],
      "faq": [
        {
          "q": "¿Qué acciones de moderación están disponibles?",
          "a": "Según la configuración, puedes usar ban, kick, timeout, advertencias y limpieza de mensajes."
        },
        {
          "q": "¿Se registran las acciones?",
          "a": "Sí, las acciones importantes pueden enviarse a un canal mod-log."
        },
        {
          "q": "¿Se conservan las advertencias?",
          "a": "Pueden mantenerse en el historial del miembro para consultarlas después."
        },
        {
          "q": "¿Puedo borrar muchos mensajes a la vez?",
          "a": "Sí, la función purge permite limpiar mensajes en bloque."
        }
      ]
    },
    "reaction_roles": {
      "intro": [
        "Permite que los miembros elijan por sí mismos sus intereses, notificaciones o regiones. Reaction Roles reduce las asignaciones manuales.",
        "Puedes ofrecer roles mediante botones o reacciones y adaptar el modo de selección a tu servidor."
      ],
      "features": [
        "Selección de roles con botones o reacciones",
        "Modos de selección flexibles",
        "Eliminación sencilla de un rol elegido",
        "Útil para intereses y notificaciones"
      ],
      "faq": [
        {
          "q": "¿Los miembros pueden elegir sus roles?",
          "a": "Sí, pueden seleccionar los roles que pongas a su disposición."
        },
        {
          "q": "¿Pueden quitar un rol?",
          "a": "Sí, según el modo, otra interacción puede quitar el rol."
        },
        {
          "q": "¿Para qué sirve Reaction Roles?",
          "a": "Es útil para intereses, juegos, regiones y notificaciones opcionales."
        },
        {
          "q": "¿El staff debe asignar roles manualmente?",
          "a": "No, la asignación se realiza automáticamente mediante la selección configurada."
        }
      ]
    },
    "levels": {
      "intro": [
        "Los miembros activos pueden ganar XP y subir de nivel. El progreso queda visible sin tener que gestionarlo manualmente.",
        "Wody puede mostrar niveles y clasificaciones para que cada miembro vea su actividad dentro de la comunidad."
      ],
      "features": [
        "Sistema de XP y niveles para miembros activos",
        "Mensajes al alcanzar un nuevo nivel",
        "Clasificación del servidor",
        "Progreso visible para cada miembro"
      ],
      "faq": [
        {
          "q": "¿Cómo consiguen XP los miembros?",
          "a": "La participación activa en el servidor puede generar progreso dentro del sistema de XP."
        },
        {
          "q": "¿Hay clasificación?",
          "a": "Sí, puedes mostrar a los miembros más activos en la clasificación del servidor."
        },
        {
          "q": "¿Puedo enviar mensajes al subir de nivel?",
          "a": "Sí, Wody puede publicar un mensaje cuando un miembro alcanza un nuevo nivel."
        },
        {
          "q": "¿El módulo de niveles es gratuito?",
          "a": "Sí, el sistema de niveles está disponible gratis con Wody."
        }
      ]
    }
  },
  "nl": {
    "tickets": {
      "intro": [
        "Supportvragen raken gemakkelijk kwijt tussen privéberichten. Met tickets krijgt elke vraag een eigen privékanal.",
        "Plaats een ticketpaneel in het kanaal dat je wilt. Het team kan een ticket oppakken, sluiten en het gesprek bewaren."
      ],
      "features": [
        "Ticket openen met één klik",
        "Privékanalen voor lid en team",
        "Duidelijke toewijzing aan een teamlid",
        "Automatische transcripties bij het sluiten"
      ],
      "faq": [
        {
          "q": "Is het ticketsysteem gratis?",
          "a": "Ja, de ticketmodule van Wody is gratis beschikbaar."
        },
        {
          "q": "Kan ik het ticketpaneel aanpassen?",
          "a": "Ja, je kunt kanaal, tekst en opties via het dashboard instellen."
        },
        {
          "q": "Wat gebeurt er wanneer een ticket sluit?",
          "a": "Het ticket wordt gesloten en het gesprek kan als transcript worden bewaard."
        },
        {
          "q": "Kunnen meerdere teamleden hetzelfde ticket zien?",
          "a": "Ja. De claimfunctie laat zien wie de aanvraag behandelt."
        }
      ]
    },
    "automod": {
      "intro": [
        "Spam en raids kunnen gebeuren voordat een moderator tijd heeft om te reageren. Automod controleert berichten automatisch en past je regels toe.",
        "Je kunt elke bescherming afzonderlijk instellen en vertrouwde rollen uitsluiten van de filters."
      ],
      "features": [
        "Detectie van spam en berichtgolven",
        "Filters voor uitnodigingen en verdachte links",
        "Bescherming tegen massamentions en raids",
        "Controle op dubbele berichten, hoofdletters en woorden"
      ],
      "faq": [
        {
          "q": "Wat detecteert Automod?",
          "a": "Automod kan onder meer spam, links, massamentions, dubbele berichten en raidactiviteit detecteren."
        },
        {
          "q": "Kan ik teamrollen uitsluiten?",
          "a": "Ja, vertrouwde rollen kunnen worden uitgesloten van Automod-regels."
        },
        {
          "q": "Handelt Automod automatisch?",
          "a": "Ja, actieve regels werken ook wanneer er geen moderator online is."
        },
        {
          "q": "Kan ik één regel uitschakelen?",
          "a": "Ja, elke beschikbare bescherming kan afzonderlijk worden ingesteld."
        }
      ]
    },
    "moderation": {
      "intro": [
        "Consistente moderatie vraagt om duidelijke tools en een bruikbare geschiedenis. Wody brengt belangrijke acties samen in eenvoudige Discord-commando's.",
        "Bans, kicks, time-outs en waarschuwingen kunnen worden vastgelegd zodat het team later kan terugzien wat er is gebeurd."
      ],
      "features": [
        "Ban, kick en time-out met reden",
        "Waarschuwingsgeschiedenis per lid",
        "Snelle bulkverwijdering met purge",
        "Mod-log voor belangrijke acties"
      ],
      "faq": [
        {
          "q": "Welke moderatieacties zijn beschikbaar?",
          "a": "Afhankelijk van de configuratie kun je onder meer ban, kick, time-out, waarschuwingen en berichtopschoning gebruiken."
        },
        {
          "q": "Worden acties gelogd?",
          "a": "Ja, belangrijke acties kunnen naar een apart mod-logkanaal worden gestuurd."
        },
        {
          "q": "Blijven waarschuwingen bewaard?",
          "a": "Ze kunnen in de geschiedenis van een lid blijven staan."
        },
        {
          "q": "Kan ik veel berichten tegelijk verwijderen?",
          "a": "Ja, met purge kun je berichten in één keer opschonen."
        }
      ]
    },
    "reaction_roles": {
      "intro": [
        "Laat leden zelf interesses, meldingen of regio's kiezen. Reaction Roles vermindert het handmatige werk van je team.",
        "Je kunt rollen aanbieden met knoppen of reacties en de selectie aanpassen aan je server."
      ],
      "features": [
        "Rollen kiezen met knoppen of reacties",
        "Flexibele selectiemodi",
        "Gekozen rol eenvoudig verwijderen",
        "Geschikt voor interesses en meldingen"
      ],
      "faq": [
        {
          "q": "Kunnen leden zelf rollen kiezen?",
          "a": "Ja, ze kunnen de rollen selecteren die jij beschikbaar maakt."
        },
        {
          "q": "Kunnen ze een rol weer verwijderen?",
          "a": "Ja, afhankelijk van de modus kan een volgende interactie de rol verwijderen."
        },
        {
          "q": "Waarvoor is Reaction Roles handig?",
          "a": "Voor interesses, games, regio's en optionele meldingen."
        },
        {
          "q": "Moet het team rollen handmatig geven?",
          "a": "Nee, de toewijzing gebeurt automatisch via de ingestelde selectie."
        }
      ]
    },
    "levels": {
      "intro": [
        "Actieve leden kunnen XP verdienen en in level stijgen. De voortgang blijft zichtbaar zonder handmatig beheer.",
        "Wody kan levels en ranglijsten tonen zodat leden hun activiteit binnen de community kunnen volgen."
      ],
      "features": [
        "XP en levels voor actieve leden",
        "Berichten bij het bereiken van een nieuw level",
        "Ranglijst van de server",
        "Zichtbare voortgang per lid"
      ],
      "faq": [
        {
          "q": "Hoe verdienen leden XP?",
          "a": "Actieve deelname op de server kan voortgang opleveren in het XP-systeem."
        },
        {
          "q": "Is er een ranglijst?",
          "a": "Ja, je kunt de meest actieve leden in een serverranglijst tonen."
        },
        {
          "q": "Kan ik een level-upbericht sturen?",
          "a": "Ja, Wody kan een bericht plaatsen wanneer een lid een nieuw level bereikt."
        },
        {
          "q": "Is de levelmodule gratis?",
          "a": "Ja, het levelsysteem is gratis beschikbaar in Wody."
        }
      ]
    }
  },
  "pt": {
    "tickets": {
      "intro": [
        "Os pedidos de apoio podem perder-se facilmente entre mensagens privadas. Com tickets, cada pedido recebe o seu próprio canal privado.",
        "Coloque um painel no canal que preferir. A equipa pode assumir o ticket, fechá-lo e guardar a conversa."
      ],
      "features": [
        "Abertura de ticket com um clique",
        "Canais privados para membro e equipa",
        "Assunção clara por um membro da equipa",
        "Transcrições automáticas ao fechar"
      ],
      "faq": [
        {
          "q": "O sistema de tickets é gratuito?",
          "a": "Sim, o módulo de tickets da Wody está disponível gratuitamente."
        },
        {
          "q": "Posso personalizar o painel?",
          "a": "Sim, pode ajustar o canal, o texto e as opções no painel."
        },
        {
          "q": "O que acontece ao fechar um ticket?",
          "a": "O ticket é fechado e a conversa pode ser guardada como transcrição."
        },
        {
          "q": "Vários membros da equipa podem acompanhar um ticket?",
          "a": "Sim. A função de assunção mostra quem está a tratar do pedido."
        }
      ]
    },
    "automod": {
      "intro": [
        "Spam e raids podem acontecer antes de um moderador conseguir reagir. O Automod verifica as mensagens automaticamente e aplica as regras escolhidas.",
        "Cada proteção pode ser configurada separadamente e os cargos de confiança podem ser excluídos dos filtros."
      ],
      "features": [
        "Deteção de spam e rajadas de mensagens",
        "Filtros para convites e links suspeitos",
        "Proteção contra menções em massa e raids",
        "Controlo de duplicados, maiúsculas e palavras indesejadas"
      ],
      "faq": [
        {
          "q": "O que o Automod deteta?",
          "a": "Pode detetar spam, links, menções em massa, mensagens duplicadas e atividade de raid."
        },
        {
          "q": "Posso excluir cargos da equipa?",
          "a": "Sim, os cargos de confiança podem ficar fora das regras do Automod."
        },
        {
          "q": "O Automod atua automaticamente?",
          "a": "Sim, as regras ativas funcionam mesmo sem um moderador online."
        },
        {
          "q": "Posso desligar uma regra específica?",
          "a": "Sim, cada proteção disponível pode ser configurada separadamente."
        }
      ]
    },
    "moderation": {
      "intro": [
        "Uma moderação consistente precisa de ferramentas claras e de um histórico consultável. A Wody reúne ações importantes em comandos simples.",
        "Bans, kicks, timeouts e avisos podem ficar registados para que a equipa consiga rever o que aconteceu."
      ],
      "features": [
        "Ban, kick e timeout com motivo",
        "Histórico de avisos por membro",
        "Limpeza em massa com purge",
        "Mod-log para ações importantes"
      ],
      "faq": [
        {
          "q": "Que ações de moderação estão disponíveis?",
          "a": "Consoante a configuração, pode usar ban, kick, timeout, avisos e limpeza de mensagens."
        },
        {
          "q": "As ações ficam registadas?",
          "a": "Sim, as ações importantes podem ser enviadas para um canal mod-log."
        },
        {
          "q": "Os avisos ficam guardados?",
          "a": "Podem permanecer no histórico do membro para consulta posterior."
        },
        {
          "q": "Posso apagar muitas mensagens de uma vez?",
          "a": "Sim, a função purge permite limpar mensagens em bloco."
        }
      ]
    },
    "reaction_roles": {
      "intro": [
        "Deixe os membros escolherem os seus próprios interesses, notificações ou regiões. Reaction Roles reduz o trabalho manual da equipa.",
        "Pode disponibilizar cargos através de botões ou reações e adaptar a seleção ao seu servidor."
      ],
      "features": [
        "Escolha de cargos com botões ou reações",
        "Modos de seleção flexíveis",
        "Remoção simples de um cargo escolhido",
        "Ideal para interesses e notificações"
      ],
      "faq": [
        {
          "q": "Os membros podem escolher os próprios cargos?",
          "a": "Sim, podem selecionar os cargos que disponibilizar."
        },
        {
          "q": "Podem remover um cargo?",
          "a": "Sim, dependendo do modo, outra interação pode removê-lo."
        },
        {
          "q": "Para que serve Reaction Roles?",
          "a": "É útil para interesses, jogos, regiões e notificações opcionais."
        },
        {
          "q": "A equipa precisa atribuir cargos manualmente?",
          "a": "Não, a atribuição é feita automaticamente pela seleção configurada."
        }
      ]
    },
    "levels": {
      "intro": [
        "Os membros ativos podem ganhar XP e subir de nível. O progresso fica visível sem gestão manual constante.",
        "A Wody pode mostrar níveis e classificações para que cada membro acompanhe a sua atividade na comunidade."
      ],
      "features": [
        "Sistema de XP e níveis para membros ativos",
        "Mensagens ao alcançar um novo nível",
        "Classificação do servidor",
        "Progresso visível para cada membro"
      ],
      "faq": [
        {
          "q": "Como os membros ganham XP?",
          "a": "A participação ativa no servidor pode gerar progresso no sistema de XP."
        },
        {
          "q": "Existe uma classificação?",
          "a": "Sim, pode mostrar os membros mais ativos na classificação do servidor."
        },
        {
          "q": "Posso enviar uma mensagem de subida de nível?",
          "a": "Sim, a Wody pode publicar uma mensagem quando um membro alcança um novo nível."
        },
        {
          "q": "O módulo de níveis é gratuito?",
          "a": "Sim, o sistema de níveis está disponível gratuitamente na Wody."
        }
      ]
    }
  }
};

function buildLocalizedSeoContent(locale, slug) {
  const copy = LOCALIZED_MODULE_SEO[locale]?.[slug];
  const localized = LOCALIZED_MODULE_CONTENT[locale]?.[slug];
  if (!copy || !localized) return null;
  const [heroTitle, heroSubtitle, metaDescription] = copy;
  return {
    heroTitle,
    heroSubtitle,
    metaTitle: heroTitle.length > 52 ? `Wody - ${heroTitle.slice(0, 52).trimEnd()}` : `Wody - ${heroTitle}`,
    metaDescription,
    ogTitle: heroTitle,
    ogDescription: metaDescription,
    intro: localized.intro,
    features: localized.features,
    faq: localized.faq,
  };
}

Object.assign(MODULE_SEO_CONTENT.en, EN_A, EN_B);
MODULE_SEO_CONTENT.ro = { ...MODULE_SEO_CONTENT.ro, ...RO_A, ...RO_B };

// Buyer profile sections (who it is for, what goes wrong elsewhere, extra questions) exist in English and Romanian.
// A locale with its own translated page body gets no profile, so a page never mixes two languages.
function withProfile(content, profiles, slug) {
  const p = profiles[slug];
  if (!content || !p) return content;
  return { ...content, audience: p.audience, pains: p.pains, faq: [...content.faq, ...(p.faqMore || [])] };
}

export function getModuleSeoContent(slug, locale) {
  const localized = buildLocalizedSeoContent(locale, slug);
  if (localized) return localized;
  const byLocale = MODULE_SEO_CONTENT[locale];
  if (byLocale && byLocale[slug]) return withProfile(byLocale[slug], locale === 'ro' ? PROFILES_RO : PROFILES_EN, slug);
  return withProfile(MODULE_SEO_CONTENT.en[slug] || null, PROFILES_EN, slug);
}
