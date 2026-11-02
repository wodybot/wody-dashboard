import json, io

LOCALES = ["en", "ro", "fr", "de", "es", "it", "pt", "nl", "tr"]
BASE = "/home/claude/wody-project/wody-dashboard-main/messages/{}.json"

# Was previously CONTENT.landing.premium.limits[].title in lib/content.js,
# hardcoded English, rendered directly in the per-guild PremiumPanel (visible
# to any server admin, not just the site owner), moved into i18n under the
# panel's existing namespace since that's already loaded there.
DATA = {
    "en": {
        "ticketPanels": "Ticket panels",
        "reactionRolePanels": "Reaction Role panels",
        "autoResponses": "Auto Responses",
        "customCommands": "Custom Commands",
        "scheduledMessages": "Scheduled Messages",
        "giveaways": "Giveaways",
        "forumAutomations": "Forum automations",
    },
    "ro": {
        "ticketPanels": "Panouri de tichete",
        "reactionRolePanels": "Panouri de roluri prin reacție",
        "autoResponses": "Răspunsuri automate",
        "customCommands": "Comenzi personalizate",
        "scheduledMessages": "Mesaje programate",
        "giveaways": "Giveaway-uri",
        "forumAutomations": "Automatizări de forum",
    },
    "fr": {
        "ticketPanels": "Panneaux de tickets",
        "reactionRolePanels": "Panneaux de rôles par réaction",
        "autoResponses": "Réponses automatiques",
        "customCommands": "Commandes personnalisées",
        "scheduledMessages": "Messages programmés",
        "giveaways": "Concours",
        "forumAutomations": "Automatisations de forum",
    },
    "de": {
        "ticketPanels": "Ticket-Panels",
        "reactionRolePanels": "Reaction-Role-Panels",
        "autoResponses": "Automatische Antworten",
        "customCommands": "Benutzerdefinierte Befehle",
        "scheduledMessages": "Geplante Nachrichten",
        "giveaways": "Gewinnspiele",
        "forumAutomations": "Forum-Automatisierungen",
    },
    "es": {
        "ticketPanels": "Paneles de tickets",
        "reactionRolePanels": "Paneles de roles por reacción",
        "autoResponses": "Respuestas automáticas",
        "customCommands": "Comandos personalizados",
        "scheduledMessages": "Mensajes programados",
        "giveaways": "Sorteos",
        "forumAutomations": "Automatizaciones de foro",
    },
    "it": {
        "ticketPanels": "Pannelli ticket",
        "reactionRolePanels": "Pannelli ruoli tramite reazione",
        "autoResponses": "Risposte automatiche",
        "customCommands": "Comandi personalizzati",
        "scheduledMessages": "Messaggi programmati",
        "giveaways": "Giveaway",
        "forumAutomations": "Automazioni forum",
    },
    "pt": {
        "ticketPanels": "Painéis de tickets",
        "reactionRolePanels": "Painéis de cargos por reação",
        "autoResponses": "Respostas automáticas",
        "customCommands": "Comandos personalizados",
        "scheduledMessages": "Mensagens agendadas",
        "giveaways": "Sorteios",
        "forumAutomations": "Automatizações de fórum",
    },
    "nl": {
        "ticketPanels": "Ticketpanelen",
        "reactionRolePanels": "Reaction-role-panelen",
        "autoResponses": "Automatische reacties",
        "customCommands": "Aangepaste commando's",
        "scheduledMessages": "Geplande berichten",
        "giveaways": "Weggeefacties",
        "forumAutomations": "Forumautomatiseringen",
    },
    "tr": {
        "ticketPanels": "Bilet panelleri",
        "reactionRolePanels": "Tepki rolü panelleri",
        "autoResponses": "Otomatik yanıtlar",
        "customCommands": "Özel komutlar",
        "scheduledMessages": "Zamanlanmış mesajlar",
        "giveaways": "Çekilişler",
        "forumAutomations": "Forum otomasyonları",
    },
}

for loc in LOCALES:
    path = BASE.format(loc)
    with io.open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    d["guildSettings"]["premium"]["limitTitles"] = DATA[loc]
    with io.open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("Merged 'limitTitles' into guildSettings.premium for all 9 locales.")
