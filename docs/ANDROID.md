# 앱으로 배포하기 (PWA · Android)

한글온은 하나의 코드로 세 가지 방법으로 배포됩니다.

| 방법 | 학생이 하는 일 | 데이터 |
|---|---|---|
| 웹 (GitHub Pages / 수업 서버) | 링크 열기 | 데모: 기기 안 / 서버: 서버 |
| **설치형 웹앱 (PWA)** | 링크를 열고 「📲 앱 설치」(iPhone은 공유 → 홈 화면에 추가) | 위와 같음 |
| **Android 앱 (APK, Google Play)** | APK를 내려받아 설치 (또는 Play 스토어) | 기본: 휴대폰 안 / 서버 주소를 넣고 빌드하면 서버 |

## 화면 구성 (휴대폰·앱)
- 화면 폭 900px 이하(휴대폰·태블릿·Android 앱)에서는 상단 바(☰ 메뉴 · 로고 · 현재 메뉴 이름)만 보입니다. 전체 메뉴·언어 선택·앱 설치·로그아웃은 ☰ 옆 메뉴(드로어) 안에 있습니다. 교사 화면도 같은 방식입니다(`src/components/StudentLayout.tsx`, `AdminLayout.tsx`).
- 휴대폰에서 바뀐 화면:
  - 레슨 단계 버튼이 한 화면에 모두 보이도록 격자로 배치되고, 「이전/다음」 버튼이 아래에 고정됩니다.
  - 탭은 여러 줄로 나뉘어 표시됩니다.
  - AI 대화는 상황 설명·설정을 접어 두고 대화창을 넓게 보여 줍니다.
  - 드라마 조작 버튼은 두 줄로 나뉩니다.
  - 교사용 표는 카드 안에서 옆으로 밀어 볼 수 있습니다.
- 휴대폰 기본 글자 크기는 15px(폭 380px 이하는 14px)입니다. Android 앱은 휴대폰의 「글꼴 크기」 설정을 따르지 않고 100%로 고정합니다(`MainActivity.java`의 `setTextZoom(100)`). 큰 글꼴 설정 때문에 화면이 옆으로 밀리지 않게 하기 위해서입니다.
- PC 화면 구성은 그대로입니다.

## 1. 설치형 웹앱 (PWA)

- 관련 파일: `public/manifest.webmanifest`(앱 이름·아이콘), `public/sw.js`(오프라인 캐시), `src/components/InstallApp.tsx`(설치 버튼), `src/lib/native.ts`의 `registerServiceWorker`.
- 화면·교재는 기기에 저장되어 **인터넷이 끊겨도 열립니다**. `/api/`(계정·기록·AI)는 항상 서버에 직접 요청하고 저장해 두지 않습니다.
- 빌드할 때마다 `sw.js`의 캐시 이름이 바뀌어(vite.config.ts의 `swBuildId`), 설치된 앱은 다음 실행 때 새 버전을 받습니다.
- 「📲 앱 설치」 버튼은 학생 화면 상단과 로그인 화면에 나옵니다. Android Chrome·PC Chrome/Edge에서는 브라우저의 설치 창이 뜨고, iPhone에서는 설치 방법을 안내합니다. 이미 설치했거나 Android 앱 안에서는 보이지 않습니다.
- 로고를 바꾸면 `python3 scripts/build-app-icons.py`를 실행하세요. PWA용 maskable 아이콘과 Android 아이콘·시작 화면을 다시 만듭니다.

## 2. Android 앱 (Capacitor)

### 자동 빌드와 내려받기
- `HanTutor` 브랜치에 푸시하면 `.github/workflows/android.yml`이 앱을 빌드합니다.
- 결과 APK는 **https://github.com/eineye/han_tutor/releases/download/android-latest/hangeulon.apk** 에 자동으로 올라갑니다. Android 휴대폰의 로그인 화면에 나오는 「🤖 안드로이드 앱 (APK)」 버튼도 이 주소로 연결됩니다.
- 학생 설치 방법: 휴대폰에서 APK 내려받기 → 열기 → 「출처를 알 수 없는 앱 설치 허용」 → 설치.
- 모든 APK는 같은 서명(`android/app/debug.keystore`, 공개용 키)으로 만들어집니다. 그래서 **새 버전을 덮어 설치해도 학습 기록이 유지**됩니다.

