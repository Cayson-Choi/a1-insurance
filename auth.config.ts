import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login"];

export default {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

      if (isPublic) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/customers", request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        const url = new URL("/login", request.nextUrl);
        if (pathname !== "/") url.searchParams.set("next", pathname);
        return Response.redirect(url);
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.agentId = user.agentId;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.agentId = (token.agentId as string) ?? "";
        session.user.role = (token.role as "admin" | "agent") ?? "agent";
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
