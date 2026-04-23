import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      agentId: string;
      role: "admin" | "manager" | "agent";
    } & DefaultSession["user"];
  }

  interface User {
    agentId: string;
    role: "admin" | "manager" | "agent";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agentId?: string;
    role?: "admin" | "manager" | "agent";
    name?: string;
  }
}