### 앱은 학생 전용입니다
- 앱(`npm run build:app` → `dist-app/`)에는 **교사 탭과 관리자 화면이 없습니다**. 교사는 수업 서버(또는 웹 데모)를 PC 브라우저로 열어 관리합니다.
- 웹 데모(GitHub Pages)는 지금처럼 학생·교사 화면이 모두 있습니다.
- 빌드할 때 구분하는 값:
  - 앱: `VITE_APP=1`
  - 서버 주소: `VITE_API_BASE`
  - 업데이트 알림: `VITE_UPDATE_CHECK=apk`
  - 관련 코드: `src/api.ts`(`IS_APP`, `API_BASE`), `src/lib/appInfo.ts`

### 두 가지 모드
- **시범 앱 (서버 없음, 지금 배포 중):**
  - 서버 없이 혼자 동작하고, 기록은 휴대폰에 저장됩니다.
  - 로그인 화면에 「📱 시범 앱」 안내가 나옵니다. 반 코드는 DEMO입니다.
  - AI 대화는 예시 응답으로 동작합니다.
- **수업 서버 연결:** 서버를 배포한 뒤(`docs/DEPLOY.md`) 주소를 넣고 빌드합니다.
  - 앱 화면은 앱 안에 들어 있고, **API만 서버에 요청**합니다.
  - 교사가 서버에서 고친 레슨·드라마·TOPIK·번역·녹음은 앱을 다시 내지 않아도 **바로 반영**됩니다.
  - 학생 기록은 서버에 쌓입니다.
  - 한 번만 설정: Actions › 「Android app (APK / AAB)」 › **Run workflow** › `server_url`에 `https://…` 입력
  - 항상 설정: 저장소 Settings › Secrets and variables › Actions › **Variables**에 `HANTUTOR_SERVER_URL` 추가
  - 서버의 CORS(다른 곳의 요청 허용): 앱의 출처 `https://localhost`는 기본으로 허용합니다. 다른 출처를 더 허용하려면 서버 환경 변수 `CORS_ORIGINS`(쉼표로 구분)에 넣으세요.
  - 인터넷이 끊겨도 **한 번 열어 본 레슨·드라마·TOPIK은 저장된 사본**으로 보입니다. 처음 여는 화면은 「서버에 연결할 수 없어요 · 다시 시도」 안내가 나옵니다.

### 버전과 업데이트 알림
- ☰ 메뉴 아래와 로그인 화면에 **버전**(`1.0.빌드번호`)이 표시됩니다. 학생이 최신 APK를 쓰는지 확인할 때 보세요.
- 직접 설치한 APK는 앱을 켤 때 `android-latest` 릴리스의 `version.json`을 확인합니다. 새 버전이 있으면 「🆕 새 버전이 나왔어요 · 내려받기」 안내가 나옵니다.
  - 「나중에」를 누르면 그 버전 안내는 다시 나오지 않습니다.
  - 받은 파일을 열어 덮어 설치하면 기록이 유지됩니다.
- **Google Play용 AAB에는 이 알림이 없습니다.** Play 앱은 Play 스토어로만 업데이트해야 하기 때문입니다(Play 정책).

### 계정 삭제·개인정보처리방침 (Google Play 필수)
- **앱 안에서 삭제:** 나의 학습 › 🗑 계정 삭제. 서버의 `DELETE /api/me`가 계정과 모든 기록을 지웁니다.
- **웹에서 삭제:** `https://서버주소/account-deletion.html`에서 이름·반 코드·PIN으로 삭제합니다(`POST /api/account/delete`). GitHub Pages 사본에서는 시범 앱 안내만 보여 줍니다.
- **개인정보처리방침:** `public/privacy.html`
  - 시범 앱: https://eineye.github.io/han_tutor/privacy.html
  - 서버 연결 후: `https://서버주소/privacy.html`
  - **출시 전에 운영자 이름과 문의 이메일(노란 표시 부분)을 채워야 합니다.**
- PIN을 8번 틀리면 그 계정은 15분 동안 로그인이 막힙니다. 교사 비밀번호도 같은 규칙입니다.

