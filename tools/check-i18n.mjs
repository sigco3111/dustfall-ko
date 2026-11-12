// i18n check. Usage: node tools/check-i18n.mjs [--list]
//  1. every t('...') key in src/ exists in the Korean dictionary
//  2. dictionary sanity: {} slots in keys match {0}.. in values, values contain Hangul (or are symbol-only), no duplicate keys
//  3. prints remaining (untranslated) player-facing English strings per file; --list shows them
import { readFileSync, readdirSync } from 'node:fs';
import { KO } from '../src/i18n-ko.js';

const src = new URL('../src/', import.meta.url);
const files = readdirSync(src).filter((f) => f.endsWith('.js') && !f.startsWith('i18n'));
const errors = [];
const hangul = /[\u3131-\u318e\uac00-\ud7a3]/;
const keep = new Set(['Tab', 'F5', 'Esc']);

// 2. dictionary sanity
const dictSrc = readFileSync(new URL('i18n-ko.js', src), 'utf8');
const seen = new Set();
for (const m of dictSrc.matchAll(/^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"):/gm)) { void m; }
for (const [k, v] of Object.entries(KO)) {
  const slots = k.split('{}').length - 1;
  const used = new Set([...v.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]));
  if (slots !== used.size || [...used].some((i) => i >= slots)) errors.push(`slot mismatch: ${k} -> ${v}`);
  if (!hangul.test(v) && !keep.has(k) && !/^[\s\d\W]*$/.test(v) && !/^Language: /.test(k)) errors.push(`no Hangul in value: ${k} -> ${v}`);
  if (seen.has(k)) errors.push(`duplicate: ${k}`); seen.add(k);
}
const pats = Object.keys(KO).filter((k) => k.includes('{}')).map((k) => new RegExp('^' + k.split('{}').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?') + '$', 's'));
const covered = (s) => KO[s] !== undefined || pats.some((r) => r.test(s)) || (/ ×\d+$/.test(s) && covered(s.replace(/ ×\d+$/, '')));

// 1. t('...') keys and 3. remaining strings
const remaining = {};
let tKeys = 0;
for (const f of files) {
  const text = readFileSync(new URL(f, src), 'utf8');
  for (const m of text.matchAll(/\bt\((['"`])((?:\\.|(?!\1).)*)\1\)/gs)) {
    tKeys++;
    const key = m[2].replace(/\\'/g, "'").replace(/\$\{[^}]*\}/g, '{}');
    if (!covered(key)) errors.push(`${f}: missing Korean for t(${JSON.stringify(key)})`);
  }
  const lines = text.split('\n'); remaining[f] = [];
  lines.forEach((line, i) => {
    if (/^\s*(import|\/\/)|console\.|querySelector|classList|getElementById|className|style\./.test(line)) return;
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).){4,}?)\1/g)) {
      const raw = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      const s = raw.replace(/\$\{[^}]*\}/g, '{}');
      if (!/[A-Za-z]{3}/.test(s) || !/ /.test(s) || /^[#.\w-]+( [#.\w>-]+)*$/.test(s) && !/[A-Z]/.test(s[0])) continue;
      if (/^(M|L|<|#|\.|https?:|data:|rgba?\(|[a-z]+:)/.test(s) || /[=;]{1}/.test(s) && /<|px|rgb/.test(s)) continue;
      if (!covered(s) && !covered(s.replace(/\{\}/g, ''))) remaining[f].push(`${i + 1}: ${s.slice(0, 90)}`);
    }
  });
}
console.log(`dictionary: ${Object.keys(KO).length} entries, t() keys checked: ${tKeys}`);
console.log('remaining English-looking strings per file (approximate, includes non-UI strings):');
for (const f of files) console.log(`  ${f.padEnd(11)} ${remaining[f].length}`);
if (process.argv.includes('--list')) for (const f of files) for (const l of remaining[f]) console.log(`${f}:${l}`);
if (errors.length) { console.error(`\n${errors.length} problem(s):`); for (const e of errors) console.error('  ' + e); process.exit(1); }
console.log('i18n check passed.');
