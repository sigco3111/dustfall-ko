// Unit tests for src/i18n.js (Korean default, patterns, particles, English passthrough). Run: node tools/test-i18n.mjs
import assert from 'node:assert/strict';
globalThis.document = { documentElement: {} };
const { tx } = await import('../src/i18n.js');
const cases = [
  ['New Game', '새 게임'], ['Used Apple.', '사과를 사용했습니다.'], ['Used Pan-Fried Fish.', '팬에 구운 생선을 사용했습니다.'],
  ['Deer Pelt ×3', '사슴 가죽 ×3'], ['Bounty $12.00 · unpaid', '현상금 $12.00 · 미납'], ['Bounty $12.00', '현상금 $12.00'],
  ['Out of arrows.', '화살이 떨어졌습니다.'], ['Loaded 3/6 · spare 10', '장전 3/6 · 예비 10'], ['You landed a 3.4 lb bluegill!', '블루길을 낚았습니다! (3.4파운드)'],
  // D2 story
  ['Abel Whitlow', '아벨 휘틀로'], ['Amos Calloway', '에이머스 캘러웨이'], ['One-Eye Quade', '애꾸눈 쿼드'], ['Lucky Okafor', '행운아 오카포'],
  ['Warrant taken: Iron Dray. Marked on your map.', '수배장을 받았습니다: 강철 드레이. 지도에 표시했습니다.'],
  ['WANTED — Cutter Maddox. For stage robbery and arson. Last seen near the wilds northwest of town with armed company. Reward $55.00, dead or alive. — A. Brandt, Sheriff',
    '수배 — 칼잡이 매덕스. 죄목: 역마차 강도와 방화. 무장한 일당과 함께 마을 북서쪽 황야 부근에서 마지막으로 목격됨. 보상금 $55.00, 생사 불문. — 보안관 에이다 브랜트'],
  ['Last seen near Dry Bones Mesa. Reward $40.00.', '마지막 목격 장소: 드라이 본스 메사 부근. 보상금 $40.00.'],
  ['Bring in Preacher Pell, last seen near the wilds of town.', '설교자 펠을 잡아 오세요. 마지막 목격 장소는 마을 인근 황야 부근입니다.'],
  ['1 · Ashes on the Wind', '1 · Ashes on the Wind'], ['Ashes on the Wind', '바람에 날린 잿더미'],
  ['Juniper. That suits her. Now, there\'s an old line camp west of town, by the hollow. Nobody has used it since the drought, and it isn\'t on Thorne\'s maps.',
    '주니퍼. 잘 어울리는 이름이구나. 자, 마을 서쪽 골짜기 옆에 낡은 목장 야영지가 있다. 가뭄 뒤로는 아무도 쓰지 않고, 쏜의 지도에도 없지.'],
  ['How is Ember treating you? Feed her oats and she\'ll run till sundown.', '엠버는 잘 따르니? 귀리를 먹이면 해 질 때까지도 달릴 게다.'],
  ['Opal Yoder: "Rain is coming. My knee says so."', '오팔 요더: “비가 올 거예요. 무릎이 그러더라고요.”'],
  ['[E] Talk to Cyrus Mercer', '[E] 사이러스 머서에게 말 걸기'], ['[E] Mount Marigold    [B] Pat', '[E] 메리골드 타기    [B] 쓰다듬기'],
  ['FINCH\'S GENERAL STORE', '핀치 잡화점'], ['DR. HALE  PHYSICIAN', '헤일 의원'],
  ['Ah. I have a wire here with your description on it. $12.00 would make it disappear, all quite legal.', '아. 여기 당신 인상착의가 적힌 전보가 있습니다. $12.00 정도면 없던 일로 해 드리지요. 아주 합법적으로요.'],
  ['"God keep you, friend."', '“하느님이 당신을 지켜 주시길, 친구.”'],
  ['[E] Skin deer', '[E] 사슴 가죽 벗기기'], ['[E] Skin cow', '[E] 소 가죽 벗기기'], ['[E] Mount the mare    [B] Pat', '[E] 암말 타기    [B] 쓰다듬기'],
  ['the mare is too far away.', '암말은 너무 멀리 있습니다.'], ["You don't own a fists yet.", '아직 맨주먹이 없습니다.'],
  ['Untranslated line stays.', 'Untranslated line stays.'], ['', ''],
];
for (const [a, b] of cases) assert.equal(tx(a), b, a);
console.log(`i18n tests passed (${cases.length} cases).`);
