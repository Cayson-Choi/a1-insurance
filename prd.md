# DB-CRM — 제품 요구사항 문서 (PRD)

| 항목 | 값 |
|---|---|
| 제품명 | **DB-CRM** (Customer & Data Management) |
| 저장소 | https://github.com/Cayson-Choi/a1-insurance |
| 작성일 | 2026-04-22 |
| 버전 | 1.8.0 |
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

DB-CRM은 보험·금융 영업 담당자용 **고객 및 데이터 관리 도구**다. 엑셀로 분산 관리되던 고객 정보를 웹으로 이관하여 다음을 제공:

1. 엑셀 28컬럼 데이터의 무손실 import / export 호환
2. 담당자별 할당·세분화된 권한 제어 (입력·수정·삭제·엑셀)
3. 변경 이력(감사로그) + 로그인 이력 자동 기록 및 관리자 열람
4. 팝업 상세 편집 + 영업 현장 편의 (전화 걸기·이미지 저장·메모 타임스탬프)
5. 로그인·강제 로그아웃 실시간 외부 알림 (Slack / Telegram)
6. 고객 목록 테이블 개인화 (정렬·컬럼 순서·폭 저장)

### 성공 기준 (KPI)

- 49+ 고객 데이터 import → export 왕복 시 **데이터 손실 0건**
- 담당자 로그인 후 타인 고객 URL 직접 접근 시 **항상 접근 차단** (RBAC 누수 없음)
- 팝업 PNG 저장 시 **한글 폰트 깨짐 0건**
- Production build 0 error · 모바일/태블릿 반응형
- 관리자 강제 로그아웃 요청 시 **수초 내 세션 무효화**
- Slack/Telegram 알림 도달 실패가 로그인 플로우를 **절대 차단하지 않음**

---

## 사용자와 역할

| 역할 | 인원 (예상) | 권한 |
|---|---|---|
| **관리자 (admin)** | 1~2명 | 모든 기능 자동 부여. 사용자 CRUD · 담당자 일괄 재배정 · DB 등록일 일괄 변경 · 엑셀 업/다운 · 감사로그·로그인 이력 열람 · 고객 삭제 · 담당자 변경 |
| **매니저 (manager)** | 0~3명 | 담당자 권한에 **전체 고객 조회 + 담당자 변경(개별·일괄)** 만 추가. 관리자 전용 페이지는 접근 불가. 본인에게도 고객 할당 가능 |
| **담당자 (agent)** | 2~10명 | 본인 배정 고객만 조회. 관리자가 부여한 권한에 따라 동작 |

담당자 ID 체계는 임의 형식 (예: `a00003`). 인증은 **담당자ID + 비밀번호**.

### 담당자 권한 매트릭스

담당자는 기본적으로 **읽기 전용 + 방문주소·메모·통화결과·예약일시만 편집 가능**이며, 관리자가 아래 5개 권한을 개별 부여한다:

| 권한 | 허용되는 동작 |
|---|---|
| `canCreate` (입력) | 엑셀 업로드(신규 고객 등록) — `/admin/excel` 페이지 + import API |
| `canEdit` (수정) | 본인 배정 고객의 모든 필드 편집 |
| `canDelete` (삭제) | 본인 배정 고객 삭제 |
| `canExport` (엑셀 다운로드) | 본인 배정 범위에서 엑셀 다운로드 |
| `canDownloadImage` (이미지 다운로드) | 고객 팝업의 [이미지 저장] 버튼 노출 · PNG 다운로드 |

권한이 전부 꺼져 있어도 다음은 항상 가능:
- 본인 배정 고객 조회·팝업 열람
- **방문주소 · 메모 · 통화결과 · 예약일시** 편집·저장
- 전화 걸기(tel:) · 복사 · 이전/다음 네비

관리자(admin)는 위 5개 권한을 암묵적으로 모두 포함하며, 추가로 **담당자 변경 · 일괄 재배정 · DB 등록일 일괄 변경 · 사용자 관리 · 변경 이력 뷰어 · 전체 고객 접근**이 가능.

매니저(manager)는 위 5개 권한을 **agent 와 동일하게 플래그 기반**으로 관리자가 개별 부여하며, 플래그와 무관하게 다음 2가지가 기본 허용된다:
- **전체 담당자의 고객 조회** (`/customers` 목록·팝업에서 WHERE 필터 우회)
- **담당자 재할당** (팝업 담당자 드롭다운 + 목록 체크박스 "담당자 일괄 변경")

