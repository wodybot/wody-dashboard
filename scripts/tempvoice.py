import sys
sys.path.insert(0, "/home/claude/work/wody-dashboard/scripts")
from merge import merge_panel

data = {
"en": {
"title": "Temporary Voice",
"description": "Join the hub channel to get your own private voice channel. It deletes itself once everyone leaves.",
"hubInfo": "The hub (join-to-create) voice channel is easiest to set directly in Discord with <code>/tempvoice-setup</code> since Discord's picker lists voice channels natively there. You can set (or change) the target category here.",
"categoryLabel": "Temp voice category",
"categoryHint": "New private channels are created inside this category.",
},
"ro": {
"title": "Voce temporară",
"description": "Alătură-te canalului hub pentru a obține propriul tău canal de voce privat. Se șterge automat când toată lumea pleacă.",
"hubInfo": "Canalul de voce hub (join-to-create) este cel mai ușor de configurat direct în Discord cu <code>/tempvoice-setup</code>, deoarece selectorul Discord listează canalele de voce nativ acolo. Poți seta (sau schimba) categoria țintă aici.",
"categoryLabel": "Categorie voce temporară",
"categoryHint": "Noile canale private sunt create în interiorul acestei categorii.",
},
"fr": {
"title": "Vocal temporaire",
"description": "Rejoignez le salon central pour obtenir votre propre salon vocal privé. Il se supprime automatiquement une fois que tout le monde le quitte.",
"hubInfo": "Le salon vocal central (rejoindre pour créer) est plus simple à configurer directement dans Discord avec <code>/tempvoice-setup</code>, car le sélecteur de Discord y liste nativement les salons vocaux. Vous pouvez définir (ou changer) la catégorie cible ici.",
"categoryLabel": "Catégorie vocal temporaire",
"categoryHint": "Les nouveaux salons privés sont créés à l'intérieur de cette catégorie.",
},
"de": {
"title": "Temporärer Sprachkanal",
"description": "Tritt dem Hub-Kanal bei, um deinen eigenen privaten Sprachkanal zu erhalten. Er löscht sich selbst, sobald alle ihn verlassen haben.",
"hubInfo": "Der Hub-Sprachkanal (Beitreten-zum-Erstellen) lässt sich am einfachsten direkt in Discord mit <code>/tempvoice-setup</code> einrichten, da Discords Auswahl dort Sprachkanäle nativ auflistet. Die Zielkategorie kannst du hier festlegen (oder ändern).",
"categoryLabel": "Kategorie für temporären Sprachkanal",
"categoryHint": "Neue private Kanäle werden innerhalb dieser Kategorie erstellt.",
},
"es": {
"title": "Voz temporal",
"description": "Únete al canal central para obtener tu propio canal de voz privado. Se elimina solo cuando todos lo abandonan.",
"hubInfo": "El canal de voz central (unirse para crear) es más fácil de configurar directamente en Discord con <code>/tempvoice-setup</code>, ya que el selector de Discord lista los canales de voz de forma nativa allí. Puedes establecer (o cambiar) la categoría de destino aquí.",
"categoryLabel": "Categoría de voz temporal",
"categoryHint": "Los nuevos canales privados se crean dentro de esta categoría.",
},
"it": {
"title": "Voce temporanea",
"description": "Unisciti al canale hub per ottenere il tuo canale vocale privato. Si elimina automaticamente quando tutti lo abbandonano.",
"hubInfo": "Il canale vocale hub (entra-per-creare) è più semplice da impostare direttamente su Discord con <code>/tempvoice-setup</code>, poiché il selettore di Discord elenca nativamente i canali vocali lì. Puoi impostare (o cambiare) la categoria di destinazione qui.",
"categoryLabel": "Categoria voce temporanea",
"categoryHint": "I nuovi canali privati vengono creati all'interno di questa categoria.",
},
"pt": {
"title": "Voz temporária",
"description": "Entre no canal hub para obter seu próprio canal de voz privado. Ele se apaga sozinho assim que todos saem.",
"hubInfo": "O canal de voz hub (entrar-para-criar) é mais fácil de configurar diretamente no Discord com <code>/tempvoice-setup</code>, já que o seletor do Discord lista os canais de voz nativamente lá. Você pode definir (ou alterar) a categoria de destino aqui.",
"categoryLabel": "Categoria de voz temporária",
"categoryHint": "Novos canais privados são criados dentro desta categoria.",
},
"nl": {
"title": "Tijdelijke spraak",
"description": "Word lid van het hub-kanaal om je eigen privé-spraakkanaal te krijgen. Het verwijdert zichzelf zodra iedereen vertrekt.",
"hubInfo": "Het hub-spraakkanaal (deelnemen-om-aan-te-maken) stel je het makkelijkst rechtstreeks in Discord in met <code>/tempvoice-setup</code>, aangezien Discords kiezer daar spraakkanalen native weergeeft. Je kunt de doelcategorie hier instellen (of wijzigen).",
"categoryLabel": "Categorie tijdelijke spraak",
"categoryHint": "Nieuwe privékanalen worden binnen deze categorie aangemaakt.",
},
"tr": {
"title": "Geçici Ses",
"description": "Kendi özel ses kanalınızı almak için hub kanalına katılın. Herkes ayrıldığında kendini otomatik olarak siler.",
"hubInfo": "Hub (katıl-oluştur) ses kanalını doğrudan Discord'da <code>/tempvoice-setup</code> ile ayarlamak en kolayıdır, çünkü Discord'un seçicisi ses kanallarını orada yerel olarak listeler. Hedef kategoriyi burada ayarlayabilir veya değiştirebilirsiniz.",
"categoryLabel": "Geçici ses kategorisi",
"categoryHint": "Yeni özel kanallar bu kategori içinde oluşturulur.",
},
}

merge_panel("tempVoice", data)
