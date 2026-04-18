import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      agentId: string;
      role: "admin" | "agent";
    } & DefaultSession["user"];
  }

  interface User {
    agentId: string;
    role: "admin" | "agent";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agentId?: string;
    role?: "admin" | "agent";
    name?: string;
  }
}
