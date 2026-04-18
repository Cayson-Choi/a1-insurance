import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import authConfig from "./auth.config";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const CredentialsSchema = z.object({
  agentId: z.string().trim().min(1).max(20),
  password: z.string().min(1).max(200),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "담당자ID",
      credentials: {
        agentId: { label: "담당자ID", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { agentId, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.agentId, agentId),
        });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.agentId, user.agentId));

        return {
          id: user.id,
          agentId: user.agentId,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
