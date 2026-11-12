# NOTES — 더스트폴 한글화 진행 기록

## 원작
- 저장소 https://github.com/webKing021/dustfall · 기준 커밋 `9e03e817a54d5296bdcd1207d46c7a8eb3270969` · 라이선스 파일 없음(README에 에셋 CC0 명시). LICENSE 추가 금지.
- Three.js 0.187 + Vite 8, 순수 JS. 원작에는 vite 설정 파일이 없음(→ `vite.config.js` 추가). 에셋 경로는 `import.meta.env.BASE_URL` 기반이라 `base './'` 로 하위 경로 배포 가능.
- 외부 요청: 없음(웹폰트·CDN·분석·Netlify 배지 코드 없음). 글꼴은 시스템 글꼴(Rockwell/Georgia 계열) → 한글 대체 체인 추가.

## 저장소 / 배포
- https://github.com/sigco3111/dustfall-ko (webKing021/dustfall 포크로 생성, 설명: 더스트폴 한글화 — 1887년 서부 오픈월드 (원작: webKing021/dustfall)). 라이브: https://sigco3111.github.io/dustfall-ko/ (Pages: main:/docs).
- 커밋은 웹 업로더로 폴더 단위(src · tools · 루트 · docs/bundle · docs · docs/assets · docs/assets/tex), 메시지 접두 `게임: `/`문서: `. 업로더가 파일명을 소문자로 바꿈 → `docs/assets/credits.txt`(원본은 `public/assets/CREDITS.txt` 그대로 유지).
- 빌드 산출물 갱신 시: `npm run build` 후 `docs/bundle/*`(해시 파일명 바뀜: 이전 파일 삭제 필요)와 `docs/index.html` 업로드.

## 작업 환경 메모
- npm 없음 → `curl https://registry.npmjs.org/npm/-/npm-10.9.2.tgz` 풀어서 `node package/bin/npm-cli.js ci`. 작업 사본 /tmp/w/dustfall(샌드박스). git 푸시 자격 증명 없음 → 웹 업로더 사용.
- 배포: `main:/docs` (Vite `outDir docs`, `assetsDir bundle`, `emptyOutDir false`, 해시 소문자 16진수). `docs/assets/`는 `public/assets/`의 복사본(빌드가 만듦).
- 빌드 `npm run build`, 검사 `npm test`(= tools/test-i18n.mjs + tools/check-i18n.mjs), 남은 문자열 목록 `node tools/check-i18n.mjs --list`.

## 구조
- `src/i18n.js` tx()/t(), 언어 저장(`dustfall.lang`), 조사 자동 처리(을(를) 등). `src/i18n-ko.js` 영어→한국어 사전(`{}` 슬롯 패턴 지원). 영어 원문이 키이므로 영어 모드는 사전 없이 그대로.
- 번역 지점(sink): `ui.toast/setPrompt/setObjective/banner/duel/dialogue(who,text,choices)/row()`가 `tx()`를 거침 → story.js 대사는 사전에 항목만 추가하면 번역됨(D2/D3).

## 용어집
Sorrel Basin 소렐 분지 · Marrow Creek 마로 크릭 · Hollow Camp 할로 캠프 · Finch Ranch 핀치 목장 · Vulture Gulch 벌처 협곡 · Thorne Rail Depot 쏜 철도 정거장 · Thorne Ranch 쏜 목장 · Dry Bones Mesa 드라이 본스 메사 · Sorrel Bridge 소렐 다리 · Gilded Mule 길디드 뮬 · Ash Riders 애시 라이더스 · Honour 명예 · Bounty/Warrant 현상금/수배장 · Satchel 배낭 · Journal 일지 · Focus 집중 · Stamina 스태미나 · Hunger 허기 · Posse 추격대 · Sheriff 보안관 · Livery Stable 마구간.
문체: UI는 명사형/해요체 혼용(버튼은 명사형), 안내문 "~하세요/~합니다", 서사 문장은 담담한 서술체("~다").