매니저에게 **차단**되는 기능: 관리자 전용 페이지(`/admin/users`, `/admin/excel`, `/admin/audit`, `/admin/logins`) + `DB 등록일 일괄 변경` 버튼. 매니저는 본인 agentId 로도 고객을 할당받을 수 있다(영업 겸직 가능).

---

## 기능 요구사항

### F1. 고객 목록 + 검색 + 페이지 이동 (최우선)

- 리스트 컬럼: 엑셀 28컬럼 모두 표시 (고객코드No · 담당자 · 이름 · 생년월일 · 주민No · 전화1 · 직업 · 주소 · 통화결과 · DB상품명 · DB보험료 · DB취급자 · 소분류 · DB증권No · DB등록일 · 대분류 · DB보험시작일 · 지사 · 본부 · 소속팀 · FAX · 예약접수 · 등록일 · 수정일 · DB회사명 · 방문주소 · DB보험만기일 · 담당자ID)
- **컬럼 헤더 클릭으로 정렬** (asc↔desc 토글, 화살표 아이콘 표시, URL `?sort=X&dir=Y` 저장)
- **헤더 드래그로 순서 재배치** (`@dnd-kit` 기반, 6px 이동 전까진 클릭으로 인식해 정렬과 충돌 없음, localStorage 저장)
- **헤더 경계 드래그로 폭 조절** (Excel 방식 — 두 인접 컬럼 제로섬, minWidth 자동 클램프, localStorage 저장)
- 테이블 상단 "컬럼 초기화" 버튼으로 기본 순서·폭 복원
- URL 쿼리 기반 필터 (공유·북마크 가능)
- 통화결과 컬러 배지 (예약·부재·가망·거절·결번·민원)
- 세로 구분선 + 가로 스크롤, 직각 모서리
- 빈 상태 / 로딩 스켈레톤 / 에러 상태 UI

### F2. 고급 검색 — 자동 검색 (Live Search)

- 이름 / 주소(부분 일치) / **전화번호(하이픈 무시 substring)** / 통화결과 / 담당자(관리자만) / 주민번호 앞 6자리 / 주민번호 뒤 7자리 / 출생연도 범위(`from`~`to`) — 복합 AND
- 주민번호는 평문 컬럼(`rrn_front`, `rrn_back`)에 인덱스로 일치 검색
- 전화번호 substring: `regexp_replace(phone1, '[^0-9]', '', 'g')` 후 `LIKE` — `"651"` 입력 → `010-6514-9114` 등 매칭
- 입력/선택 변경 시 자동 검색 (텍스트 400ms 디바운스, 드롭다운 즉시), 우측에 작은 스피너

### F3. 팝업 상세 편집 (Intercepting Route 모달)

- 목록에서 행 클릭 → 팝업 오버레이 (페이지 새로고침 없음, 이전/다음 시 깜빡임 없음)
- 좌 "고객 정보": 담당자(드롭다운/ReadOnly) / 지사·본부·소속팀 / 이름 / 생년월일 / 주민번호 앞6 + 뒤7 (평문) / 연락처(+전화/복사) / 원주소 / 방문주소 / 직업
- 우 "보험 / 상담 정보": 통화결과 / 보험사 / 보험상품명 / 가입일 / DB 만기일 / DB 보험료 / 소분류 / 예약일시 / 메모(우클릭 → 일시·담당자 자동 삽입) / 등록·수정 일시
- 통화결과 enum: 예약 · 부재 · 가망 · 거절 · 결번 · 민원
- 연락처: `tel:` URI 전화 걸기 + 한국식 포맷 복사 버튼
- 이전/다음: 검색 결과 내 이동, URL은 `history.replaceState`로 조용히 갱신
- 키보드 단축키: Esc 닫기 · Ctrl+← / Ctrl+→ 이전/다음 · Ctrl+S 저장 (capture phase)
- 저장 시 감사로그 기록 (before/after JSON, 변경된 필드 diff 자동 계산)
- 시인성: 편집 불가 필드도 진한 텍스트, 배경만 연한 회색
- 데스크톱: 헤더 툴바 빈 공간을 마우스로 끌어 팝업 위치 이동, 백드롭 투명 (배경 보임)

### F4. 담당자 변경 + 고객 삭제

