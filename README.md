# DB-CRM — Customer & Data Management

보험·금융 영업 담당자를 위한 고객 관리(CRM) 웹 애플리케이션.

기존 엑셀로 관리하던 고객 DB를 웹으로 이관하여 담당자별 할당·세분화 권한 제어, 팝업 상세 편집·이미지 저장, 엑셀 포맷 호환(import/export)을 제공합니다.

**저장소**: https://github.com/Cayson-Choi/a1-insurance
제품 요구사항과 설계 배경은 [prd.md](./prd.md), 운영 매뉴얼은 [HANDOVER.md](./HANDOVER.md) 참조.

## 주요 기능

- **인증 / 권한**: Auth.js v5 Credentials, JWT 8h 세션, 유휴 30분 자동 로그아웃. 관리자(admin) + 담당자(agent, 권한 5종 `canCreate`·`canEdit`·`canDelete`·`canExport`·`canDownloadImage` 조합)
- **고객 목록 테이블 (28컬럼)**: 엑셀 고객명부와 1:1 매칭. **컬럼 헤더 클릭 정렬** (URL 쿼리 저장) · **드래그로 순서 재배치** (localStorage) · **Excel 방식 경계 리사이즈** (두 인접 컬럼 제로섬) · "컬럼 초기화" 버튼. **21:9 울트라와이드 자동 확장** — 화면 폭이 넓으면 28컬럼이 한 화면에 전부 펼쳐짐
- **자동 검색**: 이름·주소·전화 substring·주민번호 앞/뒤·통화결과·담당자·출생연도 범위 — 복합 AND, 텍스트는 400ms 디바운스
- **팝업 상세**: Intercepting Route 무깜빡 모달, 이전/다음, 단축키, 전화 걸기(`tel:`) · 복사 · 이미지 저장(`{이름}{년생2자리}{간단주소}.png`, `canDownloadImage` 권한 필요, 스크롤 가려진 부분까지 전체 캡처, 지사/본부/소속팀은 제외), 메모 우클릭 → 일시·담당자 자동 삽입, 데스크톱 드래그 이동
- **일괄 편집 (admin)**: 선택된 고객의 **담당자** 또는 **DB 등록일** 일괄 변경 (변경 이력 자동 기록)
- **엑셀 I/O**: 28컬럼 import/export, 평문 주민번호 처리, 중복 방지(고객코드No 또는 name+phone fallback)
- **로그인 알림**: Slack / Telegram 병행 발송 (구성된 채널만 자동 선택) — 성공·실패·강제 로그아웃 실시간 전송
- **강제 로그아웃**: `users.sessions_invalidated_at` 컬럼 기반, 관리자가 해당 사용자를 다음 요청 시점에 자동 로그아웃
- **접속 상태**: `last_seen_at` 1분 throttle 갱신, 5분 이내 활동 → 🟢 접속 중 표시
- **로그인 이력**: `/admin/logins` — 성공·실패 전체 감사 로그 (필터·페이지네이션)
- **관리자**: 사용자 CRUD + 비밀번호 재설정, 권한 4종 체크박스, 담당자 일괄 변경, 변경 이력 뷰어
- **모바일**: 햄버거 메뉴, 테이블 가로 스크롤, 팝업 풀스크린, 검색바 2열 그리드
- **브랜드**: DB-CRM 청록 `#0891b2`, 딥블루 `#1e3a8a`, Pretendard 폰트, OG 이미지(카톡·링크 프리뷰)
- **성능**: Vercel Function 리전을 Neon DB 와 동일(`sin1` Singapore)로 배치해 DB 왕복 지연 최소화 + React.cache 로 요청당 인증·권한 조회 중복 제거

---

## 기술 스택

| 영역 | 도구 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI primitives) |
| 테이블 DnD | `@dnd-kit/core` + `@dnd-kit/sortable` |
| 폰트 | Pretendard Variable (CDN) |
| 인증 | Auth.js v5 Credentials (JWT 세션, 8시간) |
| 비밀번호 | bcryptjs 12 round |
| DB ORM | Drizzle + Drizzle Kit |
| DB | PostgreSQL (Neon serverless) |
| 엑셀 | exceljs |
| 이미지 저장 | html-to-image |
| 알림 | Slack Incoming Webhooks · Telegram Bot API |
| 배포 | Vercel |

---

## 로컬 개발 환경 설정

### 사전 준비

