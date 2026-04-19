import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  numeric,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const callResultEnum = pgEnum("call_result", [
  "예약",
  "부재",
  "가망",
  "거절",
  "결번",
  "민원",
]);

export const roleEnum = pgEnum("user_role", ["admin", "agent"]);

export const auditActionEnum = pgEnum("audit_action", [
  "agent_change",
  "bulk_change",
  "edit",
  "rrn_decrypt",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: varchar("agent_id", { length: 20 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    role: roleEnum("role").notNull().default("agent"),
    // 담당자별 권한 — agent role만 해당. admin은 항상 모든 권한 보유
    canCreate: boolean("can_create").notNull().default(false),
    canEdit: boolean("can_edit").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    canExport: boolean("can_export").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // 관리자가 강제 로그아웃 시킨 시각 — JWT iat 이 이 값보다 이전이면 세션 무효
    sessionsInvalidatedAt: timestamp("sessions_invalidated_at", { withTimezone: true }),
    // 매 요청마다 throttle 되어 갱신되는 활동 시각 ("접속 중" 판정)
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_agent_id_uq").on(t.agentId)],
);

// 로그인 성공·실패 이벤트 로그 (감사용)
export const loginEvents = pgTable(
  "login_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: varchar("agent_id", { length: 20 }),
    success: boolean("success").notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    reason: varchar("reason", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("login_events_agent_idx").on(t.agentId, t.createdAt),
    index("login_events_created_idx").on(t.createdAt),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerCode: varchar("customer_code", { length: 32 }).unique(),
    agentId: varchar("agent_id", { length: 20 })
      .references(() => users.agentId, { onDelete: "set null" }),
    name: varchar("name", { length: 60 }).notNull(),
    birthDate: date("birth_date"),
    rrnFront: varchar("rrn_front", { length: 6 }),
    rrnBack: varchar("rrn_back", { length: 7 }),
    phone1: varchar("phone1", { length: 30 }),
    job: text("job"),
    address: text("address"),
    addressDetail: text("address_detail"),
    callResult: callResultEnum("call_result"),
    dbProduct: text("db_product"),
    dbPremium: numeric("db_premium", { precision: 14, scale: 2 }),
    dbHandler: varchar("db_handler", { length: 60 }),
    subCategory: varchar("sub_category", { length: 60 }),
    dbPolicyNo: varchar("db_policy_no", { length: 60 }),
    dbRegisteredAt: date("db_registered_at"),
    mainCategory: varchar("main_category", { length: 60 }),
    dbStartAt: date("db_start_at"),
    dbEndAt: date("db_end_at"),
    branch: varchar("branch", { length: 60 }),
    hq: varchar("hq", { length: 60 }),
    team: varchar("team", { length: 60 }),
    fax: varchar("fax", { length: 30 }),
    reservationReceived: date("reservation_received"),
    reservationAt: timestamp("reservation_at", { withTimezone: true }),
    memo: text("memo"),
    dbCompany: varchar("db_company", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customers_agent_id_idx").on(t.agentId),
    index("customers_name_idx").on(t.name),
    index("customers_rrn_front_idx").on(t.rrnFront),
    index("customers_rrn_back_idx").on(t.rrnBack),
    index("customers_db_registered_idx").on(t.dbRegisteredAt),
    index("customers_call_result_idx").on(t.callResult),
  ],
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorAgentId: varchar("actor_agent_id", { length: 20 }).notNull(),
  customerId: uuid("customer_id"),
  action: auditActionEnum("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  customers: many(customers),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  agent: one(users, {
    fields: [customers.agentId],
    references: [users.agentId],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type LoginEvent = typeof loginEvents.$inferSelect;
export type NewLoginEvent = typeof loginEvents.$inferInsert;
