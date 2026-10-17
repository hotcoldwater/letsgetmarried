> **2026-10-17 변경:** Vercel에 바로 배포하며 Google 대신 아이디/비밀번호 로그인을 사용합니다. 아래 Auth/이메일 절차는 이전 설계입니다. 현재 절차는 [Vercel 배포 안내](vercel-deploy.md)를 따르세요.

# Neon 연결과 로컬 실행

2026-10-17 기준. 웹앱은 Mac의 localhost에서 실행하고 DB·로그인·파일 서버는 Neon 개발 브랜치를 사용합니다. 이 과정은 웹사이트 공개 배포가 아닙니다. 로컬 완성 후 배포합니다.

## 1. 역할과 현재 상태

제가 준비한 것: Next.js 앱, Neon 로그인 중계, 두 계정 접근 제한, 공동 기록 모델, SQL 마이그레이션, 공동 동의와 충돌 처리, 예산·일정·질문·후보·의견·첨부 화면, 내부 알림·푸시 대기열·예약 작업, PWA, 환경 파일 생성기, 설정 점검과 테스트 스크립트.

직접 필요한 것: Node.js 설치, Neon 개발 프로젝트/브랜치 생성, Auth 활성화, 두 분의 Google 이메일 지정, 연결 정보를 `.env.local`에 입력. 사진/PDF를 쓰려면 저장소 자격증명이 추가로 필요합니다. **DB 비밀번호·연결 문자열·스토리지 키를 채팅으로 보내지 마세요.**

현재 작업 환경에는 Node/npm·Docker·Postgres 실행 도구가 없고 셸의 외부 다운로드도 사용할 수 없습니다. 따라서 설치·빌드·서비스 연결 검증은 설정이 준비된 뒤 이어서 진행합니다. 준비가 끝나면 “Node 설치했고 .env.local 채웠어”라고 알려주시면 됩니다.

## 2. Node.js 설치와 환경 파일 생성

