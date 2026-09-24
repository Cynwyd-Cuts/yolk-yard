import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { PROFANITY_TERMS } from './profanity-terms.js';

// One policy for outbound input, host admission and recipient display. Never log
// rejected input. This is a heuristic, not a claim to detect every possible PII.
export const CHAT_LIMIT = 180;
export const NAME_LIMIT = 18;
export const FILTER_VERSION = 3;
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const controls = /[\p{Cc}\p{Cf}\p{Cs}]/gu;
const lookalikes = Object.fromEntries([...'аеорсхуіјѕһԁԛαορνικτ'].map((c, i) => [c, 'aeopcxyijshdq aopvikt'.replace(/ /g, '')[i]]));
export function foldText(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(controls, '').replace(/[‘’]/g, "'").replace(/./gu, c => lookalikes[c] || c);
}
const foldLeet = text => text.replace(/[01345789@$!|]/g, c => ({0:'o',1:'i',3:'e',4:'a',5:'s',7:'t',8:'b',9:'g','@':'a','$':'s','!':'i','|':'i'})[c]);
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Literal matching preserves every supplied spelling, including punctuation.
// Flexible matching also catches separators, accents, invisible characters and
// leetspeak. Boundaries prevent short entries matching inside innocent words.
const importedLiteral = new RegExp(`(?:^|[^a-z0-9])(?:${[...new Set(PROFANITY_TERMS.map(foldText))].map(escapePattern).join('|')})(?=$|[^a-z0-9])`, 'i');
const importedCompact = [...new Set(PROFANITY_TERMS.map(term => foldLeet(foldText(term)).replace(/[^a-z0-9]/g, '')).filter(Boolean))];
const importedFlexible = new RegExp(`(?:^|[^a-z0-9])(?:${importedCompact.map(term => [...term].join('[^a-z0-9]*')).join('|')})(?=$|[^a-z0-9])`, 'i');
const numericWords = /\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/g;
const numberValue = { zero:'0', oh:'0', one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9' };
const privacyRules = [
  /@|\b(?:https?|ftp):|\bwww\s*[.\[]/i,
  /\b[a-z0-9][a-z0-9-]*\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[a-z]{2,24}\b/i,
  /\b[a-z0-9._+-]+\s+(?:at|\[at\]|\(at\))\s+[a-z0-9.-]+\s+(?:dot|\.)/i,
  /\b(?:gmail|yahoo|hotmail|outlook|icloud|protonmail|discord|snapchat|instagram|whatsapp|telegram|tiktok|facebook|facetime|skype|onlyfans)\b/i,
  /\b(?:e[ -]?mail|phone|mobile number|cell number|address|postcode|zip code|social security|ssn|password|passcode|credit card|debit card|bank account|routing number|login|ip address|date of birth|birthday|birthdate|real name|full name|last name|surname|first name|school name|home town|hometown)\b/i,
  /\b(?:my|your|his|her|our|their)\s+(?:age|school|college|university|street|city|town|location|number|snap|insta|handle|account|user\s*name)\b/i,
  /\b(?:i\s*(?:am|'m)|im)\s+(?:(?:only|just|almost)\s+)?\d{1,3}\b/i,
  /\b(?:i|we|he|she|they)\s+(?:live|lives|reside|resides|study|studies|work|works)\s+(?:in|at|on|near)\b/i,
  /\b(?:i\s*(?:am|'m)|im|we are|he is|she is|they are)\s+from\b/i,
  /\b(?:where\s+(?:do|does|are|is)|how old|what(?:'s| is)\s+(?:your|his|her)|send\s+(?:me|us)\s+(?:your|a)|call me|text me|dm me|message me|contact me|add me on|meet me|meet up|born in|born on|years old|year old|y\s*\/\s*o)\b/i,
  /\b\d{1,5}\s+(?:[a-z]+\s+){0,4}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|boulevard|blvd|way|place|pl|terrace|trail|circle)\b/i,
  /\b(?:elementary|middle|high|primary|secondary)\s+school\b|\b(?:university|college)\s+of\b/i,
  /\b(?:latitude|longitude|coordinates|postal|apartment|apt\s*#|p\.?\s*o\.?\s*box)\b/i,
];
// Additional family-friendly rules, including milder language and common
// harassment abbreviations not consistently covered by the upstream dataset.
const extraLanguage = /\b(?:damn(?:it)?|hell|crap|wtf|wth|stfu|gtfo|fml|lmao|lmfao|kys|idiot|moron|loser|retard\w*|nazi\w*|hitler|porn\w*|sext\w*|nudes?|boobs?|horny|suicide|pedo\w*|groom(?:er|ing)|dox(?:x|ing)?|mierda|puta|puto|joder|pendejo|cabron|merde|putain|salope|scheisse|scheiße|kurwa)\b/i;
const threats = /\b(?:kill|hurt|hate)\s+(?:you|yourself|urself)|\byou\s+(?:should|must|deserve to)\s+die\b/i;
function reasonFor(text) {
  const folded = foldText(text);
  const numbers = folded.replace(numericWords, w => numberValue[w] || '00');
  if (privacyRules.some(rule => rule.test(numbers)) ||
      /\d(?:[\s().,\-/]*\d){3}/.test(numbers) ||
      (numbers.match(/\d/g) || []).length >= 7) return 'privacy';
  const leet = foldLeet(folded);
  const unspaced=folded.replace(/[^a-z0-9]/g,'');
  if (importedLiteral.test(folded) || importedFlexible.test(leet) ||
      matcher.hasMatch(text) || matcher.hasMatch(folded) ||
      matcher.hasMatch(unspaced) || /\b[a-z]+[*#]+[a-z]+\b/.test(folded) ||
      extraLanguage.test(leet) || threats.test(leet) ||
      extraLanguage.test(leet.replace(/(?<=\b[a-z])[.\s_-](?=[a-z]\b)/g, ''))) return 'language';
  if (/[<>\\]|&#?\w+;|%[a-f0-9]{2}/i.test(text)) return 'format';
  // Unsupported scripts/symbol encodings fail closed; quick chat is always
  // available. Accented Latin letters and common apostrophes are supported.
  if (/[^\x20-\x7e\u2018\u2019\u201c\u201d\u2013\u2014\u2026]/.test(folded)) return 'format';
  // A name alone is not a private-detail disclosure. Do not guess identity or
  // location from named entities: names such as Paris can also be places.
  // The explicit contact, address and disclosure rules above still apply.
  return null;
}
const rejected = reason => ({ ok:false, text:'', reason });
export function moderateText(value, { kind = 'chat', previous = [] } = {}) {
  if (typeof value !== 'string' || value.length > (kind === 'name' ? 128 : CHAT_LIMIT)) return rejected('length');
  const text = value.normalize('NFKC').replace(controls, '').replace(/\s+/g, ' ').trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return rejected('empty');
  if (kind === 'name' && text.length > NAME_LIMIT) return rejected('length');
  try {
    const reason = reasonFor(text);
    if (reason) return rejected(reason);
    if (kind === 'name' && !/^[\p{Script=Latin}\d _-]+$/u.test(text)) return rejected('format');
    // Inspect the full submitted name before any shortening. No unsafe suffix
    // or email may disappear merely because the display is 18 characters long.
    if (previous.length) {
      const prior = previous.slice(-4).filter(s => typeof s === 'string' && s.length <= CHAT_LIMIT);
      if (prior.length && (reasonFor([...prior, text].join(' ')) || reasonFor([...prior, text].join('')))) return rejected('context');
    }
    return { ok:true, text, reason:null };
  } catch { return rejected('unavailable'); }
}
const nameCache = new Map();
export function safeName(value) {
  if (typeof value !== 'string' || value.length > 128) return 'Egg';
  if (nameCache.has(value)) return nameCache.get(value);
  const result = moderateText(value, {kind:'name'});
  if (!result.ok) return 'Egg';
  // Cache only approved strings. Snapshots reuse names at 20 Hz.
  if (nameCache.size >= 256) nameCache.delete(nameCache.keys().next().value);
  nameCache.set(result.text, result.text);
  return result.text;
}
export const SAFETY_MESSAGES = Object.freeze({
  privacy:'Not sent. Keep personal details, contact information and links private.',
  language:'Not sent. Please use friendly language.',
  context:'Not sent. This could share private details or bypass the safety filter.',
  format:'Not sent. Use plain English text, or choose a quick message.',
  length:`Use 1–${CHAT_LIMIT} characters.`,
  empty:'Write a message first.',
  unavailable:'Chat safety is unavailable. Try a quick message.',
  slow:'Slow down a little before sending again.',
  duplicate:'You already sent that. Give other eggs a turn.',
  muted:'The host has silenced your chat for this room.',
  cooldown:'Chat is cooling down after repeated blocked messages.',
  disabled:'The host has paused room chat.',
  channel:'Team chat is available to teammates in team modes.',
  disconnected:'Join a connected room to use chat.',
});
const systemCache = new Map();
export function safeSystemText(text, fallback = 'Game update') {
  if(systemCache.has(text))return systemCache.get(text);
  const result = moderateText(text);
  if(!result.ok)return fallback;
  if(systemCache.size>=256)systemCache.delete(systemCache.keys().next().value);
  systemCache.set(result.text,result.text);
  return result.text;
}
