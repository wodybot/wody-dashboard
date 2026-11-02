"""'How to set up' section of the module pages. Order: en ro fr it de es pt nl tr. No em dashes."""
LANGS = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"]
P = "modulesPage.howto."
ROWS = {}


def r(key, *v):
    assert len(v) == 9, key
    ROWS[P + key] = v


r("title", "How to set up {module}", "Cum se configurează {module}", "Comment configurer {module}", "Come configurare {module}", "So richtest du {module} ein", "Cómo configurar {module}", "Como configurar {module}", "Zo stel je {module} in", "{module} nasıl kurulur")
r("intro", "Here is how to get {module} running on your server, step by step. It takes a few minutes.",
  "Iată cum pornești {module} pe serverul tău, pas cu pas. Durează câteva minute.",
  "Voici comment activer {module} sur ton serveur, étape par étape. Ça prend quelques minutes.",
  "Ecco come attivare {module} sul tuo server, passo dopo passo. Ci vogliono pochi minuti.",
  "So bringst du {module} Schritt für Schritt auf deinen Server. Es dauert nur ein paar Minuten.",
  "Así pones en marcha {module} en tu servidor, paso a paso. Lleva unos minutos.",
  "Assim colocas {module} a funcionar no teu servidor, passo a passo. Demora poucos minutos.",
  "Zo krijg je {module} stap voor stap draaiend op je server. Het kost een paar minuten.",
  "{module} modülünü sunucunda adım adım nasıl çalıştıracağını burada bulabilirsin. Birkaç dakika sürer.")
r("s1t", "Add Wody and open the dashboard", "Adaugă Wody și deschide dashboard-ul", "Ajoute Wody et ouvre le tableau de bord", "Aggiungi Wody e apri la dashboard", "Füge Wody hinzu und öffne das Dashboard", "Añade a Wody y abre el panel", "Adiciona o Wody e abre o painel", "Voeg Wody toe en open het dashboard", "Wody'yi ekle ve paneli aç")
r("s1d", "Invite Wody to your server, then sign in to the dashboard with Discord and pick your server. In Discord you can also run /dashboard to get the link.",
  "Invită-l pe Wody pe server, apoi conectează-te la dashboard cu Discord și alege serverul. În Discord poți rula și /dashboard ca să primești linkul.",
  "Invite Wody sur ton serveur, connecte-toi au tableau de bord avec Discord et choisis ton serveur. Dans Discord, tu peux aussi lancer /dashboard pour obtenir le lien.",
  "Invita Wody nel tuo server, accedi alla dashboard con Discord e scegli il server. Su Discord puoi anche usare /dashboard per ottenere il link.",
  "Lade Wody auf deinen Server ein, melde dich mit Discord im Dashboard an und wähle deinen Server. In Discord erhältst du den Link auch mit /dashboard.",
  "Invita a Wody a tu servidor, inicia sesión en el panel con Discord y elige tu servidor. En Discord también puedes usar /dashboard para obtener el enlace.",
  "Convida o Wody para o teu servidor, inicia sessão no painel com o Discord e escolhe o servidor. No Discord também podes usar /dashboard para receber o link.",
  "Nodig Wody uit op je server, log met Discord in op het dashboard en kies je server. In Discord krijg je de link ook met /dashboard.",
  "Wody'yi sunucuna davet et, Discord ile panele giriş yap ve sunucunu seç. Discord'da /dashboard komutuyla da bağlantıyı alabilirsin.")
r("s2t", "Turn on {module}", "Pornește {module}", "Active {module}", "Attiva {module}", "Schalte {module} ein", "Activa {module}", "Ativa {module}", "Zet {module} aan", "{module} modülünü aç")
r("s2d", "Open {module} in the sidebar and switch it on if it is off.",
  "Deschide {module} din bara laterală și pornește modulul dacă este oprit.",
  "Ouvre {module} dans la barre latérale et active le module s'il est désactivé.",
  "Apri {module} nella barra laterale e attiva il modulo se è spento.",
  "Öffne {module} in der Seitenleiste und schalte das Modul ein, falls es aus ist.",
  "Abre {module} en la barra lateral y activa el módulo si está apagado.",
  "Abre {module} na barra lateral e ativa o módulo se estiver desligado.",
  "Open {module} in de zijbalk en zet de module aan als die uit staat.",
  "Kenar çubuğundan {module} modülünü aç ve kapalıysa etkinleştir.")
