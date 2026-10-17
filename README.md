# 성현과 지윤의 결혼 준비

오성현 · 정지윤 / 2027-09-25 14:00 Asia/Seoul. 로즈 블러시 · Pretendard · 타임라인 A · 예산 B.

Next.js + Neon PostgreSQL. **Vercel Hobby에 바로 배포**합니다. [배포 절차](docs/vercel-deploy.md)를 먼저 확인하세요.

## 로그인

- 성현: integer0125
- 지윤: hawe123789

일반 회원가입은 없습니다. 각자 일회용 링크에서 첫 비밀번호를 설정하고 아이디/비밀번호로 로그인합니다. Neon Better Auth와 Google OAuth는 사용하지 않습니다. 비밀번호는 scrypt 해시로 저장하고 세션은 서버 DB에 보관합니다. 로그인 시도 제한, 30일 세션, 비밀번호 변경과 다른 기기의 세션 해제를 지원합니다.

## 기능

- 가로 마일스톤 타임라인, 날짜 미정 일정, 준비 체크리스트.
- 준비 항목 → 질문 → 후보 → 하위 질문, 선택 이유, 의견과 자료.
- 같은 후보의 같은 수정본에 두 사람이 동의해야 확정. 핵심 조건 변경 시 재동의.
- 초기 예산 3천만 원. 예산·분류·포함 범위의 공동 변경 제안.
- 계약 총액·지급액, 지급 완료/확정 미지급/미확정 예상 합계, 초과 표시.
- 빠른 기록, 보관과 복원, 최근 변경 이력.
- 비공개 사진/PDF 첨부 (별도 Object Storage 연결 필요).
- 내부 알림과 기기별 Web Push, 하루 한 번 일정 알림, iPhone PWA.
- 동시 수정은 버전 조건 갱신으로 충돌 감지. 원본은 Neon에 저장.

## 배포와 검증

Node.js 24에서 `npm test`와 `npm run build`가 통과했습니다. 기존 규칙 140개와 새 아이디/비밀번호/토큰 검사 19개를 포함합니다. 실제 DB, 두 계정 로그인, 파일, 아이폰 푸시는 배포 후 통합 검증합니다.

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
