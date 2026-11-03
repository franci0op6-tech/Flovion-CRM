
import "server-only";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type Ruolo = "SUPERADMIN" | "ADMIN" | "USER";

const RUOLI_VALIDI: readonly Ruolo[] = [
  "SUPERADMIN",
  "ADMIN",
  "USER",
];

function isRuolo(value: unknown): value is Ruolo {
  return (
    typeof value === "string" &&
    RUOLI_VALIDI.includes(value as Ruolo)
  );
}

function isValidId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Recupera l'utente autenticato.
 *
 * I permessi vengono riletti dal database:
 * non ci affidiamo soltanto al ruolo presente nella sessione.
 */
export async function requireCurrentUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Accesso negato.");
  }

  const id = Number(session.user.id);

  if (!isValidId(id)) {
    throw new Error("Utente non valido.");
  }

  const user = await prisma.utente.findUnique({
    where: { id },
    select: {
      id: true,
      ruolo: true,
      aziendaId: true,
    },
  });

  if (!user || !isRuolo(user.ruolo)) {
    throw new Error("Utente non autorizzato.");
  }

  if (user.ruolo !== "SUPERADMIN" && !user.aziendaId) {
    throw new Error(
      "Utente non associato a un'azienda."
    );
  }

  return {
    id: user.id,
    ruolo: user.ruolo,
    aziendaId: user.aziendaId,
  };
}

export type CurrentUser = Awaited<
  ReturnType<typeof requireCurrentUser>
>;

/**
 * Permessi di MODIFICA del lead.
 *
 * SUPERADMIN:
 *   può gestire tutti i lead.
 *
 * ADMIN:
 *   può gestire i lead della propria azienda.
 *
 * USER:
 *   può gestire i lead di cui è proprietario.
 *
 * I lead condivisi NON diventano automaticamente
 * modificabili o eliminabili.
 */
export function leadAccessWhere(
  user: CurrentUser,
  leadId: number
): Prisma.LeadWhereInput {
  if (!isValidId(leadId)) {
    throw new Error("ID lead non valido.");
  }

  if (user.ruolo === "SUPERADMIN") {
    return { id: leadId };
  }

  if (!user.aziendaId) {
    throw new Error(
      "Utente non associato a un'azienda."
    );
  }

  if (user.ruolo === "ADMIN") {
    return {
      id: leadId,
      aziendaId: user.aziendaId,
    };
  }

  return {
    id: leadId,
    aziendaId: user.aziendaId,
    utenteId: user.id,
  };
}

/**
 * Permessi di VISUALIZZAZIONE del lead.
 *
 * Un collaboratore può vedere:
 * - i propri lead;
 * - i lead condivisi con lui;
 *
 * La condivisione deve essere ancora attiva
 * e il lead deve appartenere alla sua azienda.
 *
 * Questo filtro va usato per le letture.
 */
export function leadReadAccessWhere(
  user: CurrentUser,
  leadId?: number
): Prisma.LeadWhereInput {
  if (leadId !== undefined && !isValidId(leadId)) {
    throw new Error("ID lead non valido.");
  }

  const idFilter =
    leadId === undefined ? {} : { id: leadId };

  if (user.ruolo === "SUPERADMIN") {
    return idFilter;
  }

  if (!user.aziendaId) {
    throw new Error(
      "Utente non associato a un'azienda."
    );
  }

  if (user.ruolo === "ADMIN") {
    return {
      ...idFilter,
      aziendaId: user.aziendaId,
    };
  }

  return {
    ...idFilter,
    aziendaId: user.aziendaId,
    OR: [
      {
        utenteId: user.id,
      },
      {
        accessiCondivisi: {
          some: {
            utenteId: user.id,
            revocatoIl: null,
          },
        },
      },
    ],
  };
}

/**
 * Verifica se l'utente può ASSEGNARE
 * un task a un determinato collaboratore.
 *
 * Restituisce false per qualsiasi assegnazione
 * non consentita.
 *
 * Un task può essere assegnato soltanto
 * a un utente USER della stessa azienda del lead.
 */
export async function canAssignTaskToUser(
  currentUser: CurrentUser,
  leadId: number,
  assegnatarioId: number
): Promise<boolean> {
  if (
    !isValidId(leadId) ||
    !isValidId(assegnatarioId)
  ) {
    return false;
  }

  // USER può assegnare un task soltanto a sé stesso.
  if (
    currentUser.ruolo === "USER" &&
    assegnatarioId !== currentUser.id
  ) {
    return false;
  }

  const lead = await prisma.lead.findFirst({
    where: leadAccessWhere(currentUser, leadId),
    select: {
      id: true,
      aziendaId: true,
    },
  });

  if (!lead?.aziendaId) {
    return false;
  }

  const assegnatario = await prisma.utente.findFirst({
    where: {
      id: assegnatarioId,
      aziendaId: lead.aziendaId,
      ruolo: "USER",
    },
    select: {
      id: true,
    },
  });

  return assegnatario !== null;
}

/**
 * Verifica se un utente può gestire
 * le impostazioni aziendali WhatsApp.
 *
 * ADMIN: soltanto la propria azienda.
 * SUPERADMIN: qualsiasi azienda esistente.
 * USER: nessuna azienda.
 */
export async function canManageCompanySettings(
  currentUser: CurrentUser,
  aziendaId: number
): Promise<boolean> {
  if (!isValidId(aziendaId)) {
    return false;
  }

  if (currentUser.ruolo === "USER") {
    return false;
  }

  if (currentUser.ruolo === "ADMIN") {
    return currentUser.aziendaId === aziendaId;
  }

  const azienda = await prisma.azienda.findUnique({
    where: { id: aziendaId },
    select: { id: true },
  });

  return azienda !== null;
}
