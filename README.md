# letsgetmarried

오성현 · 정지윤 / 2027-09-25 14:00 Asia/Seoul. 로즈 블러시 · Pretendard · 타임라인 A · 예산 B.

Next.js + Neon PostgreSQL. **Vercel Hobby에 바로 배포**합니다. [배포 절차](docs/vercel-deploy.md)를 먼저 확인하세요.

## 로그인

- 성현: integer0125
- 지윤: hawe123789

일반 회원가입은 없습니다. 각자 일회용 링크에서 첫 비밀번호를 설정하고 아이디/비밀번호로 로그인합니다. Neon Better Auth와 Google OAuth는 사용하지 않습니다. 비밀번호는 scrypt 해시로 저장하고 세션은 서버 DB에 보관합니다. 로그인 시도 제한, 30일 세션, 비밀번호 변경과 다른 기기의 세션 해제를 지원합니다.

## 기능

- **일정:** 날짜순 목록과 가로 흐름, 날짜 미정 일정, 바로 완료 체크.
- **결정할 것:** 한 줄 추가, 미정·진행 중·완료 상태, 정한 내용. 후보 비교와 자료는 상세에서 선택적으로 사용.
- **예산:** 목표 3천만 원에서 시작. 예산·분류·포함 범위를 바로 수정. 예상·확정·지급 완료와 부분 지급 지원.
- 결제 예정일과 30일 내 예정 금액, 중복 없는 계약 총액·지급액 집계.
- 의견·동의·재동의·예산 변경 승인 절차를 제거. 빠른 기록은 결정할 것에 통합.
- 참고 자료에서 정리한 선택형 준비 항목 16개, 일정에 불러오는 준비물 체크리스트 4종.
- 비공개 사진/PDF 첨부는 별도 Object Storage 연결 시 제공. 링크 자료는 바로 이용 가능.
- 설정에서 기기별 Web Push. 미완료 일정 알림과 iPhone PWA.
- 동시 수정은 버전 조건 갱신으로 충돌 감지. 두 계정의 로그인과 기록 접근 제한은 유지.

## 기존 기록 호환

`db/004_simple_planner.sql`은 기존 기록 전체를 `wedding.workspace_backups`에 한 번 백업하고 JSON 스키마 1·2를 허용합니다. 기존 SQL 파일은 변경하지 않습니다. 기존 기록은 읽을 때 변환하고 다음 저장 시 버전 조건 갱신과 함께 스키마 2로 저장합니다.

확정 후보와 지출 분류·지급액을 유지하고, 빠른 기록은 같은 ID의 결정 항목으로 합칩니다. 이전 의견과 동의 데이터는 UI에서 제거하되 원본 데이터에 남깁니다. 대기 중이던 예산 제안은 자동 적용하지 않습니다. 로컬 `references/`의 원본, 예시 금액과 하객 정보는 Git이나 실제 공동 기록에 업로드하지 않습니다.

## 배포와 검증

Node.js 24에서 `npm test`와 `npm run build`가 통과했습니다. 시안 모델 65개, 단순화·데이터 변환·예산·푸시 규칙 77개, 아이디/비밀번호/토큰 검사 19개를 포함합니다. 변경된 운영 화면과 실제 아이폰 푸시는 배포 후 검증합니다.

Vercel의 빌드는 환경 변수 검사 → DB 마이그레이션 → Next.js 빌드 순서입니다. 기존 공동 기록은 재배포해도 덮어쓰지 않습니다. `vercel.json`에 Singapore 리전과 하루 한 번 Cron을 지정했습니다.

## 로컬 개발 (선택)

```sh
npm ci
npm run setup:local
# .env.local에 APP_URL과 DATABASE_URL 입력
npm run doctor
npm run db:migrate
npm test
npm run build
npm run dev
```

`.env.local`과 비밀번호 설정 키는 Git에 포함하지 않습니다. 기존 `.env.local`을 사용하는 경우 GROOM_SETUP_TOKEN과 BRIDE_SETUP_TOKEN이 각각 32바이트 난수 base64url 값인지 확인하세요.

## 파일 구성

- app/: 실제 앱 화면과 API
- lib/: 도메인 규칙, 비밀번호 처리, 서버 연결
- db/: 버전별 SQL 마이그레이션
- public/: PWA 아이콘과 service worker
- scripts/: 설정 생성, 환경 점검, DB 초기화, 테스트
- docs/vercel-deploy.md: 현재 배포 절차
- index.html, studio.html, app.js, model.js: 이전 디자인 시안. 예시 데이터는 실제 DB에 이관되지 않음

이력 전체 내용 비교·복구, HEIC 변환, 이미지 확대 전용 화면은 후속 보완 대상입니다. 화면을 다시 열거나 새로고침하면 공동 기록을 갱신하며 실시간 스트리밍 방식은 아닙니다.
