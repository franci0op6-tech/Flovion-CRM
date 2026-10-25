import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    ruolo: string;
    aziendaId: number | null;
  }

  interface Session {
    user: {
      id: string;
      ruolo: string;
      aziendaId: number | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    ruolo?: string;
    aziendaId?: number | null;
  }
}