# DB-CRM 고객 데이터 관리

보험/금융 영업 조직에서 고객 DB를 엑셀로 업로드하고, 담당자별로 배정, 조회, 수정, 감사 추적을 수행하는 Next.js 기반 CRM입니다.

저장소: https://github.com/Cayson-Choi/a1-insurance

## 현재 주요 기능

- Auth.js v5 Credentials 로그인, JWT 세션, 유휴 시간 자동 로그아웃
- 역할 기반 권한: `admin`, `manager`, `agent`
- 세부 권한: 신규 등록, 수정, 삭제, 엑셀 내보내기, 이미지 저장
- 고객 목록 28개 컬럼, 컬럼 순서 저장, 컬럼 너비 조정, 정렬, 검색, 페이지당 최대 500건
- 담당자 필터: 전체, 미배정, 담당자별 조회
- 고객 선택 후 담당자 일괄 변경, DB 등록일 일괄 변경, 선택 삭제
- 고객 목록, 변경 이력, 로그인 이력 전체 삭제 버튼
- 엑셀 업로드 preview/apply 흐름
- 고객 코드, 주민번호 해시, 이름+전화번호 기준 upsert
- 엑셀 다운로드 시 수식 인젝션 방어
- 변경 이력과 로그인 이력 조회 및 선택 삭제
- Slack/Telegram 로그인 알림
- Vercel 배포, Neon/PostgreSQL, Drizzle migration

## 보안 구조

- 고객 주민번호 앞자리는 HMAC 해시로 검색하고, 뒷자리는 AES-256-GCM으로 암호화 저장합니다.
- 원문 주민번호 컬럼은 migration `0013_drop_plaintext_rrn.sql` 이후 제거됩니다.
- `PII_ENC_KEY`, `PII_HMAC_KEY`는 Vercel Production에서 Sensitive 환경변수로 등록해야 합니다.
- 고객 목록/상세/일괄 작업은 서버에서 RBAC를 다시 검사합니다. UI 권한만 믿지 않습니다.
- 엑셀 업로드는 `.xlsx` 확장자, MIME allowlist, ZIP 시그니처, 최대 용량, 최대 행 수를 검사합니다.
- import/export/detail API에는 no-store 보안 헤더와 사용자+IP 기준 rate limit을 적용합니다.
- 로그인 실패는 agentId와 IP 기준으로 누적 제한합니다.
- 주요 보안 헤더는 `next.config.ts`에서 설정합니다.

## 성능 구조

- 고객 목록 count와 rows 조회는 병렬 실행합니다.
- 고객 목록 정렬/검색을 위해 migration `0014_perf_security_indexes.sql`에서 복합 인덱스와 trigram 인덱스를 추가합니다.
- 이름/주소/전화번호 substring 검색은 PostgreSQL `pg_trgm` 인덱스를 사용합니다.
- 고객 import는 기존 고객 매칭에 필요한 최소 컬럼만 조회하고, 신규 고객은 500건 단위로 batch insert합니다.
- export는 엑셀에 필요한 컬럼만 조회하며 최대 50,000건으로 제한합니다.
- 500건 선택/해제는 React state로 500개 row를 모두 재렌더링하지 않도록 DOM checkbox 동기화 방식으로 처리합니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Framework | Next.js 16 App Router, Turbopack |
| Language | TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Base UI |
| Auth | Auth.js v5 Credentials |
| ORM/DB | Drizzle ORM, PostgreSQL/Neon |
| Excel | exceljs |
| Password | bcryptjs |
| Deploy | Vercel |

## 환경변수

`.env.local` 예시:

```env
DATABASE_URL=postgres://USER:PASS@HOST/neondb?sslmode=require
AUTH_SECRET=
PII_ENC_KEY=
PII_HMAC_KEY=
NEXT_PUBLIC_SITE_URL=https://your-domain.com
SLACK_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

키 생성 예시:

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32      # PII_ENC_KEY
openssl rand -hex 32      # PII_HMAC_KEY
```

## 로컬 개발

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

개발 서버: http://localhost:3000

## 배포

```bash
pnpm build
vercel --prod
```

DB 스키마 변경 후 운영 DB에 migration을 적용합니다.

```bash
pnpm db:migrate
```

## 주요 명령

```bash
pnpm dev              # 개발 서버
pnpm build            # 프로덕션 빌드
pnpm lint             # ESLint
pnpm db:migrate       # Drizzle migration 적용
pnpm db:seed          # 초기 사용자 seed
pnpm db:import-xlsx   # 로컬 엑셀 import 스크립트
```

## 주요 디렉터리

```text
app/
  (auth)/login/                  로그인
  (app)/customers/               고객 목록/상세
  (app)/admin/users/             사용자 관리
  (app)/admin/excel/             엑셀 업로드/다운로드
  (app)/admin/audit/             변경 이력
  (app)/admin/logins/            로그인 이력
  api/customers/import/          엑셀 업로드 API
  api/customers/export/          엑셀 다운로드 API
  api/customers/[id]/context/    고객 상세 모달 컨텍스트 API

components/
  customers/                     고객 목록, 검색, 일괄 작업 UI
  admin/                         관리자 화면 UI
  auth/                          로그인/세션 UI

lib/
  auth/                          RBAC, 권한, 비밀번호
  customers/                     고객 쿼리와 서버 액션
  db/                            Drizzle schema/client
  excel/                         엑셀 import/export
  security/                      PII 암호화, rate limit, audit redaction
  audit/                         변경 이력
  logins/                        로그인 이력
```

## 운영 체크리스트

- Production/Preview/Development 환경에 `DATABASE_URL`, `AUTH_SECRET`, `PII_ENC_KEY`, `PII_HMAC_KEY`가 모두 있는지 확인합니다.
- PII 키를 바꾸면 기존 암호화 주민번호는 복호화할 수 없습니다. 운영 중 키 교체는 별도 re-encryption 절차가 필요합니다.
- migration 추가 후 `pnpm db:migrate`를 운영 DB에 적용합니다.
- 기본 관리자 비밀번호나 테스트 계정은 운영 배포 전에 변경합니다.
- 대량 엑셀 업로드 전에는 기존 데이터 삭제 여부와 담당자 ID 매칭을 preview에서 확인합니다.
