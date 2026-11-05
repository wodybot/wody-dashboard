import { M } from './db.js';
import { NOTIF_GROUPS, NOTIF_CRITICAL, notifTab } from './constants.js';
import { getNotifPrefs } from './profile.js';

export const DM_TEXTS = {
  published: {
    en: 'Your request "{title}" is now live on the WODY Collab.', ro: 'Cererea ta "{title}" este acum publică în WODY Collab.', fr: 'Votre demande "{title}" est maintenant en ligne sur WODY Collab.', it: 'La tua richiesta "{title}" è ora online su WODY Collab.',
    de: 'Deine Anfrage "{title}" ist jetzt im WODY Collab sichtbar.', es: 'Tu solicitud "{title}" ya está publicada en WODY Collab.', pt: 'O teu pedido "{title}" já está publicado no WODY Collab.', nl: 'Je aanvraag "{title}" staat nu live op WODY Collab.', tr: '"{title}" talebin artık WODY Collab\'te yayında.',
  },
  held_review: {
    en: 'Your request "{title}" is being reviewed by the WODY team before it can be published. Requests must not contain prices, budgets or payment details.', ro: 'Cererea ta "{title}" este verificată de echipa WODY înainte de publicare. Cererile nu pot conține prețuri, bugete sau detalii de plată.', fr: 'Votre demande "{title}" est examinée par l\'équipe WODY avant publication. Les demandes ne doivent contenir ni prix, ni budgets, ni détails de paiement.', it: 'La tua richiesta "{title}" è in revisione dal team WODY prima della pubblicazione. Le richieste non devono contenere prezzi, budget o dati di pagamento.',
    de: 'Deine Anfrage "{title}" wird vom WODY-Team geprüft, bevor sie veröffentlicht wird. Anfragen dürfen keine Preise, Budgets oder Zahlungsdaten enthalten.', es: 'Tu solicitud "{title}" está siendo revisada por el equipo de WODY antes de publicarse. Las solicitudes no pueden incluir precios, presupuestos ni datos de pago.', pt: 'O teu pedido "{title}" está a ser revisto pela equipa WODY antes de ser publicado. Os pedidos não podem conter preços, orçamentos ou dados de pagamento.', nl: 'Je aanvraag "{title}" wordt door het WODY-team bekeken voordat ze gepubliceerd wordt. Aanvragen mogen geen prijzen, budgetten of betaalgegevens bevatten.', tr: '"{title}" talebin yayınlanmadan önce WODY ekibi tarafından inceleniyor. Talepler fiyat, bütçe veya ödeme bilgisi içermemelidir.',
  },
  held_server: {
    en: 'Your request "{title}" is waiting for approval from the owner of the server it belongs to.', ro: 'Cererea ta "{title}" așteaptă aprobarea proprietarului serverului de care aparține.', fr: 'Votre demande "{title}" attend l\'approbation du propriétaire du serveur concerné.', it: 'La tua richiesta "{title}" attende l\'approvazione del proprietario del server di appartenenza.',
    de: 'Deine Anfrage "{title}" wartet auf die Freigabe des Besitzers des zugehörigen Servers.', es: 'Tu solicitud "{title}" espera la aprobación del propietario del servidor al que pertenece.', pt: 'O teu pedido "{title}" aguarda aprovação do dono do servidor a que pertence.', nl: 'Je aanvraag "{title}" wacht op goedkeuring van de eigenaar van de bijbehorende server.', tr: '"{title}" talebin, ait olduğu sunucunun sahibinin onayını bekliyor.',
  },
  rejected: {
    en: 'NOT APPROVED: "{title}". Reason: {reason}', ro: 'NEAPROBAT: "{title}". Motiv: {reason}', fr: 'NON APPROUVÉ : "{title}". Motif : {reason}', it: 'NON APPROVATO: "{title}". Motivo: {reason}',
    de: 'NICHT FREIGEGEBEN: "{title}". Grund: {reason}', es: 'NO APROBADO: "{title}". Motivo: {reason}', pt: 'NÃO APROVADO: "{title}". Motivo: {reason}', nl: 'NIET GOEDGEKEURD: "{title}". Reden: {reason}', tr: 'ONAYLANMADI: "{title}". Neden: {reason}',
  },
  changes: {
    en: 'Changes are needed on your request "{title}": {reason}', ro: 'Cererea ta "{title}" necesită modificări: {reason}', fr: 'Des modifications sont nécessaires pour votre demande "{title}" : {reason}', it: 'La tua richiesta "{title}" richiede modifiche: {reason}',
    de: 'Deine Anfrage "{title}" muss angepasst werden: {reason}', es: 'Tu solicitud "{title}" necesita cambios: {reason}', pt: 'O teu pedido "{title}" precisa de alterações: {reason}', nl: 'Je aanvraag "{title}" heeft aanpassingen nodig: {reason}', tr: '"{title}" talebin için değişiklik gerekiyor: {reason}',
  },
  suspended: {
    en: 'Your request "{title}" was suspended and is no longer visible. Reason: {reason}', ro: 'Cererea ta "{title}" a fost suspendată și nu mai este vizibilă. Motiv: {reason}', fr: 'Votre demande "{title}" a été suspendue et n\'est plus visible. Motif : {reason}', it: 'La tua richiesta "{title}" è stata sospesa e non è più visibile. Motivo: {reason}',
    de: 'Deine Anfrage "{title}" wurde gesperrt und ist nicht mehr sichtbar. Grund: {reason}', es: 'Tu solicitud "{title}" fue suspendida y ya no es visible. Motivo: {reason}', pt: 'O teu pedido "{title}" foi suspenso e já não está visível. Motivo: {reason}', nl: 'Je aanvraag "{title}" is opgeschort en niet meer zichtbaar. Reden: {reason}', tr: '"{title}" talebin askıya alındı ve artık görünmüyor. Neden: {reason}',
  },
  application_new: {
    en: 'New application on your request "{title}".', ro: 'Aplicație nouă la cererea ta "{title}".', fr: 'Nouvelle candidature pour votre demande "{title}".', it: 'Nuova candidatura alla tua richiesta "{title}".',
    de: 'Neue Bewerbung auf deine Anfrage "{title}".', es: 'Nueva candidatura en tu solicitud "{title}".', pt: 'Nova candidatura ao teu pedido "{title}".', nl: 'Nieuwe reactie op je aanvraag "{title}".', tr: '"{title}" talebine yeni bir başvuru geldi.',
  },
  application_selected: {
    en: 'You were selected for the request "{title}". Check your Collab inbox.', ro: 'Ai fost ales pentru cererea "{title}". Verifică inbox-ul din Collab.', fr: 'Vous avez été choisi pour la demande "{title}". Consultez votre boîte Collab.', it: 'Sei stato scelto per la richiesta "{title}". Controlla la tua casella Collab.',
    de: 'Du wurdest für die Anfrage "{title}" ausgewählt. Sieh in deinem Collab-Postfach nach.', es: 'Has sido elegido para la solicitud "{title}". Revisa tu bandeja de Collab.', pt: 'Foste escolhido para o pedido "{title}". Vê a tua caixa do Collab.', nl: 'Je bent gekozen voor de aanvraag "{title}". Bekijk je Collab-inbox.', tr: '"{title}" talebi için seçildin. Collab gelen kutunu kontrol et.',
  },
  application_declined: {
    en: 'The author of "{title}" chose another candidate.', ro: 'Autorul cererii "{title}" a ales alt candidat.', fr: 'L\'auteur de "{title}" a choisi un autre candidat.', it: 'L\'autore di "{title}" ha scelto un altro candidato.',
    de: 'Der Autor von "{title}" hat sich für jemand anderen entschieden.', es: 'El autor de "{title}" eligió a otro candidato.', pt: 'O autor de "{title}" escolheu outro candidato.', nl: 'De auteur van "{title}" koos een andere kandidaat.', tr: '"{title}" talebinin sahibi başka bir adayı seçti.',
  },
  message_new: {
    en: 'New message about your request "{title}".', ro: 'Mesaj nou despre cererea ta "{title}".', fr: 'Nouveau message concernant votre demande "{title}".', it: 'Nuovo messaggio sulla tua richiesta "{title}".',
    de: 'Neue Nachricht zu deiner Anfrage "{title}".', es: 'Nuevo mensaje sobre tu solicitud "{title}".', pt: 'Nova mensagem sobre o teu pedido "{title}".', nl: 'Nieuw bericht over je aanvraag "{title}".', tr: '"{title}" talebin hakkında yeni bir mesaj var.',
  },
  expired: {
    en: "Your request \"{title}\" has expired and is now hidden. Reactivate it from your Dashboard within {reason} days, otherwise it will be deleted automatically.", ro: "Cererea ta \"{title}\" a expirat și este acum ascunsă. Reactiveaz-o din Dashboard în {reason} zile, altfel va fi ștearsă automat.", fr: "Votre demande \"{title}\" a expiré et est maintenant masquée. Réactivez-la depuis le Dashboard dans les {reason} jours, sinon elle sera supprimée automatiquement.", it: "La tua richiesta \"{title}\" è scaduta ed è ora nascosta. Riattivala dalla Dashboard entro {reason} giorni, altrimenti verrà eliminata automaticamente.",
    de: "Deine Anfrage \"{title}\" ist abgelaufen und jetzt ausgeblendet. Reaktiviere sie im Dashboard innerhalb von {reason} Tagen, sonst wird sie automatisch gelöscht.", es: "Tu solicitud \"{title}\" ha caducado y ahora está oculta. Reactívala desde el Dashboard en {reason} días o se eliminará automáticamente.", pt: "O teu pedido \"{title}\" expirou e está agora oculto. Reativa-o a partir do Dashboard em {reason} dias, ou será eliminado automaticamente.", nl: "Je aanvraag \"{title}\" is verlopen en nu verborgen. Heractiveer hem in het Dashboard binnen {reason} dagen, anders wordt hij automatisch verwijderd.", tr: "\"{title}\" talebin süresi doldu ve gizlendi. {reason} gün içinde Dashboard'dan yeniden etkinleştir, aksi halde otomatik olarak silinecek.",
  },
  expiring_soon: {
    en: "Your request \"{title}\" expires in {reason} days. Renew it from your Dashboard so it stays visible.", ro: "Cererea ta \"{title}\" expiră în {reason} zile. Reînnoiește-o din Dashboard ca să rămână vizibilă.", fr: "Votre demande \"{title}\" expire dans {reason} jours. Renouvelez-la depuis le Dashboard pour qu'elle reste visible.", it: "La tua richiesta \"{title}\" scade tra {reason} giorni. Rinnovala dalla Dashboard per mantenerla visibile.", de: "Deine Anfrage \"{title}\" läuft in {reason} Tagen ab. Verlängere sie im Dashboard, damit sie sichtbar bleibt.",
    es: "Tu solicitud \"{title}\" caduca en {reason} días. Renuévala desde el Dashboard para que siga visible.", pt: "O teu pedido \"{title}\" expira em {reason} dias. Renova-o a partir do Dashboard para continuar visível.", nl: "Je aanvraag \"{title}\" verloopt over {reason} dagen. Verleng hem in het Dashboard zodat hij zichtbaar blijft.", tr: "\"{title}\" talebinin süresi {reason} gün içinde doluyor. Görünür kalması için Dashboard'dan yenile.",
  },
  auto_removed: {
    en: "Your request \"{title}\" was not renewed and has been deleted automatically.", ro: "Cererea ta \"{title}\" nu a fost reactivată și a fost ștearsă automat.", fr: "Votre demande \"{title}\" n'a pas été renouvelée et a été supprimée automatiquement.", it: "La tua richiesta \"{title}\" non è stata rinnovata ed è stata eliminata automaticamente.",
    de: "Deine Anfrage \"{title}\" wurde nicht verlängert und automatisch gelöscht.", es: "Tu solicitud \"{title}\" no se renovó y se eliminó automáticamente.", pt: "O teu pedido \"{title}\" não foi renovado e foi eliminado automaticamente.", nl: "Je aanvraag \"{title}\" is niet verlengd en automatisch verwijderd.", tr: "\"{title}\" talebin yenilenmediği için otomatik olarak silindi.",
  },
  announce_channel: {
    en: "The WODY Collab announcement channel of {title} was changed by {reason}.", ro: "Canalul de anunțuri WODY Collab al serverului {title} a fost schimbat de {reason}.", fr: "Le salon d'annonces WODY Collab de {title} a été modifié par {reason}.",
    it: "Il canale degli annunci WODY Collab di {title} è stato cambiato da {reason}.", de: "Der WODY-Collab-Ankündigungskanal von {title} wurde von {reason} geändert.", es: "El canal de anuncios de WODY Collab de {title} fue cambiado por {reason}.",
    pt: "O canal de anúncios do WODY Collab de {title} foi alterado por {reason}.", nl: "Het WODY Collab-aankondigingskanaal van {title} is gewijzigd door {reason}.", tr: "{title} sunucusunun WODY Collab duyuru kanalı {reason} tarafından değiştirildi.",
  },
  announce_channel_off: {
    en: "WODY Collab announcements of {title} were turned off by {reason}.", ro: "Anunțurile WODY Collab ale serverului {title} au fost oprite de {reason}.", fr: "Les annonces WODY Collab de {title} ont été désactivées par {reason}.",
    it: "Gli annunci WODY Collab di {title} sono stati disattivati da {reason}.", de: "Die WODY-Collab-Ankündigungen von {title} wurden von {reason} ausgeschaltet.", es: "Los anuncios de WODY Collab de {title} fueron desactivados por {reason}.",
    pt: "Os anúncios do WODY Collab de {title} foram desativados por {reason}.", nl: "De WODY Collab-aankondigingen van {title} zijn uitgezet door {reason}.", tr: "{title} sunucusunun WODY Collab duyuruları {reason} tarafından kapatıldı.",
  },
};
const ACCESS_LABEL = { en: 'Access', ro: 'Accesează', fr: 'Accéder', it: 'Accedi', de: 'Öffnen', es: 'Acceder', pt: 'Aceder', nl: 'Openen', tr: 'Eriş' };
export const DM_TYPES = Object.keys(DM_TEXTS);

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f`@]/g, ' ').slice(0, n);
export function renderDm(type, locale, params = {}) {
  const row = DM_TEXTS[type];
  if (!row) return null;
  const text = row[locale] || row.en;
  const title = clean(params.title, 100).replace(/[*_~|>#\\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return text.replace('"{title}"', () => `**${title}**`).replace('{title}', () => `**${title}**`).replace('{reason}', () => clean(params.reason, 300));
}

let dmSender = async (userId, payload) => {
  const { sendDirectMessage } = await import('@/lib/discord');
  return sendDirectMessage(userId, payload);
};
export function setDmSender(fn) { dmSender = fn; }

const SITE = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export async function notifyUser(db, userId, type, params = {}) {
  const to = String(userId);
  const { prefs, locale: saved } = await getNotifPrefs(db, to);
  const locale = saved || 'en';
  const group = NOTIF_GROUPS[type];
  const groupOn = group ? prefs[group] !== false : true;
  const store = NOTIF_CRITICAL.has(type) || (prefs.inapp && groupOn);
  if (store) {
    try {
      await db.collection(M.notifications).insertOne({ to, type, params: { request_id: params.request_id ? String(params.request_id) : null, title: clean(params.title, 100), reason: clean(params.reason, 300) }, created_at: new Date(), read: false });
    } catch (e) { console.error('collab notification', e?.message); }
  }
  const text = renderDm(type, locale, params);
  if (!text || params.dm === false || !prefs.dm || !groupOn) return;
  try {
    const url = type === 'published' && params.request_id ? `${SITE()}/${locale}/collab/${String(params.request_id)}` : `${SITE()}/${locale}/profile?tab=${notifTab(type)}`;
    await dmSender(to, { content: `**WODY Collab**\n${text}`, allowed_mentions: { parse: [] }, components: [{ type: 1, components: [{ type: 2, style: 5, label: ACCESS_LABEL[locale] || ACCESS_LABEL.en, url }] }] });
  } catch { }
}
