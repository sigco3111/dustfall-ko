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
| world.js | ~25 | 지명 8, 건물 간판 10(캔버스 텍스처), 날씨 | 지명 완료 / **간판 D2** |
| player.js | ~20 | 프롬프트·낚시·말·장전 토스트 | 번역 완료 |
| actors.js | ~15 | 수배/매복/늑대/약탈/가죽 벗기기 토스트 | 번역 완료 (이벤트 NPC 대사·이름 D2) |
| story.js (34 KB) | ~170 | 미션 6장(제목/목표/요약), 대사, 상점 문구, 현상금 이름·장소, 인사말 10, 인트로 | 상점·알림 일부만. **퀘스트/대사/현상금 D2·D3** |
| models.js / main.js / assets.js | ~0 | 사용자 노출 문자열 거의 없음 | 해당 없음 |
- 현재 `node tools/check-i18n.mjs` 출력(대략, 코드 조각 포함): story.js 161, ui.js 31(대부분 코드 조각), world.js 16(간판·셰이더 일부), actors.js 10, models/player 4.

## 완료 (D1)
- i18n 계층, 한글 글꼴 체인, 언어 전환(타이틀/일시정지), 타이틀 크레딧 줄, README(NOTICE), 빌드 설정, 검사 스크립트.
- 번역: 타이틀/메뉴/설정/조작법, HUD, 프롬프트, 알림, 상점·배낭·지도·일지·휴식·모닥불·블랙잭 UI, 아이템/무기/지명.

## 남은 일 (D2/D3)
- story.js: 인트로, 장별 목표·요약·대사·선택지, 현상금 이름/장소/문구, 인사말, 상점 대사 → 사전에 추가. 인물 이름 표기 확정(예: Calloway 캘러웨이, Thorne 쏜, Brandt 브랜트, Finch 핀치, Vane 베인, Crane 크레인, Pruitt 프루잇, Hale 헤일).
- world.js 건물 간판(캔버스에 그리는 글자: 한글 글꼴 확인), 낚시/사냥 세부 문구, 블랙잭 문구 점검.
