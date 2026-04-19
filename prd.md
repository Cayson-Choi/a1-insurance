# JG-ORM — 제품 요구사항 문서 (PRD)

| 항목 | 값 |
|---|---|
| 제품명 | **JG-ORM** (Customer & Data Management) |
| 저장소 | https://github.com/Cayson-Choi/a1-insurance |
| 작성일 | 2026-04-19 |
| 버전 | 1.2 (브랜드 리뉴얼) |
| 상태 | 모든 기능 구현 완료 · Production build 통과 · 납품 문서 최신화 |

> 이 문서는 제품이 무엇을 해야 하는지(요구사항)와 어떻게 만들고 있는지(기술·설계 결정)를 함께 담는다. 사양 변경 시 반드시 아래 "변경 이력"에 기록한다.

---

## 목차

1. [목표와 성공 기준](#목표와-성공-기준)
2. [사용자와 역할](#사용자와-역할)
3. [기능 요구사항](#기능-요구사항)
4. [비기능 요구사항 (상용 UX 체크리스트)](#비기능-요구사항-상용-ux-체크리스트)
5. [브랜드 가이드](#브랜드-가이드)
6. [기술 결정](#기술-결정)
7. [데이터 모델](#데이터-모델)
8. [디렉토리 / 핵심 파일](#디렉토리--핵심-파일)
9. [구현 단계 (PR 단위 로드맵)](#구현-단계-pr-단위-로드맵)
10. [검증 계획](#검증-계획)
11. [배포](#배포)
12. [변경 이력](#변경-이력)

---

## 목표와 성공 기준

### 핵심 목표

JG-ORM은 보험·금융 영업 담당자용 **고객 및 데이터 관리 도구**다. 엑셀로 분산 관리되던 고객 정보를 웹으로 이관하여 다음을 제공:

1. 엑셀 28컬럼 데이터의 무손실 import / export 호환
2. 담당자별 할당·세분화된 권한 제어
3. 주민번호 등 민감 정보의 법적 수준 암호화·감사
4. 팝업 상세 편집 + 영업 현장 편의 (전화 걸기·이미지 저장)

### 성공 기준 (KPI)

- 49+ 고객 데이터 import → export 왕복 시 **데이터 손실 0건**
- 담당자 로그인 후 타인 고객 URL 직접 접근 시 **항상 접근 차단** (RBAC 누수 없음)
- 주민번호는 DB에서 평문으로 조회 불가 (암호문 + 해시만)
- 팝업 PNG 저장 시 **한글 폰트 깨짐 0건**
- Production build 0 error · 모바일/태블릿 반응형

---

## 사용자와 역할

| 역할 | 인원 (예상) | 권한 |
|---|---|---|
| **관리자 (admin)** | 1~2명 | 모든 기능 자동 부여. 사용자 CRUD · 담당자 일괄 재배정 · 엑셀 업/다운 · 감사로그 열람 · 주민번호 복호화 · 고객 삭제 · 담당자 변경 |
| **담당자 (agent)** | 2~10명 | 본인 배정 고객만 조회. 관리자가 부여한 권한에 따라 동작 |

담당자 ID 체계는 임의 형식 (예: `a00003`). 인증은 **담당자ID + 비밀번호**.

### 담당자 권한 매트릭스

담당자는 기본적으로 **읽기 전용 + 방문주소·메모·통화결과만 편집 가능**이며, 관리자가 아래 2개 권한을 개별 부여한다:

| 권한 | 허용되는 동작 |
|---|---|
| `canManage` (데이터 관리) | 본인 배정 고객의 모든 필드 편집 + 고객 삭제 |
| `canExport` (엑셀 다운로드) | 본인 배정 범위에서 엑셀 다운로드 |

권한이 전부 꺼져 있어도 다음은 항상 가능:
- 본인 배정 고객 조회·팝업 열람
- **방문주소 · 메모 · 통화결과** 편집·저장
- 전화 걸기(tel:) · 복사 · 팝업 이미지 저장 · 이전/다음 네비

관리자(admin)는 위 2개 권한을 암묵적으로 모두 포함하며, 추가로 **담당자 변경 · 주민번호 복호화 · 전체 고객 접근**이 가능.

---

## 기능 요구사항

### F1. 고객 목록 + 검색 + 페이지 이동 (최우선)

- 리스트 컬럼: 담당자(관리자만) / 이름 / 연락처 / 생년월일 / 주소 / 직업 / 통화결과 / 보험사 / DB등록일
- URL 쿼리 기반 필터 (공유·북마크 가능)
- 통화결과 컬러 배지 (예약·부재·가망·거절·결번·민원)
- 빈 상태 / 로딩 스켈레톤 / 에러 상태 UI

### F2. 고급 검색 — 자동 검색 (Live Search)

- 이름 / 주소(부분 일치) / **전화번호(하이픈 무시 substring)** / 통화결과 / 담당자(관리자만) / 주민번호 앞 6자리 / 주민번호 뒤 7자리 — 복합 AND
- 주민번호는 HMAC 해시 비교 (DB엔 원문 없음)
- 전화번호 substring: `regexp_replace(phone1, '[^0-9]', '', 'g')` 후 `LIKE` — `"651"` 입력 → `010-6514-9114` 등 매칭
- 입력/선택 변경 시 자동 검색 (텍스트 400ms 디바운스, 드롭다운 즉시), 우측에 "검색 중…" 스피너

### F3. 팝업 상세 편집 (Intercepting Route 모달)

- 목록에서 행 클릭 → 팝업 오버레이 (페이지 새로고침 없음, 이전/다음 시 깜빡임 없음)
- 좌 "고객 정보": 담당자(드롭다운/ReadOnly) / 지사·본부·소속팀 / 이름 / 생년월일 / 주민번호 등록상태 + 복호화 / 주민번호 앞·뒤 / 연락처(+전화/복사) / 원주소 / 방문주소 / 직업
- 우 "보험 / 상담 정보": 통화결과 / 보험사 / 보험상품명 / 가입일 / 예약일시 / DB 보험료 / 소분류 / DB 등록일 / DB 만기일 / 메모 / 등록·수정 일시
- 통화결과 enum: 예약 · 부재 · 가망 · 거절 · 결번 · 민원
- 연락처: `tel:` URI 전화 걸기 + 한국식 포맷 복사 버튼
- 이전/다음: 검색 결과 내 이동, URL은 `history.replaceState`로 조용히 갱신
- 키보드 단축키: Esc 닫기 · ←/→ 이전/다음 · Ctrl+S 저장 (capture phase)
- 저장 시 감사로그 기록 (before/after JSON, 변경된 필드 diff 자동 계산)
- 시인성: 편집 불가 필드도 진한 텍스트, 배경만 연한 회색

### F4. 담당자 변경 + 고객 삭제

- 관리자만: 팝업 "담당자" 드롭다운에서 직접 변경 → `agent_change` 감사로그
- 관리자만: 목록 체크박스 다중 선택 → 플로팅 BulkBar "담당자 일괄 변경" → `bulk_change` 일괄 기록
- 관리자 또는 canManage 있는 담당자: 팝업 우상단 "삭제" 버튼 → 확인 다이얼로그 → 삭제 전 감사로그 기록 후 영구 삭제
- 담당자: 본인 배정 고객만 보임 (쿼리 강제 + URL 직접 접근 시 not-found)

### F5. 엑셀 업/다운로드

- 관리자 또는 canExport 있는 담당자: 다운로드
- 관리자만: 업로드
- 업로드: 28컬럼 포맷 호환. 프리뷰(앞 10행·오류·미등록 담당자) → 검증(zod) → upsert (`customer_code` 또는 `name+phone1` fallback dedup)
- 업로드 시 주민번호 컬럼 자동 HMAC 해시 + AES-GCM 암호화
- 다운로드: 현재 필터 쿼리 결과 스트림. 한글 컬럼명 유지

### F6. 팝업 이미지 저장

- 팝업 상세를 보이는 그대로 PNG로 저장 (영업 기록·보고용, 권한 무관 누구나 가능)
- 파일명 `{고객명}_{YYYYMMDD-HHmm}.png`
- 편집 중 입력값도 DOM 반영된 상태로 캡처
- Pretendard 폰트 임베드 — 깨짐 없음

### F7. 관리자 페이지

- 사용자(담당자) CRUD — 추가·수정·비밀번호 리셋·삭제
- 사용자 추가 시 권한 체크박스: `데이터 관리` · `엑셀 다운로드`
- 본인 계정 보호 (관리자 강등 차단, 자기 삭제 차단)
- 감사로그 뷰어 — 필터(기간·action·actor), 변경 내용 요약 diff
- 주민번호 복호화 모달 — 사유 + `rrn_decrypt` 자동 기록, 닫으면 메모리 폐기

---

## 비기능 요구사항 (상용 UX 체크리스트)

- [x] 모든 화면에 JG-ORM 로고 + "JG-ORM 고객·데이터 관리" 헤더, 풋터
- [x] 로그인 화면: JG-ORM 로고 + 태그라인 "Customer & Data Management"
- [x] 빈 상태 · 로딩 스켈레톤 · 에러 상태 UI
- [x] 파괴적 동작(삭제·일괄변경·로그아웃) Confirm 다이얼로그
- [x] 세션 유휴 타임아웃 30분 자동 로그아웃, 5분 전 경고
- [x] 한국식 포맷: 전화 010-0000-0000, 주민 000000-0******, 날짜 YYYY-MM-DD, 금액 55,080원
- [x] 개인정보 최소 노출 (목록 마스킹, 팝업에서만 전체)
- [x] 키보드 단축키: Esc / ←/→ / Ctrl+S
- [x] 접근성: 라벨 · 포커스 링 · 대비 AA · 스크린리더 aria-live
- [x] 모바일 햄버거 메뉴, 반응형 테이블·검색바·팝업 풀스크린
- [x] 인쇄/이미지 저장 시 한글 폰트 깨짐 없음
- [x] favicon · title · meta 태그에 JG-ORM 브랜드
- [x] 검색 엔진 색인 차단 (robots: noindex)

---

## 브랜드 가이드

### 로고

- 파일: `public/brand/jg-orm-logo.png`
- 디자인: 청록·파랑 그라디언트의 동그라미 안에 인물·식물·네트워크 아이콘 + "JG-ORM" 텍스트 + "CUSTOMER & DATA MANAGEMENT" 부제

### 색상

| 토큰 | HEX | 용도 |
|---|---|---|
| `--brand` | `#0891b2` (cyan-600) | 주요 버튼, 포커스, 활성 상태 |
| `--brand-hover` | `#0e7490` (cyan-700) | hover / pressed |
| `--brand-muted` | `#ecfeff` (cyan-50) | 배경 강조 (선택된 행, 권한 배지) |
| `--brand-accent` | `#1e3a8a` (blue-900) | 보조 강조 (링크, 헤딩) |
| `--foreground` | `#0f172a` (slate-900) | 본문 텍스트 |
| `--muted-foreground` | `#64748b` (slate-500) | 보조 텍스트 |

### 타이포그래피

- **Pretendard Variable** (CDN), fallback Apple SD Gothic Neo → Noto Sans KR → Malgun Gothic
- 숫자는 `tabular-nums`로 정렬

### 제품 정보 (`lib/company.ts`)

- nameKo / nameEn: **JG-ORM**
- tagline: **Customer & Data Management**
- slogan: **고객·데이터를 한 곳에서**
- appName: **JG-ORM 고객·데이터 관리**

---

## 기술 결정

### 스택 요약

| 층 | 도구 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | 프론트·서버 통합, Server Actions, Intercepting Routes |
| 언어 | TypeScript | 상용 제품에서 타입 안전성 필수 |
| UI | Tailwind v4 + shadcn/ui (Base UI) | 브랜드 커스터마이즈 자유 |
| 폰트 | Pretendard Variable | 한국 웹앱 표준 |
| DB ORM | Drizzle | 서버리스 콜드스타트 가벼움, 타입 자동 |
| DB | PostgreSQL (Neon) | 관리형, Vercel 통합, branching, pg_trgm |
| 인증 | Auth.js v5 Credentials + JWT | 담당자ID/비번, 8h 세션, 30분 유휴 타임아웃 |
| 비밀번호 | bcryptjs (12 round) | 단방향 해시 |
| 주민번호 | AES-256-GCM + HMAC-SHA256 | 법 충족 + 검색 가능 |
| 입력 검증 | Zod | TypeScript 타입·런타임 동시 |
| 엑셀 | exceljs | 한글·스트리밍 |
| 이미지 저장 | html-to-image | Pretendard 임베드 |
| 배포 | Vercel | Next.js 공식, Preview, Neon 원클릭 |

### 주민번호 전략

- 앞자리: HMAC-SHA256(YYMMDD) 해시만 (검색용, 평문 미저장)
- 뒷자리: AES-256-GCM 암호화 + HMAC-SHA256 해시 이중 저장
- 키는 `PII_ENC_KEY` / `PII_HMAC_KEY` env로 분리
- 화면 기본 마스킹, 관리자만 복호화 — 호출 시 audit_log 자동 기록

### RBAC

- Auth.js Credentials + JWT (bcryptjs 12 round)
- 페이지 레벨 가드 (`requireUserWithPerms`)
- Server Action 내부에서 권한 재검증
- 일반 담당자 쿼리엔 `WHERE agent_id = session.agentId` 강제

---

## 데이터 모델

### users

`id, agent_id UNIQUE, password_hash, name, role('admin' | 'agent'), can_manage, can_export, created_at, last_login_at`

### customers (28컬럼 1:1 매핑 + PII 필드 분해)

`id, customer_code UNIQUE, agent_id FK, name, birth_date, rrn_front_hash, rrn_back_enc, rrn_back_hash, phone1, job, address, address_detail, call_result ENUM, db_product, db_premium, db_handler, sub_category, db_policy_no, db_registered_at, main_category, db_start_at, db_end_at, branch, hq, team, fax, reservation_received, reservation_at, memo, db_company, created_at, updated_at`

### audit_logs

`id, actor_agent_id, customer_id, action('agent_change' | 'bulk_change' | 'edit' | 'rrn_decrypt'), before JSONB, after JSONB, created_at`

### 인덱스

- `customers(agent_id)` · `(name)` · `(rrn_front_hash)` · `(rrn_back_hash)` · `(call_result)` · `(db_registered_at DESC)`
- pg_trgm GIN `(address)` (확장 시 적용)

---

## 디렉토리 / 핵심 파일

```
app/
  (auth)/login/page.tsx                        로그인 (JG-ORM 로고 + 태그라인)
  (app)/layout.tsx                             인증 가드 + 헤더/풋터/유휴 타임아웃
  (app)/customers/page.tsx                     목록 + URL 쿼리 검색 (자동 검색)
  (app)/customers/[id]/page.tsx                풀페이지 상세 (모달 폴백)
  (app)/@modal/(.)customers/[id]/page.tsx      Intercepting Route 모달
  (app)/admin/excel/page.tsx
  (app)/admin/users/page.tsx
  (app)/admin/audit/page.tsx
  api/customers/import/route.ts
  api/customers/export/route.ts

lib/
  db/schema.ts                                 Drizzle 스키마
  auth/rbac.ts                                 권한 헬퍼 (canManage, canExport)
  crypto/pii.ts                                AES-GCM + HMAC
  customers/actions.ts                         Server Actions (update/delete/bulkReassign/reveal)
  excel/column-map.ts                          28컬럼 매핑 (HEADER_ALIASES 포함)
  excel/importer.ts · exporter.ts
  audit/queries.ts · diff.ts
  users/queries.ts · actions.ts · schema.ts
  company.ts                                   JG-ORM 브랜드 상수

components/
  brand/logo.tsx · app-header.tsx · app-footer.tsx
  auth/login-form.tsx · idle-timeout.tsx
  customers/list-table.tsx · search-bar.tsx · pagination.tsx · detail-form.tsx
                                · detail-dialog.tsx · call-result-badge.tsx
                                · rrn-reveal-button.tsx · delete-customer-dialog.tsx
                                · bulk-reassign-dialog.tsx
  admin/excel-uploader.tsx · user-table.tsx · user-form-dialog.tsx
       · user-reset-password-dialog.tsx · user-delete-dialog.tsx
       · audit-table.tsx · audit-filter.tsx · audit-pagination.tsx
  ui/...                                       shadcn/ui

scripts/                                       migrate · seed · import-xlsx
drizzle/                                       마이그레이션 SQL
public/brand/jg-orm-logo.png                   브랜드 로고
```

---

## 구현 단계 (PR 단위 로드맵)

| # | 단계 | 상태 |
|---|---|---|
| 1 | 스캐폴드 (Next.js + Tailwind + shadcn/ui + Drizzle + Neon) | ✅ |
| 2 | 인증 + 레이아웃 (Auth.js + 헤더/풋터 + 유휴 타임아웃) | ✅ |
| 3 | 고객 목록 + 검색 + 페이지네이션 + 통화결과 배지 | ✅ |
| 4 | 팝업 상세 편집 (Intercepting Route) + 단축키 + 감사로그 + PNG 저장 | ✅ |
| 5 | 주민번호 암호화/해시 + 고급 검색 | ✅ |
| 6 | 엑셀 업/다운로드 + xlsx 자동 RRN 암호화 | ✅ |
| 7 | 사용자 관리 (CRUD + 비밀번호 리셋) | ✅ |
| 8 | 변경 이력 뷰어 + 주민번호 복호화 모달 | ✅ |
| 9 | 담당자 일괄 변경 + 고객 삭제 + 권한 시스템 (canManage·canExport) | ✅ |
| 10 | 납품 마감 점검 (loading/error, README, HANDOVER, 도메인) | ✅ |
| 11 | 모바일 최적화 (햄버거 메뉴 · 반응형) + 자동 검색 + 전화 걸기 | ✅ |
| 12 | **JG-ORM 브랜드 리뉴얼** (이전 흔적 전부 제거 · 청록 컬러 팔레트 · 새 로고) | ✅ |

---

## 검증 계획

### 로컬 개발

- `.env.local`에 `DATABASE_URL`, `PII_ENC_KEY`, `PII_HMAC_KEY`, `AUTH_SECRET`
- `pnpm db:migrate` → 스키마 반영
- `pnpm db:seed` → 초기 사용자 8명
- `pnpm db:import-xlsx` → 샘플 49건 import (주민번호 자동 암호화)
- `pnpm dev` → http://localhost:3000

### 시나리오 체크리스트

- [ ] admin 로그인 → 전체 49건 + 엑셀 다운/업 + 일괄 재배정 + audit_log
- [ ] 일반 담당자 로그인 → 본인 분만 보임, 타인 URL 직접 접근 시 차단
- [ ] 권한 없는 담당자 → 방문주소·메모·통화결과만 편집 가능, 나머지 disabled (텍스트는 진하게 보임)
- [ ] canManage 부여한 담당자 → 모든 필드 편집 + 고객 삭제 가능
- [ ] canExport 부여한 담당자 → 엑셀 다운로드 가능
- [ ] 주민 뒷자리 검색 → 해시 매칭, 화면은 마스킹
- [ ] 전화번호 substring 검색 (`651` → `010-6514-9114`)
- [ ] 자동 검색 (텍스트 디바운스, 드롭다운 즉시)
- [ ] 팝업 PNG 저장 → 한글 깨짐 없음
- [ ] 엑셀 라운드트립 → 49건 갱신 0 신규
- [ ] 30분 유휴 후 자동 로그아웃, 5분 전 경고
- [ ] 모바일 햄버거 메뉴 → 모든 메뉴 접근 가능, 테이블 가로 스크롤, 팝업 풀스크린

---

## 배포

1. GitHub 저장소 push
2. Vercel에서 저장소 연결 → 프로젝트 생성
3. Neon Marketplace integration → DATABASE_URL 자동 주입
4. 환경변수 3종 (`AUTH_SECRET`, `PII_ENC_KEY`, `PII_HMAC_KEY`) 등록 (Production · Preview)
5. Preview URL에서 시나리오 전수 재현
6. 통과 시 Production 승격 → 도메인 연결

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|---|---|---|---|
| 2026-04-19 | 1.0 | 초기 납품 릴리스 (10단계 완료) | 개발팀 |
| 2026-04-19 | 1.1 | 권한 통합(`canManage`+`canExport`) · 고객 삭제 · 전화 substring 검색 · 자동 검색 · 팝업 전 필드 편집 · 시인성 개선 | 개발팀 |
| 2026-04-19 | 1.1.1 | Vercel Production 배포 · 도메인 연결 · README/HANDOVER/PRD 최신화 | 개발팀 |
| 2026-04-19 | 1.2 | **브랜드 확정: JG-ORM (Customer & Data Management)**. 청록 컬러 팔레트(`#0891b2`) 적용, 로고(`public/brand/jg-orm-logo.png`), 풋터/로그인/메타데이터/엑셀 파일명/감사로그 라벨 통일, 운영 가이드 일반화 | 개발팀 |