- 관리자 또는 매니저: 팝업 "담당자" 드롭다운에서 직접 변경 → `agent_change` 감사로그
- 관리자 또는 매니저: 목록 체크박스 다중 선택 → 플로팅 BulkBar "담당자 일괄 변경" → `bulk_change` 일괄 기록
- 관리자만: 목록 체크박스 다중 선택 → 플로팅 BulkBar "DB 등록일 일괄 변경" → `bulk_change` 일괄 기록
- 관리자 또는 `canDelete` 있는 담당자/매니저: 팝업 우상단 "삭제" 버튼 → 확인 다이얼로그 → 삭제 전 감사로그 기록 후 영구 삭제
- 담당자: 본인 배정 고객만 보임 (쿼리 강제 + URL 직접 접근 시 not-found)
- 매니저: 전체 담당자의 고객 보임 (WHERE 필터 우회, 관리자와 동일한 조회 범위)

### F5. 엑셀 업/다운로드

- 관리자 또는 `canExport` 있는 담당자: 다운로드
- 관리자 또는 `canCreate` 있는 담당자: 업로드
- 업로드: 28컬럼 포맷 호환. 프리뷰(앞 10행·오류·미등록 담당자) → 검증(zod) → upsert (`customer_code` 또는 `name+phone1` fallback dedup)
- 다운로드: 현재 필터 쿼리 결과 스트림. 한글 컬럼명 유지. 주민번호는 평문 그대로 출력

### F6. 팝업 이미지 저장

- 팝업 상세를 보이는 그대로 PNG로 저장 (영업 기록·보고용, 권한 무관 누구나 가능)
- 파일명 `{고객명}{생년2자리}{간단주소}.png` (예: `김동환79충북청주.png`)
- 편집 중 입력값도 DOM 반영된 상태로 캡처
- Pretendard 폰트 임베드 — 깨짐 없음

### F7. 관리자 페이지

- 사용자(담당자) CRUD — 추가·수정·비밀번호 리셋·삭제
- 사용자 추가 시 권한 체크박스 5종: `입력` · `수정` · `삭제` · `엑셀 다운로드` · `이미지 다운로드`
- 본인 계정 보호 (관리자 강등 차단, 자기 삭제 차단·본인 강제 로그아웃 차단)
- 감사로그 뷰어 — 필터(기간·action·actor), 변경 내용 요약 diff
- **사용자 관리 테이블에 접속 상태 컬럼** (🟢 접속 중 · ⚪ 오프라인)
- **강제 로그아웃 버튼** (admin 전용, 본인 비활성)
- 로그인 이력 뷰어 (`/admin/logins`) — 성공·실패 전체 로그, 필터(사용자·결과·기간), 페이지네이션

### F8. 로그인 알림 (Slack / Telegram)

