"""Kick in Stream Notifications (Premium). Order: en ro fr it de es pt nl tr."""
P = "guildSettings."
ROWS = {}


def r(key, *v):
    assert len(v) == 9, key
    ROWS[P + key] = v


r("streams.description", "Announce live streams and new videos from Twitch, Kick and TikTok.",
  "Anunță live-urile și videoclipurile noi de pe Twitch, Kick și TikTok.",
  "Annonce les lives et les nouvelles vidéos de Twitch, Kick et TikTok.",
  "Annuncia dirette e nuovi video da Twitch, Kick e TikTok.",
  "Kündigt Livestreams und neue Videos von Twitch, Kick und TikTok an.",
  "Anuncia directos y vídeos nuevos de Twitch, Kick y TikTok.",
  "Anuncia diretos e vídeos novos da Twitch, Kick e TikTok.",
  "Kondigt livestreams en nieuwe video's van Twitch, Kick en TikTok aan.",
  "Twitch, Kick ve TikTok'taki canlı yayınları ve yeni videoları duyurur.")
r("streams.provider.kick.ok", "Kick is connected through the official Kick API.",
  "Kick este conectat prin API-ul oficial Kick.",
  "Kick est connecté via l'API officielle de Kick.",
  "Kick è collegato tramite l'API ufficiale di Kick.",
  "Kick ist über die offizielle Kick-API verbunden.",
  "Kick está conectado mediante la API oficial de Kick.",
  "O Kick está ligado através da API oficial do Kick.",
  "Kick is verbonden via de officiële Kick-API.",
  "Kick, resmi Kick API'si üzerinden bağlı.")
r("streams.list.emptyText.kick", "Add a Kick streamer to announce when they go live.",
  "Adaugă un streamer Kick ca să anunți când intră live.",
  "Ajoute un streamer Kick pour annoncer quand il passe en live.",
  "Aggiungi uno streamer Kick per annunciare quando va in diretta.",
  "Füge einen Kick-Streamer hinzu, um anzukündigen, wenn er live geht.",
  "Añade un streamer de Kick para anunciar cuando empiece directo.",
  "Adiciona um streamer da Kick para anunciar quando entrar em direto.",
  "Voeg een Kick-streamer toe om aan te kondigen wanneer die live gaat.",
  "Canlı yayına başladığında duyurmak için bir Kick yayıncısı ekle.")
r("streams.add.title.kick", "Add a Kick streamer", "Adaugă un streamer Kick", "Ajouter un streamer Kick", "Aggiungi uno streamer Kick",
  "Kick-Streamer hinzufügen", "Añadir un streamer de Kick", "Adicionar um streamer da Kick", "Kick-streamer toevoegen", "Kick yayıncısı ekle")
r("streams.add.text.kick", "Type the streamer and pick the channel where alerts go.",
  "Scrie streamerul și alege canalul unde merg alertele.",
  "Saisis le streamer et choisis le salon des alertes.",
  "Scrivi lo streamer e scegli il canale degli avvisi.",
  "Gib den Streamer ein und wähle den Kanal für die Alarme.",
  "Escribe el streamer y elige el canal de las alertas.",
  "Escreve o streamer e escolhe o canal dos alertas.",
  "Typ de streamer in en kies het kanaal voor de meldingen.",
  "Yayıncıyı yaz ve uyarıların gideceği kanalı seç.")
r("streams.add.kickHint", "Type the Kick username or paste the channel link.",
  "Scrie numele de utilizator Kick sau lipește linkul canalului.",
  "Saisis le nom d'utilisateur Kick ou colle le lien de la chaîne.",
  "Scrivi il nome utente Kick o incolla il link del canale.",
  "Gib den Kick-Benutzernamen ein oder füge den Kanallink ein.",
  "Escribe el usuario de Kick o pega el enlace del canal.",
  "Escreve o utilizador da Kick ou cola o link do canal.",
  "Typ de Kick-gebruikersnaam of plak de kanaallink.",
  "Kick kullanıcı adını yaz veya kanal bağlantısını yapıştır.")
