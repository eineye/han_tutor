# Han Tutor — working notes for Claude

Korean learning web app for teens abroad (React + Vite front end, Express API, Gemini).
Design: docs/DESIGN.md · Deployment: docs/DEPLOY.md · 앱(PWA·Android): docs/ANDROID.md

## 소통 언어 (소유자 요청)
- 소유자에게 보내는 모든 답변·보고·설명은 **한국어**로 작성한다. 영어 용어는 꼭 필요할 때만 괄호로 덧붙인다.
- 커밋 메시지, 문서(README, docs/), PR 설명도 한국어로 작성한다.
- 학생용 화면 문구는 대상(해외 학생)에 맞춰 영어+한국어 병기를 유지하고, 교사용 화면은 한국어로 둔다.

## Layout
- `server/core.js` — all API logic (framework-agnostic). Used by `server/index.js` (Express) and `src/demo/mockServer.ts` (browser demo). Change API behavior here only.
- `server/seed/` — curriculum, drama scenes and songs (`videos.js`; `kind`: drama/video/song — songs use ORIGINAL lyrics only, never real song lyrics). `curriculum.js` follows the table of contents and teaching flow of the class textbook (세종학당 한국어 입문; the PDF is not kept in the repo: 예비편 + 12과 + 연습 활용 1–5), but every example, explanation and quiz item is original — never copy text from the textbook or real dramas. `bonus.js` holds draft conversation lessons.
- `src/` — UI; `src/pages/admin/` — teacher screens (Korean UI).
- 자막·가사 추출기(교사용): `server/transcripts.js`(프롬프트·가져오기·내보내기 형식, 테스트 `server/tests/transcripts.test.js`), 화면 `src/pages/admin/AdminTranscripts.tsx`·`AdminTranscriptEditor.tsx`, 공용 타입 `src/lib/transcript.ts`.
- 학생 화면 언어 (한국어/English/नेपाली 네팔어): `src/i18n/`. 화면 문구는 `ui.ts`(키별 3개 언어), 교재·드라마 설명은 영어 원문을 키로 하는 `content.ne.json` / `content.ko.json`. 시드의 영어 문장을 추가·수정하면 두 사전에도 번역을 추가해야 하며, `server/tests/i18n.test.js`가 누락을 잡아낸다. AI 설명 언어는 요청의 `lang` 값으로 정한다. 교사가 화면(관리자 › 번역 관리)에서 입력한 번역은 DB `translations`에 저장되어 기본 사전보다 우선한다 (`server/i18nStrings.js`가 학생에게 보이는 문장을 모음).

## After every change (owner's standing request: always build, commit and deploy)
1. `npx tsc -b && npm test && npm run build:demo` — all must pass.
2. Commit with a clear message and push to `HanTutor` (the default branch; formerly `claude/korean-learning-webapp-kq0wm3`).
3. The push triggers `.github/workflows/pages.yml`, which redeploys https://eineye.github.io/han_tutor/ — check the run succeeds and report the result.
- TOPIK I 대비: 문제 `server/seed/topik.js`(실제 시험 형식으로 새로 쓴 문제 — 실제 기출문제를 옮겨 넣지 말 것), 학생 화면 `src/pages/TopikHome.tsx`·`TopikTest.tsx`, 교사 화면 `src/pages/admin/AdminTopik.tsx`·`AdminTopikEditor.tsx`. 그림 보기(이모지)를 새로 쓰면 `node scripts/build-emoji-icons.mjs`.
- 앱 배포: PWA(`public/manifest.webmanifest`, `public/sw.js`, `src/components/InstallApp.tsx`)와 Android 앱(Capacitor: `capacitor.config.ts`, `android/`, 휴대폰 음성은 `src/lib/native.ts`). 앱은 학생 전용 빌드(`npm run build:app` → `dist-app/`, `IS_APP`)이며 교사 화면은 웹/서버에만 있다. 서버 주소는 `HANTUTOR_SERVER_URL`(→ `VITE_API_BASE`). `.github/workflows/android.yml`이 HanTutor 푸시마다 APK와 `version.json`을 빌드해 `android-latest` 릴리스에 올린다 — 이 실행도 성공했는지 확인할 것. 로고를 바꾸면 `python3 scripts/build-app-icons.py`.