- 대상 이벤트: **로그인 성공 / 로그인 실패 / 강제 로그아웃**
- 발송 채널: env 구성에 따라 자동 선택
  - `SLACK_WEBHOOK_URL` → Slack Incoming Webhook
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` → Telegram Bot API
  - 양쪽 모두 구성 시 병행 발송 (`Promise.allSettled`)
- 메시지 내용: 사용자 이름·ID·역할·IP·브라우저(UA 간소화)·시각(KST)·실패 사유
- fire-and-forget 3초 타임아웃, 실패해도 로그인 자체는 정상 진행
- 이벤트는 `login_events` 테이블에도 기록되어 `/admin/logins` 로 언제든 조회 가능

### F9. 강제 로그아웃 (Stateless JWT 대응)

- 관리자 → 사용자 관리 → "강제 로그아웃" 버튼 → 확인 다이얼로그
- 서버: `users.sessions_invalidated_at = NOW()` 업데이트
- Auth.js `session` 콜백: 매 요청마다 `sessions_invalidated_at > token.iat` 검사 → true 면 세션 폐기
- 결과: 대상 사용자가 **다음 페이지 이동 시점에 자동 `/login` 리다이렉트** (수초 내)
- 본인 강제 로그아웃 차단 · Slack/Telegram 알림 동반

### F10. 접속 상태 표시 (온라인 판정)

- `users.last_seen_at` — Auth.js `jwt` 콜백에서 **1분 throttle** 로 갱신 (DB 쓰기 최소화)
- `isOnline()` 헬퍼: `last_seen_at` 이 5분 내 + `sessions_invalidated_at` 이후가 아닐 때 → 🟢 접속 중
- 사용자 관리 테이블 맨 왼쪽 컬럼에 색 점 + 텍스트로 표시

---

## 비기능 요구사항 (상용 UX 체크리스트)

- [x] 모든 화면에 DB-CRM 로고 + "DB-CRM 고객·데이터 관리" 헤더, 풋터
- [x] 로그인 화면: DB-CRM 로고 + 태그라인 "Customer & Data Management"
- [x] 빈 상태 · 로딩 스켈레톤 · 에러 상태 UI
- [x] 파괴적 동작(삭제·일괄변경·로그아웃) Confirm 다이얼로그
- [x] 세션 유휴 타임아웃 30분 자동 로그아웃, 5분 전 경고
- [x] 한국식 포맷: 전화 010-0000-0000, 주민 000000-0******, 날짜 YYYY-MM-DD, 금액 55,080원
- [x] 개인정보 최소 노출 (목록 마스킹, 팝업에서만 전체)
- [x] 키보드 단축키: Esc / ←/→ / Ctrl+S
- [x] 접근성: 라벨 · 포커스 링 · 대비 AA · 스크린리더 aria-live
- [x] 모바일 햄버거 메뉴, 반응형 테이블·검색바·팝업 풀스크린
- [x] 인쇄/이미지 저장 시 한글 폰트 깨짐 없음
- [x] favicon · title · meta 태그에 DB-CRM 브랜드
- [x] 검색 엔진 색인 차단 (robots: noindex)

---

## 브랜드 가이드

### 로고

- 파일: `public/brand/db-crm-logo.png`
- 디자인: 청록·파랑 그라디언트의 동그라미 안에 인물·식물·네트워크 아이콘 + "DB-CRM" 텍스트 + "CUSTOMER & DATA MANAGEMENT" 부제

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

- nameKo / nameEn: **DB-CRM**
- tagline: **Customer & Data Management**
- slogan: **고객·데이터를 한 곳에서**
- appName: **DB-CRM 고객·데이터 관리**

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
| 입력 검증 | Zod | TypeScript 타입·런타임 동시 |
| 엑셀 | exceljs | 한글·스트리밍 |
| 이미지 저장 | html-to-image | Pretendard 임베드 |
| 배포 | Vercel | Next.js 공식, Preview, Neon 원클릭 |

### 주민번호 저장 정책

- 앞자리(`rrn_front`, varchar 6) · 뒷자리(`rrn_back`, varchar 7) **평문 저장**
- 양 컬럼에 btree 인덱스 → 정확 일치 검색 사용
- 화면·엑셀 모두 평문 표시. 마스킹·복호화 모달 없음
- 데이터 자체의 민감도는 인정되므로 실제 운영 시 DB 접근 통제·전송 암호화(TLS)에 의존

### RBAC

- Auth.js Credentials + JWT (bcryptjs 12 round)
- 페이지 레벨 가드 (`requireUserWithPerms`)
- Server Action 내부에서 권한 재검증
- 일반 담당자 쿼리엔 `WHERE agent_id = session.agentId` 강제

---

## 데이터 모델

### users

`id, agent_id UNIQUE, password_hash, name, role('admin' | 'manager' | 'agent'), can_create, can_edit, can_delete, can_export, can_download_image, created_at, last_login_at, sessions_invalidated_at, last_seen_at`

- `sessions_invalidated_at`: 관리자 강제 로그아웃 시각 — JWT `iat` 이전이면 세션 폐기
- `last_seen_at`: Auth.js jwt 콜백에서 1분 throttle 갱신 — 접속 상태 판정용

### customers (28컬럼 1:1 매핑)

`id, customer_code UNIQUE, agent_id FK, name, birth_date, rrn_front, rrn_back, phone1, job, address, address_detail, call_result ENUM, db_product, db_premium, db_handler, sub_category, db_policy_no, db_registered_at, main_category, db_start_at, db_end_at, branch, hq, team, fax, reservation_received, reservation_at, memo, db_company, created_at, updated_at`

### audit_logs

`id, actor_agent_id, customer_id, action('agent_change' | 'bulk_change' | 'edit' | 'rrn_decrypt'), before JSONB, after JSONB, created_at`

> 참고: `rrn_decrypt` 액션은 과거 복호화 모달용 enum 값으로, 현재(주민번호 평문화 이후) 새로 발생하지 않음. enum 값은 호환성을 위해 유지.

### login_events (신규, 마이그 0006)

`id, agent_id, success BOOL, ip, user_agent, reason, created_at`

- 로그인 성공·실패 전부 기록
- agent_id 는 nullable (미입력 실패 시 NULL)
- user_agent 는 500자 제한
- 인덱스: `(agent_id, created_at DESC)` · `(created_at DESC)`

### 인덱스

- `customers(agent_id)` · `(name)` · `(rrn_front)` · `(rrn_back)` · `(call_result)` · `(db_registered_at DESC)`
- `login_events(agent_id, created_at DESC)` · `(created_at DESC)`
- pg_trgm GIN `(address)` (확장 시 적용)

---

## 디렉토리 / 핵심 파일

```
app/
  (auth)/login/page.tsx                        로그인 (DB-CRM 로고 + 태그라인)
  (app)/layout.tsx                             인증 가드 + 헤더/풋터/유휴 타임아웃
  (app)/customers/page.tsx                     목록 + URL 쿼리 검색 (자동 검색)
  (app)/customers/[id]/page.tsx                풀페이지 상세 (모달 폴백)
  (app)/@modal/(.)customers/[id]/page.tsx      Intercepting Route 모달
  (app)/admin/excel/page.tsx
  (app)/admin/users/page.tsx
  (app)/admin/audit/page.tsx
  (app)/admin/logins/page.tsx                  (신규) 로그인 이력
  api/customers/import/route.ts
  api/customers/export/route.ts
  layout.tsx                                   OG 메타 · 링크 프리뷰

