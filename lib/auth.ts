import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credenziali",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const utente = await prisma.utente.findUnique({
          where: { email: credentials.email as string }
        });

        if (!utente) return null;

        const passwordCorretta = await bcrypt.compare(
          credentials.password as string,
          utente.password
        );

        if (!passwordCorretta) return null;

        return {
          id: utente.id.toString(),
          name: utente.nome,
          email: utente.email,
          ruolo: utente.ruolo,
          // @ts-ignore
          aziendaId: utente.aziendaId, // <-- 1. Legge l'azienda dal DB
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.ruolo = user.ruolo as string;
        // @ts-ignore
        token.aziendaId = user.aziendaId; // <-- 2. Salva nel token
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // @ts-ignore
        session.user.ruolo = token.ruolo as string;
        // @ts-ignore
        session.user.aziendaId = token.aziendaId as number; // <-- 3. Passa alla sessione
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
});