- Node.js 20+ (현재 개발은 v24에서 검증)
- pnpm 10+ (`npm i -g pnpm`)
- Neon Postgres 프로젝트 (https://neon.tech)

### 1. 저장소 클론 + 의존성 설치

```bash
git clone https://github.com/Cayson-Choi/a1-insurance db-crm
cd db-crm
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일 생성:

```env
# [필수] Neon Postgres connection string (Pooled 권장)
DATABASE_URL=postgres://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require

# [필수] 세션 서명용 (48바이트 base64)
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
AUTH_SECRET=

# [선택] 링크 프리뷰용 절대 URL (미설정 시 Vercel URL 자동 감지, 로컬 fallback: localhost:3000)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# [선택] Slack 로그인 알림 — Incoming Webhook URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...

# [선택] Telegram 로그인 알림 — 두 값 모두 설정돼야 동작
TELEGRAM_BOT_TOKEN=12345:ABC...
TELEGRAM_CHAT_ID=123456789
```

> Slack·Telegram 중 하나만 있어도 되고, 둘 다 있으면 양쪽 모두에 알림 발송. 둘 다 없으면 알림만 조용히 skip되고 다른 기능은 정상 동작.

### 3. 데이터베이스 마이그레이션

```bash
pnpm db:generate     # 스키마 변경 시 SQL 생성 (초기 구축 시 이미 포함)
pnpm db:migrate      # Neon에 스키마 적용 (마이그 0000–0006)
pnpm db:seed         # 초기 사용자 시드 (admin + 샘플 담당자 7명)
pnpm db:import-xlsx  # material/고객명부.xlsx 를 DB로 import
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000 접속. 첫 화면에서 `/login`으로 리다이렉트됩니다.

초기 테스트 계정 (시드):

| ID | 비밀번호 | 역할 |
|---|---|---|
| `admin` | `admin1234` | 관리자 |
| `a00003`, `a00005`, `a00006`, `a00007`, `a00012`, `a00014`, `a44643` | `agent1234` | 담당자 |

> ⚠ **실제 배포 전 반드시 비밀번호를 변경**하세요. 관리자 페이지 → 사용자 관리 → 비밀번호 재설정.

---

## Vercel Production 배포

### 1. Vercel 프로젝트 생성

1. https://vercel.com/new 접속 (GitHub 계정 로그인 상태)
2. 저장소 Import
3. Framework: Next.js 자동 감지 / Root Directory: `./` / Build: `pnpm build`

### 2. Neon 통합 연결

Vercel 프로젝트 → **Storage** 탭 → **Add Integration** → **Neon** → 기존 프로젝트 연결. 통합이 자동으로 `DATABASE_URL`을 주입합니다.

### 3. 환경 변수 등록

Vercel 프로젝트 → Settings → Environment Variables. `Production` + `Preview` 환경에 등록:

| Key | 값 | 비고 |
|---|---|---|
| `AUTH_SECRET` | 로컬 `.env.local`에서 복사 | 필수 |
| `NEXT_PUBLIC_SITE_URL` | 운영 도메인 | OG 이미지·링크 프리뷰용 |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook | 선택 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot 토큰 | 선택 (chat_id와 세트) |
| `TELEGRAM_CHAT_ID` | Telegram chat_id | 선택 (bot_token과 세트) |

(`DATABASE_URL`은 Neon 통합이 자동 주입)

### 4. 배포

- `main` 브랜치에 푸시하면 자동 Production 배포
- Preview URL에서 `admin / admin1234` 로그인 → 정상 확인 후 **관리자 비밀번호 즉시 변경**

> ⚠ **환경변수 추가·변경 후 자동 재배포되지 않습니다**. Vercel 대시보드 → Deployments → 최신 배포 우측 ⋯ → **Redeploy** 클릭 필요.

### 5. CLI 대안 (선택)

```bash
vercel login
vercel link
vercel env add AUTH_SECRET
vercel --prod
```

### 6. 도메인 연결 (선택)

Vercel 프로젝트 → Settings → Domains → 원하는 도메인 추가.

---

## 주요 스크립트

```bash
pnpm dev              # Turbopack dev server
pnpm build            # Production build
pnpm start            # Production server (빌드된 결과)
pnpm lint             # ESLint

pnpm db:generate      # Drizzle 스키마 변경 → SQL 파일 생성
pnpm db:migrate       # 저장된 SQL 파일을 DB에 적용 (0000–0006)
pnpm db:studio        # Drizzle Studio (DB GUI)
pnpm db:seed          # 초기 사용자 시드
pnpm db:import-xlsx   # material/고객명부.xlsx 일괄 import
```

---

## 디렉토리 구조 (핵심)

```
app/
  (auth)/login/                  로그인 (DB-CRM 로고 + 태그라인)
  (app)/
    layout.tsx                   인증 필수 · 헤더/풋터 · 유휴 타임아웃
    customers/                   고객 목록·검색·상세
    admin/
      users/                     사용자 관리 (접속 상태 + 강제 로그아웃)
      excel/                     엑셀 업/다운로드
      audit/                     변경 이력
      logins/                    로그인 이력 (신규)
    @modal/(.)customers/[id]/    Intercepting Route 모달
  api/
    auth/[...nextauth]/          Auth.js
    customers/export/            엑셀 다운로드
    customers/import/            엑셀 업로드 (mode=preview|apply)
  layout.tsx                     OG 메타 · Toaster

lib/
  db/                            Drizzle 스키마·클라이언트
  auth/                          세션·RBAC·비밀번호 해시
  customers/
    columns.ts                   28컬럼 메타데이터 (단일 출처)
    queries.ts · actions.ts      쿼리·Server Actions
    get-detail.ts · schema.ts · preserve-query.ts
  excel/                         28컬럼 매핑·importer·exporter
  audit/                         감사로그 쿼리·diff
  users/
    queries.ts · actions.ts · schema.ts
    online.ts                    접속 상태 판정 (클라이언트 안전)
  logins/queries.ts              로그인 이벤트 쿼리
  notifications/
    index.ts                     디스패처 (Slack + Telegram 병행)
    format.ts                    공통 포맷 유틸
    slack.ts · telegram.ts       각 transport
  company.ts                     DB-CRM 브랜드 상수
  env.ts                         zod 기반 env 검증
  format.ts                      전화·날짜·마스킹 유틸

components/
  brand/                         로고·헤더·풋터
  auth/                          로그인 폼·유휴 타임아웃
  customers/
    list-table.tsx               TanStack-free 테이블 (정렬·DnD·리사이즈)
    use-table-prefs.ts           localStorage 훅
    detail-form.tsx · detail-dialog.tsx · search-bar.tsx · ...
  admin/
    user-table.tsx · user-form-dialog.tsx · ...
    force-logout-dialog.tsx      (신규) 강제 로그아웃 확인
    login-history-table.tsx      (신규) 로그인 이력 테이블
    login-filter.tsx · login-history-pagination.tsx (신규)
    audit-table.tsx · audit-filter.tsx · audit-pagination.tsx
  ui/                            shadcn/ui 기본 컴포넌트

scripts/                         CLI용 (migrate · seed · import-xlsx)
drizzle/                         생성된 마이그레이션 SQL (0000–0006)
material/                        원본 레퍼런스 (고객명부.xlsx, 로고 등)
public/
  brand/db-crm-logo.png          DB-CRM 로고
  og-image.png                   카톡·SNS 링크 프리뷰 이미지
auth.ts · auth.config.ts         Auth.js v5 구성
```

---

## 권한 시스템

`role` (admin / agent) + 담당자 권한 5종으로 구성됩니다.

| 권한 | 영향 범위 |
|---|---|
| `canCreate` | 엑셀 업로드(신규 고객 등록) — `/admin/excel` 페이지 접근 + import API |
| `canEdit` | 고객 상세 모든 필드 수정 (없으면 방문주소·메모·통화결과만 가능) |
| `canDelete` | 고객 삭제 버튼 |
| `canExport` | 엑셀 다운로드 |
| `canDownloadImage` | 고객 팝업의 **이미지 저장** 버튼 노출 |

- `admin` role 은 위 5종을 자동으로 모두 보유합니다.
- 담당자 일괄 재배정·DB 등록일 일괄 변경·사용자 관리·변경 이력·로그인 이력 뷰어는 항상 admin 전용.
- 관리자는 다른 사용자를 **강제 로그아웃** 가능 (본인 제외). 대상 사용자는 다음 페이지 이동 시 자동으로 `/login` 으로 돌아감.

---

## 알림 시스템

로그인·강제 로그아웃 이벤트를 외부 메신저로 실시간 전송합니다.

| 이벤트 | 내용 |
|---|---|
| 로그인 성공 | 🔐 이름·ID·역할 · IP · 브라우저 · 시각 |
| 로그인 실패 | 🚨 시도한 ID · IP · 실패 사유 · 시각 |
| 강제 로그아웃 | ⛔ 대상·관리자·시각 |

- **Slack**: `SLACK_WEBHOOK_URL` 설정 시 활성
- **Telegram**: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` 둘 다 설정 시 활성
- 양쪽 모두 구성하면 **병행 발송** (한쪽 실패해도 다른 쪽 영향 없음)
- 웹훅 실패는 로그인 자체를 막지 않음 (fire-and-forget, 3초 타임아웃)

---

## 운영 가이드

- **사용자 추가 · 비밀번호 관리**: 관리자 → 사용자 관리
- **엑셀 대량 이관**: 관리자 → 엑셀 업/다운로드 → 미리보기 → 업로드 실행 (`canCreate` 필요)
- **담당자 일괄 재배정**: 고객 목록 체크박스 다중 선택 → 플로팅 바 **담당자 일괄 변경** (admin 전용)
- **DB 등록일 일괄 변경**: 고객 목록 체크박스 다중 선택 → 플로팅 바 **DB 등록일 일괄 변경** → 날짜 지정 또는 비우기 (admin 전용, 감사로그 자동 기록)
- **변경 이력**: 관리자 → 변경 이력 (고객 데이터 변경 감사)
- **로그인 이력**: 관리자 → 로그인 이력 (인증 이벤트 감사)
- **강제 로그아웃**: 관리자 → 사용자 관리 → 각 사용자 행의 "로그아웃" 버튼
- **접속 상태 확인**: 사용자 관리 테이블 맨 왼쪽 컬럼 (🟢 접속 중 / ⚪ 오프라인, 5분 기준)
- **세션 만료**: 기본 8시간(JWT), 유휴 30분 자동 로그아웃(5분 전 경고)
- **이미지 저장 파일명**: `{고객이름}{생년2자리}{간단주소}.png` (예: `김동환79충북청주.png`)
- **메모 입력 단축**: 메모 textarea 우클릭 → `YYYY.MM.DD HH:mm (담당자) :` 자동 삽입
- **테이블 개인화**: 컬럼 헤더 클릭(정렬) · 드래그(순서 변경) · 경계 드래그(폭 조절) — localStorage 저장. "컬럼 초기화" 버튼으로 기본값 복원

---

## 성능 최적화

### 적용 중인 최적화

- **Vercel Function 리전 = Neon DB 리전** (`sin1` Singapore / `ap-southeast-1`)
  - 서버리스 함수가 Neon 과 같은 AWS 리전에 위치해 DB 쿼리 왕복 ~5ms
  - 리전 불일치 시(US East ↔ Singapore) 250ms/query 발생 → Singapore 통일로 ~95% 감소
- **React.cache 로 인증·권한 중복 조회 제거** (`lib/auth/rbac.ts`)
  - `getSessionUser()`, `getPermissions(agentId)` 를 `cache(...)` 래핑
  - layout + page 에서 둘 다 `requireUser` 호출해도 `auth()` 세션 콜백 DB 쿼리 1회
  - Intercepting Route 모달에서 layout·@modal·page 셋 중복 호출 → 1회로 통합
- **DB 커넥션 풀링**: Neon Pooler 엔드포인트 사용 (`-pooler.*.neon.tech`), Drizzle `max: 10 / prepare: false`
- **Auth.js jwt 콜백 `last_seen_at` throttle**: 1분 이내 UPDATE 스킵
- **standalone Next.js 빌드**: Vercel Edge 함수 대신 Fluid Compute (Node.js)

### 추가로 권장 가능한 개선 (선택)

| 방안 | 효과 | 비용 | 복잡도 |
|---|---|---|---|
| Neon Pro → auto-sleep 해제 | 첫 요청 cold start 1~2초 제거 | $19/월 | 설정만 |
| JWT 토큰에 권한 embed | 페이지당 DB 쿼리 -1 | 무료 | 중 (auth.ts + rbac.ts 수정) |
| `listAgents` `unstable_cache`(60s) | 관리자 페이지 DB 쿼리 -1 | 무료 | 낮 |

현 구성으로도 Singapore 리전 이동 + React.cache 적용만으로 이전 대비 약 **2~3배 빠른 페이지 로드**가 기대됩니다. 더 필요한 경우 위 방안을 순차 적용.
