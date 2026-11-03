import { M } from './db.js';

export const DM_TEXTS = {
  published: {
    en: 'Your request "{title}" is now live on the WODY Marketplace.', ro: 'Cererea ta "{title}" este acum publică în WODY Marketplace.', fr: 'Votre demande "{title}" est maintenant en ligne sur WODY Marketplace.', it: 'La tua richiesta "{title}" è ora online su WODY Marketplace.',
    de: 'Deine Anfrage "{title}" ist jetzt im WODY Marketplace sichtbar.', es: 'Tu solicitud "{title}" ya está publicada en WODY Marketplace.', pt: 'O teu pedido "{title}" já está publicado no WODY Marketplace.', nl: 'Je aanvraag "{title}" staat nu live op WODY Marketplace.', tr: '"{title}" talebin artık WODY Marketplace\'te yayında.',
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
    en: 'Your request "{title}" was not approved. Reason: {reason}', ro: 'Cererea ta "{title}" nu a fost aprobată. Motiv: {reason}', fr: 'Votre demande "{title}" n\'a pas été approuvée. Motif : {reason}', it: 'La tua richiesta "{title}" non è stata approvata. Motivo: {reason}',
    de: 'Deine Anfrage "{title}" wurde nicht freigegeben. Grund: {reason}', es: 'Tu solicitud "{title}" no fue aprobada. Motivo: {reason}', pt: 'O teu pedido "{title}" não foi aprovado. Motivo: {reason}', nl: 'Je aanvraag "{title}" is niet goedgekeurd. Reden: {reason}', tr: '"{title}" talebin onaylanmadı. Neden: {reason}',
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
    en: 'You were selected for the request "{title}". Check your Marketplace inbox.', ro: 'Ai fost ales pentru cererea "{title}". Verifică inbox-ul din Marketplace.', fr: 'Vous avez été choisi pour la demande "{title}". Consultez votre boîte Marketplace.', it: 'Sei stato scelto per la richiesta "{title}". Controlla la tua casella Marketplace.',
    de: 'Du wurdest für die Anfrage "{title}" ausgewählt. Sieh in deinem Marketplace-Postfach nach.', es: 'Has sido elegido para la solicitud "{title}". Revisa tu bandeja de Marketplace.', pt: 'Foste escolhido para o pedido "{title}". Vê a tua caixa do Marketplace.', nl: 'Je bent gekozen voor de aanvraag "{title}". Bekijk je Marketplace-inbox.', tr: '"{title}" talebi için seçildin. Marketplace gelen kutunu kontrol et.',
  },
  application_declined: {
    en: 'The author of "{title}" chose another candidate.', ro: 'Autorul cererii "{title}" a ales alt candidat.', fr: 'L\'auteur de "{title}" a choisi un autre candidat.', it: 'L\'autore di "{title}" ha scelto un altro candidato.',
    de: 'Der Autor von "{title}" hat sich für jemand anderen entschieden.', es: 'El autor de "{title}" eligió a otro candidato.', pt: 'O autor de "{title}" escolheu outro candidato.', nl: 'De auteur van "{title}" koos een andere kandidaat.', tr: '"{title}" talebinin sahibi başka bir adayı seçti.',
  },
  message_new: {
    en: 'New message about your request "{title}".', ro: 'Mesaj nou despre cererea ta "{title}".', fr: 'Nouveau message concernant votre demande "{title}".', it: 'Nuovo messaggio sulla tua richiesta "{title}".',
    de: 'Neue Nachricht zu deiner Anfrage "{title}".', es: 'Nuevo mensaje sobre tu solicitud "{title}".', pt: 'Nova mensagem sobre o teu pedido "{title}".', nl: 'Nieuw bericht over je aanvraag "{title}".', tr: '"{title}" talebin hakkında yeni bir mesaj var.',
  },
};
export const DM_TYPES = Object.keys(DM_TEXTS);

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f`@]/g, ' ').slice(0, n);
export function renderDm(type, locale, params = {}) {
  const row = DM_TEXTS[type];
  if (!row) return null;
  const text = row[locale] || row.en;
  return text.replace('{title}', clean(params.title, 100)).replace('{reason}', clean(params.reason, 300));
}

let dmSender = async (userId, payload) => {
  const { sendDirectMessage } = await import('@/lib/discord');
  return sendDirectMessage(userId, payload);
};
export function setDmSender(fn) { dmSender = fn; }

const SITE = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

export async function notifyUser(db, userId, type, params = {}) {
  const to = String(userId);
  let locale = 'en';
  try {
    const prof = await db.collection(M.profiles).findOne({ user_id: to }, { projection: { locale: 1 } });
    if (prof?.locale) locale = prof.locale;
  } catch { }
  try {
    await db.collection(M.notifications).insertOne({ to, type, params: { request_id: params.request_id ? String(params.request_id) : null, title: clean(params.title, 100), reason: clean(params.reason, 300) }, created_at: new Date(), read: false });
  } catch (e) { console.error('marketplace notification', e?.message); }
  const text = renderDm(type, locale, params);
  if (!text || params.dm === false) return;
  try {
    await dmSender(to, { content: `${text}\n${SITE()}/${locale}/dashboard/marketplace`, allowed_mentions: { parse: [] } });
  } catch { }
}
