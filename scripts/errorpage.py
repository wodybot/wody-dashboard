import sys
sys.path.insert(0, "/home/claude/wody-project/wody-dashboard-main/scripts")
from merge_ns import merge_namespace

# Shared across app/[locale]/error.js, app/[locale]/dashboard/error.js and
# app/[locale]/dashboard/[guildId]/error.js, the three boundaries only
# differed by a trailing period on the heading and "try searching again" vs
# "try again" in the body, so they're unified onto one namespace instead of
# three near-duplicate key sets. app/error.js and app/global-error.js stay
# untouched: those sit above the [locale] segment/layout, so locale context
# may not be resolvable there (global-error.js already hardcodes lang="en"
# intentionally as the last-resort fallback).
DATA = {
    "en": {"heading": "An error occurred", "body": "Something went wrong while loading this page. It's usually temporary (Discord rate-limit, database blip), try again.", "retry": "Retry"},
    "ro": {"heading": "A apărut o eroare", "body": "Ceva nu a mers bine la încărcarea acestei pagini. De obicei e temporar (limitare de rată Discord, sincopă a bazei de date), încearcă din nou.", "retry": "Încearcă din nou"},
    "fr": {"heading": "Une erreur s'est produite", "body": "Un problème est survenu lors du chargement de cette page. C'est généralement temporaire (limite de débit Discord, incident de base de données), réessayez.", "retry": "Réessayer"},
    "de": {"heading": "Ein Fehler ist aufgetreten", "body": "Beim Laden dieser Seite ist etwas schiefgelaufen. Das ist meist vorübergehend (Discord-Ratenlimit, Datenbank-Aussetzer), versuche es erneut.", "retry": "Erneut versuchen"},
    "es": {"heading": "Se produjo un error", "body": "Algo salió mal al cargar esta página. Suele ser algo temporal (límite de solicitudes de Discord, fallo puntual de la base de datos): inténtalo de nuevo.", "retry": "Reintentar"},
    "it": {"heading": "Si è verificato un errore", "body": "Qualcosa è andato storto durante il caricamento di questa pagina. Di solito è temporaneo (limite di frequenza di Discord, intoppo del database), riprova.", "retry": "Riprova"},
    "pt": {"heading": "Ocorreu um erro", "body": "Algo correu mal ao carregar esta página. Normalmente é temporário (limite de taxa do Discord, falha pontual na base de dados), tenta novamente.", "retry": "Tentar novamente"},
    "nl": {"heading": "Er is een fout opgetreden", "body": "Er ging iets mis bij het laden van deze pagina. Dit is meestal tijdelijk (Discord-ratelimiet, kortstondig databaseprobleem), probeer het opnieuw.", "retry": "Opnieuw proberen"},
    "tr": {"heading": "Bir hata oluştu", "body": "Bu sayfa yüklenirken bir şeyler ters gitti. Bu genellikle geçicidir (Discord hız sınırı, veritabanı aksaması), tekrar dene.", "retry": "Tekrar dene"},
}

merge_namespace("errorPage", DATA)
