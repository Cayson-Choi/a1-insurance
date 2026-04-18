# A-ONE CRM — 에이원 고객관리 시스템

에이원금융판매(주)([www.aonefs.co.kr](https://www.aonefs.co.kr))의 보험 영업 담당자용 고객 관리(CRM) 웹 애플리케이션.

기존 엑셀로 관리하던 고객 DB를 웹으로 이관하여 담당자별 할당·권한 제어, 주민번호 보호, 팝업 상세 편집·이미지 저장, 엑셀 포맷 호환(import/export)을 제공합니다.

제품 요구사항과 설계 배경은 [prd.md](./prd.md) 참조.

---

## 기술 스택

| 영역 | 도구 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI primitives) |
| 폰트 | Pretendard Variable |
| 인증 | Auth.js v5 Credentials (JWT 세션, 8시간) |
| 비밀번호 | bcryptjs 12 round |
| DB ORM | Drizzle + Drizzle Kit |
| DB | PostgreSQL (Neon serverless) |
| 민감정보 | AES-256-GCM (양방향) + HMAC-SHA256 (검색 해시) |
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
git clone <repo-url> a1-insurance
cd a1-insurance
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

# 주민번호 암호화 키 (32바이트 hex = 64 chars)
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PII_ENC_KEY=

# 주민번호 해시 키 (32바이트 hex)
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PII_HMAC_KEY=
```

> ⚠ 한 번 배포한 뒤에는 `PII_ENC_KEY`와 `PII_HMAC_KEY`를 **절대 바꾸면 안 됩니다** (기존 암호문·해시를 해독/검색할 수 없게 됨).

### 3. 데이터베이스 마이그레이션

```bash
pnpm db:generate     # 스키마 변경 시 SQL 생성 (초기 구축 시 이미 포함)
pnpm db:migrate      # Neon에 스키마 적용
pnpm db:seed         # 초기 사용자 시드 (admin + 샘플 담당자 7명)
pnpm db:import-xlsx  # material/고객명부.xlsx 를 DB로 import (주민번호 자동 암호화)
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

1. GitHub에 저장소 푸시
2. https://vercel.com → New Project → GitHub 저장소 선택 → Import
3. Framework: Next.js 자동 감지
4. Root Directory: `./`
5. Build Command: `pnpm build`

### 2. Neon 통합 연결

Vercel 프로젝트 → Storage 탭 → **Add Integration** → **Neon** → 기존 프로젝트 연결 (또는 신규 생성)
→ `DATABASE_URL` 환경 변수 자동 주입.

### 3. 환경 변수 등록

Vercel 프로젝트 → Settings → Environment Variables. `Production` + `Preview` 환경에 각각:

```
AUTH_SECRET
PII_ENC_KEY
PII_HMAC_KEY
```

(`DATABASE_URL`은 Neon 통합이 주입)

### 4. 첫 배포

- `main` 브랜치에 푸시하면 자동 Production 배포
- 배포 후 Vercel Shell 또는 로컬에서 `DATABASE_URL`을 Production 값으로 두고 `pnpm db:migrate` 한 번 실행 (스키마 생성)
- 이후 `pnpm db:seed` 로 admin 계정 한 개 생성, 관리자로 로그인 후 시드 계정 비밀번호 변경
- 테스트 데이터(xlsx) 불러오기는 **관리자 > 엑셀 업/다운로드** 페이지에서 진행

### 5. 도메인 연결 (선택)

Vercel 프로젝트 → Settings → Domains → `crm.aonefs.co.kr` 같은 서브도메인 추가.

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
  (auth)/login/                  로그인 (A-ONE CI, 슬로건)
  (app)/
    layout.tsx                   인증 필수 · 헤더/풋터 · 유휴 타임아웃
    customers/                   고객 목록·검색·상세(풀페이지·모달)
    admin/                       관리자 전용 페이지
      excel/                     엑셀 업/다운로드
      users/                     사용자 관리 (CRUD·비번 재설정)
      audit/                     변경 이력 뷰어
    @modal/(.)customers/[id]/    Intercepting Route 모달
  api/
    auth/[...nextauth]/          Auth.js
    customers/export/            엑셀 다운로드
    customers/import/            엑셀 업로드 (mode=preview|apply)

lib/
  db/                            Drizzle 스키마 · 클라이언트 · 쿼리
  auth/                          세션 · RBAC · 비밀번호 해시
  crypto/pii.ts                  AES-GCM + HMAC
  customers/                     쿼리 · Server Actions
  excel/                         28컬럼 매핑 · importer · exporter
  audit/                         감사로그 쿼리 · diff
  users/                         사용자 CRUD
  company.ts                     A-ONE 공식 정보 상수
  env.ts                         zod 기반 env 검증

components/
  brand/                         로고 · 헤더 · 풋터
  auth/                          로그인 폼 · 유휴 타임아웃
  customers/                     목록·상세·검색·일괄변경
  admin/                         엑셀·사용자·감사로그 UI
  ui/                            shadcn/ui 기본 컴포넌트

scripts/                         CLI용 (migrate · seed · import-xlsx)
drizzle/                         생성된 마이그레이션 SQL
material/                        원본 레퍼런스 (고객명부.xlsx, 로고 등)
public/brand/                    A-ONE 로고 에셋
```

---

## 운영 가이드

- **사용자 추가 · 비밀번호 관리**: 관리자 > 사용자 관리
- **엑셀 대량 이관**: 관리자 > 엑셀 업/다운로드 → 미리보기 → 업로드 실행 (고객코드No 또는 이름+전화로 중복 감지)
- **담당자 일괄 재배정**: 고객 목록에서 체크박스 다중 선택 → 플로팅 바 "담당자 일괄 변경"
- **주민번호 열람**: 고객 상세 팝업 → "복호화" 버튼 (변경 이력에 `rrn_decrypt` 자동 기록)
- **변경 이력 감사**: 관리자 > 변경 이력 (액션·작업자·기간별 필터)
- **개인정보 유출 대응**: 주민번호는 AES-256-GCM 암호화 + HMAC 해시 이중 저장. 평문은 DB에 없음. 복호화 시 반드시 감사로그 기록.
- **세션 만료**: 기본 8시간(JWT), 유휴 30분 자동 로그아웃(5분 전 경고)

---

## 라이선스 · 저작권

© 에이원금융판매(주). 내부 업무용 시스템.