1. [Node.js 공식 다운로드](https://nodejs.org/en/download)에서 **24 LTS** macOS 설치 파일을 선택합니다. M 시리즈는 ARM64, Intel Mac은 x64입니다. [현재 릴리스 목록](https://nodejs.org/en/about/previous-releases)
2. 설치 후 터미널을 새로 열어 다음을 실행합니다.

```sh
node -v
npm -v
cd /Users/david/projects/letsgetmarried
npm install
npm run setup:local
```

`node -v`는 `v24...`가 나와야 합니다. `setup:local`은 `.env.example`을 바탕으로 `.env.local`을 만들고 쿠키 서명 키·VAPID 키·예약 작업 비밀 키를 생성합니다. 비밀 값은 출력하지 않으며 기존 파일을 덮어쓰지 않습니다. 파일은 본인만 읽고 쓸 수 있게 만들고 Git에서 제외합니다.

현재 패키지를 설치하지 못해 lockfile이 없습니다. 최초 설치와 빌드가 확인되면 `package-lock.json`을 함께 관리합니다. 설치 오류가 나면 비밀 값이 없는 오류 문구만 공유해 주세요.

## 3. Neon 개발 프로젝트

1. [Neon Console](https://console.neon.tech)에 로그인합니다.
2. **Free** 프로젝트를 만들고 이름을 `letsgetmarried`로 지정합니다.
3. 리전은 **AWS Asia Pacific (Singapore)**를 권합니다. 현재 Object Storage 지원 리전 중 한국에 가까운 선택입니다. [저장소 지원 리전](https://neon.com/docs/storage/get-started)
4. 개발 브랜치 `development`를 만듭니다. DB·Auth·파일 저장소는 모두 이 브랜치로 맞춥니다.
5. 브랜치의 **Connect**에서 Postgres 연결 문자열을 복사합니다. `postgresql://...` 형식이며 비밀번호와 `sslmode=require`를 포함합니다. 이 값을 `DATABASE_URL`에 넣습니다.
6. 프로젝트 사용량 화면에서 컴퓨트·DB·파일·전송량을 확인합니다. 무료 한도는 변경될 수 있으므로 실제 콘솔 요금제를 기준으로 운영합니다. [Neon 요금표](https://neon.com/pricing)

브라우저용 Data API나 공개 DB 권한은 필요하지 않습니다. 제공한 SQL은 별도 `wedding` 스키마를 만들고 PUBLIC 권한을 회수합니다. 서버용 DB 역할의 연결 문자열을 사용합니다.

## 4. Google 로그인

1. 같은 `development` 브랜치에서 **Auth / Managed Better Auth**를 활성화합니다.
2. **Auth base URL**을 복사해 `NEON_AUTH_BASE_URL`에 입력합니다. DB 호스트와 다른 주소이며 콘솔이 제공하는 경로까지 그대로 복사합니다.
3. 신뢰할 앱 주소(Trusted domains/origins)에 `http://localhost:3000`을 등록합니다. 개발 모드에서 기본 허용되더라도 설정을 확인합니다. 로컬 접속은 `localhost`로 통일합니다.
4. 개발 단계는 Neon의 기본 Google OAuth 공유 자격증명으로 시작할 수 있습니다. 지금 Google Cloud 프로젝트를 별도로 만들 필요는 없습니다. 정식 사용 전 본인 Google OAuth 앱으로 전환합니다. [공식 OAuth 안내](https://neon.com/docs/auth/guides/setup-oauth)
5. 두 분이 사용할 Google 계정 이메일을 각각 `GROOM_EMAIL`, `BRIDE_EMAIL`에 입력합니다. 서로 다른 주소여야 하며 비밀번호는 필요하지 않습니다.

앱 서버는 확인된 이메일이 두 주소 중 하나인지 검사합니다. 다른 계정으로 Neon 로그인이 되어도 공동 기록 API는 403으로 거부합니다. 다른 사람 이름으로 대신 동의하는 기능은 없습니다.

아이폰의 타사 쿠키 제약을 고려해 앱의 `/api/auth/...` 경로로 로그인 요청을 중계합니다. Neon 공식 Next.js SDK의 beta 버전을 고정했으며 실제 로그인·로그아웃·세션 갱신은 연결 후 확인해야 합니다. [공식 서버 SDK](https://neon.com/docs/auth/reference/nextjs-server)

## 5. .env.local 입력

프로젝트 루트의 `.env.local`을 텍스트 편집기로 엽니다. Finder의 숨김 파일은 `Command + Shift + .`로 표시합니다.

```dotenv
APP_URL=http://localhost:3000
DATABASE_URL=Neon_개발_브랜치의_Postgres_연결_문자열
NEON_AUTH_BASE_URL=Neon_개발_브랜치의_Auth_base_URL
GROOM_EMAIL=오성현_님의_Google_이메일
BRIDE_EMAIL=정지윤_님의_Google_이메일
```

위 예시는 입력 위치 설명이므로 실제 값으로 바꿉니다. 생성된 `NEON_AUTH_COOKIE_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`은 유지합니다. 비밀 값에 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. `AWS_*`는 비어 있어도 텍스트·예산 기능을 먼저 실행할 수 있습니다.

환경 파일을 바꾸면 개발 서버를 중지했다가 다시 시작해야 합니다.

## 6. DB 초기화와 실행

```sh
cd /Users/david/projects/letsgetmarried
npm run doctor
npm run db:migrate
npm test
npm run test:db
npm run dev
```

- `doctor`: 값 자체를 출력하지 않고 필수 설정과 형식을 확인합니다. 원격 접속 검사는 아닙니다.
- `db:migrate`: SQL 파일을 순서대로 적용하고 공동 공간을 만듭니다. 기존 기록은 덮어쓰지 않으며 SQL 파일 체크섬을 기록합니다.
- `test`: 동의·재동의·계산·접근 계정 판별·알림 규칙을 Node에서 검사합니다.
- `test:db`: 실제 스키마와 임시 테이블의 버전 조건 갱신을 검사합니다. 결혼 준비 기록은 변경하지 않습니다.
- `dev`: 로컬 서버를 실행합니다. 터미널을 켜둔 채 `http://localhost:3000`을 엽니다.

첫 화면은 지출 0원, 예산 3천만 원, 기본 준비 항목과 실제 결혼식 일정으로 시작합니다. `studio.html`의 가상 계약·지출·동의는 이관하지 않습니다. `studio.html`은 디자인 시안이고 localhost 앱이 실제 공동 기록입니다.

Chrome의 서로 다른 프로필 또는 일반 창·시크릿 창에서 두 Google 계정으로 각각 로그인하면 공동 동의를 확인할 수 있습니다. 실제 저장을 확인한 다음 `npm run build`도 실행합니다.

## 7. 사진·PDF 저장소

텍스트 기능을 확인한 뒤 같은 브랜치의 **Object storage → New bucket**에서 이름 `wedding-private`, 접근 수준 **private**으로 버킷을 만듭니다. [버킷 생성 안내](https://neon.com/docs/storage/buckets)

스토리지 전용 자격증명은 `storage:read`, `storage:write` 범위로 만듭니다. 콘솔에서 찾기 어려우면 CLI를 사용합니다.

```sh
npx neon@latest login
npx neon@latest link
npx neon@latest branches list
npx neon@latest credentials create --scope storage:read --scope storage:write --name wedding-local
```

`link`에서 프로젝트와 `development`를 선택하고 `branches list`로 확인합니다. 생성 결과는 한 번 출력되므로 직접 `.env.local`로 옮깁니다. 이 출력은 채팅에 보내지 않습니다. [CLI 설치·접속 안내](https://neon.com/docs/cli/install)

| 환경 변수 | 입력 값 |
| --- | --- |
| `AWS_ENDPOINT_URL_S3` | 해당 브랜치의 전체 storage endpoint, 버킷명은 붙이지 않음 |
| `AWS_REGION` | Singapore이면 `ap-southeast-1` |
| `AWS_ACCESS_KEY_ID` | 생성 결과의 `token_id` |
| `AWS_SECRET_ACCESS_KEY` | 생성 결과의 `s3_secret_access_key` |
| `ATTACHMENT_BUCKET` | `wedding-private` |

AWS 계정이나 AWS IAM 키는 필요하지 않습니다. 이름만 S3 SDK 규약을 따릅니다. Neon 일반 API 토큰과 S3 비밀 키는 다른 값입니다. [자격증명 매핑](https://neon.com/docs/storage/authentication)

endpoint를 콘솔에서 찾기 어렵다면 [저장소 시작 안내](https://neon.com/docs/storage/get-started)의 브랜치 storage 조회 절차를 사용합니다. 지원 리전이 아니면 파일 저장소를 사용할 수 없습니다.

서버 재시작 후 ‘사진 · PDF’ 버튼을 확인합니다. 사진은 1,600px JPEG로 줄이고 파일당 4MB까지 받습니다. HEIC는 JPEG로 변환해 첨부합니다. 사진은 인증 후 열며 PDF는 다운로드합니다. 서명 링크는 60초 동안만 유효합니다.

## 8. 아이폰과 알림

사이트 내부 알림은 로그인·DB 연결만으로 사용할 수 있습니다. iOS 16.4 이상은 홈 화면에 추가한 웹앱에서 Web Push를 지원하며 기기마다 사용자가 허용해야 합니다. [Apple WebKit 안내](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

Mac의 `http://localhost:3000`은 Mac에서만 접근하는 주소입니다. 아이폰의 같은 주소는 Mac 서버를 가리키지 않습니다. LAN IP의 일반 HTTP 주소도 실제 푸시 테스트에는 충분하지 않습니다.

PC 기능 확인 후 두 아이폰이 신뢰하는 **로컬 HTTPS 주소와 인증서**를 구성하고 Auth trusted origin과 `APP_URL`도 맞춥니다. 이 주소를 Safari에서 열고 **공유 → 홈 화면에 추가 → 아이콘으로 열기 → 알림 → 이 기기 알림 켜기 → 테스트 알림** 순서로 확인합니다. HTTPS 구성은 다음 작업에서 진행하며 그 전에 공개 배포하지 않습니다.

예약 알림은 로컬에서 자동 실행되지 않습니다. 개발 서버가 켜진 상태로 별도 터미널에서:

```sh
npm run notify:run
```

오늘 기준 선택한 7일 전·하루 전·당일 조건에 맞는 확정 일정이 있으면 명령을 실행한 시점에 알림을 보냅니다. 자동 발송은 배포 후 `deployment/reminder-worker.mjs`에 Cron `0 0 * * *`(한국 오전 9시)를 연결해야 합니다. 컴퓨터가 꺼진 상태의 발송은 그 이후 가능합니다.

변경 알림은 저장 후 발송을 시도합니다. 실패 건은 다음 저장·테스트·예약 작업에서 최대 5회 다시 시도합니다. 실제 수신은 OS와 네트워크 영향도 받으므로 기기에서 직접 확인합니다.

## 9. 설정 후 제가 이어서 할 일

- 설치·Next.js 프로덕션 빌드, 의존성 버전과 lockfile 확인.
- 두 계정 로그인/로그아웃/세션 갱신과 제3자 차단.
- 동시 수정 409 충돌, 입력 보존과 재확인 후 저장.
- 후보/계약 변경 재동의, 반복 승인, 하위 결정 완료 상태.
- 총액·부분 지급·분류 제외·공동 예산 변경·초과 표시.
- 파일 업로드·접근 제한·링크 만료·저장 충돌 때 파일 정리.
- 실제 아이폰 화면·키보드·동작 줄이기·PWA·푸시.
- 예약 중복 실행·실패 재시도·완료/보관/미동의 일정 제외.
- 실사용 일정 체크리스트·후보 보관/복원 검증, 변경 전후 비교 등 남은 세부 기능.

현재 규칙 검사 140개는 macOS JavaScriptCore에서 통과했습니다. URL 관련 검사는 Foundation 어댑터를 사용했습니다. 새 UI·SQL·OAuth·스토리지·푸시의 통합 테스트 통과를 뜻하지 않습니다.

## 10. 배포는 로컬 완성 후

서버 기능 때문에 **Cloudflare Workers + OpenNext**를 우선 검토합니다. Pages 정적 배포만으로는 현재 API를 실행할 수 없습니다. [공식 Next.js 가이드](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

인증·S3·Web Push SDK의 Workers 호환성과 무료 CPU/요청 한도는 배포 전에 검증해야 합니다. 결과에 따라 Vercel을 선택할 수도 있습니다. Vercel Hobby Cron은 하루 한 번이며 실행 시각 정밀도 제한이 있습니다. [Cloudflare 한도](https://developers.cloudflare.com/workers/platform/limits/), [Vercel Cron 한도](https://vercel.com/docs/cron-jobs/usage-and-pricing)

도메인 구매·유료 플랜·정식 Google OAuth 앱·배포 계정 연결은 지금 하지 않아도 됩니다. 현재 폴더에는 `.git`이 없어 저장소 연결도 아직 완료되지 않았습니다. 로컬 검증 후 기존 원격 저장소와 충돌 없이 연결합니다.
