// New Wody systems show only Wody custom emoji (drawn from icon names). Owner-typed texts may not contain Unicode emoji or pictographs.
const PICTO = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;
export const stripPictographs = (s) => String(s ?? '').replace(PICTO, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
export const hasPictograph = (s) => new RegExp(PICTO.source, 'u').test(String(s ?? ''));
