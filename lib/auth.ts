
import { authConfig } from "@/lib/auth.config";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { RuoloUtente } from "@/types/next-auth";

const RUOLI_VALIDI: RuoloUtente[] = [
  "SUPERADMIN",
  "ADMIN",
  "USER",
];

function isRuoloUtente(ruolo: unknown): ruolo is RuoloUtente {
  return (
    typeof ruolo === "string" &&
    RUOLI_VALIDI.includes(ruolo as RuoloUtente)
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    CredentialsProvider({
      name: "Credenziali",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string"
        ) {
          return null;
        }

        const utente = await prisma.utente.findUnique({
          where: { email: credentials.email },
        });

        if (!utente || !isRuoloUtente(utente.ruolo)) {
          return null;
        }

        const passwordCorretta = await bcrypt.compare(
          credentials.password,
          utente.password
        );

        if (!passwordCorretta) {
          return null;
        }

        return {
          id: utente.id.toString(),
          name: utente.nome,
          email: utente.email,
          ruolo: utente.ruolo,
          aziendaId: utente.aziendaId,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.ruolo = user.ruolo;
        token.aziendaId = user.aziendaId;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.id === "string" ? token.id : "";

        session.user.ruolo = isRuoloUtente(token.ruolo)
          ? token.ruolo
          : "USER";

        session.user.aziendaId =
          typeof token.aziendaId === "number"
            ? token.aziendaId
            : null;
      }

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.AUTH_SECRET,
});
