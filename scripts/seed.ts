import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { users, type NewUser } from "@/lib/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

const agentDefaults = {
  password: "agent1234",
  role: "agent" as const,
};

const SEED_USERS: Array<Omit<NewUser, "passwordHash"> & { password: string }> = [
  {
    agentId: "admin",
    password: "admin1234",
    name: "관리자",
    role: "admin",
  },
  { ...agentDefaults, agentId: "a00003", name: "동의콜A" },
  { ...agentDefaults, agentId: "a00005", name: "동의콜D" },
  { ...agentDefaults, agentId: "a00006", name: "동의콜B" },
  { ...agentDefaults, agentId: "a00007", name: "동의콜C" },
  { ...agentDefaults, agentId: "a00012", name: "동의콜E" },
  { ...agentDefaults, agentId: "a00014", name: "동의콜R" },
  { ...agentDefaults, agentId: "a44643", name: "이은영" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema: { users } });

  console.log(`Seeding ${SEED_USERS.length} users...`);

  for (const u of SEED_USERS) {
    const { password, ...rest } = u;
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await db.query.users.findFirst({
      where: eq(users.agentId, u.agentId),
    });

    if (existing) {
      console.log(`  - ${u.agentId} (${u.name}) exists, skipping`);
      continue;
    }

    await db.insert(users).values({ ...rest, passwordHash });
    console.log(`  + ${u.agentId} (${u.name}, ${u.role}) created`);
  }

  console.log("\n[시드 완료] 로그인 정보:");
  console.log("  관리자:  admin / admin1234");
  console.log("  담당자:  a00003, a00005, a00006, a00007, a00012, a00014, a44643 / agent1234");
  console.log("\n⚠ 실제 배포 전 반드시 비밀번호를 변경하세요.");

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
