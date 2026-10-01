# Han Tutor — working notes for Claude

Korean learning web app for teens abroad (React + Vite front end, Express API, Gemini).
Design: docs/DESIGN.md · Deployment: docs/DEPLOY.md

## Layout
- `server/core.js` — all API logic (framework-agnostic). Used by `server/index.js` (Express) and `src/demo/mockServer.ts` (browser demo). Change API behavior here only.
- `server/seed/` — curriculum and drama scenes. `curriculum.js` follows the table of contents and teaching flow of the class textbook (`basicHan1.pdf`, 세종학당 한국어 입문: 예비편 + 12과 + 연습 활용 1–5), but every example, explanation and quiz item is original — never copy text from the textbook or real dramas. `bonus.js` holds draft conversation lessons.
- `src/` — UI; `src/pages/admin/` — teacher screens (Korean UI); student UI is English + Korean.

## After every change (owner's standing request: always build, commit and deploy)
1. `npx tsc -b && npm test && npm run build:demo` — all must pass.
2. Commit with a clear message and push to `HanTutor` (the default branch; formerly `claude/korean-learning-webapp-kq0wm3`).
3. The push triggers `.github/workflows/pages.yml`, which redeploys https://eineye.github.io/han_tutor/ — check the run succeeds and report the result.
