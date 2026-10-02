# 한글온 (Hangeul On)

<img src="src/assets/brand/한글온_icon_logo.png" alt="한글온 아이콘" height="80"> <img src="src/assets/brand/한글온_Name_logo.png" alt="한글온 HANGEUL ON" height="80">

해외 거주 중·고등학생을 위한 한국어 학습 웹앱 (시험판 v0.1)

- 🐯 **2D 캐릭터 '보리'** 가 모음에 맞춰 입 모양을 바꾸며 발음을 들려주고, 학생 발음을 음절 단위로 채점
- 👄 **정밀 입 모양 애니메이션** — 발음 코치 화면에서 입술·이·혀를 앞모습과 옆모습(입안 단면)으로 보여 주며 모음마다 부드럽게 변함
- 💬 **Gemini AI 실시간 대화** — 레슨별 역할극, 오류 교정, 예시 답변 제안, 음성 입력/출력
- 🎬 **드라마 스튜디오** — K-드라마 스타일 장면으로 자막·쉐도잉·역할극·퀴즈 (YouTube/자체영상/오디오드라마)
- 🧑‍🏫 **관리자(교사) 모드** — 진도·평가·과제·개별 관리, AI 학습 리포트, 레슨/영상 콘텐츠 편집
- 🌐 **학생 화면 언어 선택** — 한국어 / English / Монгол (화면 문구, 교재 설명, 드라마 해석, AI 설명까지). 교사 화면 「번역 관리」에서 번역을 직접 고치고 채울 수 있음 (AI 초안 지원)

설계 문서: [docs/DESIGN.md](docs/DESIGN.md)

**🌐 바로 테스트하기 (GitHub Pages):** https://eineye.github.io/han_tutor/
— 서버 없이 브라우저에서 동작하는 데모입니다. 데이터는 각자의 브라우저에만 저장되고, 교사 비밀번호는 `admin1234`입니다. 교사 › 설정에서 테스트용 Gemini 키를 넣으면 실제 AI도 시험할 수 있습니다. 이 브랜치에 push하면 자동으로 다시 배포됩니다 (`.github/workflows/pages.yml`).

## 빠른 시작

```bash
npm install
cp .env.example .env      # GEMINI_API_KEY, ADMIN_PASSWORD 설정
npm run dev               # http://localhost:5173 (API: 8787)
```

- 학생: 로그인 화면 → **Sign up** → 반 코드 `DEMO`, 숫자 4자리 PIN
- 교사: 로그인 화면 → **교사 Teacher** 탭 → `.env`의 `ADMIN_PASSWORD` (기본값 `admin1234`, 배포 전 반드시 변경)
- `GEMINI_API_KEY`가 없으면 AI 기능이 **데모 모드**(정해진 응답)로 동작합니다. 키는 https://aistudio.google.com/apikey 에서 발급합니다.

### 브라우저 데모 (서버 없이 실행)

```bash
npm run build:demo        # dist-demo/han-tutor-demo.html (단일 HTML 파일)
```

서버와 같은 API 코어(`server/core.js`)를 브라우저에서 실행하고, 데이터는 그 브라우저의 localStorage에 저장합니다. 예시 학생 4명이 미리 들어 있고, AI는 데모 응답을 사용합니다. 교사 비밀번호는 `admin1234`입니다.

### 배포 (단일 서버)

```bash
npm run build
npm start                 # dist/ 정적 파일 + API를 8787 포트에서 함께 서빙
```

데이터는 `data/db.json`에 저장됩니다 (`DATA_DIR`로 위치 변경 가능). 정기적으로 백업하세요.

클라우드 배포(Google Cloud Run / Render): [docs/DEPLOY.md](docs/DEPLOY.md)

### 브라우저 지원

| 기능 | Chrome / Edge | Safari | Firefox |
|---|---|---|---|
| TTS (보리 음성) | ✅ | ✅ | ✅ (OS 한국어 음성 필요) |
| 즉시 발음 채점 (음성 인식) | ✅ | ✅ | ❌ → AI 코치로 대체 |
| AI 발음 피드백 (녹음→Gemini) | ✅ | ✅ | ✅ |

마이크 사용을 위해 배포 시 **HTTPS**가 필요합니다.

## 테스트

```bash
npm test          # API 통합 테스트
npm run typecheck
```

## 폴더 구조

```
server/            Express API (인증, 진도, Gemini 프록시, 관리자 API)
  seed/            기본 커리큘럼(한글 5과 + 레슨 9과) · 드라마 장면 3편 — 모두 자체 작성
  gemini.js        Gemini REST 호출, 프롬프트/응답 스키마
src/
  components/      Mascot(보리), PronunciationPractice, QuizRunner, DialogueView, VideoSurface …
  lib/             hangul(자모 분해·채점·입모양), speech(TTS/STT), recorder(WAV 녹음)
  pages/           학생 화면
  pages/admin/     교사용 관리자 화면
```