r("premium", "{module} is part of Premium. Activate a key for your server first, then turn it on.",
  "{module} face parte din Premium. Activează mai întâi o cheie pentru server, apoi pornește modulul.",
  "{module} fait partie de Premium. Active d'abord une clé pour ton serveur, puis active le module.",
  "{module} fa parte di Premium. Attiva prima una chiave per il server, poi attiva il modulo.",
  "{module} gehört zu Premium. Aktiviere zuerst einen Schlüssel für deinen Server und schalte das Modul dann ein.",
  "{module} forma parte de Premium. Activa primero una clave para tu servidor y luego activa el módulo.",
  "{module} faz parte do Premium. Ativa primeiro uma chave para o servidor e depois ativa o módulo.",
  "{module} hoort bij Premium. Activeer eerst een sleutel voor je server en zet de module daarna aan.",
  "{module} Premium'a dahildir. Önce sunucun için bir anahtar etkinleştir, sonra modülü aç.")
r("s3t", "Set it up", "Configurează modulul", "Configure le module", "Configura il modulo", "Richte das Modul ein", "Configura el módulo", "Configura o módulo", "Stel de module in", "Modülü ayarla")
r("s3d", "Choose what you need and save. Changes reach the bot instantly. You can set:",
  "Alege ce ai nevoie și salvează. Modificările ajung instant la bot. Poți seta:",
  "Choisis ce dont tu as besoin puis enregistre. Les changements arrivent instantanément au bot. Tu peux régler :",
  "Scegli ciò che ti serve e salva. Le modifiche arrivano subito al bot. Puoi impostare:",
  "Wähle, was du brauchst, und speichere. Änderungen kommen sofort beim Bot an. Du kannst festlegen:",
  "Elige lo que necesites y guarda. Los cambios llegan al bot al instante. Puedes ajustar:",
  "Escolhe o que precisas e guarda. As alterações chegam ao bot de imediato. Podes definir:",
  "Kies wat je nodig hebt en sla op. Wijzigingen komen direct bij de bot aan. Je kunt instellen:",
  "İhtiyacın olanı seç ve kaydet. Değişiklikler bota anında ulaşır. Şunları ayarlayabilirsin:")
r("quick", "A short Quick setup guides you through the first steps. You can skip it and open all settings.",
  "Un scurt ghid Configurare rapidă te duce prin primii pași. Îl poți sări și deschide toate setările.",
  "Une courte Configuration rapide te guide pour les premiers pas. Tu peux l'ignorer et ouvrir tous les réglages.",
  "Una breve Configurazione rapida ti guida nei primi passi. Puoi saltarla e aprire tutte le impostazioni.",
  "Eine kurze Schnelleinrichtung führt dich durch die ersten Schritte. Du kannst sie überspringen und alle Einstellungen öffnen.",
  "Una breve Configuración rápida te guía en los primeros pasos. Puedes omitirla y abrir todos los ajustes.",
  "Uma breve Configuração rápida guia-te nos primeiros passos. Podes ignorá-la e abrir todas as definições.",
  "Een korte Snelle installatie leidt je door de eerste stappen. Je kunt die overslaan en alle instellingen openen.",
  "Kısa bir Hızlı kurulum ilk adımlarda sana rehberlik eder. Atlayıp tüm ayarları açabilirsin.")
