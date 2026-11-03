
import type { DefaultSession } from "next-auth";

export type RuoloUtente = "SUPERADMIN" | "ADMIN" | "USER";

declare module "next-auth" {
  interface User {
    ruolo: RuoloUtente;
    aziendaId: number | null;
  }

  interface Session {
    user: {
      id: string;
      ruolo: RuoloUtente;
      aziendaId: number | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    ruolo?: RuoloUtente;
    aziendaId?: number | null;
  }
}