lib/
  db/schema.ts                                 Drizzle 스키마 (users + customers + audit_logs + login_events)
  auth/rbac.ts                                 권한 헬퍼 (canCreate/canEdit/canDelete/canExport/canDownloadImage)
  customers/columns.ts                         28컬럼 메타데이터 (단일 출처)
  customers/actions.ts · queries.ts · get-detail.ts
  excel/column-map.ts                          28컬럼 매핑 (HEADER_ALIASES 포함)
  excel/importer.ts · exporter.ts
  audit/queries.ts · diff.ts
  users/queries.ts · actions.ts · schema.ts · online.ts (클라이언트 안전 판정 함수)
  logins/queries.ts                            (신규) 로그인 이벤트 쿼리 + 필터
  notifications/
    index.ts                                   디스패처 (Slack + Telegram 병행 발송)
    format.ts                                  공통 포맷 유틸 (UA 파싱 · 메시지 빌더)
    slack.ts · telegram.ts                     각 transport
  company.ts                                   DB-CRM 브랜드 상수
  env.ts                                       zod env 검증 (SLACK/TELEGRAM 는 optional)

components/
  brand/logo.tsx · app-header.tsx · app-footer.tsx
  auth/login-form.tsx · idle-timeout.tsx
  customers/
    list-table.tsx                             DnD Kit 기반 (정렬·재배치·리사이즈)
    use-table-prefs.ts                         localStorage 훅 (컬럼 순서·폭)
    search-bar.tsx · pagination.tsx · detail-form.tsx
    detail-dialog.tsx · call-result-badge.tsx
    delete-customer-dialog.tsx · bulk-reassign-dialog.tsx
  admin/
    excel-uploader.tsx
    user-table.tsx · user-form-dialog.tsx
    user-reset-password-dialog.tsx · user-delete-dialog.tsx
    force-logout-dialog.tsx                    (신규) 강제 로그아웃 확인
    audit-table.tsx · audit-filter.tsx · audit-pagination.tsx
    login-history-table.tsx                    (신규) 로그인 이력 테이블
    login-filter.tsx · login-history-pagination.tsx (신규)
  ui/...                                       shadcn/ui

auth.ts · auth.config.ts                       Auth.js v5 (Edge-safe 라우팅 가드 · DB 콜백 분리)
scripts/                                       migrate · seed · import-xlsx
drizzle/                                       마이그레이션 SQL (0000–0006)
public/
  brand/db-crm-logo.png                        브랜드 로고
  og-image.png                                 카톡·SNS 링크 프리뷰