r("s4t", "Use it in Discord", "Folosește comenzile în Discord", "Utilise les commandes dans Discord", "Usa i comandi su Discord", "Nutze die Befehle in Discord", "Usa los comandos en Discord", "Usa os comandos no Discord", "Gebruik de commando's in Discord", "Komutları Discord'da kullan")
r("s4d", "These commands are ready for you and your members:", "Aceste comenzi sunt gata pentru tine și membrii tăi:", "Ces commandes sont prêtes pour toi et tes membres :", "Questi comandi sono pronti per te e i tuoi membri:", "Diese Befehle stehen dir und deinen Mitgliedern bereit:", "Estos comandos están listos para ti y tus miembros:", "Estes comandos estão prontos para ti e os teus membros:", "Deze commando's staan klaar voor jou en je leden:", "Bu komutlar sen ve üyelerin için hazır:")
r("s5t", "Check that it works", "Verifică dacă funcționează", "Vérifie que ça fonctionne", "Verifica che funzioni", "Prüfe, ob es funktioniert", "Comprueba que funciona", "Confirma que funciona", "Controleer of het werkt", "Çalıştığını kontrol et")
r("s5d", "Try it in your server. If something is missing, Wody tells you exactly what, for example a permission, and the Error Log in the dashboard shows it. You can come back and change anything at any time.",
  "Încearcă-l pe server. Dacă lipsește ceva, Wody îți spune exact ce, de exemplu o permisiune, iar Error Log din dashboard arată același lucru. Poți reveni oricând să schimbi orice.",
  "Essaie-le sur ton serveur. S'il manque quelque chose, par exemple une permission, Wody te dit exactement quoi et le journal d'erreurs du tableau de bord l'affiche. Tu peux revenir modifier ce que tu veux à tout moment.",
  "Provalo nel tuo server. Se manca qualcosa, per esempio un permesso, Wody ti dice esattamente cosa e il registro errori della dashboard lo mostra. Puoi tornare a cambiare tutto quando vuoi.",
  "Probiere es auf deinem Server aus. Fehlt etwas, etwa eine Berechtigung, sagt Wody dir genau, was, und das Fehlerprotokoll im Dashboard zeigt es an. Du kannst jederzeit zurückkommen und alles ändern.",
  "Pruébalo en tu servidor. Si falta algo, por ejemplo un permiso, Wody te dice exactamente qué y el registro de errores del panel lo muestra. Puedes volver y cambiar lo que quieras cuando quieras.",
  "Experimenta no teu servidor. Se faltar alguma coisa, por exemplo uma permissão, o Wody diz-te exatamente o quê e o registo de erros do painel mostra o mesmo. Podes voltar e mudar o que quiseres a qualquer momento.",
  "Probeer het uit op je server. Ontbreekt er iets, bijvoorbeeld een permissie, dan zegt Wody precies wat en toont het foutlogboek in het dashboard het ook. Je kunt altijd terugkomen om iets te wijzigen.",
  "Sunucunda dene. Bir şey eksikse, örneğin bir izin, Wody tam olarak neyin eksik olduğunu söyler ve paneldeki hata günlüğü de bunu gösterir. İstediğin zaman dönüp her şeyi değiştirebilirsin.")

