"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseLocalToUTC } from "@/lib/utils";

export type CreateTaskState = {
  ok: boolean;
  error?: string;
  taskId?: number;
};

function required(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDueDate(value: string) {
  if (!value) return null;
  // Sfruttiamo l'utility per convertire correttamente la stringa in UTC
  const date = parseLocalToUTC(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export async function createTask(
  _prevState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const leadId = Number(formData.get("leadId"));
  const descrizione = required(formData.get("descrizione"));
  const dataScadenzaRaw = required(formData.get("data_scadenza"));

  if (!Number.isInteger(leadId) || leadId <= 0) {
    return { ok: false, error: "Lead non valido." };
  }

  if (!descrizione || !dataScadenzaRaw) {
    return { ok: false, error: "Compila tutti i campi obbligatori." };
  }

  const data_scadenza = parseDueDate(dataScadenzaRaw);
  if (!data_scadenza) {
    return { ok: false, error: "Inserisci una data di scadenza valida." };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true },
  });

  if (!lead) {
    return { ok: false, error: "Il lead selezionato non esiste." };
  }

  const task = await prisma.task.create({
    data: {
      descrizione,
      data_scadenza,
      completato: false,
      leadId,
    },
  });

  revalidatePath("/");
  return { ok: true, taskId: task.id };
}