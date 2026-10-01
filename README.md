# Han Tutor · 한글 튜터

해외 거주 중·고등학생을 위한 한국어 학습 웹앱 (시험판 v0.1)

- 🐯 **2D 캐릭터 '보리'** 가 모음에 맞춰 입 모양을 바꾸며 발음을 들려주고, 학생 발음을 음절 단위로 채점
- 💬 **Gemini AI 실시간 대화** — 레슨별 역할극, 오류 교정, 예시 답변 제안, 음성 입력/출력
- 🎬 **드라마 스튜디오** — K-드라마 스타일 장면으로 자막·쉐도잉·역할극·퀴즈 (YouTube/자체영상/오디오드라마)
- 🧑‍🏫 **관리자(교사) 모드** — 진도·평가·과제·개별 관리, AI 학습 리포트, 레슨/영상 콘텐츠 편집

설계 문서: [docs/DESIGN.md](docs/DESIGN.md)

## 빠른 시작

```bash
npm install
cp .env.example .env      # GEMINI_API_KEY, ADMIN_PASSWORD 설정
npm run dev               # http://localhost:5173 (API: 8787)
```

- 학생: 로그인 화면 → **Sign up** → 반 코드 `DEMO`, 숫자 4자리 PIN
- 교사: 로그인 화면 → **교사 Teacher** 탭 → `.env`의 `ADMIN_PASSWORD` (기본값 `admin1234`, 배포 전 반드시 변경)
- `GEMINI_API_KEY`가 없으면 AI 기능이 **데모 모드**(정해진 응답)로 동작합니다. 키는 https://aistudio.google.com/apikey 에서 발급합니다.

### 배포 (단일 서버)

```bash
npm run build
npm start                 # dist/ 정적 파일 + API를 8787 포트에서 함께 서빙
```

데이터는 `data/db.json`에 저장됩니다 (`DATA_DIR`로 위치 변경 가능). 정기적으로 백업하세요.

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