# Modules without a dashboard panel of their own: custom middle steps.
r("pools.at", "Start a pool", "Pornește un sondaj", "Lance un sondage", "Avvia un sondaggio", "Starte eine Umfrage", "Inicia una encuesta", "Inicia uma sondagem", "Start een poll", "Anket başlat")
r("pools.ad", "In the channel where members should vote, run /pool create. Write the question, add 2 to 10 options separated by | and set how long it stays open, for example 2h or 1d. You can also allow several answers or hide live results.",
  "În canalul unde membrii votează, rulează /pool create. Scrie întrebarea, adaugă între 2 și 10 opțiuni separate prin | și alege cât rămâne deschis, de exemplu 2h sau 1d. Poți permite și mai multe răspunsuri sau ascunde rezultatele live.",
  "Dans le salon où les membres votent, lance /pool create. Écris la question, ajoute 2 à 10 options séparées par | et choisis la durée, par exemple 2h ou 1d. Tu peux aussi autoriser plusieurs réponses ou masquer les résultats en direct.",
  "Nel canale in cui i membri votano, usa /pool create. Scrivi la domanda, aggiungi da 2 a 10 opzioni separate da | e scegli la durata, per esempio 2h o 1d. Puoi anche consentire più risposte o nascondere i risultati live.",
  "Führe im Kanal, in dem abgestimmt werden soll, /pool create aus. Schreibe die Frage, füge 2 bis 10 Optionen getrennt durch | hinzu und lege die Dauer fest, zum Beispiel 2h oder 1d. Du kannst auch mehrere Antworten erlauben oder Live-Ergebnisse verbergen.",
  "En el canal donde votarán los miembros, usa /pool create. Escribe la pregunta, añade de 2 a 10 opciones separadas por | y elige cuánto dura, por ejemplo 2h o 1d. También puedes permitir varias respuestas u ocultar los resultados en directo.",
  "No canal onde os membros vão votar, usa /pool create. Escreve a pergunta, adiciona 2 a 10 opções separadas por | e define a duração, por exemplo 2h ou 1d. Também podes permitir várias respostas ou esconder os resultados em direto.",
  "Gebruik /pool create in het kanaal waar leden stemmen. Schrijf de vraag, voeg 2 tot 10 opties toe gescheiden door | en kies hoe lang de poll open blijft, bijvoorbeeld 2h of 1d. Je kunt ook meerdere antwoorden toestaan of live resultaten verbergen.",
  "Üyelerin oy vereceği kanalda /pool create komutunu çalıştır. Soruyu yaz, | ile ayrılmış 2 ila 10 seçenek ekle ve ne kadar açık kalacağını belirle, örneğin 2h veya 1d. Birden fazla yanıta izin verebilir veya canlı sonuçları gizleyebilirsin.")
r("pools.bt", "Close it and read the results", "Închide-l și citește rezultatele", "Clôture-le et lis les résultats", "Chiudilo e leggi i risultati", "Beende sie und lies die Ergebnisse", "Ciérrala y lee los resultados", "Encerra-a e lê os resultados", "Sluit af en bekijk de resultaten", "Kapat ve sonuçları gör")
r("pools.bd", "It closes by itself when the time is up. To end it earlier use /pool end with the ID of the poll message. /pool results shows the numbers and /pool list shows the active pools.",
  "Se închide singur când expiră timpul. Ca să-l închizi mai devreme, folosește /pool end cu ID-ul mesajului sondajului. /pool results arată cifrele, iar /pool list arată sondajele active.",
  "Il se ferme tout seul à la fin du temps. Pour le clore plus tôt, utilise /pool end avec l'ID du message du sondage. /pool results affiche les chiffres et /pool list les sondages actifs.",
  "Si chiude da solo allo scadere del tempo. Per chiuderlo prima usa /pool end con l'ID del messaggio del sondaggio. /pool results mostra i numeri e /pool list i sondaggi attivi.",
  "Sie endet von selbst, wenn die Zeit abläuft. Früher beendest du sie mit /pool end und der ID der Umfragenachricht. /pool results zeigt die Zahlen und /pool list die aktiven Umfragen.",
  "Se cierra sola al acabarse el tiempo. Para cerrarla antes usa /pool end con el ID del mensaje de la encuesta. /pool results muestra las cifras y /pool list las encuestas activas.",
  "Fecha sozinha quando o tempo acaba. Para encerrar mais cedo usa /pool end com o ID da mensagem da sondagem. /pool results mostra os números e /pool list mostra as sondagens ativas.",
  "De poll sluit vanzelf als de tijd om is. Wil je eerder stoppen, gebruik dan /pool end met het ID van het pollbericht. /pool results toont de cijfers en /pool list de actieve polls.",
  "Süre dolunca kendiliğinden kapanır. Daha erken kapatmak için anket mesajının kimliğiyle /pool end kullan. /pool results rakamları, /pool list ise etkin anketleri gösterir.")
