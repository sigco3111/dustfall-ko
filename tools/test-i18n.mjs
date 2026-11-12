// Unit tests for src/i18n.js (Korean default, patterns, particles, English passthrough). Run: node tools/test-i18n.mjs
import assert from 'node:assert/strict';
globalThis.document = { documentElement: {} };
const { tx } = await import('../src/i18n.js');
const cases = [
  ['New Game', '새 게임'], ['Used Apple.', '사과를 사용했습니다.'], ['Used Pan-Fried Fish.', '팬에 구운 생선을 사용했습니다.'],
  ['Deer Pelt ×3', '사슴 가죽 ×3'], ['Bounty $12.00 · unpaid', '현상금 $12.00 · 미납'], ['Bounty $12.00', '현상금 $12.00'],
  ['Out of arrows.', '화살이 떨어졌습니다.'], ['Loaded 3/6 · spare 10', '장전 3/6 · 예비 10'], ['You landed a 3.4 lb bluegill!', '블루길을 낚았습니다! (3.4파운드)'],
  ['Untranslated line stays.', 'Untranslated line stays.'], ['', ''],
];
for (const [a, b] of cases) assert.equal(tx(a), b, a);
console.log(`i18n tests passed (${cases.length} cases).`);
