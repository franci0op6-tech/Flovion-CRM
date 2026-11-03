
"use server";

import { requireCurrentUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function salvaColoriTema(formData: FormData) {
  const currentUser = await requireCurrentUser();

  if (
    currentUser.ruolo !== "SUPERADMIN" &&
    currentUser.ruolo !== "ADMIN"
  ) {
    throw new Error(
      "Non hai i permessi per modificare le impostazioni grafiche.",
    );
  }

  const bgColor = formData.get("bgColor");
  const textColor = formData.get("textColor");
  const primaryColor = formData.get("primaryColor");
  const cardBgColor = formData.get("cardBgColor");

  const colori = [
    bgColor,
    textColor,
    primaryColor,
    cardBgColor,
  ];

  if (
    colori.some(
      (colore) =>
        typeof colore !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(colore),
    )
  ) {
    throw new Error("Uno o più colori non sono validi.");
  }

  if (
    currentUser.ruolo !== "SUPERADMIN" &&
    currentUser.aziendaId == null
  ) {
    throw new Error("Utente non associato a un'azienda.");
  }

  const aziende = await prisma.azienda.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  // L'ADMIN modifica esclusivamente la propria azienda.
  // Il SUPERADMIN, per ora, modifica la prima azienda:
  // la selezione esplicita dell'azienda sarà aggiunta dopo.
  const aziendaId =
    currentUser.ruolo === "SUPERADMIN"
      ? Number(formData.get("aziendaId"))
      : currentUser.aziendaId!;

  if (!Number.isSafeInteger(aziendaId) || aziendaId <= 0) {
    throw new Error("Seleziona un'azienda valida.");
  }

  if (!aziende.some((azienda) => azienda.id === aziendaId)) {
    throw new Error("L'azienda selezionata non esiste.");
  }

  if (
    currentUser.ruolo === "ADMIN" &&
    aziendaId !== currentUser.aziendaId
  ) {
    throw new Error("Non puoi modificare un'altra azienda.");
  }

  await prisma.impostazioniGrafiche.upsert({
    where: { aziendaId },
    update: {
      bgColor: bgColor as string,
      textColor: textColor as string,
      primaryColor: primaryColor as string,
      cardBgColor: cardBgColor as string,
    },
    create: {
      aziendaId,
      bgColor: bgColor as string,
      textColor: textColor as string,
      primaryColor: primaryColor as string,
      cardBgColor: cardBgColor as string,
    },
  });

  revalidatePath("/");
  revalidatePath("/impostazioni");
}
