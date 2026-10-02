# 클라우드 배포 가이드

Han Tutor는 Docker 컨테이너 하나(웹 화면 + API)로 배포됩니다. 데이터는 `/data/db.json` 파일과 `/data/audio/`(교사 녹음 파일) 폴더에 저장되므로 **영구 저장소를 연결**해야 합니다.

| 방법 | 장점 | 비용(대략) |
|---|---|---|
| **A. Google Cloud Run** (권장) | 서울 리전, Gemini와 같은 Google 계정, 사용량 기반 과금 | 소규모 반은 무료 한도 내 ~ 월 수천 원 |
| B. Render | GitHub 연결 후 클릭 몇 번 | Starter 플랜 + 디스크 월 약 $7~8 |

배포 전에 준비할 것: **Gemini API 키** (https://aistudio.google.com/apikey), **교사용 관리자 비밀번호** (기본값 `admin1234`는 운영 모드에서 거부됩니다).

## A. Google Cloud Run

1. https://console.cloud.google.com 에서 프로젝트를 만들고 결제 계정을 연결합니다.
2. 콘솔 오른쪽 위 **Cloud Shell(>_)** 을 열고 실행합니다.
   ```bash
   git clone -b claude/korean-learning-webapp-kq0wm3 https://github.com/eineye/han_tutor.git
   cd han_tutor
   PROJECT_ID=<프로젝트ID> ./deploy/cloudrun.sh
   ```
3. 처음 실행하면 Gemini 키와 관리자 비밀번호를 묻습니다 (Secret Manager에 암호화 저장). 끝나면 `https://han-tutor-xxxx.a.run.app` 주소가 출력됩니다.

스크립트가 하는 일: 필요한 API 활성화 → 데이터용 Cloud Storage 버킷 생성 후 `/data`에 마운트 → 비밀값 등록 → 소스에서 이미지 빌드 → 서울(asia-northeast3) 리전에 배포 (인스턴스 최대 1개: 파일 DB의 동시 쓰기 방지).

- 코드 수정 후 재배포: 같은 명령을 다시 실행
- 비밀번호 변경: `printf '새비밀번호' | gcloud secrets versions add han-tutor-admin-password --data-file=-` 후 재배포
- 백업: `gcloud storage cp gs://<프로젝트ID>-han-tutor-data/db.json ./backup.json` (교사 녹음은 `gcloud storage cp -r gs://<프로젝트ID>-han-tutor-data/audio ./audio-backup`)

## B. Render

1. https://render.com 에 GitHub로 로그인 → **New → Blueprint** → `eineye/han_tutor` 저장소, 브랜치 선택
2. `render.yaml`이 자동 인식됩니다. `GEMINI_API_KEY`, `ADMIN_PASSWORD` 값을 입력하고 **Apply**
3. 배포가 끝나면 `https://han-tutor.onrender.com` 형태의 주소가 생깁니다.

## 배포 후 확인
- `https://<주소>/healthz` → `ok`
- 교사 로그인 → 설정에서 **AI 상태: API 키 설정됨** 확인, 반 코드 추가
- HTTPS 주소이므로 마이크(발음 채점·음성 입력)가 정상 동작합니다.

## 규모가 커지면
JSON 파일 DB는 한 학교·수십~수백 명 규모의 시범 운영용입니다. 여러 학교로 확장할 때는 `server/db.js`를 Firestore 또는 Cloud SQL로 교체하고 인스턴스 수 제한을 풀면 됩니다 (API 로직은 `server/core.js`에 분리되어 있어 저장소만 바꾸면 됩니다).
