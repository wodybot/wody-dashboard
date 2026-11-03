"""Texts of the /modules hub page (all modules in one place, linking to every module page). Order: en ro fr it de es pt nl tr."""
P = "modulesHub."
ROWS = {}


def r(key, *v):
    assert len(v) == 9, key
    ROWS[P + key] = v


r("metaTitle", "Wody Modules | Moderation, Tickets, Levels, Giveaways and More for Discord",
  "Module Wody | Moderare, Tichete, Niveluri, Giveaway-uri și Multe Altele pentru Discord",
  "Modules Wody | Modération, Tickets, Niveaux, Concours et Plus pour Discord",
  "Moduli Wody | Moderazione, Ticket, Livelli, Giveaway e Altro per Discord",
  "Wody-Module | Moderation, Tickets, Level, Giveaways und mehr für Discord",
  "Módulos de Wody | Moderación, Tickets, Niveles, Sorteos y Más para Discord",
  "Módulos do Wody | Moderação, Tickets, Níveis, Sorteios e Mais para o Discord",
  "Wody-modules | Moderatie, Tickets, Levels, Giveaways en meer voor Discord",
  "Wody Modülleri | Discord için Moderasyon, Bilet, Seviye, Çekiliş ve Daha Fazlası")
r("metaDescription", "Every Wody module in one place: moderation, tickets, levels, giveaways, welcome messages, Pulse, Radar, economy and more. Open a module to see what it does and how to set it up.",
  "Toate modulele Wody într-un singur loc: moderare, tichete, niveluri, giveaway-uri, mesaje de bun venit, Pulse, Radar, economie și altele. Deschide un modul ca să vezi ce face și cum îl configurezi.",
  "Tous les modules Wody au même endroit : modération, tickets, niveaux, concours, messages de bienvenue, Pulse, Radar, économie et plus. Ouvre un module pour voir ce qu'il fait et comment le configurer.",
  "Tutti i moduli Wody in un posto solo: moderazione, ticket, livelli, giveaway, messaggi di benvenuto, Pulse, Radar, economia e altro. Apri un modulo per vedere cosa fa e come configurarlo.",
  "Alle Wody-Module an einem Ort: Moderation, Tickets, Level, Giveaways, Willkommensnachrichten, Pulse, Radar, Wirtschaft und mehr. Öffne ein Modul, um zu sehen, was es kann und wie du es einrichtest.",
  "Todos los módulos de Wody en un solo lugar: moderación, tickets, niveles, sorteos, mensajes de bienvenida, Pulse, Radar, economía y más. Abre un módulo para ver qué hace y cómo configurarlo.",
  "Todos os módulos do Wody num só lugar: moderação, tickets, níveis, sorteios, mensagens de boas-vindas, Pulse, Radar, economia e mais. Abre um módulo para ver o que faz e como o configurar.",
  "Alle Wody-modules op één plek: moderatie, tickets, levels, giveaways, welkomstberichten, Pulse, Radar, economie en meer. Open een module om te zien wat het doet en hoe je het instelt.",
  "Tüm Wody modülleri tek yerde: moderasyon, bilet, seviye, çekiliş, karşılama mesajları, Pulse, Radar, ekonomi ve daha fazlası. Ne yaptığını ve nasıl kurulacağını görmek için bir modül aç.")
r("ogTitle", "All Wody modules for Discord", "Toate modulele Wody pentru Discord", "Tous les modules Wody pour Discord", "Tutti i moduli Wody per Discord",
  "Alle Wody-Module für Discord", "Todos los módulos de Wody para Discord", "Todos os módulos do Wody para o Discord", "Alle Wody-modules voor Discord", "Discord için tüm Wody modülleri")
r("title", "Wody modules", "Modulele Wody", "Les modules Wody", "I moduli di Wody", "Die Wody-Module", "Los módulos de Wody", "Os módulos do Wody", "De Wody-modules", "Wody modülleri")
r("subtitle", "One bot for moderation, community, creators and fun. Pick a module to see what it does and how to set it up.",
  "Un singur bot pentru moderare, comunitate, creatori și distracție. Alege un modul ca să vezi ce face și cum îl configurezi.",
  "Un seul bot pour la modération, la communauté, les créateurs et le fun. Choisis un module pour voir ce qu'il fait et comment le configurer.",
  "Un solo bot per moderazione, community, creator e divertimento. Scegli un modulo per vedere cosa fa e come configurarlo.",
  "Ein Bot für Moderation, Community, Creator und Spaß. Wähle ein Modul, um zu sehen, was es kann und wie du es einrichtest.",
  "Un solo bot para moderación, comunidad, creadores y diversión. Elige un módulo para ver qué hace y cómo configurarlo.",
  "Um só bot para moderação, comunidade, criadores e diversão. Escolhe um módulo para ver o que faz e como o configurar.",
  "Eén bot voor moderatie, community, creators en plezier. Kies een module om te zien wat het doet en hoe je het instelt.",
  "Moderasyon, topluluk, içerik üreticileri ve eğlence için tek bot. Ne yaptığını ve nasıl kurulacağını görmek için bir modül seç.")
r("breadcrumb", "Modules", "Module", "Modules", "Moduli", "Module", "Módulos", "Módulos", "Modules", "Modüller")
r("home", "Home", "Acasă", "Accueil", "Home", "Startseite", "Inicio", "Início", "Home", "Ana sayfa")

ROWS["footer.columns.features.all"] = ("All modules", "Toate modulele", "Tous les modules", "Tutti i moduli", "Alle Module", "Todos los módulos", "Todos os módulos", "Alle modules", "Tüm modüller")