### 휴대폰 음성 기능
Android 앱 화면(WebView)에는 브라우저 음성 기능이 없어서, 휴대폰 자체의 음성 엔진을 씁니다(`src/lib/native.ts`, `src/lib/speech.ts`).
- **읽어 주기:** Google 텍스트 음성 변환을 사용합니다. 소리가 안 나면 휴대폰 설정 › 접근성(또는 일반 관리) › 텍스트 음성 변환 › Google 엔진 › 음성 데이터 설치에서 **한국어**를 설치하세요. 교사 녹음과 AI 음성(서버 모드)은 그대로 재생됩니다.
- **음성 인식(발음 채점·말하기):** 휴대폰의 Google 음성 인식을 사용합니다. 처음 쓸 때 마이크 권한을 묻습니다.
- **Android 뒤로 가기 버튼:** 앞 화면으로 돌아가고, 첫 화면에서 누르면 앱이 닫힙니다.

### 직접 빌드하기 (Android Studio)
```bash
npm ci
npm run build:app         # 서버 모드: HANTUTOR_SERVER_URL=https://… npm run build:app
npx cap sync android
npx cap open android      # Android Studio에서 ▶ 실행
```

## 3. Google Play 출시

1. **개발자 계정:** https://play.google.com/console 에서 만듭니다(1회 $25). 개인 계정은 신원 확인이 필요합니다.
2. **업로드 키 만들기:** 한 번만, 본인 PC에서 만듭니다. 키 파일과 비밀번호는 잃어버리지 않게 따로 보관하세요.
   ```bash
   keytool -genkeypair -v -keystore hangeulon-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 hangeulon-upload.jks > hangeulon-upload.b64   # macOS: base64 -i hangeulon-upload.jks
   ```
3. **GitHub Secrets 등록:** 저장소 Settings › Secrets and variables › Actions › **Secrets**에 다음 네 가지를 넣습니다. 채팅이나 코드에는 절대 붙여 넣지 마세요.
   - `ANDROID_KEYSTORE_BASE64`: `hangeulon-upload.b64` 파일 내용
   - `ANDROID_KEYSTORE_PASSWORD`: 키 저장소 비밀번호
   - `ANDROID_KEY_ALIAS`: `upload`
   - `ANDROID_KEY_PASSWORD`: 키 비밀번호
   - 등록한 뒤 다시 푸시하면 Actions 결과물(artifact)에 `hangeulon-release.aab`가 생깁니다.
4. **Play Console에서 앱 만들기:**
   - AAB를 업로드합니다. 「Play 앱 서명」은 기본값(사용)을 그대로 둡니다.
   - 버전 번호(versionCode)는 빌드 번호로 자동 증가합니다.
5. **비공개 테스트:** 신규 개인 계정은 **테스터 12명 이상이 14일 동안 비공개 테스트**를 해야 정식(프로덕션) 출시를 신청할 수 있습니다. 반 학생·선생님의 Google 계정을 테스터로 등록하세요.
6. **필수 입력 항목:**
   - 개인정보처리방침 URL: 학생 이름·반 코드·학습 기록·음성 녹음을 어떻게 다루는지 적습니다.
   - 데이터 보안 양식
   - 콘텐츠 등급 설문
   - 대상 연령: 13세 이상 권장. 13세 미만이 포함되면 「가족 정책」 요건이 추가됩니다.
   - 스토어 설명·스크린샷(휴대폰 2장 이상)·아이콘 512px(`public/icon-512.png`)·그래픽 이미지(1024×500)
7. **앱 ID 주의:** 앱 ID `io.github.eineye.hangeulon`은 Play에 처음 올린 뒤에는 바꿀 수 없습니다. 바꾸려면 첫 업로드 전에 `capacitor.config.ts`와 `android/app/build.gradle`을 함께 수정하세요.

## iPhone (App Store)
같은 Capacitor 구성으로 `npx cap add ios`를 하면 만들 수 있습니다. 다만 Apple 개발자 계정(연 $99)과 Mac(Xcode)이 필요하므로, 당분간은 iPhone 학생에게 PWA(홈 화면에 추가)를 안내하세요.
