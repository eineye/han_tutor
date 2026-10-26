# 앱으로 배포하기 (PWA · Android)

한글온은 하나의 코드로 세 가지 방법으로 배포됩니다.

| 방법 | 학생이 하는 일 | 데이터 |
|---|---|---|
| 웹 (GitHub Pages / 수업 서버) | 링크 열기 | 데모: 기기 안 / 서버: 서버 |
| **설치형 웹앱 (PWA)** | 링크를 열고 「📲 앱 설치」(iPhone은 공유 → 홈 화면에 추가) | 위와 같음 |
| **Android 앱 (APK, Google Play)** | APK를 내려받아 설치 (또는 Play 스토어) | 기본: 휴대폰 안 / 서버 주소를 넣고 빌드하면 서버 |

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

### 두 가지 모드
- **기본 (오프라인 단독 앱):** 데모 빌드(`dist-demo/site`)를 앱 안에 넣습니다.
  - 인터넷 없이 레슨·한글·TOPIK을 공부할 수 있고, 기록은 휴대폰에 저장됩니다.
  - AI 기능은 교사 설정에서 Gemini 키를 넣었을 때만 동작합니다.
- **수업 서버 연결:** 서버를 배포한 뒤(`docs/DEPLOY.md`) 서버 주소를 넣고 빌드하면, 앱이 그 서버를 엽니다. 교사 관리·학생 기록 공유·AI가 모두 서버로 동작합니다.
  - 한 번만: Actions › 「Android app (APK / AAB)」 › **Run workflow** › `server_url`에 `https://…` 입력.
  - 항상: 저장소 Settings › Secrets and variables › Actions › **Variables**에 `HANTUTOR_SERVER_URL` 추가.

### 휴대폰 음성 기능
Android 앱 화면(WebView)에는 브라우저 음성 기능이 없어서, 휴대폰 자체의 음성 엔진을 씁니다(`src/lib/native.ts`, `src/lib/speech.ts`).
- **읽어 주기:** Google 텍스트 음성 변환을 사용합니다. 소리가 안 나면 휴대폰 설정 › 접근성(또는 일반 관리) › 텍스트 음성 변환 › Google 엔진 › 음성 데이터 설치에서 **한국어**를 설치하세요. 교사 녹음과 AI 음성(서버 모드)은 그대로 재생됩니다.
- **음성 인식(발음 채점·말하기):** 휴대폰의 Google 음성 인식을 사용합니다. 처음 쓸 때 마이크 권한을 묻습니다.
- **Android 뒤로 가기 버튼:** 앞 화면으로 돌아가고, 첫 화면에서 누르면 앱이 닫힙니다.

### 직접 빌드하기 (Android Studio)
```bash
npm ci
npm run build:demo        # 또는 서버 모드: HANTUTOR_SERVER_URL=https://… 를 붙여 cap sync
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
