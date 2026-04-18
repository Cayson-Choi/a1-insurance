import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__pgClient ??
  postgres(env().DATABASE_URL, {
    prepare: false,
    max: env().NODE_ENV === "production" ? 10 : 1,
  });

if (env().NODE_ENV !== "production") global.__pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
