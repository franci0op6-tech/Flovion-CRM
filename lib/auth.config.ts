
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },

  providers: [],

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLogged = !!auth;
      const isLoginPage = nextUrl.pathname.startsWith("/login");

      if (!isLogged && !isLoginPage) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (isLogged && isLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
