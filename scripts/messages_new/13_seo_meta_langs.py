"""SEO meta for fr/it/de/es/pt/nl/tr (titles 30-60, descriptions 90-158, no em dashes). Idempotent PATCH."""
ROWS = {}
L = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"]
M = {
 "fr": {
  "premiumPage.metaTitle": "Wody Premium | Limites étendues et modules en plus",
  "team.metaTitle": "Équipe Wody | Les personnes derrière le bot Discord",
  "team.metaDescription": "Découvre les personnes derrière Wody, le bot Discord de modération, tickets, niveaux et giveaways, et qui le crée et le fait évoluer.",
  "help.metaDescription": "Aide Wody : guides de configuration, tableau de bord, tickets, rôles par réaction, Premium, vote et comment inviter Wody sur ton serveur.",
  "commands.metaDescription": "Liste complète des commandes du bot Discord Wody : modération, tickets, giveaways, niveaux, sauvegardes, vocal, économie et jeux comme /slots.",
  "modulesHub.metaTitle": "Modules Wody | Modération, Tickets, Niveaux et plus",
  "modulesHub.metaDescription": "Tous les modules Wody au même endroit : modération, tickets, niveaux, concours, bienvenue, Pulse, Radar, économie et plus. Vois ce que chacun fait.",
  "globalBoard.metaDescription": "Les 100 membres les plus riches de tous les serveurs qui utilisent Wody Economy, classés par fortune totale et mis à jour en continu.",
 },
 "it": {
  "commands.metaDescription": "Elenco completo dei comandi del bot Discord Wody: moderazione, ticket, giveaway, livelli, backup, voce, economia e giochi come /slots.",
  "premiumPage.metaTitle": "Wody Premium | Limiti più alti e moduli extra",
  "team.metaTitle": "Team Wody | Le persone dietro il bot Discord",
  "team.metaDescription": "Conosci le persone dietro Wody, il bot Discord per moderazione, ticket, livelli e giveaway, e scopri chi lo crea e lo mantiene.",
  "modulesHub.metaTitle": "Moduli Wody | Moderazione, Ticket, Livelli e altro",
  "modulesHub.metaDescription": "Tutti i moduli Wody in un posto solo: moderazione, ticket, livelli, giveaway, benvenuto, Pulse, Radar, economia e altro. Scopri cosa fa ognuno.",
  "globalBoard.metaDescription": "I 100 membri più ricchi di tutti i server che usano Wody Economy, in classifica per patrimonio totale e aggiornata di continuo.",
 },
 "de": {
  "commands.metaDescription": "Komplette Befehlsliste des Wody-Discord-Bots: Moderation, Tickets, Gewinnspiele, Level, Backups, Sprachkanäle, Wirtschaft und Spiele wie /slots.",
  "premiumPage.metaTitle": "Wody Premium | Höhere Limits und Zusatzmodule",
  "team.metaTitle": "Wody-Team | Die Menschen hinter dem Discord-Bot",
  "team.metaDescription": "Lerne die Menschen hinter Wody kennen, dem Discord-Bot für Moderation, Tickets, Level und Gewinnspiele, und wer ihn entwickelt und pflegt.",
  "modulesHub.metaTitle": "Wody-Module | Moderation, Tickets, Level und mehr",
  "modulesHub.metaDescription": "Alle Wody-Module an einem Ort: Moderation, Tickets, Level, Giveaways, Willkommen, Pulse, Radar, Wirtschaft und mehr. Sieh, was jedes Modul kann.",
  "globalBoard.metaDescription": "Die 100 reichsten Mitglieder aller Server, die Wody Economy nutzen, gereiht nach Gesamtvermögen und laufend aktualisiert.",
 },
 "es": {
  "premiumPage.metaTitle": "Wody Premium | Más límites y módulos extra",
  "team.metaTitle": "Equipo de Wody | Las personas detrás del bot",
  "team.metaDescription": "Conoce a las personas detrás de Wody, el bot de Discord de moderación, tickets, niveles y sorteos, y a quienes lo crean y mantienen.",
  "help.metaDescription": "Ayuda de Wody: guías de configuración, panel, tickets, roles por reacción, Premium, votación y cómo invitar a Wody a tu servidor.",
  "commands.metaDescription": "Lista completa de comandos del bot de Discord Wody: moderación, tickets, sorteos, niveles, copias, voz, economía y juegos como /slots.",
  "modulesHub.metaTitle": "Módulos de Wody | Moderación, Tickets, Niveles y más",
  "modulesHub.metaDescription": "Todos los módulos de Wody en un solo lugar: moderación, tickets, niveles, sorteos, bienvenida, Pulse, Radar, economía y más. Mira qué hace cada uno.",
  "globalBoard.metaDescription": "Los 100 miembros más ricos de todos los servidores que usan Wody Economy, ordenados por fortuna total y actualizados de forma continua.",
 },
 "pt": {
  "premiumPage.metaTitle": "Wody Premium | Mais limites e módulos extra",
  "team.metaTitle": "Equipa Wody | As pessoas por trás do bot Discord",
  "team.metaDescription": "Conhece as pessoas por trás do Wody, o bot de Discord para moderação, tickets, níveis e sorteios, e quem o cria e mantém.",
  "help.metaDescription": "Ajuda do Wody: guias de configuração, painel, tickets, cargos por reação, Premium, votação e como convidar o Wody para o teu servidor.",
  "commands.metaDescription": "Lista completa de comandos do bot Wody para Discord: moderação, tickets, sorteios, níveis, cópias, voz, economia e jogos como /slots.",
  "modulesHub.metaTitle": "Módulos do Wody | Moderação, Tickets, Níveis e mais",
  "modulesHub.metaDescription": "Todos os módulos do Wody num só lugar: moderação, tickets, níveis, sorteios, boas-vindas, Pulse, Radar, economia e mais. Vê o que cada um faz.",
  "globalBoard.metaDescription": "Os 100 membros mais ricos de todos os servidores que usam Wody Economy, ordenados por fortuna total e atualizados continuamente.",
 },
 "nl": {
  "commands.metaDescription": "Volledige commandolijst van de Wody Discord-bot: moderatie, tickets, giveaways, levels, back-ups, spraak, economie en games zoals /slots.",
  "premiumPage.metaTitle": "Wody Premium | Hogere limieten en extra modules",
  "team.metaTitle": "Wody-team | De mensen achter de Discord-bot",
  "team.metaDescription": "Maak kennis met de mensen achter Wody, de Discord-bot voor moderatie, tickets, levels en giveaways, en wie hem bouwt en onderhoudt.",
  "modulesHub.metaTitle": "Wody-modules | Moderatie, Tickets, Levels en meer",
  "modulesHub.metaDescription": "Alle Wody-modules op één plek: moderatie, tickets, levels, giveaways, welkom, Pulse, Radar, economie en meer. Zie wat elke module doet.",
  "globalBoard.metaDescription": "De 100 rijkste leden van alle servers die Wody Economy gebruiken, gerangschikt op totaal vermogen en continu bijgewerkt.",
 },
 "tr": {
  "commands.metaDescription": "Wody Discord botunun tüm komut listesi: moderasyon, destek talepleri, çekilişler, seviyeler, yedekler, ses, ekonomi ve /slots gibi oyunlar.",
  "premiumPage.metaTitle": "Wody Premium | Yüksek limitler ve ek modüller",
  "team.metaTitle": "Wody Ekibi | Discord botunun arkasındaki insanlar",
  "team.metaDescription": "Moderasyon, bilet, seviye ve çekiliş sunan Discord botu Wody'nin arkasındaki insanlarla tanış ve onu kimin geliştirdiğini gör.",
  "modulesHub.metaTitle": "Wody Modülleri | Moderasyon, Bilet, Seviye ve Fazlası",
  "modulesHub.metaDescription": "Tüm Wody modülleri tek yerde: moderasyon, bilet, seviye, çekiliş, karşılama, Pulse, Radar, ekonomi ve fazlası. Her birinin ne yaptığını gör.",
  "globalBoard.metaDescription": "Wody Economy kullanan tüm sunuculardaki en zengin 100 üye, toplam servete göre sıralanır ve sürekli güncellenir.",
 },
}
M["en"] = {"globalBoard.metaDescription": "The 100 richest members across every server that uses Wody Economy, ranked by total wealth and updated continuously."}
M["ro"] = {"globalBoard.metaDescription": "Cei mai bogați 100 de membri din toate serverele care folosesc Wody Economy, clasați după averea totală și actualizați continuu."}
def PATCH(data, i):
    for path, text in M.get(L[i], {}).items():
        a, b = path.split(".")
        if a in data and b in data[a]:
            data[a][b] = text

_prev = PATCH
def PATCH(data, i):
    _prev(data, i)
    for k in ("help", "commands", "contact", "careers", "updates", "partners"):
        t = data.get(k, {}).get("metaTitle")
        if t and len(t) < 25 and "Discord" not in t and "|" not in t:
            data[k]["metaTitle"] = t + " | Discord Bot"
