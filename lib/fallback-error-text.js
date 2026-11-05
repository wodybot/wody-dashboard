
export const FALLBACK_ERROR_TEXT = {
  "en": {
    "heading": "An error occurred",
    "text": "Something went wrong while loading this page. It's usually temporary, please try again.",
    "retry": "Retry"
  },
  "ro": {
    "heading": "A apărut o eroare",
    "text": "Ceva nu a mers bine la încărcarea paginii. De obicei este temporar, te rugăm să încerci din nou.",
    "retry": "Reîncearcă"
  },
  "fr": {
    "heading": "Une erreur est survenue",
    "text": "Un problème est survenu lors du chargement de cette page. C'est généralement temporaire, réessaie.",
    "retry": "Réessayer"
  },
  "it": {
    "heading": "Si è verificato un errore",
    "text": "Qualcosa è andato storto durante il caricamento della pagina. Di solito è temporaneo, riprova.",
    "retry": "Riprova"
  },
  "de": {
    "heading": "Ein Fehler ist aufgetreten",
    "text": "Beim Laden dieser Seite ist etwas schiefgelaufen. Das ist meist nur vorübergehend, bitte versuche es erneut.",
    "retry": "Erneut versuchen"
  },
  "es": {
    "heading": "Se produjo un error",
    "text": "Algo salió mal al cargar esta página. Suele ser temporal, inténtalo de nuevo.",
    "retry": "Reintentar"
  },
  "pt": {
    "heading": "Ocorreu um erro",
    "text": "Algo deu errado ao carregar esta página. Normalmente é temporário, tente novamente.",
    "retry": "Tentar novamente"
  },
  "nl": {
    "heading": "Er is een fout opgetreden",
    "text": "Er ging iets mis bij het laden van deze pagina. Meestal is dit tijdelijk, probeer het opnieuw.",
    "retry": "Opnieuw proberen"
  },
  "tr": {
    "heading": "Bir hata oluştu",
    "text": "Bu sayfa yüklenirken bir sorun oluştu. Genellikle geçicidir, lütfen tekrar dene.",
    "retry": "Tekrar dene"
  }
};

export function fallbackErrorLocale() {
  try {
    const first = String(window.location.pathname || '').split('/')[1] || '';
    return Object.prototype.hasOwnProperty.call(FALLBACK_ERROR_TEXT, first) ? first : 'en';
  } catch {
    return 'en';
  }
}
