import sys
sys.path.insert(0, "/home/claude/wody-project/wody-dashboard-main/scripts")
from merge_ns import merge_namespace

# `body` uses {b}/{code} rich-text placeholders (rendered via t.rich in the
# component) so "two" and the `localStorage` mention stay styled the same
# way as the original hardcoded JSX, across every language.
DATA = {
    "en": {
        "title": "We do not track you.",
        "body": "Wody uses <b>two</b> strictly-necessary cookies for Discord login (a session cookie, and a short-lived one to secure the login redirect), plus one <code>localStorage</code> entry, set only when you dismiss this banner, so it doesn't reappear. No analytics, no advertising, no third-party trackers, no data sold.",
        "privacy": "Privacy",
        "cookies": "Cookies",
        "terms": "Terms",
        "gotIt": "Got it",
        "dismiss": "Dismiss",
    },
    "ro": {
        "title": "Nu te urmărim.",
        "body": "Wody folosește <b>două</b> cookie-uri strict necesare pentru autentificarea cu Discord (un cookie de sesiune și unul de scurtă durată pentru a securiza redirecționarea la login), plus o intrare <code>localStorage</code>, setată doar când închizi acest banner, ca să nu mai reapară. Fără analiză de trafic, fără publicitate, fără trackere terțe, fără vânzare de date.",
        "privacy": "Confidențialitate",
        "cookies": "Cookie-uri",
        "terms": "Termeni",
        "gotIt": "Am înțeles",
        "dismiss": "Închide",
    },
    "fr": {
        "title": "Nous ne vous suivons pas.",
        "body": "Wody utilise <b>deux</b> cookies strictement nécessaires pour la connexion Discord (un cookie de session et un cookie de courte durée pour sécuriser la redirection de connexion), plus une entrée <code>localStorage</code>, définie uniquement lorsque vous fermez cette bannière, afin qu'elle ne réapparaisse pas. Pas d'analytique, pas de publicité, pas de traceurs tiers, aucune donnée vendue.",
        "privacy": "Confidentialité",
        "cookies": "Cookies",
        "terms": "Conditions",
        "gotIt": "J'ai compris",
        "dismiss": "Fermer",
    },
    "de": {
        "title": "Wir tracken dich nicht.",
        "body": "Wody verwendet <b>zwei</b> unbedingt erforderliche Cookies für den Discord-Login (ein Sitzungscookie und ein kurzlebiges Cookie zur Absicherung der Login-Weiterleitung) sowie einen <code>localStorage</code>-Eintrag, der nur gesetzt wird, wenn du dieses Banner schließt, damit es nicht erneut erscheint. Keine Analyse, keine Werbung, keine Tracker Dritter, keine Weitergabe von Daten.",
        "privacy": "Datenschutz",
        "cookies": "Cookies",
        "terms": "AGB",
        "gotIt": "Verstanden",
        "dismiss": "Schließen",
    },
    "es": {
        "title": "No te rastreamos.",
        "body": "Wody utiliza <b>dos</b> cookies estrictamente necesarias para el inicio de sesión con Discord (una cookie de sesión y otra de corta duración para proteger la redirección de inicio de sesión), además de una entrada de <code>localStorage</code>, que solo se establece cuando cierras este aviso, para que no vuelva a aparecer. Sin analítica, sin publicidad, sin rastreadores externos, sin venta de datos.",
        "privacy": "Privacidad",
        "cookies": "Cookies",
        "terms": "Términos",
        "gotIt": "Entendido",
        "dismiss": "Cerrar",
    },
    "it": {
        "title": "Non ti tracciamo.",
        "body": "Wody utilizza <b>due</b> cookie strettamente necessari per l'accesso con Discord (un cookie di sessione e uno di breve durata per proteggere il reindirizzamento del login), oltre a una voce di <code>localStorage</code>, impostata solo quando chiudi questo banner, così non ricompare più. Nessuna analisi, nessuna pubblicità, nessun tracker di terze parti, nessuna vendita di dati.",
        "privacy": "Privacy",
        "cookies": "Cookie",
        "terms": "Termini",
        "gotIt": "Ho capito",
        "dismiss": "Chiudi",
    },
    "pt": {
        "title": "Não te rastreamos.",
        "body": "O Wody usa <b>dois</b> cookies estritamente necessários para o login com Discord (um cookie de sessão e outro de curta duração para proteger o redirecionamento do login), além de uma entrada de <code>localStorage</code>, definida apenas quando fechas este aviso, para que não reapareça. Sem análise, sem publicidade, sem rastreadores de terceiros, sem venda de dados.",
        "privacy": "Privacidade",
        "cookies": "Cookies",
        "terms": "Termos",
        "gotIt": "Entendi",
        "dismiss": "Fechar",
    },
    "nl": {
        "title": "We volgen je niet.",
        "body": "Wody gebruikt <b>twee</b> strikt noodzakelijke cookies voor Discord-login (een sessiecookie en een kortstondige cookie om de login-redirect te beveiligen), plus één <code>localStorage</code>-item, dat alleen wordt ingesteld wanneer je deze banner sluit, zodat hij niet opnieuw verschijnt. Geen analytics, geen advertenties, geen trackers van derden, geen verkoop van gegevens.",
        "privacy": "Privacy",
        "cookies": "Cookies",
        "terms": "Voorwaarden",
        "gotIt": "Begrepen",
        "dismiss": "Sluiten",
    },
    "tr": {
        "title": "Seni takip etmiyoruz.",
        "body": "Wody, Discord girişi için kesinlikle gerekli <b>iki</b> çerez kullanır (bir oturum çerezi ve giriş yönlendirmesini güvence altına alan kısa ömürlü bir çerez), ayrıca bu banner'ı kapattığında bir daha görünmemesi için yalnızca o zaman ayarlanan bir <code>localStorage</code> girişi kullanır. Analitik yok, reklam yok, üçüncü taraf izleyici yok, veri satışı yok.",
        "privacy": "Gizlilik",
        "cookies": "Çerezler",
        "terms": "Koşullar",
        "gotIt": "Anladım",
        "dismiss": "Kapat",
    },
}

merge_namespace("cookieNotice", DATA)
