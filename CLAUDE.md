# Han Tutor — working notes for Claude

Korean learning web app for teens abroad (React + Vite front end, Express API, Gemini).
Design: docs/DESIGN.md · Deployment: docs/DEPLOY.md

## 소통 언어 (소유자 요청)
- 소유자에게 보내는 모든 답변·보고·설명은 **한국어**로 작성한다. 영어 용어는 꼭 필요할 때만 괄호로 덧붙인다.
- 커밋 메시지, 문서(README, docs/), PR 설명도 한국어로 작성한다.
- 학생용 화면 문구는 대상(해외 학생)에 맞춰 영어+한국어 병기를 유지하고, 교사용 화면은 한국어로 둔다.

## Layout
- `server/core.js` — all API logic (framework-agnostic). Used by `server/index.js` (Express) and `src/demo/mockServer.ts` (browser demo). Change API behavior here only.
- `server/seed/` — curriculum and drama scenes. `curriculum.js` follows the table of contents and teaching flow of the class textbook (세종학당 한국어 입문; the PDF is not kept in the repo: 예비편 + 12과 + 연습 활용 1–5), but every example, explanation and quiz item is original — never copy text from the textbook or real dramas. `bonus.js` holds draft conversation lessons.
- `src/` — UI; `src/pages/admin/` — teacher screens (Korean UI).
- 학생 화면 언어 (한국어/English/Монгол): `src/i18n/`. 화면 문구는 `ui.ts`(키별 3개 언어), 교재·드라마 설명은 영어 원문을 키로 하는 `content.mn.json` / `content.ko.json`. 시드의 영어 문장을 추가·수정하면 두 사전에도 번역을 추가해야 하며, `server/tests/i18n.test.js`가 누락을 잡아낸다. AI 설명 언어는 요청의 `lang` 값으로 정한다.

## After every change (owner's standing request: always build, commit and deploy)
1. `npx tsc -b && npm test && npm run build:demo` — all must pass.
2. Commit with a clear message and push to `HanTutor` (the default branch; formerly `claude/korean-learning-webapp-kq0wm3`).
3. The push triggers `.github/workflows/pages.yml`, which redeploys https://eineye.github.io/han_tutor/ — check the run succeeds and report the result.
