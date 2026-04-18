# A1-insurance CRM — 제품 요구사항 문서 (PRD)

| 항목 | 값 |
|---|---|
| 제품명 | 에이원 고객관리 시스템 (A-ONE CRM) |
| 납품처 | 에이원금융판매(주) · https://www.aonefs.co.kr |
| 운영 URL | **https://a1-insurance.xyz** |
| 저장소 | https://github.com/Cayson-Choi/a1-insurance |
| 작성일 | 2026-04-18 ~ 2026-04-19 |
| 버전 | 1.1 (납품 준비 — 권한·편집·검색 개선) |
| 상태 | **모든 기능 구현 완료** · Production build 통과 · 납품 문서 최신화 · Vercel 배포 도메인 연결 |

> 이 문서는 제품이 **무엇을 해야 하는지**(요구사항)와 **어떻게 만들고 있는지**(기술·설계 결정)를 함께 담는다. 사양 변경 시 반드시 아래 "변경 이력"에 기록한다.

---

## 목차

1. [배경 / 납품 맥락](#배경--납품-맥락)
2. [목표와 성공 기준](#목표와-성공-기준)
3. [사용자와 역할](#사용자와-역할)
4. [기능 요구사항](#기능-요구사항)
5. [비기능 요구사항 (상용 납품 UX 체크리스트)](#비기능-요구사항-상용-납품-ux-체크리스트)
6. [브랜드 가이드](#브랜드-가이드)
7. [기술 결정](#기술-결정)
8. [데이터 모델](#데이터-모델)
9. [디렉토리 / 핵심 파일](#디렉토리--핵심-파일)
10. [구현 단계 (PR 단위 로드맵)](#구현-단계-pr-단위-로드맵)
11. [검증 계획](#검증-계획)
12. [배포](#배포)
13. [변경 이력](#변경-이력)

---

## 배경 / 납품 맥락

**납품처: 에이원금융판매(주)** (https://www.aonefs.co.kr) — 보험 종합 판매·컨설팅 회사. 자동차/생명/손해보험 취급. 본 프로젝트는 **상용 납품 제품**이므로 모든 화면·동작을 상용 수준 완성도로 빌드한다.

현재 에이원은 `고객명부.xlsx`(28컬럼, 수십~수백 행 추정) 엑셀 파일 한 장에 고객·담당자·상담 결과를 모두 기록하고 있다. 이로 인한 문제:

- 여러 명 동시 편집 시 충돌
- 변경 이력 추적 불가 (누가 언제 무엇을 바꿨는지)
- 주민번호 등 민감정보가 일반 엑셀에 평문으로 저장
- 검색이 느리고 필드 조건 조합이 불편
- 담당자 일괄 재배정 등 관리 작업을 수동으로 수행

본 제품은 이 엑셀 프로세스를 **웹 기반 CRM**으로 이관하여 위 문제를 해결한다.

---

## 목표와 성공 기준

### 핵심 목표

1. 엑셀 데이터의 **무손실 이관** (기존 `고객명부.xlsx` 28컬럼을 DB로 import, 반대로 export 가능)
2. **담당자별 할당·권한 제어** — 담당자는 본인 배정 고객만, 관리자는 전체
3. **주민번호 보호·감사로그** — 법(개인정보보호법) 충족 수준
4. **팝업 상세 편집 + 이미지 저장** — 영업 현장 편의
5. 모든 화면에 **A-ONE 브랜드 적용** — 상용 납품 품질

### 성공 기준 (KPI)

- `고객명부.xlsx` 전 행 import → export 왕복 시 **데이터 손실 0건**
- 담당자 로그인 후 타인 고객 URL 직접 접근 시 **항상 403** (RBAC 누수 없음)
- 주민번호는 DB에서 평문으로 조회 불가 (암호문 + 해시만)
- 팝업 PNG 저장 시 **한글 폰트 깨짐 0건**
- Lighthouse 접근성 점수 90+ / 모바일 태블릿까지 레이아웃 붕괴 없음

---

## 사용자와 역할

| 역할 | 인원 (예상) | 권한 |
|---|---|---|
| **관리자 (admin)** | 1~2명 | 모든 기능 자동 부여. 사용자 CRUD·담당자 일괄 재배정·엑셀 업/다운·감사로그 열람·주민번호 복호화·고객 삭제·담당자 변경 |
| **담당자 (agent)** | 2~10명 | 본인 배정 고객만 조회. 관리자가 부여한 권한에 따라 동작 |

담당자 ID 체계는 기존 엑셀 그대로 계승 (`a00003` 등). 인증은 **담당자ID + 비밀번호**.

### 담당자 권한 매트릭스

담당자는 기본적으로 **읽기 전용 + 방문주소·메모·통화결과만 편집 가능**이며, 관리자가 아래 2개 권한을 개별 부여한다:

| 권한 | 허용되는 동작 |
|---|---|
| `canManage` (데이터 관리) | 본인 배정 고객의 **모든 필드 편집**, 고객 **삭제** |
| `canExport` (엑셀 다운로드) | 본인 배정 범위에서 엑셀 다운로드 |

권한이 전부 꺼져 있어도 다음은 항상 가능:
- 본인 배정 고객 조회·팝업 열람
- **방문주소 · 메모 · 통화결과** 편집·저장 (영업 현장 기본 수요)
- 전화 걸기(tel:) · 복사 · 팝업 이미지 저장 · 이전/다음 네비

관리자 권한(admin)은 위 2개 권한을 암묵적으로 모두 포함하며, 추가로 **담당자 변경 · 주민번호 복호화 · 전체 고객 접근**이 가능.

---

## 기능 요구사항

### F1. 고객 목록 + 검색 + 페이지 이동 (최우선)

- 리스트 컬럼: 담당자 / 이름 / 연락처 / 생년월일 / 주소 / 직업 / DB등록일 / 보험사
- URL 쿼리 기반 필터 (공유·북마크 가능): `?name=&addr=&rrnFront=&rrnBack=&callResult=&page=`
- 통화결과는 컬러 배지로 표시 (예약·부재·가망·거절·결번·민원)
- 빈 상태 / 로딩 스켈레톤 / 에러 상태 UI 필수

### F2. 고급 검색 — 자동 검색 (Live Search)

- 이름 / 주소(부분 일치) / **전화번호(하이픈 무시 substring)** / 통화결과 / 담당자(관리자만) / 주민번호 앞 6자리 / 주민번호 뒤 7자리 — 복합 AND 조건
- 주민번호 검색은 HMAC 해시 비교 (DB엔 원문 없음)
- 전화번호 검색은 `regexp_replace(phone1, '[^0-9]', '', 'g')` 후 `LIKE '%digits%'` — `"651"` 입력 → `010-6514-9114` 등 매칭
- 입력/선택 변경 시 **자동 검색** (검색 버튼 없음): 텍스트 400ms 디바운스, 드롭다운 즉시
- 우측 진행 중 스피너 "검색 중…" 표시

### F3. 팝업 상세 편집 (Intercepting Route 모달)

- 목록에서 행 클릭 → 팝업 오버레이 (페이지 새로고침 없음, 이전/다음은 DOM만 교체되어 깜빡임 없음)
- 좌 "고객 정보": 담당자(드롭다운/ReadOnly) / 지사·본부·소속팀 / 이름 / 생년월일 / 주민번호 등록상태 + 복호화 / 주민번호 앞·뒤 / 연락처(+전화/복사 버튼) / 원주소 / 방문주소 / 직업
- 우 "보험 / 상담 정보": 통화결과 / 보험사 / 보험상품명 / 가입일 / 예약일시 / DB 보험료 / 소분류 / DB 등록일 / DB 만기일 / 메모 / 등록·수정 일시
- 통화결과 enum: **예약 · 부재 · 가망 · 거절 · 결번 · 민원**
- 연락처: `tel:` URI 전화 걸기 (Windows Phone Link·iOS·모바일) + 한국식 포맷 복사 버튼
- 이전/다음 버튼 — 검색 결과 내 고객 간 이동, URL은 `history.replaceState`로 조용히 갱신 (라우트 재호출 없음)
- 키보드 단축키: `Esc` 닫기 · `←/→` 이전/다음 · `Ctrl+S` 저장 (capture phase — 입력창 포커스 중에도 동작)
- 저장 시 감사로그 기록 (before/after JSON, 변경된 필드 diff 자동 계산)
- **시인성**: 편집 불가 필드도 `text-foreground`로 진하게 렌더, 배경만 연한 회색

### F4. 담당자 변경 + 고객 삭제

- **관리자만**: 팝업 "담당자" 드롭다운에서 직접 변경 → 저장 시 감사로그 `agent_change`
- **관리자만**: 목록 체크박스 다중 선택 → 플로팅 BulkBar "담당자 일괄 변경" → `bulk_change` 감사로그 일괄 기록
- **관리자 또는 canManage 있는 담당자**: 팝업 우상단 "삭제" 버튼 → 확인 다이얼로그 → 삭제 전 감사로그 기록(이름·연락처·이전 담당자 스냅샷) 후 레코드 영구 삭제
- **담당자**: 본인 배정 고객만 보임 (쿼리 레벨에서 `WHERE agent_id = session.agentId` 강제, URL 직접 접근 시 not-found UI)

### F5. 엑셀 업/다운로드

- **관리자 또는 canExport 있는 담당자** 다운로드
- **관리자만** 업로드 (일괄 변경은 감사 영향이 큼)
- 업로드: `고객명부.xlsx` 28컬럼 포맷 호환. 프리뷰(앞 10행·오류·미등록 담당자 표시) → 검증(zod) → **upsert** (`customer_code` 기준 또는 `name+phone1` fallback dedup)
- 업로드 시 주민번호 컬럼(`주민No`) 자동으로 HMAC 해시 + AES-GCM 암호화 저장
- 다운로드: 현재 적용된 검색 쿼리 결과를 엑셀 스트림으로 응답 (`phone`·`agentId` 필터 포함)
- 한글 컬럼명·UTF-8 인코딩 보장. 헤더는 "주소상세" ↔ "방문주소" 양쪽 인식(import), export는 "방문주소"

### F6. 팝업 이미지 저장

- 팝업 상세 화면을 **보이는 그대로 PNG로 저장** (영업 기록·보고용, 권한 무관 누구나 가능)
- 파일명 `{고객명}_{YYYYMMDD-HHmm}.png`
- 편집 중인 입력값도 DOM에 반영된 상태로 캡처 (저장 직전 blur)
- 한글 폰트(Pretendard) 임베드 — 깨짐 없음

### F7. 관리자 페이지

- 사용자(담당자) CRUD — 추가·수정·비밀번호 리셋·삭제
- 사용자 추가 시 **담당자 권한 체크박스**: `데이터 관리 (입력·수정·삭제)` · `엑셀 다운로드`
- 본인 계정 보호 (관리자 강등 차단, 자기 삭제 차단)
- 감사로그 뷰어 — 필터(기간·action·actor), 페이지네이션, 변경 내용 요약 diff
- 주민번호 복호화 열람 모달 — 사유 입력 + 감사로그 `rrn_decrypt` 자동 기록, 닫으면 메모리에서 즉시 폐기

---

## 비기능 요구사항 (상용 납품 UX 체크리스트)

- [ ] 모든 화면에 **A-ONE 로고 + "에이원 고객관리 시스템"** 헤더, 회사정보 풋터(대표이사·사업자번호·주소·TEL)
- [ ] 로그인 화면: A-ONE CI, 슬로건 "ALWAYS WITH CUSTOMERS", 저작권 표기
- [ ] 빈 상태 · 로딩 스켈레톤 · 에러 상태 UI 모든 목록/상세에 적용
- [ ] 파괴적 동작(삭제·일괄변경·로그아웃) Confirm 다이얼로그 + "되돌릴 수 없습니다" 문구
- [ ] **세션 유휴 타임아웃 30분** 자동 로그아웃, 경고 모달 (5분 전 예고)
- [ ] 한국식 포맷 유틸 일괄 사용: 전화 `010-0000-0000`, 주민 `000000-0******`, 날짜 `YYYY-MM-DD`, 금액 `55,080원`
- [ ] 개인정보 최소 노출 (목록 마스킹, 팝업에서만 전체 — 전체 열람도 권한 분리)
- [ ] 키보드 단축키: 팝업 `Esc` / `←` `→` / `Ctrl+S`
- [ ] 접근성 기본: 라벨 · 포커스 링 · 대비 AA · 스크린리더 aria-live for toast
- [ ] 인쇄/이미지 저장 시 한글 폰트 깨짐 없음 (Pretendard 임베드)
- [ ] favicon · title · meta 태그에 "에이원" 브랜드 반영
- [ ] 검색 엔진 색인 차단 (`robots: noindex`) — 회사 전용 내부 시스템

---

## 브랜드 가이드

### 색상 (A-ONE CI 추출)

| 토큰 | HEX | 용도 |
|---|---|---|
| `--brand` | `#f7941d` | 주요 버튼, 포커스, 활성 상태 |
| `--brand-hover` | `#e87714` | hover / pressed |
| `--brand-muted` | `#fef3e2` | 배경 강조 (예: 선택된 행) |
| `--brand-accent` | `#253dbe` | 보조 강조 (링크, 헤딩) |
| `--foreground` | `#1f2937` | 본문 텍스트 |
| `--muted-foreground` | `#6b7280` | 보조 텍스트 |

### 타이포그래피

- **Pretendard Variable** (CDN 임포트, fallback: Apple SD Gothic Neo → Noto Sans KR → Malgun Gothic)
- 숫자는 `tabular-nums`로 통일 (CRM 표에서 정렬감)

### 로고 · 공식 정보 (상수화: `lib/company.ts`)

- 한글: 에이원금융판매(주)
- 영문 태그라인: Agency Number One
- 슬로건: **ALWAYS WITH CUSTOMERS** / "마음이 든든해지는 고객 만족 보험서비스"
- 대표이사: 정현호, 노승창
- 사업자등록번호: 124-87-21729
- 주소: 서울특별시 종로구 대학로 19 / 광진구 능동로 294
- TEL: 02-538-4422 / 02-420-2288
- 로고 에셋: `public/brand/aonefs-logo.png` (가로형), `public/brand/aonefs-ci.gif` (CI)

---

## 기술 결정

### 스택 요약

| 층 | 도구 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 16 (App Router)** | 프론트·서버 통합, Server Actions, Intercepting Routes |
| 언어 | **TypeScript** | 상용 제품에서 타입 안전성 필수 |
| UI | **Tailwind v4 + shadcn/ui** | 브랜드 커스터마이즈 자유, 복사형 컴포넌트 |
| 폰트 | **Pretendard Variable** | 한국 웹앱 표준, 상용감 |
| DB ORM | **Drizzle** | 서버리스 콜드스타트 가벼움, 타입 자동 추출, SQL-like 문법 |
| DB | **Postgres (Neon)** | 관리형, Vercel 통합, branching, 한글 UTF-8, pg_trgm |
| 인증 | **Auth.js v5 Credentials** + JWT | 담당자ID/비밀번호, 세션 30분 유휴 |
| 비밀번호 | **bcryptjs (12 round)** | 업계 표준 단방향 해시 |
| 주민번호 | **AES-256-GCM** (원문 보관) + **HMAC-SHA256** (검색용 해시) | 법 충족 + 검색 가능 |
| 입력 검증 | **Zod** | TypeScript 타입·런타임 동시 검증 |
| 엑셀 | **exceljs** | 한글·스트리밍·스타일 |
| 이미지 저장 | **html-to-image** | 안정적, Pretendard 임베드 가능 |
| 배포 | **Vercel** | Next.js 공식, Preview 배포, Neon 원클릭 |

### 주민번호 전략 (개인정보보호법 대응)

- **앞자리**: HMAC-SHA256 해시(검색용) + 평문 보관 (생년월일과 중복이라 민감도 낮음)
- **뒷자리**: **AES-256-GCM 암호화** 저장(표시용 복호화 가능) + **HMAC-SHA256 해시** 저장(검색 비교용) **이중 저장**
- 키는 Vercel env `PII_ENC_KEY`, `PII_HMAC_KEY` 로 분리
- 기본 화면은 `901201-1******` 마스킹, 관리자만 복호화 API 호출 가능 — 호출 시 audit_log에 자동 기록

### 인증 / RBAC

- Auth.js Credentials Provider + JWT 세션 (bcryptjs 12 round)
- `middleware.ts`로 `/customers`, `/admin` 보호
- RBAC은 **Server Action 내부에서 재검증** (클라이언트 분기 신뢰 금지)
- 일반 담당자 쿼리엔 `WHERE agent_id = session.agentId` 강제

### 팝업 이미지 저장

- 팝업 루트 DOM에 `ref` → `html-to-image`의 `toPng(ref.current, { fontEmbedCSS })` 캡처 → `<a download>`로 저장
- 캡처 직전 `blur()`로 편집 중 입력값 DOM에 반영
- 파일명 `{고객명}_{YYYYMMDD-HHmm}.png`
- 대안: `dom-to-image-more` (필요 시 교체)

### 엑셀 업/다운

- `exceljs` 기반. 컬럼 매핑은 `lib/excel/column-map.ts` 한 곳에 집중
- 업로드: multipart → 스트림 파싱 → zod 검증 → `INSERT ... ON CONFLICT (customer_code) DO UPDATE` upsert
- 다운로드: 현재 검색 쿼리 결과 스트림 응답

---

## 데이터 모델

### users

`id, agent_id UNIQUE (예: a00003), password_hash, name, role('admin' | 'agent'), branch, hq, team, created_at, last_login_at`

### customers (엑셀 28컬럼 1:1 매핑 + PII 필드 분해)

`id, customer_code UNIQUE, agent_id FK → users.agent_id, name, birth_date, rrn_front_hash, rrn_back_enc, rrn_back_hash, phone1, job, address, address_detail, call_result ENUM('예약','부재','가망','거절','결번','민원'), db_product, db_premium, db_handler, sub_category, db_policy_no, db_registered_at, main_category, db_start_at, db_end_at, branch, hq, team, fax, reservation_received, reservation_at, memo, db_company, created_at, updated_at`

### audit_logs

`id, actor_agent_id, customer_id, action('agent_change' | 'bulk_change' | 'edit' | 'rrn_decrypt'), before JSONB, after JSONB, created_at`

### 인덱스

- `customers(agent_id)` — RBAC 필터용
- btree `(name)`, `(rrn_front_hash)`, `(rrn_back_hash)`, `(call_result)`, `(db_registered_at DESC)`
- **pg_trgm GIN** `(address)` — 부분 일치 검색용

---

## 디렉토리 / 핵심 파일

```
app/
  (auth)/login/page.tsx
  (app)/layout.tsx                       — 세션 가드 + 헤더/풋터
  (app)/customers/page.tsx               — 목록 + URL 쿼리 검색
  (app)/customers/[id]/page.tsx          — 풀페이지 상세 (SEO fallback)
  (app)/@modal/(.)customers/[id]/page.tsx — Intercepting Route 팝업
  (app)/admin/excel/page.tsx
  (app)/admin/users/page.tsx
  (app)/admin/audit/page.tsx
  (app)/admin/bulk-assign/page.tsx
  api/customers/import/route.ts
  api/customers/export/route.ts
lib/
  db/schema.ts                           ← 핵심
  db/client.ts
  db/queries.ts
  auth/session.ts
  auth/rbac.ts                           ← 핵심
  crypto/pii.ts                          ← 핵심 (AES-GCM + HMAC)
  excel/column-map.ts                    ← 핵심 (28컬럼 매핑)
  excel/importer.ts
  excel/exporter.ts
  company.ts                             ← 회사 공식 정보 상수
  env.ts                                 ← 환경변수 zod 검증
components/
  brand/logo.tsx
  brand/app-footer.tsx
  brand/app-header.tsx                   — (예정)
  customers/list-table.tsx
  customers/detail-dialog.tsx
  customers/search-bar.tsx
  customers/image-save-button.tsx
  ui/...                                 — shadcn/ui
middleware.ts
drizzle.config.ts
```

---

## 구현 단계 (PR 단위 로드맵)

| # | 단계 | 상태 | 핵심 산출물 |
|---|---|---|---|
| 1 | **스캐폴드** | ✅ 완료 | Next.js 16 + Tailwind + shadcn/ui + Drizzle + A-ONE 브랜드 토큰 + Pretendard + 회사정보 컴포넌트 |
| 2 | **브랜드 레이아웃 + 인증** | ✅ 완료 | A-ONE 헤더/풋터, `/login`, Auth.js Credentials, users 시드(8명), 페이지 레벨 가드, RBAC, 30분 유휴 타임아웃. Next.js 16 proxy.ts 호환 이슈로 middleware 대신 layout-level 가드 채택 |
| 3 | **고객 목록 + 기본 검색** | ✅ 완료 | 대시보드 쉘, Server Component 테이블, 페이지네이션, 이름/주소/통화결과/담당자 필터, 통화결과 컬러 배지, 빈/로딩 상태, RBAC 쿼리 분기 (admin 49건 ↔ agent 본인분만) |
| 4 | **팝업 상세 편집** | ✅ 완료 | Intercepting Route 모달 (`@modal/(.)customers/[id]`) + 풀페이지 폴백, 2.png 스타일 좌/우 2열 레이아웃, Server Action `updateCustomerAction` + zod 검증 + 감사로그(`edit`/`agent_change`), 이전/다음 네비(검색 컨텍스트 유지), 키보드 단축키(Esc·Ctrl+S·Ctrl+←·Ctrl+→), 팝업 PNG 저장(`html-to-image`) 선행 구현 |
| 5 | **주민번호 암호화 + 고급 검색** | ✅ 완료 | `lib/crypto/pii.ts` (AES-256-GCM 양방향 + HMAC-SHA256 검색 해시), 검색바에 주민 앞 6 · 뒤 7 필드 추가, 상세 폼에서 입력 → 해시·암호문 저장, 등록 상태 Pill 표시, 평문은 DB에 일절 저장되지 않음. 관리자 "복호화 reveal" UI는 7단계 관리자 페이지에서 추가 |
| 6 | **엑셀 업/다운 + 팝업 이미지 저장** | ✅ 완료 | `/admin/excel` 페이지(미리보기→확인→upsert), `/api/customers/import` (preview/apply 모드), `/api/customers/export` (현재 검색 쿼리 유지), 28컬럼 한글 헤더·주황색 헤더 스타일. 팝업 PNG 저장은 4단계에서 선행 구현. RBAC는 `ForbiddenError`로 403 JSON 반환 |
| 7 | **관리자 사용자 관리** | ✅ 완료 | `/admin/users` CRUD 페이지, 추가·수정·비밀번호 재설정·삭제 다이얼로그, 본인 계정 강등/삭제 방지, 담당 고객 수 집계, 삭제 시 FK SET NULL로 고객 미배정 전환 |
| 8 | **변경 이력 + 주민번호 reveal** | ✅ 완료 | `/admin/audit` 페이지 (액션·작업자·날짜 필터, 페이지네이션, 요약 diff 뷰), 관리자용 RRN 복호화 버튼(확인 모달 + 감사로그 `rrn_decrypt` 자동 기록, 열람 사유 기록, 닫을 때 메모리 폐기) |
| 9 | **담당자 일괄 변경** | ✅ 완료 | 관리자 전용 체크박스 컬럼 + 전체 선택/해제, 플로팅 BulkBar(선택 건수 표시), 담당자/미배정 선택 다이얼로그, `bulkReassignAction` Server Action, 감사로그 `bulk_change` 기록 |
| 10 | **납품 마감 점검** | ✅ 완료 | Production build 0 error, 관리자 페이지 loading 스켈레톤, `(app)` 범위 error boundary, 고객 상세 not-found 페이지, [README.md](./README.md) 기술 배포 가이드, [HANDOVER.md](./HANDOVER.md) 운영 인수인계 가이드 |
| 11 | **납품 전 UX · 권한 고도화** | ✅ 완료 | 전화 걸기·복사 버튼 · 담당자 권한 통합(`canManage`+`canExport`) · 고객 삭제 · 전화번호 substring 검색 · 자동 검색(디바운스) · 팝업 전 필드 편집 · 제한 편집(방문주소·메모·통화결과) · 시인성 개선 · `users.소속` 제거 |

---

## 검증 계획

### 로컬 개발 환경

- `.env.local`에 `DATABASE_URL`, `PII_ENC_KEY`, `PII_HMAC_KEY`, `AUTH_SECRET` 설정
- `pnpm db:push` → 스키마 반영
- `pnpm db:import-xlsx` → `material/고객명부.xlsx`를 DB에 주입
- `pnpm dev` → http://localhost:3000 브라우저 확인

### 시나리오 체크리스트 (납품 전 필수)

- [ ] admin 로그인 → 전체 목록 조회, 엑셀 업/다운, 담당자 `a00003`에게 10건 일괄 할당, audit_log 확인
- [ ] 일반 담당자 `a00003` 로그인 → 본인 할당분만 보임, 타인 고객 URL 직접 접근 시 403
- [ ] 주민번호 뒷자리 `1234567` 검색 → 해시 매칭 건 조회, 화면은 마스킹
- [ ] 이름/주소/통화결과 복합 필터, 팝업 열고 이전/다음 → 검색 컨텍스트 유지
- [ ] 팝업 상세 화면에서 "이미지 저장" 버튼 클릭 → 팝업 전체가 1장 PNG로 저장됨, 한글 폰트 깨짐 없음, 파일명 `{고객명}_{YYYYMMDD-HHmm}.png`, 편집 중 입력값도 캡처에 반영
- [ ] 엑셀 업로드 후 `customer_code` 기준 upsert 동작 확인, 검색결과만 다운로드 → 행 수 일치
- [ ] 30분 유휴 후 자동 로그아웃, 5분 전 경고 모달 노출
- [ ] Lighthouse 접근성 90+, 태블릿 뷰포트에서 레이아웃 무너짐 없음

---

## 배포

1. GitHub 저장소 생성 및 코드 푸시
2. Vercel에서 저장소 연결 → 프로젝트 생성
3. Neon Marketplace integration으로 Postgres 연결 → `DATABASE_URL` 자동 주입
4. 환경변수 3종(`AUTH_SECRET`, `PII_ENC_KEY`, `PII_HMAC_KEY`) 등록 (Production · Preview)
5. Preview URL에서 위 시나리오 전수 재현
6. 통과 시 Production 승격 → 에이원 지정 도메인 연결

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|---|---|---|---|
| 2026-04-18 | 0.1 | 초안 작성. 1단계 스캐폴드 완료 시점 기준. 에이원금융판매(주) 납품 맥락·브랜드·상용 UX 체크리스트 포함 | 개발팀 |
| 2026-04-18 | 0.2 | 2단계(인증·브랜드 레이아웃) 완료. Auth.js v5 Credentials, 로그인 화면, 헤더/풋터, 30분 유휴 타임아웃, 사용자 시드 8명. Next.js 16 proxy.ts 호환 미성숙으로 layout-level 가드 방식 채택 | 개발팀 |
| 2026-04-18 | 0.3 | 3단계(고객 목록·검색·페이지네이션) 완료. `고객명부.xlsx` 49건 import, 통화결과 배지, URL 쿼리 기반 필터, RBAC 검증(admin 49건 / a00012 12건) | 개발팀 |
| 2026-04-18 | 0.4 | 4단계(팝업 상세 편집) 완료. Intercepting Route 모달 + 풀페이지 폴백, Server Action 저장 + 감사로그, 이전/다음 네비, 키보드 단축키, 팝업 PNG 저장(6단계 범위였으나 선행 구현) | 개발팀 |
| 2026-04-18 | 0.5 | 5단계(주민번호 암호화 + 고급 검색) 완료. AES-256-GCM + HMAC-SHA256, 검색바·상세폼 RRN 필드, 라운드트립 검증 완료. 관리자 reveal UI는 7단계로 이월 | 개발팀 |
| 2026-04-18 | 0.6 | 6단계(엑셀 업/다운로드) 완료. `/admin/excel` 업로드 프리뷰 + upsert 적용, `/api/customers/export` 현재 필터 유지 스트림, 28컬럼 한글 헤더 · 주황색 헤더 스타일 적용, 셀프 라운드트립 검증 | 개발팀 |
| 2026-04-18 | 0.7 | 7단계(사용자 관리) 완료. `/admin/users` 페이지, 추가·수정·비밀번호 재설정·삭제 다이얼로그, 본인 계정 보호(admin 강등·자기 삭제 차단), 담당 고객 수 집계. 검색 버그 수정(Select 값 FormData 미전달 이슈), UI 중복 제거(사이드바·역할 배지) | 개발팀 |
| 2026-04-19 | 0.8 | 8단계(변경 이력 + 주민번호 reveal) 완료. `/admin/audit` 페이지 (필터·페이지네이션·변경 내용 요약), 관리자 RRN 복호화 모달(사유·경고·audit 기록·메모리 폐기), 액션별 색상 배지 | 개발팀 |
| 2026-04-19 | 0.9 | 9단계(담당자 일괄 변경) 완료. 체크박스 다중 선택, 플로팅 BulkBar, 일괄 변경 다이얼로그, `bulkReassignAction` + `bulk_change` 감사로그 기록. 엑셀 업로드 시 주민번호 자동 암호화·해시 기능 추가, 재업로드 중복 방지(name+phone 폴백 dedup) | 개발팀 |
| 2026-04-19 | 1.0 | 10단계(납품 마감 점검) 완료. Production build 0 error, 관리자 페이지 loading 스켈레톤, `(app)` error boundary, 고객 not-found 페이지, `README.md` 배포 가이드 + `HANDOVER.md` 에이원 운영 인수인계 매뉴얼. **초기 납품 릴리스 준비 완료.** | 개발팀 |
| 2026-04-19 | 1.1 | 납품 전 UX·권한 체계 고도화: (1) 연락처 `tel:` 전화 걸기 + 클립보드 복사 버튼 (2) 담당자별 권한 시스템 도입 후 `canManage` 단일 권한으로 통합 (입력·수정·삭제 묶음) + `canExport` (3) 고객 삭제 기능(canManage 게이트 + 감사로그) (4) 전화번호 substring 검색 (5) 검색바 자동 검색(버튼 제거, 400ms 디바운스) (6) 팝업 전 필드 편집 가능(생년월일·소속·DB 보험료·소분류·DB 등록일·만기일) (7) agent 부분 편집: 권한 없어도 방문주소·메모·통화결과는 항상 편집 가능 (서버 whitelist) (8) 팝업 시인성 개선: `disabled:opacity-50` 제거 → `text-foreground` 유지 (9) 담당자 드롭다운을 좌측 최상단으로 이동 (10) `users.branch/hq/team` 제거, 고객 테이블에서 편집 관리 (11) 방문주소 레이블 통일 | 개발팀 |
| 2026-04-19 | 1.1.1 | Vercel Production 배포 · **도메인 https://a1-insurance.xyz 연결** · README·HANDOVER·PRD 최신화 | 개발팀 |
