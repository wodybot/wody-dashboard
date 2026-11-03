"""Card font picker (Welcome, Goodbye, Level cards)."""
LANGS = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"]
P = "cardFonts."
ROWS = {
 P + "label": ["Font", "Font", "Police", "Font", "Schriftart", "Fuente", "Fonte", "Lettertype", "Yazı tipi"],
 P + "classic": ["Classic (default)", "Clasic (implicit)", "Classique (par défaut)", "Classico (predefinito)", "Klassisch (Standard)", "Clásica (predeterminada)", "Clássica (predefinida)", "Klassiek (standaard)", "Klasik (varsayılan)"],
 P + "classicBold": ["Classic bold", "Clasic îngroșat", "Classique gras", "Classico grassetto", "Klassisch fett", "Clásica en negrita", "Clássica em negrito", "Klassiek vet", "Klasik kalın"],
 P + "hint": [
  "Used for the text drawn on the card image. Names with special characters are supported.",
  "Folosit pentru textul desenat pe imaginea cardului. Numele cu diacritice sunt suportate.",
  "Utilisée pour le texte dessiné sur l'image de la carte. Les noms avec caractères spéciaux sont pris en charge.",
  "Usato per il testo disegnato sull'immagine della card. I nomi con caratteri speciali sono supportati.",
  "Wird für den Text im Kartenbild verwendet. Namen mit Sonderzeichen werden unterstützt.",
  "Se usa para el texto dibujado en la imagen de la tarjeta. Se admiten nombres con caracteres especiales.",
  "Usada para o texto desenhado na imagem do cartão. Nomes com caracteres especiais são suportados.",
  "Gebruikt voor de tekst op de kaartafbeelding. Namen met speciale tekens worden ondersteund.",
  "Kart görselindeki metin için kullanılır. Özel karakterli adlar desteklenir.",
 ],
}
