"""SEO: meta titles/descriptions in sensible lengths (no em dashes). Idempotent PATCH for en and ro."""
ROWS = {}
M = {
 "en": {
  "careers.metaTitle": "Wody Careers | Contribute to the Discord Bot",
  "contact.metaTitle": "Contact Wody | Support, Privacy and Legal",
  "premiumPage.metaTitle": "Wody Premium | Higher Limits and Extra Modules",
  "commands.metaTitle": "Wody Commands | Full Discord Bot Command List",
  "commands.metaDescription": "Browse the full Wody Discord bot command list: moderation, tickets, giveaways, levels, backups, voice, economy and games like /slots and /dice.",
  "updates.metaTitle": "Wody Updates | New Features, Fixes and News",
  "updates.metaDescription": "Latest Wody Discord bot updates: new features, fixes and announcements, posted as soon as they ship so you can see what changed.",
  "team.metaTitle": "Wody Team | The People Behind the Discord Bot",
  "team.metaDescription": "Meet the people behind Wody, the Discord bot for moderation, tickets, levels, giveaways and more, and see who builds and maintains it.",
  "modulesHub.metaTitle": "Wody Modules | Moderation, Tickets, Levels and More",
  "modulesHub.metaDescription": "Every Wody module in one place: moderation, tickets, levels, giveaways, welcome messages, Pulse, Radar, economy and more. See what each one does.",
 },
 "ro": {
  "careers.metaTitle": "Cariere Wody | Contribuie la botul Discord",
  "contact.metaTitle": "Contact Wody | Suport, Confidențialitate, Legal",
  "premiumPage.metaTitle": "Wody Premium | Limite mai mari și module extra",
  "commands.metaTitle": "Comenzi Wody | Lista completă a botului Discord",
  "commands.metaDescription": "Vezi lista completă de comenzi Wody: moderare, tichete, giveaway-uri, niveluri, backup-uri, voce, economie și jocuri precum /slots și /dice.",
  "updates.metaTitle": "Noutăți Wody | Funcții noi, remedieri și anunțuri",
  "updates.metaDescription": "Cele mai noi noutăți despre botul Discord Wody: funcții noi, remedieri și anunțuri, publicate imediat ce apar, ca să vezi ce s-a schimbat.",
  "team.metaTitle": "Echipa Wody | Oamenii din spatele botului Discord",
  "team.metaDescription": "Cunoaște oamenii din spatele Wody, botul Discord pentru moderare, tichete, niveluri, giveaway-uri și altele, și vezi cine îl construiește.",
  "help.metaDescription": "Ajutor Wody: ghiduri de configurare, dashboard, tichete, roluri prin reacție, Premium, vot și cum să inviți Wody pe serverul tău.",
  "modulesHub.metaTitle": "Module Wody | Moderare, Tichete, Niveluri și altele",
  "modulesHub.metaDescription": "Toate modulele Wody într-un singur loc: moderare, tichete, niveluri, giveaway-uri, mesaje de bun venit, Pulse, Radar, economie și altele.",
 },
}
def PATCH(data, i):
    lang = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"][i]
    for path, text in M.get(lang, {}).items():
        a, b = path.split(".")
        if a in data and b in data[a]:
            data[a][b] = text

HOME_DESC = {
 "en": "Wody is a Discord bot with moderation, tickets, giveaways, levels, welcome messages, reaction roles, automod and more for growing communities.",
 "ro": "Wody este un bot Discord cu moderare, tichete, giveaway-uri, niveluri, mesaje de bun venit, roluri prin reacție, automod și altele pentru comunități.",
 "fr": "Wody est un bot Discord avec modération, tickets, giveaways, niveaux, messages de bienvenue, rôles par réaction, automod et plus pour votre communauté.",
 "it": "Wody è un bot Discord con moderazione, ticket, giveaway, livelli, messaggi di benvenuto, ruoli reazione, automod e altro per la tua community.",
 "de": "Wody ist ein Discord-Bot mit Moderation, Tickets, Gewinnspielen, Leveln, Willkommensnachrichten, Reaktionsrollen, Automod und mehr für Communities.",
 "es": "Wody es un bot de Discord con moderación, tickets, sorteos, niveles, mensajes de bienvenida, roles por reacción, automod y más para tu comunidad.",
 "pt": "Wody é um bot do Discord com moderação, tickets, sorteios, níveis, mensagens de boas-vindas, cargos por reação, automod e mais para sua comunidade.",
 "nl": "Wody is een Discord-bot met moderatie, tickets, giveaways, levels, welkomstberichten, reactierollen, automod en meer voor groeiende communities.",
 "tr": "Wody; moderasyon, bilet, çekiliş, seviye, karşılama mesajı, tepki rolü, automod ve daha fazlasını sunan, topluluklar için bir Discord botudur.",
}
_old = PATCH
def PATCH(data, i):
    _old(data, i)
    lang = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"][i]
    data["meta"]["description"] = HOME_DESC[lang]
