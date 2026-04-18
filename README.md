# A-ONE CRM — 에이원 고객관리 시스템

에이원금융판매(주)([www.aonefs.co.kr](https://www.aonefs.co.kr))의 보험 영업 담당자용 고객 관리(CRM) 웹 애플리케이션.

기존 엑셀로 관리하던 고객 DB를 웹으로 이관하여 담당자별 할당·권한 제어, 주민번호 보호, 팝업 상세 편집·이미지 저장, 엑셀 포맷 호환(import/export)을 제공합니다.

**저장소**: https://github.com/Cayson-Choi/a1-insurance
**운영 URL**: https://a1-insurance.xyz
제품 요구사항과 설계 배경은 [prd.md](./prd.md), 운영 매뉴얼은 [HANDOVER.md](./HANDOVER.md) 참조.

## 주요 기능

- **인증 / 권한**: Auth.js v5 Credentials, JWT 8h 세션, 유휴 30분 자동 로그아웃. 관리자(admin) + 담당자(agent, 권한 2종 `canManage`·`canExport` 조합)
- **고객 관리**: 49+ 고객 DB, 자동 검색(이름·주소·전화 substring·주민번호 앞/뒤·통화결과·담당자), 페이지네이션, 통화결과 컬러 배지
- **팝업 상세**: Intercepting Route 무깜빡 모달, 이전/다음, 단축키, 전화 걸기(`tel:`) · 복사 · 이미지 저장
- **개인정보**: 주민번호 AES-256-GCM + HMAC-SHA256 이중 저장, 관리자 복호화 열람(감사로그)
- **엑셀 I/O**: 28컬럼 import/export, 자동 주민번호 암호화, 중복 방지(code or name+phone fallback)
- **관리자**: 사용자 CRUD + 비밀번호 재설정, 담당자별 권한 2종 체크박스, 담당자 일괄 변경, 변경 이력 뷰어, 고객 삭제(agent도 권한 부여 시)
- **브랜드**: A-ONE 주황 `#f7941d`, Pretendard 폰트, CI 로고·회사 정보 헤더/풋터

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

1. https://vercel.com/new 접속 (GitHub 계정 로그인 상태)
2. **Cayson-Choi/a1-insurance** 저장소 Import
3. Framework: Next.js 자동 감지 / Root Directory: `./` / Build: `pnpm build`

### 2. Neon 통합 연결

이미 Neon 프로젝트를 Vercel 통합으로 생성해 둔 상태라면, 해당 통합이 자동으로 `DATABASE_URL`을 주입합니다. 없으면:

Vercel 프로젝트 → **Storage** 탭 → **Add Integration** → **Neon** → 기존 `a1-insurance` 프로젝트 연결

### 3. 환경 변수 등록

Vercel 프로젝트 → Settings → Environment Variables. `Production` + `Preview` 환경에 각각 3종:

| Key | 값 |
|---|---|
| `AUTH_SECRET` | 로컬 `.env.local`에서 복사 |
| `PII_ENC_KEY` | 로컬 `.env.local`에서 복사 ⚠ 변경 금지 |
| `PII_HMAC_KEY` | 로컬 `.env.local`에서 복사 ⚠ 변경 금지 |

(`DATABASE_URL`은 Neon 통합이 자동 주입)

### 4. 배포

- `main` 브랜치에 푸시하면 자동 Production 배포
- **DB는 이미 초기화되어 있음** (로컬에서 `pnpm db:migrate` + `pnpm db:seed` + `pnpm db:import-xlsx` 로 세팅 완료한 상태)
- Preview URL 이나 Production URL에서 `admin / admin1234` 로그인 → 정상 확인 후 **관리자 비밀번호 즉시 변경**

### 5. CLI 대안 (선택)

Vercel CLI가 설치돼 있으면 터미널에서도 진행 가능:

```bash
vercel login                 # 브라우저 로그인
vercel link                  # GitHub 저장소와 프로젝트 연결
vercel env add AUTH_SECRET   # 3종 환경변수 추가
vercel env add PII_ENC_KEY
vercel env add PII_HMAC_KEY
vercel --prod                # Production 배포
```

### 6. 도메인 연결 — **a1-insurance.xyz**

Vercel 프로젝트 → Settings → Domains → **`a1-insurance.xyz`** 및 **`www.a1-insurance.xyz`** 추가.
도메인 등록처(예: Namecheap, Gabia)의 DNS 설정에서 Vercel이 안내하는 레코드를 추가하면 몇 분 내에 HTTPS 자동 발급됨.

배포 후 https://a1-insurance.xyz 에서 서비스 운영.

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