## 영어 문자열 인벤토리 (원본 기준, 대략)
| 파일 | 대략 개수 | 내용 | D1 상태 |
| --- | --- | --- | --- |
| ui.js (26 KB) | ~120 | 타이틀·메뉴·설정·조작법(21)·HUD·모달(상점/배낭/지도/일지/휴식/모닥불/블랙잭) | 번역 완료 |
| core.js | ~50 | 아이템 23(이름+설명), 무기 4, 명예 등급 5 | 번역 완료 |
| world.js | ~25 | 지명 8, 건물 간판 14(캔버스 텍스처), 날씨 | 지명·간판 완료 |
| player.js | ~20 | 프롬프트·낚시·말·장전 토스트 | 번역 완료 |
| actors.js | ~15 | 수배/매복/늑대/약탈/가죽 벗기기 토스트 | 번역 완료 (이벤트 NPC 대사·이름 D2 완료) |
| story.js (34 KB) | ~170 | 미션 6장(제목/목표/요약), 대사, 상점 문구, 현상금 이름·장소, 인사말 10, 인트로 | **D2 완료** |
| models.js / main.js / assets.js | ~0 | 사용자 노출 문자열 거의 없음 | 해당 없음 |
- 현재 `node tools/check-i18n.mjs` 출력(대략, 코드 조각 포함): story.js 161, ui.js 31(대부분 코드 조각), world.js 16(간판·셰이더 일부), actors.js 10, models/player 4.

## 완료 (D1)
- i18n 계층, 한글 글꼴 체인, 언어 전환(타이틀/일시정지), 타이틀 크레딧 줄, README(NOTICE), 빌드 설정, 검사 스크립트.
- 번역: 타이틀/메뉴/설정/조작법, HUD, 프롬프트, 알림, 상점·배낭·지도·일지·휴식·모닥불·블랙잭 UI, 아이템/무기/지명.

## 완료 (D2) — 스토리·퀘스트·간판·이름
- `src/i18n-ko.js` 에 약 220항목 추가(총 537): 장 제목·요약·목표(6장), NPC 대사·선택지, 인트로·엔딩, 현상금(수배장 패턴·죄목·장소 8방향·이름 패턴), 마을 사람 인사말 10, 결투 문구, 간판 14, 이벤트 NPC 대사.
- 코드 변경은 표시용 3곳뿐(게임 로직 불변): `story.js` 목표 제목 `tx()`, `ui.js` 일지의 장 제목 `tx()`, `world.js` 간판 텍스처에 `tx()`+한글 글꼴 체인.
- 마을 사람 이름("Abel Whitlow")과 현상금 이름("Cutter Maddox")은 영어로 생성·저장하고(세이브 호환) 표시할 때 `'Abel {}'`/`'Cutter {}'` 패턴 + 성(姓) 항목으로 번역.
- 검사 확장: `tools/check-i18n.mjs` 가 say()/N()/obj/title/recap/name/sign 및 pick([...]) 목록의 모든 문자열이 사전에 있는지 검사(스토리 키 235개). `tools/test-i18n.mjs` 30건.
- 인명 확정: Wren Calloway 렌 캘러웨이 · Tobias Finch 토바이어스 핀치(애칭 Tobe 토브) · June Finch 준 핀치 · Ada/Sheriff Brandt 에이다/브랜트 보안관 · Silas Thorne 사일러스 쏜 · Amos Calloway 에이머스 캘러웨이 · Rosalind Vane 로절린드 베인 · Mrs. Crane 크레인 부인 · Mr. Pruitt 프루잇 씨 · Hobb Kessler 홉 케슬러 · Dr. Imogen Hale 이모진 헤일 의사 · Ezra Pike 에즈라 파이크. 지명: Carrow City 캐로 시티 · Sorrel Flats 소렐 평원. 말 이름 Juniper 주니퍼 / Ember 엠버 / Marigold 메리골드. Deputy 부보안관 · Ash Rider 애시 라이더 · Thorne Gunhand 쏜의 총잡이.
- 말투 결정: 목표·안내 "~하세요/~합니다"; 서술(N) 담담한 "~다"; 렌(주인공)은 마을 어른에게 해요체, 쏜에게는 차가운 평어. 토바이어스·준: 반말(해체, 아끼는 어른이 아이에게). 브랜트 보안관: 하오체. 프루잇: 합쇼체(능글맞게). 쏜: 하게체. 마을 사람 인사말: 해요체. 금액 슬롯 뒤에는 조사를 붙이지 않는다(조사 자동 처리는 한글 뒤에서만 동작).
- 빌드: 번들 `index-6bd427f1.js` (이전 `index-93beb2d4.js` 삭제). `docs/assets/CREDITS.txt` 는 빌드가 만들지만 업로드하지 않음(소문자 `credits.txt` 가 이미 있음).
- 배포 확인(D2): 커밋 7건(게임 5 · 문서 2) 모두 한글 메시지. 사이트 파일 24개 200 OK, 이전 번들 404. 라이브 새 게임: 인트로 4줄·1장 목표·일지 모두 한국어, 콘솔 오류/경고 0건(in-page 훅).
- 커밋 순서(배포 유지): tools → src → docs/bundle(신규 번들 추가) → docs/index.html → 이전 번들 삭제 → README/NOTES. 웹 편집기·삭제 대화상자는 영어(또는 Copilot 제안) 메시지·설명이 미리 채워지므로 메시지를 바꾸고 설명을 비운다(설명란은 Backspace 키 이벤트에 windowsVirtualKeyCode 필요).

