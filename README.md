# JK-CRM — Customer & Data Management

보험·금융 영업 담당자를 위한 고객 관리(CRM) 웹 애플리케이션.

기존 엑셀로 관리하던 고객 DB를 웹으로 이관하여 담당자별 할당·세분화 권한 제어, 팝업 상세 편집·이미지 저장, 엑셀 포맷 호환(import/export)을 제공합니다.

**저장소**: https://github.com/Cayson-Choi/a1-insurance
제품 요구사항과 설계 배경은 [prd.md](./prd.md), 운영 매뉴얼은 [HANDOVER.md](./HANDOVER.md) 참조.

## 주요 기능

- **인증 / 권한**: Auth.js v5 Credentials, JWT 8h 세션, 유휴 30분 자동 로그아웃. 관리자(admin) + 담당자(agent, 권한 4종 `canCreate`·`canEdit`·`canDelete`·`canExport` 조합)
- **고객 관리**: 자동 검색(이름·주소·전화 substring·주민번호 앞/뒤·통화결과·담당자·출생연도 범위), 페이지네이션, 통화결과 컬러 배지
- **팝업 상세**: Intercepting Route 무깜빡 모달, 이전/다음, 단축키, 전화 걸기(`tel:`) · 복사 · 이미지 저장(`{이름}{년생2자리}{간단주소}.png`), 메모 우클릭 → 일시·담당자 자동 삽입
- **드래그·UX**: 데스크톱 팝업 헤더 드래그로 위치 이동, 백드롭 투명, 메모 영역 확대
- **엑셀 I/O**: 28컬럼 import/export, 평문 주민번호 처리, 중복 방지(고객코드No 또는 name+phone fallback)
- **관리자**: 사용자 CRUD + 비밀번호 재설정, 담당자별 권한 4종 체크박스, 담당자 일괄 변경, 변경 이력 뷰어, 고객 삭제(canDelete 권한)
- **모바일**: 햄버거 메뉴, 테이블 가로 스크롤, 팝업 풀스크린, 검색바 2열 그리드
- **브랜드**: JK-CRM 청록 `#0891b2`, 딥블루 `#1e3a8a`, Pretendard 폰트

---

## 기술 스택

| 영역 | 도구 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI primitives) |
| 폰트 | Pretendard Variable (CDN) |
| 인증 | Auth.js v5 Credentials (JWT 세션, 8시간) |
| 비밀번호 | bcryptjs 12 round |
| DB ORM | Drizzle + Drizzle Kit |
| DB | PostgreSQL (Neon serverless) |
| 엑셀 | exceljs |
| 이미지 저장 | html-to-image |
| 배포 | Vercel |

---

## 로컬 개발 환경 설정

### 사전 준비

- Node.js 20+ (현재 개발은 v24에서 검증)
- pnpm 10+ (`npm i -g pnpm`)
- Neon Postgres 프로젝트 (https://neon.tech)

### 1. 저장소 클론 + 의존성 설치

```bash
git clone https://github.com/Cayson-Choi/a1-insurance jk-crm
cd jk-crm
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일 생성:

```env
# Neon Postgres connection string (Pooled 권장)
DATABASE_URL=postgres://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require

# 세션 서명용 (48바이트 base64)
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
AUTH_SECRET=
```

### 3. 데이터베이스 마이그레이션

```bash
pnpm db:generate     # 스키마 변경 시 SQL 생성 (초기 구축 시 이미 포함)
pnpm db:migrate      # Neon에 스키마 적용
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

| Key | 값 |
|---|---|
| `AUTH_SECRET` | 로컬 `.env.local`에서 복사 |

(`DATABASE_URL`은 Neon 통합이 자동 주입)

### 4. 배포

- `main` 브랜치에 푸시하면 자동 Production 배포
- Preview URL에서 `admin / admin1234` 로그인 → 정상 확인 후 **관리자 비밀번호 즉시 변경**

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
pnpm db:migrate       # 저장된 SQL 파일을 DB에 적용
pnpm db:studio        # Drizzle Studio (DB GUI)
pnpm db:seed          # 초기 사용자 시드
pnpm db:import-xlsx   # material/고객명부.xlsx 일괄 import
```

---

## 디렉토리 구조 (핵심)

```
app/
  (auth)/login/                  로그인 (JK-CRM 로고)
  (app)/
    layout.tsx                   인증 필수 · 헤더/풋터 · 유휴 타임아웃
    customers/                   고객 목록·검색·상세
    admin/                       관리자 전용 (excel/users/audit)
    @modal/(.)customers/[id]/    Intercepting Route 모달
  api/
    auth/[...nextauth]/          Auth.js
    customers/export/            엑셀 다운로드
    customers/import/            엑셀 업로드 (mode=preview|apply)

lib/
  db/                            Drizzle 스키마·클라이언트·쿼리
  auth/                          세션·RBAC·비밀번호 해시
  customers/                     쿼리·Server Actions
  excel/                         28컬럼 매핑·importer·exporter
  audit/                         감사로그 쿼리·diff
  users/                         사용자 CRUD
  company.ts                     JK-CRM 브랜드 상수
  env.ts                         zod 기반 env 검증
  format.ts                      전화·날짜·금액·마스킹 유틸

components/
  brand/                         로고·헤더·풋터
  auth/                          로그인 폼·유휴 타임아웃
  customers/                     목록·상세·검색·일괄변경·삭제
  admin/                         엑셀·사용자·감사로그 UI
  ui/                            shadcn/ui 기본 컴포넌트

scripts/                         CLI용 (migrate · seed · import-xlsx)
drizzle/                         생성된 마이그레이션 SQL (0000–0005)
material/                        원본 레퍼런스 (고객명부.xlsx, 로고 등)
public/brand/jk-crm-logo.png     JK-CRM 로고
```

---

## 권한 시스템

`role` (admin / agent) + 담당자 권한 4종으로 구성됩니다.

| 권한 | 영향 범위 |
|---|---|
| `canCreate` | 엑셀 업로드(신규 고객 등록) — `/admin/excel` 페이지 접근 + import API |
| `canEdit` | 고객 상세 모든 필드 수정 (없으면 방문주소·메모·통화결과만 가능) |
| `canDelete` | 고객 삭제 버튼 |
| `canExport` | 엑셀 다운로드 |

- `admin` role 은 위 4종을 자동으로 모두 보유합니다.
- 담당자 일괄 재배정·사용자 관리·변경 이력 뷰어는 항상 admin 전용.

---

## 운영 가이드

- **사용자 추가 · 비밀번호 관리**: 관리자 → 사용자 관리
- **엑셀 대량 이관**: 관리자 → 엑셀 업/다운로드 → 미리보기 → 업로드 실행 (`canCreate` 필요)
- **담당자 일괄 재배정**: 고객 목록 체크박스 다중 선택 → 플로팅 바 (admin 전용)
- **변경 이력 감사**: 관리자 → 변경 이력 (액션·작업자·기간별 필터)
- **세션 만료**: 기본 8시간(JWT), 유휴 30분 자동 로그아웃(5분 전 경고)
- **이미지 저장 파일명**: `{고객이름}{생년2자리}{간단주소}.png` 형식 (예: `김동환79충북청주.png`)
- **메모 입력 단축**: 메모 textarea 우클릭 → `YYYY.MM.DD HH:mm (담당자) :` 자동 삽입