r("bump.at", "Publish your server profile", "Publică profilul serverului", "Publie le profil de ton serveur", "Pubblica il profilo del server", "Veröffentliche das Serverprofil", "Publica el perfil de tu servidor", "Publica o perfil do servidor", "Publiceer het serverprofiel", "Sunucu profilini yayınla")
r("bump.ad", "Open Community Discovery in the dashboard, fill in the description, category, tags and languages, and submit the profile. A person on the Wody team reviews it before it goes live.",
  "Deschide Community Discovery în dashboard, completează descrierea, categoria, etichetele și limbile și trimite profilul. O persoană din echipa Wody îl verifică înainte să fie publicat.",
  "Ouvre Community Discovery dans le tableau de bord, remplis la description, la catégorie, les tags et les langues, puis envoie le profil. Une personne de l'équipe Wody le vérifie avant sa mise en ligne.",
  "Apri Community Discovery nella dashboard, compila descrizione, categoria, tag e lingue e invia il profilo. Una persona del team Wody lo controlla prima della pubblicazione.",
  "Öffne Community Discovery im Dashboard, fülle Beschreibung, Kategorie, Tags und Sprachen aus und sende das Profil ab. Eine Person aus dem Wody-Team prüft es, bevor es online geht.",
  "Abre Community Discovery en el panel, rellena la descripción, la categoría, las etiquetas y los idiomas, y envía el perfil. Una persona del equipo de Wody lo revisa antes de publicarlo.",
  "Abre o Community Discovery no painel, preenche a descrição, a categoria, as etiquetas e os idiomas e envia o perfil. Uma pessoa da equipa do Wody revê-o antes de ser publicado.",
  "Open Community Discovery in het dashboard, vul beschrijving, categorie, tags en talen in en dien het profiel in. Een persoon van het Wody-team controleert het voordat het live gaat.",
  "Panelde Community Discovery'yi aç, açıklamayı, kategoriyi, etiketleri ve dilleri doldur ve profili gönder. Yayına girmeden önce Wody ekibinden biri onu inceler.")
r("bump.bt", "Bump your server", "Dă bump serverului", "Fais remonter ton serveur", "Fai il bump del server", "Bumpe deinen Server", "Haz bump a tu servidor", "Faz bump ao servidor", "Bump je server", "Sunucunu bump'la")
r("bump.bd", "Run /bump in your server to move it up in Recently bumped. Free servers can bump every 2 hours, Premium servers every 30 minutes.",
  "Rulează /bump pe server ca să urci în Recently bumped. Serverele gratuite pot da bump la 2 ore, cele Premium la 30 de minute.",
  "Lance /bump sur ton serveur pour monter dans Recently bumped. Les serveurs gratuits peuvent faire un bump toutes les 2 heures, les serveurs Premium toutes les 30 minutes.",
  "Usa /bump nel tuo server per salire in Recently bumped. I server gratuiti possono fare bump ogni 2 ore, quelli Premium ogni 30 minuti.",
  "Führe /bump auf deinem Server aus, um in Recently bumped aufzusteigen. Kostenlose Server können alle 2 Stunden bumpen, Premium-Server alle 30 Minuten.",
  "Usa /bump en tu servidor para subir en Recently bumped. Los servidores gratuitos pueden hacer bump cada 2 horas y los Premium cada 30 minutos.",
  "Usa /bump no teu servidor para subir em Recently bumped. Os servidores gratuitos podem fazer bump a cada 2 horas e os Premium a cada 30 minutos.",
  "Gebruik /bump op je server om hoger te komen in Recently bumped. Gratis servers kunnen elke 2 uur bumpen, Premium-servers elke 30 minuten.",
  "Recently bumped listesinde yükselmek için sunucunda /bump kullan. Ücretsiz sunucular 2 saatte bir, Premium sunucular 30 dakikada bir bump yapabilir.")
