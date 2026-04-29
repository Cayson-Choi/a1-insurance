-- buildOrderBy 가 모든 정렬에서 desc(createdAt) 을 tie-breaker 로 추가하므로 index 추가.
-- CONCURRENTLY 는 트랜잭션 안에서 사용 불가하나 drizzle-kit push 가 트랜잭션으로 감싸므로 일반 CREATE INDEX 사용.
CREATE INDEX IF NOT EXISTS "customers_created_at_idx" ON "customers" ("created_at");
