# DB-CRM 인수인계 문서

이 문서는 현재 코드 기준 운영/개발자가 바로 확인해야 할 내용을 정리합니다. 상세 기능 소개는 [README.md](./README.md)를 기준으로 합니다.

## 현재 상태

- 프레임워크: Next.js 16 App Router
- DB: PostgreSQL/Neon
- ORM: Drizzle
- 배포: Vercel
- 인증: Auth.js v5 Credentials
- 민감정보: 주민번호 앞자리 HMAC, 뒷자리 AES-256-GCM 암호화
- 최근 성능 보강: 고객 목록 정렬/검색용 인덱스, import batch insert, import/export 최소 컬럼 조회
- 최근 보안 보강: import/export/context API rate limit, no-store 보안 헤더, import same-origin 검사
- 최근 운영 보강: 엑셀 담당자ID가 사용자 관리에 없으면 import 실행 시 담당자 계정 자동 생성

## 필수 환경변수

```env
DATABASE_URL=
AUTH_SECRET=
PII_ENC_KEY=
PII_HMAC_KEY=
NEXT_PUBLIC_SITE_URL=
SLACK_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`PII_ENC_KEY`, `PII_HMAC_KEY`는 64자리 hex 문자열이어야 합니다.

```bash
openssl rand -hex 32
```

## 운영 배포 순서

```bash
pnpm lint
pnpm build
pnpm db:migrate
vercel --prod
```

DB migration은 Vercel 배포와 별개입니다. schema/migration 변경이 있으면 운영 DB에 `pnpm db:migrate`를 적용해야 합니다.

## 주요 migration

- `0012_reencrypt_rrn.sql`: 기존 주민번호 데이터를 암호화 구조로 전환
- `0013_drop_plaintext_rrn.sql`: 원문 주민번호 컬럼 제거
- `0014_perf_security_indexes.sql`: 고객 목록 정렬/검색, audit/log 조회 성능용 인덱스 추가

`0014`는 `pg_trgm` 확장을 사용합니다. Neon/PostgreSQL에서 일반적으로 지원되지만, DB 권한 문제로 실패하면 확장을 먼저 허용해야 합니다.

## 권한 모델

- `admin`: 모든 관리 화면 접근, 모든 권한 기본 허용
- `manager`: 전체 고객 조회와 담당자 변경 가능, 관리자 전용 화면은 접근 불가
- `agent`: 본인 담당 고객만 조회, 세부 권한 플래그에 따라 생성/수정/삭제/export 가능

서버 액션과 API는 UI 표시 여부와 별개로 권한을 다시 검사합니다.

## 고객 데이터 처리

- 목록 조회: `lib/customers/queries.ts`
- 상세 조회: `lib/customers/get-detail.ts`
- 수정/삭제/일괄 작업: `lib/customers/actions.ts`
- 엑셀 import: `app/api/customers/import/route.ts`
- 엑셀 export: `app/api/customers/export/route.ts`

import 매칭 우선순위:

1. 고객 코드
2. 주민번호 앞자리 해시 + 뒷자리 해시
3. 이름 + 전화번호 숫자 정규화

신규 고객 insert는 500건 단위로 batch 처리합니다.

엑셀 담당자ID 자동 생성:

- 대상: admin/manager처럼 담당자 재배정 권한이 있는 업로드
- 생성 조건: 엑셀의 담당자ID가 `users.agent_id`에 없고 형식이 `a-z`, `A-Z`, `0-9`, `_`, `-`, 2~20자 조건을 만족
- 이름: 엑셀의 담당자 컬럼 값을 사용하고, 없으면 담당자ID를 이름으로 사용
- 역할: `agent`
- 최초 비밀번호: `123456`
- 권한: 생성/수정/삭제/export/이미지 저장 모두 `false`
- 감사 로그: `user_create`, `source: excel_import`

## 보안 주의사항

- PII 키를 변경하면 기존 암호화 데이터 복호화가 실패합니다.
- `.env.local`, Vercel env pull 결과, 엑셀 원본 파일은 커밋하지 않습니다.
- export 권한이 있는 계정은 개인정보 파일을 내려받을 수 있으므로 운영 계정 권한을 최소화합니다.
- API rate limit은 서버 인스턴스 메모리 기반입니다. 분산 환경에서 완전한 WAF 대체가 아니므로, 공격 트래픽이 커지면 Vercel Firewall/Upstash/Redis 기반 제한을 추가하세요.
- 엑셀 export는 최대 50,000건으로 제한합니다. 더 큰 백업은 DB 백업 절차를 사용하세요.

## 성능 체크포인트

- 고객 목록 정렬이 느리면 운영 DB에 `0014_perf_security_indexes.sql`이 적용됐는지 먼저 확인합니다.
- 이름/주소/전화 검색이 느리면 `pg_trgm` 확장과 GIN 인덱스 생성 여부를 확인합니다.
- 대량 import가 느리면 기존 고객 수, 업데이트 비율, Vercel 함수 제한 시간을 확인합니다. 신규 insert는 batch 처리되지만 기존 고객 update는 감사 추적과 충돌 방지를 위해 row 단위로 처리합니다.
- 페이지당 500건은 렌더링 비용이 큽니다. 브라우저가 오래된 PC라면 100건 이하를 권장합니다.

## 검증 명령

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

## 커밋 전 확인

- `git status --short`로 `material/`의 엑셀/이미지 파일이 스테이징되지 않았는지 확인합니다.
- migration을 추가했다면 `drizzle/meta/_journal.json`도 같이 갱신합니다.
- 보안/성능 관련 변경은 README와 이 문서를 같이 업데이트합니다.
