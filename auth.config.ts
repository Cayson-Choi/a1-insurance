import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login"];

// Edge runtime 호환을 위해 DB 의존 로직(jwt·session)은 auth.ts 로 분리.
// 여기엔 미들웨어에서 호출 가능한 가벼운 라우트 가드만 남긴다.
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
  },
} satisfies NextAuthConfig;