## 완료 (D3) — 보완·검사 확장·스크린샷
- 작업 사본: /mnt/workspace/dustfall-ko (Node 22 + 포터블 npm 10.9.2 → `node /tmp/npm/package/bin/npm-cli.js ci`). git 푸시 불가 → 웹 업로더/웹 편집기.
- 남은 영어 전수 점검: 소스의 모든 문자열 리터럴(주석 제외)을 토큰 단위로 훑어 사전에 없는 것을 찾음(`tools/check-i18n.mjs --list`의 새 스캐너). 리터럴은 모두 사전에 있었고, 실제 누락은 **실행 중 조합되는 문구** 7개: 가죽 벗기기 안내의 짐승 이름 `deer/wolf/rabbit/cow/horse`, 말 이름 `the mare`, `fists`(소문자 무기명). → `src/i18n-ko.js` 7항목 추가(총 544). 낚시·블랙잭·사냥 토스트는 D1/D2에서 이미 사전에 있어 변경 없음(확인만).
- 검사 확장: 사전 외에 조합 문구 268건(마을 사람/현상금 이름 조합, 가죽 벗기기, 말 이름, 소문자 무기·탄약, 물고기 이름, 아이템 사용)을 `tx()`에 통과시켜 영어가 남으면 실패. 단위 테스트 35건. 남은 영어 목록은 0.
- 빌드: 번들 `index-b003ba16.js` (이전 `index-6bd427f1.js` 삭제), CSS 불변 `index-b8b2f4bf.css`. 커밋 순서: tools → src → docs/bundle → docs/index.html → 이전 번들 삭제 → 스크린샷 → README → NOTES. 모두 한글 메시지, 설명란 비움.
- 웹 업로더: `upload/main/<폴더>` 에 파일을 올리고(CDP `DOM.setFileInputFiles`), 커밋 메시지 입력란에 포커스 후 전체 선택·삭제·입력, 설명란은 선택·삭제. 삭제 대화상자(React)는 `#commit-message-input`/`#commit-description-input`, 버튼은 JS `click()` (좌표 클릭은 반응하지 않았음). 새 폴더(`docs/screenshots`)도 같은 업로드 URL 로 생성됨.
- 스크린샷(README): 라이브 사이트를 1280×720 iframe(뷰포트가 1536×643이라 0.89배 축소 후 clip scale 로 캡처 → 1280×720 WebP q85)으로 6장: 01-title, 02-controls, 03-intro, 04-world, 05-journal, 06-satchel (각 40–82 KB). 상점·블랙잭은 마을까지 이동이 필요해 생략(배낭으로 대체). in-page 훅(console.error/warn, error, unhandledrejection) 기록 0건.
- 알려진 원작 동작: 일지의 통계 값이 0이면 숫자가 비어 보임(`row()`가 0을 거짓으로 취급).

## 남은 일
- 한글 줄바꿈·길이 확인(간판 글자 크기), 영어 모드 회귀 확인, 상점·블랙잭 화면 스크린샷 추가.
