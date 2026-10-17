# Vercel + Neon 배포

현재 결정: Vercel Hobby에 바로 배포합니다. Neon 개발 브랜치를 첫 배포 DB로 사용합니다. 인증은 앱의 두 고정 계정이며 Neon Better Auth·Google OAuth는 사용하지 않습니다.

## 환경 변수

Vercel 프로젝트의 Production 환경에 입력합니다. 비밀 값은 Git에 저장하지 않습니다.

| 이름 | 값 |
| --- | --- |
| APP_URL | 프로젝트의 고정 HTTPS 주소. 끝에 / 없이 입력 |
| DATABASE_URL | Neon development 브랜치의 서버 연결 문자열. sslmode=require 포함 |
| GROOM_SETUP_TOKEN | 32바이트 난수 base64url. setup-local에서 생성 |
| BRIDE_SETUP_TOKEN | 다른 32바이트 난수 base64url |
| VAPID_PUBLIC_KEY | setup-local에서 생성된 키 |
| VAPID_PRIVATE_KEY | setup-local에서 생성된 비밀 키 |
| CRON_SECRET | setup-local에서 생성된 예약 호출 키 |

사진/PDF 기능은 AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, ATTACHMENT_BUCKET을 같은 프로젝트의 비공개 Object Storage에 맞춰 추가합니다. 초기 텍스트 기능에 필수는 아닙니다.

## 빌드와 DB 초기화

Node.js 24, 프레임워크 Next.js, 루트 ./, 출력 디렉터리는 기본값을 사용합니다. vercel.json의 buildCommand가 `npm run deploy:build`를 실행합니다. 필수 환경 변수 검사 → 변경된 SQL 마이그레이션 → Next.js 빌드 순서입니다. 최초 공동 공간은 실제 예식일과 지출 0원으로 만들며 재배포 시 덮어쓰지 않습니다.

Preview에는 별도 DB와 별도 APP_URL을 설정하기 전 Production 환경 변수를 복사하지 않습니다. 예약 실행은 Production 배포에서만 작동합니다.

## 두 계정의 첫 비밀번호

- 오성현: integer0125
- 정지윤: hawe123789

각자 `APP_URL/setup#role=groom&token=GROOM_SETUP_TOKEN` 또는 `APP_URL/setup#role=bride&token=BRIDE_SETUP_TOKEN` 링크를 엽니다. 변수 이름을 실제 값으로 치환한 링크는 비공개로 전달합니다. 실제 키를 README, 공개 코드, 로그에 기록하지 않습니다.

링크는 최초 DB 초기화부터 7일간, 계정당 한 번 사용할 수 있습니다. 비밀번호는 15자 이상이며 서버에 scrypt 해시로만 저장합니다. 일반 회원가입은 없고 계정은 두 개로 고정됩니다. 로그인은 30일 쿠키로 유지되며 계정 메뉴에서 현재 비밀번호를 확인하고 변경할 수 있습니다. 변경 시 다른 기기의 세션은 해제됩니다.

초기 설정 키를 변경해 재배포해도 사용한 링크나 기존 비밀번호는 초기화되지 않습니다. 계정 복구가 필요한 경우 DB 관리자 절차로 새 일회용 링크를 발급해야 합니다. 기존 설정 키를 계속 재사용하지 않습니다.

## 아이폰과 알림

Safari에서 배포 주소 열기 → 공유 → 홈 화면에 추가 → 홈 화면 아이콘으로 실행 → 로그인 → 알림 → 이 기기 알림 켜기 → 테스트 알림. 각 기기에서 허용합니다.

Vercel Hobby의 하루 한 번 Cron을 사용합니다. UTC 0시 예약은 한국 오전 9~10시 사이 실행되며 분 단위 정시 실행은 보장되지 않습니다. /api/jobs/reminders GET과 POST 모두 CRON_SECRET을 검사합니다. 변경 알림은 저장 후 별도 발송을 시도합니다.

## 확인할 항목

빌드와 도메인 규칙 검사는 통과했습니다. 배포 후 실제 DB 마이그레이션, 미로그인 접근 차단, 두 계정의 비밀번호 설정/로그인, 공동 동의, 파일, 아이폰 푸시를 실제 서비스에서 확인합니다. 비밀번호 설정 링크는 테스트 목적으로 대신 사용하지 않습니다.
