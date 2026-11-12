// Tiny i18n layer. Source strings stay in English (they are the keys); `tx` looks them up in the Korean
// dictionary. Entries containing `{}` are patterns: each `{}` captures text that is itself translated and
// is inserted into the Korean value at `{0}`, `{1}` ... A trailing " ×N" (item counts) is kept as is.
import { KO } from './i18n-ko.js';

const KEY = 'dustfall.lang';
export const LANGS = ['ko', 'en'];
export let lang = 'ko';
try { const v = localStorage.getItem(KEY); if (LANGS.includes(v)) lang = v; } catch (e) { /* storage blocked */ }
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
  lang = l;
}

// Korean particles written as 을(를) / 이(가) / 은(는) / 과(와) / 으로(로) in the dictionary are resolved by the
// final consonant of the preceding Hangul syllable (left unchanged after Latin letters or digits).
const JOSA = { '을(를)': ['을', '를'], '이(가)': ['이', '가'], '은(는)': ['은', '는'], '과(와)': ['과', '와'], '으로(로)': ['으로', '로'] };
function josa(str) {
  return str.replace(/([가-힣])(을\(를\)|이\(가\)|은\(는\)|과\(와\)|으로\(로\))/g, (m, ch, j) => {
    const code = ch.charCodeAt(0) - 0xac00, jong = code % 28, [withJ, noJ] = JOSA[j];
    if (j === '으로(로)') return ch + (jong === 0 || jong === 8 ? noJ : withJ);
    return ch + (jong ? withJ : noJ);
  });
}

const exact = new Map(), pats = [];
for (const [k, v] of Object.entries(KO)) {
  if (!k.includes('{}')) { exact.set(k, v); continue; }
  const re = new RegExp('^' + k.split('{}').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$', 's');
  pats.push([re, v, k.replace(/\{\}/g, '').length]);
}
pats.sort((a, b) => b[2] - a[2]);

export function tx(s) {
  if (lang !== 'ko' || typeof s !== 'string' || !s) return s;
  return josa(tr(s));
}
function tr(s) {
  const hit = exact.get(s);
  if (hit !== undefined) return hit;
  const m = /^(.*?)( ×\d+)$/.exec(s);
  if (m) return tr(m[1]) + m[2];
  for (const [re, v] of pats) {
    const r = re.exec(s);
    if (r) return v.replace(/\{(\d+)\}/g, (_, i) => tr(r[+i + 1]));
  }
  return s;
}
export const t = tx;
