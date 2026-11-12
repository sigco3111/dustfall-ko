<p align="center">
  <img src="docs/logo.png" alt="Dustfall" width="620">
</p>

<p align="center">
  <b>더스트폴(Dustfall) 한글화</b> — 브라우저에서 즐기는 1887년 서부 오픈월드 게임<br>
  말을 달리고, 사냥하고, 낚시하고, 카드를 치고, 소렐 분지에서 오래된 빚을 청산하세요.
</p>

<p align="center">
  <a href="https://sigco3111.github.io/dustfall-ko/"><b>▶ 바로 플레이: https://sigco3111.github.io/dustfall-ko/</b></a>
</p>

## 안내 (NOTICE)

- **이 저장소는 비공식 한글화입니다.** 원작 게임은 **Dustfall**, 제작자는 **webKing021** 입니다.
  - 원작 저장소: <https://github.com/webKing021/dustfall> (원작 플레이: <https://dustfalls.netlify.app/>)
  - 한글화 기준 원작 커밋: `9e03e817a54d5296bdcd1207d46c7a8eb3270969`
- 한글화 시점에 원작 저장소에는 **라이선스 파일이 없습니다.** 이 저장소는 어떤 라이선스도 부여하지 않으며, 원작의 권리는 모두 원작자에게 있습니다. 이 저장소에 `LICENSE` 파일을 두지 않은 것도 같은 이유입니다.
- 원작 README가 밝힌 대로 모델·텍스처 등 서드파티 에셋은 CC0(퍼블릭 도메인)이며, 출처 표기는 아래 [크레딧](#크레딧)과 [`public/assets/CREDITS.txt`](public/assets/CREDITS.txt)에 원작 그대로 유지했습니다.
- 원작자 표기를 달아 공개하며, **권리자가 요청하면 즉시 내리겠습니다.** 요청은 이 저장소의 Issues 로 남겨 주세요.
- 원작은 “Built with Claude Fable 5.2” 로 만들어졌다고 밝히고 있습니다.

## 스크린샷

[라이브 사이트](https://sigco3111.github.io/dustfall-ko/)를 1280×720 에서 직접 캡처한 화면입니다 (한국어 모드).

<p align="center">
  <img src="docs/screenshots/01-title.webp" alt="타이틀 화면" width="720"><br>
  <sub>① 타이틀 화면 — 새 게임 · 이어하기 · 조작법 버튼, 한국어/English 전환 버튼, 하단의 한글화 크레딧 줄</sub>
</p>

<p align="center">
  <img src="docs/screenshots/02-controls.webp" alt="조작법 화면" width="720"><br>
  <sub>② 조작법 화면 — 이동·달리기·점프·상호작용·무기 선택 등 키 목록(Esc 일시정지까지)</sub>
</p>

<p align="center">
  <img src="docs/screenshots/03-intro.webp" alt="새 게임 인트로" width="720"><br>
  <sub>③ 새 게임 시작 직후의 인트로 대사 — “3주 전 캘러웨이 농장이 불탔다…”, 왼쪽 위 1장 목표, 오른쪽 위 소지금·시계·명예 표시</sub>
</p>

<p align="center">
  <img src="docs/screenshots/04-world.webp" alt="월드와 HUD" width="720"><br>
  <sub>④ 월드 화면 — 왼쪽 위 퀘스트 목표(“1 · 바람에 날린 잿더미”), 왼쪽 아래 미니맵과 생명력·스태미나·집중·허기 게이지, 오른쪽 아래 무기 표시(총집에 넣음)</sub>
</p>

<p align="center">
  <img src="docs/screenshots/05-journal.webp" alt="일지 화면" width="720"><br>
  <sub>⑤ 일지(J) — 지금까지의 이야기(진행 중인 장과 목표), 분지에서의 내 평판(명예·일차 등). 통계 값이 0인 항목은 원작처럼 숫자가 표시되지 않습니다.</sub>
</p>

<p align="center">
  <img src="docs/screenshots/06-satchel.webp" alt="배낭 화면" width="720"><br>
  <sub>⑥ 배낭(Tab) — 식량과 물품(리볼버 탄약, 사워도 빵), 무기(리볼버 장전 6/6), 상태(생명력·스태미나·집중·허기)</sub>
</p>

<sub>상점과 블랙잭 화면은 이번 캡처에 포함하지 못했습니다(클라우드 브라우저의 소프트웨어 WebGL 이 느려 마을까지 걸어가 플레이하지 않았기 때문입니다). 대신 배낭 화면을 담았습니다.</sub>

## 한글화 내용

원작 대비 바꾼 점 (게임 규칙·월드·에셋은 그대로):

- `src/i18n.js`, `src/i18n-ko.js` 추가: 영어 원문을 키로 쓰는 한국어 사전. 언어는 `localStorage`(`dustfall.lang`)에 저장되며 **기본값은 한국어**, 영어 원문도 그대로 남아 있습니다.
- 타이틀 화면의 `한국어 / English` 전환 버튼과 일시정지 메뉴의 언어 전환, 타이틀 화면 하단의 한글화 크레딧 줄.
- 번역한 범위(1차): 타이틀·메뉴·설정·조작법, HUD(생명력/스태미나/집중/허기, 시계, 명예, 현상금, 탄약), 상호작용 안내문, 알림 메시지, 배낭·지도·일지·휴식·모닥불·상점·블랙잭 화면, 아이템·무기·지명, 주요 알림/튜토리얼 힌트.
- 한글 글꼴 대체 목록(시스템 글꼴만 사용, 외부 요청 없음): 본문 `Pretendard`, `Noto Sans KR`, `Apple SD Gothic Neo`, `Malgun Gothic` / 제목체 `Noto Serif KR`, `Nanum Myeongjo` (기존 세리프 제목 스타일 유지). 한글 줄바꿈은 `word-break: keep-all`.
- `vite.config.js` 추가: GitHub Pages 배포용 빌드를 `docs/` 에 출력(`base './'`, 해시 파일명은 소문자 16진수).
- `tools/check-i18n.mjs`(번역 키 검사), `tools/test-i18n.mjs`(단위 테스트) 추가, `npm test` 로 실행.
- 번역한 범위(2차, D2): 스토리·퀘스트 전체(`src/story.js`: 장 제목·요약·목표, NPC 대사와 선택지, 인트로·엔딩, 현상금 수배장 문구·이름·장소, 마을 사람 인사말, 결투 문구), 건물 간판(캔버스 텍스처, 한글 글꼴 대체 목록 적용), 인물·NPC 이름, 이벤트 NPC(길 잃은 여행자) 대사. 인명 표기와 말투 결정은 [NOTES.md](NOTES.md)에 기록.
- 번역한 범위(3차, D3): 낚시·사냥·블랙잭 세부 문구와 실행 중에 조합되는 문구(가죽 벗기기 안내의 짐승 이름, 말 이름, 무기·탄약 이름이 들어가는 알림)를 마저 한글화하고, `tools/check-i18n.mjs` 가 조합 문구까지 검사하도록 확장했습니다. 코드의 소스 문자열 검사 기준으로 번역 누락은 없으며, 새로 발견되는 영어가 있으면 Issues 로 알려 주세요. 진행 기록은 [NOTES.md](NOTES.md).

## 직접 실행

[Node.js](https://nodejs.org) 20 이상이 필요합니다.

```bash
git clone https://github.com/sigco3111/dustfall-ko.git
cd dustfall-ko
npm install
npm run dev      # 개발 서버
npm run build    # docs/ 에 배포용 빌드
npm test         # 번역 사전 검사
```

## 조작법

| 키 | 동작 | 키 | 동작 |
| --- | --- | --- | --- |
| W A S D | 이동 / 말 조종 | 1 2 3 4 | 총집에 넣기, 리볼버, 소총, 활 |
| 마우스 | 시점 | 마우스 오른쪽 / 왼쪽 | 조준 / 발사 (총을 넣었으면 주먹질) |
| Shift / Ctrl | 달리기·질주 / 천천히 걷기 | R | 재장전 |
| Space / C | 점프 / 웅크리기 | Q | 집중 (시간 늦추기) |
| E | 대화·말 타기·약탈·가죽 벗기기·사용 | X | 빠르게 먹기·마시기 |
| H / B | 휘파람 / 말 쓰다듬기 | G | 조준한 상대 강탈 |
| Tab / M / J | 배낭 / 지도 / 일지 | F5 / Esc | 저장 / 일시정지 |

## 크레딧

원작 README의 크레딧을 그대로 옮깁니다 (The story, characters, map and code are original to the Dustfall project by webKing021. All third-party art is public domain (CC0)):

- Models and animations by [Quaternius](https://quaternius.com)
- Ground and wood textures from [Poly Haven](https://polyhaven.com)

The full list is in [`public/assets/CREDITS.txt`](public/assets/CREDITS.txt).

Open-source software this project depends on (installed through npm, not copied into the repo):

- [Three.js](https://github.com/mrdoob/three.js) (MIT) for rendering, model loading and animation
- [Vite](https://github.com/vitejs/vite) (MIT) as the dev server and bundler
- [Puppeteer](https://github.com/puppeteer/puppeteer) (Apache-2.0) for the test and screenshot scripts
- [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) and [glTF Transform](https://github.com/donmccurdy/glTF-Transform) were used once to convert and shrink the models

한글화: sigco3111 (비공식). 원작: [webKing021/dustfall](https://github.com/webKing021/dustfall).
