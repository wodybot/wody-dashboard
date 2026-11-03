"""Display names: Feeds is now "Pulse" (/pulse) and Lookups is now "Radar" (/radar), in every language.

Internal keys stay the same (module keys `feeds` / `lookups`, database collections, API routes, page URLs). This PATCH
runs last, so it also fixes any text the earlier scripts put back. It is idempotent."""
import re

LANGS = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"]
ROWS = {}

LOOK_NOUN = ["lookups", "căutări", "recherches", "ricerche", "Lookups", "búsquedas", "pesquisas", "opzoekingen", "sorgulamalar"]
FEED_NOUN = ["feeds", "feed-uri", "flux", "feed", "Feeds", "feeds", "feeds", "feeds", "akışlar"]
FEED_WORD = ["Feeds", "Feeds", "Flux", "Feed", "Feeds", "Feeds", "Feeds", "Feeds", "Akışlar"]

TITLES = {  # path -> "pulse" | "radar"
    "landing.modulesDetail.19.title": "Radar", "landing.modulesDetail.20.title": "Pulse",
    "commands.groups.10.title": "Radar", "commands.groups.11.title": "Pulse",
    "guildSettings.feeds.title": "Pulse", "guildSettings.lookups.title": "Radar",
    "modules.lookups.title": "Radar", "modules.feeds.title": "Pulse",
}
HEADINGS = {"privacy.sections.20.heading": "look", "privacy.sections.21.heading": "feed",
            "terms.sections.19.heading": "look", "terms.sections.20.heading": "feed"}
SIDEBAR_MENTIONS = ["guildSettings.lookups.footer", "commands.groups.11.commands.2.description"]


def _get(node, parts):
    for p in parts:
        node = node[int(p)] if isinstance(node, list) else node[p]
    return node


def _set(data, path, fn):
    parts = path.split(".")
    parent = _get(data, parts[:-1])
    key = int(parts[-1]) if isinstance(parent, list) else parts[-1]
    parent[key] = fn(parent[key])


def _commands(text):
    return re.sub(r"(?<![\w./<])/lookup(?![\w.-])", "/radar", re.sub(r"(?<![\w./<])/feed(?![\w.-])", "/pulse", text))


def _walk(node, fn):
    if isinstance(node, dict):
        for k, v in node.items():
            node[k] = _walk(v, fn)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            node[i] = _walk(v, fn)
    elif isinstance(node, str):
        return fn(node)
    return node


PHRASES = [
    # legal text: no "free" claims, the module names are the new ones
    ("Lookups are free and on by default. They can be turned off by a server administrator in the dashboard.", "Radar is on by default. A server administrator can turn it off in the dashboard."),
    ("Feeds are free. A server administrator sets them up on the dashboard or with", "A server administrator sets Pulse up on the dashboard or with"),
    ("Lookups sunt gratuite și pornite implicit. Un administrator al serverului le poate opri din dashboard.", "Radar este pornit implicit. Un administrator al serverului îl poate opri din dashboard."),
    ("Feeds sunt gratuite. Un administrator al serverului le configurează din dashboard sau cu", "Un administrator al serverului configurează Pulse din dashboard sau cu"),
    ("Les recherches sont gratuites et activées par défaut. Un administrateur du serveur peut les désactiver dans le tableau de bord.", "Radar est activé par défaut. Un administrateur du serveur peut le désactiver dans le tableau de bord."),
    ("Les flux sont gratuits. Un administrateur du serveur les configure dans le tableau de bord ou avec", "Un administrateur du serveur configure Pulse dans le tableau de bord ou avec"),
    ("Le ricerche sono gratuite e attive per impostazione predefinita. Un amministratore del server può disattivarle nella dashboard.", "Radar è attivo per impostazione predefinita. Un amministratore del server può disattivarlo nella dashboard."),
    ("I feed sono gratuiti. Un amministratore del server li configura nella dashboard o con", "Un amministratore del server configura Pulse nella dashboard o con"),
    ("Lookups sind kostenlos und standardmäßig aktiv. Ein Server-Administrator kann sie im Dashboard abschalten.", "Radar ist standardmäßig aktiv. Ein Server-Administrator kann es im Dashboard abschalten."),
    ("Feeds sind kostenlos. Ein Server-Administrator richtet sie im Dashboard oder mit", "Ein Server-Administrator richtet Pulse im Dashboard oder mit"),
    ("Las búsquedas son gratuitas y están activadas por defecto. Un administrador del servidor puede desactivarlas en el panel.", "Radar está activado por defecto. Un administrador del servidor puede desactivarlo en el panel."),
    ("Los feeds son gratuitos. Un administrador del servidor los configura en el panel o con", "Un administrador del servidor configura Pulse en el panel o con"),
    ("As pesquisas são gratuitas e estão ligadas por predefinição. Um administrador do servidor pode desligá-las no painel.", "O Radar está ligado por predefinição. Um administrador do servidor pode desligá-lo no painel."),
    ("Os feeds são gratuitos. Um administrador do servidor configura-os no painel ou com", "Um administrador do servidor configura o Pulse no painel ou com"),
    ("Opzoekingen zijn gratis en staan standaard aan. Een serverbeheerder kan ze in het dashboard uitzetten.", "Radar staat standaard aan. Een serverbeheerder kan het in het dashboard uitzetten."),
    ("Feeds zijn gratis. Een serverbeheerder stelt ze in via het dashboard of met", "Een serverbeheerder stelt Pulse in via het dashboard of met"),
    ("Sorgulamalar ücretsizdir ve varsayılan olarak açıktır. Sunucu yöneticisi bunları panelden kapatabilir.", "Radar varsayılan olarak açıktır. Sunucu yöneticisi bunu panelden kapatabilir."),
    ("Akışlar ücretsizdir. Sunucu yöneticisi bunları panelden veya", "Sunucu yöneticisi Pulse'ı panelden veya"),
    ("Feeds do not read private messages", "Pulse does not read private messages"),
    ("Feeds nu citesc mesaje private", "Pulse nu citește mesaje private"),
    ("Feeds lesen keine privaten", "Pulse liest keine privaten"),
    ("Nu folosi Lookups", "Nu folosi Radar"), ("Nu folosi Feeds", "Nu folosi Pulse"),
    ("Nutze Lookups nicht", "Nutze Radar nicht"), ("Nutze Feeds nicht", "Nutze Pulse nicht"),
    ("Feeds lezen geen privéberichten", "Pulse leest geen privéberichten"),
    ("Do not use Lookups", "Do not use Radar"), ("Do not use Feeds", "Do not use Pulse"),
]


def _phrases(text):
    for a, b in PHRASES:
        text = text.replace(a, b)
    return text


def PATCH(data, i):
    # the slash commands, wherever they are named
    _walk(data, _commands)
    _walk(data, _phrases)
    for path, name in TITLES.items():
        _set(data, path, lambda _v, name=name: name)
    for path, kind in HEADINGS.items():
        noun = LOOK_NOUN[i] if kind == "look" else FEED_NOUN[i]
        label = "Radar" if kind == "look" else "Pulse"
        _set(data, path, lambda v, label=label, noun=noun: re.sub(r"^(\d+\. ).*$", rf"\g<1>{label} ({noun})", v))
    word = FEED_WORD[i]
    for path in SIDEBAR_MENTIONS:
        def fix(v):
            v = re.sub(r"\bFeeds'in\b", "Pulse'ın", v)
            v = re.sub(rf"\b{word}\b", "Pulse", v)
            return re.sub(r"\bLookups\b", "Radar", v) if i in (0, 1, 4) else v
        _set(data, path, fix)
    return data