```

---

## 구현 단계 (PR 단위 로드맵)

| # | 단계 | 상태 |
|---|---|---|
| 1 | 스캐폴드 (Next.js + Tailwind + shadcn/ui + Drizzle + Neon) | ✅ |
| 2 | 인증 + 레이아웃 (Auth.js + 헤더/풋터 + 유휴 타임아웃) | ✅ |
| 3 | 고객 목록 + 검색 + 페이지네이션 + 통화결과 배지 | ✅ |
| 4 | 팝업 상세 편집 (Intercepting Route) + 단축키 + 감사로그 + PNG 저장 | ✅ |
| 5 | 주민번호 검색 + 출생연도 범위 필터 | ✅ |
| 6 | 엑셀 업/다운로드 (28컬럼 평문 처리) | ✅ |
| 7 | 사용자 관리 (CRUD + 비밀번호 리셋) | ✅ |
| 8 | 변경 이력 뷰어 | ✅ |
| 9 | 담당자 일괄 변경 + 고객 삭제 + 권한 4종(canCreate·canEdit·canDelete·canExport) | ✅ |
| 10 | 납품 마감 점검 (loading/error, README, HANDOVER, 도메인) | ✅ |
| 11 | 모바일 최적화 (햄버거 메뉴 · 반응형) + 자동 검색 + 전화 걸기 | ✅ |
| 12 | **DB-CRM 브랜드 리뉴얼** (청록 컬러 팔레트 · 새 로고) | ✅ |
| 13 | 최종 정비 (메모 우클릭 자동 입력 · 팝업 드래그 · 이미지 파일명 규칙 · 권한 분리 · 코드 정리) | ✅ |
| 14 | 테이블 개인화 (정렬 · 드래그 재배치 · Excel 방식 리사이즈) + 28컬럼 전체 노출 | ✅ |
| 15 | 로그인 이력 + Slack/Telegram 알림 + 강제 로그아웃 + 접속 상태 표시 | ✅ |
| 16 | OG 이미지 + 링크 프리뷰 (카톡 · SNS) | ✅ |
| 17 | 최종 dead-code 정리 (미사용 패키지 4개 제거) + 문서 최신화 | ✅ |
| 18 | 팝업 UX 정비 · `canDownloadImage` 권한 · DB 등록일 일괄 변경 · 울트라와이드 레이아웃 · rrnFront 회귀 수정 | ✅ |

---

## 검증 계획

### 로컬 개발

- `.env.local` 필수: `DATABASE_URL`, `AUTH_SECRET`
- `.env.local` 선택: `SLACK_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SITE_URL`
- `pnpm db:migrate` → 스키마 반영 (마이그 0000–0006)
- `pnpm db:seed` → 초기 사용자 8명
- `pnpm db:import-xlsx` → 샘플 49건 import
- `pnpm dev` → http://localhost:3000

### 시나리오 체크리스트

- [ ] admin 로그인 → 전체 49건 + 엑셀 다운/업 + 일괄 재배정 + audit_log
- [ ] 일반 담당자 로그인 → 본인 분만 보임, 타인 URL 직접 접근 시 차단
- [ ] 권한 없는 담당자 → 방문주소·메모·통화결과·예약일시만 편집 가능, 나머지 readOnly (텍스트는 진하게 보임)
- [ ] `canEdit` 담당자 → 모든 필드 편집 가능
- [ ] `canDelete` 담당자 → 고객 삭제 가능
- [ ] `canCreate` 담당자 → `/admin/excel` 접근 + 엑셀 업로드 가능
- [ ] `canExport` 담당자 → 엑셀 다운로드 가능
- [ ] `canDownloadImage` 담당자 → 팝업 이미지 저장 버튼 노출 · PNG 다운로드 가능; 권한 해제 시 버튼 숨김
- [ ] 주민 뒷자리 검색 (평문 일치) → 결과 정확히 매칭
- [ ] 전화번호 substring 검색 (`651` → `010-6514-9114`)
- [ ] 출생연도 범위 검색 (예: `1960~1970`)
- [ ] 자동 검색 (텍스트 디바운스, 드롭다운 즉시)
- [ ] 팝업 드래그 이동 (데스크톱) · 백드롭 투명
- [ ] 메모 우클릭 → 일시·담당자 자동 삽입
- [ ] 팝업 PNG 저장 → 파일명 규칙(`{이름}{년생2}{간단주소}.png`) + 한글 깨짐 없음
- [ ] 엑셀 라운드트립 → 49건 갱신 0 신규, 주민번호 평문 출력
- [ ] 30분 유휴 후 자동 로그아웃, 5분 전 경고
- [ ] 모바일 햄버거 메뉴 → 모든 메뉴 접근 가능, 테이블 가로 스크롤, 팝업 풀스크린
- [ ] **테이블 컬럼 헤더 클릭** → 정렬 asc↔desc, URL 쿼리 저장
- [ ] **테이블 헤더 드래그** → 컬럼 순서 변경, localStorage 저장
- [ ] **테이블 헤더 경계 드래그** → 인접 두 컬럼 제로섬 리사이즈, localStorage 저장
- [ ] "컬럼 초기화" 버튼 → 기본 순서·폭 복원
- [ ] 로그인 성공 → Slack/Telegram 알림 수신
- [ ] 로그인 실패 (비번 오류) → Slack/Telegram 알림 수신
- [ ] 관리자 강제 로그아웃 → 대상 사용자가 다음 페이지 이동 시 `/login` 리다이렉트 · 알림 수신
- [ ] 사용자 관리 접속 상태 컬럼 🟢 정상 표시 (로그인 5분 내)
- [ ] `/admin/logins` 이력 페이지 → 필터(사용자·결과·기간) 정상 동작
- [ ] OG 이미지 — 카톡에서 운영 URL 공유 시 DB-CRM 로고 프리뷰 표시

---

## 배포

1. GitHub 저장소 push
2. Vercel에서 저장소 연결 → 프로젝트 생성
3. Neon Marketplace integration → DATABASE_URL 자동 주입
4. 환경변수 등록 (Production · Preview):
   - 필수: `AUTH_SECRET`
   - 선택: `NEXT_PUBLIC_SITE_URL` (OG 이미지 절대 URL용), `SLACK_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID`
5. 환경변수 추가·수정 시 **Deployments → Redeploy** 필수
6. Preview URL에서 시나리오 전수 재현
7. 통과 시 Production 승격 → 도메인 연결

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|---|---|---|---|
| 2026-04-19 | 1.0 | 초기 납품 릴리스 (10단계 완료) | 개발팀 |
| 2026-04-19 | 1.1 | 권한 통합(`canManage`+`canExport`) · 고객 삭제 · 전화 substring 검색 · 자동 검색 · 팝업 전 필드 편집 · 시인성 개선 | 개발팀 |
| 2026-04-19 | 1.1.1 | Vercel Production 배포 · 도메인 연결 · README/HANDOVER/PRD 최신화 | 개발팀 |
| 2026-04-19 | 1.2 | **브랜드 확정: DB-CRM (Customer & Data Management)**. 청록 컬러 팔레트(`#0891b2`) 적용, 로고(`public/brand/db-crm-logo.png`), 풋터/로그인/메타데이터/엑셀 파일명/감사로그 라벨 통일, 운영 가이드 일반화 | 개발팀 |
| 2026-04-19 | 1.3 | 주민번호 평문 저장 전환 (마이그 0004) · 권한 통합 → 분리(`canCreate`/`canEdit`/`canDelete`/`canExport`, 마이그 0005) · 메모 우클릭 자동 삽입 · 팝업 드래그 이동 · 백드롭 투명 · 이미지 파일명 규칙 변경 · 검색바 한 줄 정렬 · DB만기일 컬럼 노출 · React 19 form 자동 리셋 버그 수정 · dead-code 정리(`lib/crypto/pii.ts` 제거, public 보일러플레이트 svg 제거, 미사용 format 함수 제거) | 개발팀 |
| 2026-04-19 | 1.4 | **최종 납품 버전**. 엑셀 28컬럼 전체 노출 + 테이블 개인화(`@dnd-kit` 도입 — 정렬·드래그 재배치·Excel 방식 제로섬 리사이즈 + localStorage 영속화) · 로그인 추적 체계 구축 (마이그 0006 — `users.sessions_invalidated_at`/`last_seen_at` 컬럼 + `login_events` 테이블) · **강제 로그아웃** (JWT stateless 대응: sessions_invalidated_at 비교로 세션 무효) · **접속 중 상태 표시** (1분 throttle 갱신, 5분 이내 판정) · **로그인 이력 페이지** (`/admin/logins`) · **Slack + Telegram 알림** (병행 발송, 성공·실패·강제 로그아웃 이벤트) · **OG 이미지** (카톡·SNS 링크 프리뷰) · 미사용 패키지 4개 제거(`@neondatabase/serverless`, `@hookform/resolvers`, `react-hook-form`, `date-fns`) | 개발팀 |
| 2026-04-20 | 1.5 | 엑셀 왕복 일관성 완벽 보정 (주민No 뒤 7자리만 · 변경 감지 기반 updatedAt 보존 · KST 시간대 명시 파싱/포맷) · 엑셀 업로드 정책 변경: **전체 교체** (트랜잭션 DELETE all → INSERT all, `created_at`/`updated_at` 엑셀 값 그대로 사용, `NOT NULL` 제약 해제 마이그 0007, 확인 다이얼로그) · 로그인 placeholder 제거 | 개발팀 |
| 2026-04-21 | 1.6 | 상세 팝업 저장 실패 버그 수정 (disabled → readOnly, callResult 빈 문자열 처리, 메모 10K 자, 에러 토스트 상세화) · DB 보험료 표시 소수점 제거 · **성능 대폭 개선**: Vercel Function 리전을 Neon DB 와 동일한 `sin1` Singapore 로 이전 (DB 왕복 250ms → 5ms) + `React.cache` 로 요청당 인증·권한 중복 조회 제거 (`lib/auth/rbac.ts` `getSessionUser` / `getPermissions` 래핑) | 개발팀 |
| 2026-04-22 | 1.7 | **팝업 UX 개선**: 등록일시/수정일시 표시 제거 · 주민번호 앞자리 입력 제거(생년월일에서 자동 파생) · 이미지 저장 시 스크롤 가려진 영역 전체 캡처 + 지사/본부/소속팀 제외. **권한 추가**: `canDownloadImage` 신설 (마이그 0008) — 이미지 저장 버튼 노출 제어. **일괄 변경 확장**: DB 등록일 일괄 변경 기능 추가 (admin 전용, bulk_change 감사로그). **울트라와이드 지원**: `(app)` 레이아웃의 `max-w-screen-2xl` 해제 → 21:9 (~3440px) 모니터에서 28컬럼 전체가 한 화면에 펼쳐짐. **데이터 무결성 fix**: UI 에서 rrnFront 입력 제거 후 빈 birthDate 저장 시 rrnFront 가 null 로 덮이던 회귀 수정. | 개발팀 |
| 2026-04-22 | 1.7.1 | **주민No 표시 일관성**: 고객 목록의 `주민No` 컬럼을 엑셀 원본 포맷과 동일하게 뒷자리 7자리만 표시(정렬 키도 rrnBack 으로 통일). **DB 보험료 표시**: 팝업에 천단위 쉼표 포맷(`65,630`), blur 시 자동 재포맷. **감사로그 완전성 수정**: `updateCustomerAction` 스냅샷에 누락됐던 편집 가능 필드 8종 추가(생년월일·DB 보험료·소분류·DB 만기일·DB 등록일·지사·본부·소속팀). **감사 diff 라벨 보정**: `lib/audit/diff.ts` dead keys(`rrnFrontSet`/`rrnBackSet`) 제거 + 누락 라벨 11종 보강. **스키마 주석**: `rrnFront` 가 서버 derivation 전용임 명시. | 개발팀 |
| 2026-04-24 | 1.8.0 | **매니저 역할 신설** (마이그 0009 — `user_role` enum 에 `manager` 추가). admin 과 agent 사이의 중간 계급으로 기본 권한 2가지 추가: (1) 전체 담당자의 고객 조회 (WHERE 필터 우회), (2) 담당자 재할당(팝업 드롭다운 + 목록 "담당자 일괄 변경"). 나머지 권한(`canCreate`/`canEdit`/`canDelete`/`canExport`/`canDownloadImage`)은 agent 와 동일하게 플래그 기반 — 관리자가 `/admin/users` 에서 개별 부여. 관리자 전용 페이지(`/admin/users`/`/admin/excel`/`/admin/audit`/`/admin/logins`) 및 `DB 등록일 일괄 변경` 은 **매니저 차단 유지**. 매니저도 `customer.agent_id` 로 할당 가능(영업 겸직). 신규 헬퍼 `canSeeAllCustomers` / `canReassignAgent` / `requireAdminOrManager` / `roleLabel` 추가 — 클라이언트 안전한 순수 유틸은 `lib/auth/roles.ts` 로 분리(기존 `rbac.ts` 가 클라이언트로 끌려갈 때 `postgres/tls` 번들 오류 방지). `list-table` 은 `canBulkEdit` 단일 prop 을 `canBulkReassign`(admin+manager) / `canBulkDate`(admin) 로 분리. | 개발팀 |