r("streams.add.kickPlaceholder", "kick.com/username", "kick.com/utilizator", "kick.com/utilisateur", "kick.com/utente",
  "kick.com/benutzername", "kick.com/usuario", "kick.com/utilizador", "kick.com/gebruiker", "kick.com/kullanici")
r("streams.advanced.kickNote", "Kick alerts are found by checking the channel's live status at regular intervals through the official API.",
  "Alertele Kick se găsesc verificând la intervale regulate dacă canalul e live, prin API-ul oficial.",
  "Les alertes Kick sont détectées en vérifiant à intervalles réguliers si la chaîne est en live, via l'API officielle.",
  "Gli avvisi Kick si trovano controllando a intervalli regolari se il canale è in diretta, tramite l'API ufficiale.",
  "Kick-Alarme werden gefunden, indem der Live-Status des Kanals in regelmäßigen Abständen über die offizielle API geprüft wird.",
  "Las alertas de Kick se detectan comprobando a intervalos regulares si el canal está en directo, mediante la API oficial.",
  "Os alertas da Kick são encontrados verificando a intervalos regulares se o canal está em direto, através da API oficial.",
  "Kick-meldingen worden gevonden door met regelmatige tussenpozen via de officiële API te controleren of het kanaal live is.",
  "Kick uyarıları, kanalın canlı durumu resmi API üzerinden düzenli aralıklarla kontrol edilerek bulunur.")
r("kit.errors.invalid_kick_slug", "Enter a valid Kick username or channel link.",
  "Introdu un nume de utilizator Kick sau un link de canal valid.",
  "Saisis un nom d'utilisateur Kick ou un lien de chaîne valide.",
  "Inserisci un nome utente Kick o un link di canale valido.",
  "Gib einen gültigen Kick-Benutzernamen oder Kanallink ein.",
  "Introduce un usuario de Kick o un enlace de canal válido.",
  "Introduz um utilizador da Kick ou um link de canal válido.",
  "Voer een geldige Kick-gebruikersnaam of kanaallink in.",
  "Geçerli bir Kick kullanıcı adı veya kanal bağlantısı gir.")
r("kit.errors.kick_not_found", "No Kick channel was found with that name.",
  "Nu a fost găsit niciun canal Kick cu acest nume.",
  "Aucune chaîne Kick trouvée avec ce nom.",
  "Nessun canale Kick trovato con questo nome.",
  "Es wurde kein Kick-Kanal mit diesem Namen gefunden.",
  "No se encontró ningún canal de Kick con ese nombre.",
  "Não foi encontrado nenhum canal da Kick com esse nome.",
  "Er is geen Kick-kanaal met die naam gevonden.",
  "Bu adla bir Kick kanalı bulunamadı.")

r("kit.issues.kick_not_configured", "Kick is not set up on this bot yet. The bot owner has to add the Kick key.", "Kick nu este configurat încă pe acest bot. Proprietarul botului trebuie să adauge cheia Kick.", "Kick n'est pas encore configuré sur ce bot. Le propriétaire du bot doit ajouter la clé Kick.", "Kick non è ancora configurato su questo bot. Il proprietario del bot deve aggiungere la chiave Kick.", "Kick ist bei diesem Bot noch nicht eingerichtet. Der Bot-Besitzer muss den Kick-Schlüssel hinzufügen.", "Kick aún no está configurado en este bot. El propietario del bot debe añadir la clave de Kick.", "A Kick ainda não está configurada neste bot. O dono do bot tem de adicionar a chave da Kick.", "Kick is nog niet ingesteld op deze bot. De eigenaar van de bot moet de Kick-sleutel toevoegen.", "Kick bu botta henüz kurulmadı. Bot sahibinin Kick anahtarını eklemesi gerekiyor.")
