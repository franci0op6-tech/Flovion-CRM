import "server-only";

import { Prisma, TipoNotificaTask } from "@prisma/client";
import { parseLocalToUTC } from "@/lib/utils";

const TIME_ZONE = "Europe/Rome";
const QUINDICI_MINUTI = 15 * 60 * 1000;

type PianificaNotificheParams = {
  tx: Prisma.TransactionClient;
  taskId: number;
  versionePromemoria: number;
  dataScadenza: Date;
  assegnatoAId: number | null;
  oraPromemoria: string;
  nuovaAssegnazione: boolean;
  nuovaTask?: boolean;
  riferimento?: Date;
};

type DestinatarioNotifica = "AZIENDA" | "COLLABORATORE";

function getDataItaliana(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function getOraValida(value: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("L'orario del promemoria aziendale non è valido.");
  }
  return value;
}

export async function pianificaNotificheTask({
  tx,
  taskId,
  versionePromemoria,
  dataScadenza,
  assegnatoAId,
  oraPromemoria,
  nuovaAssegnazione,
  nuovaTask = false,
  riferimento = new Date(),
}: PianificaNotificheParams): Promise<number> {
  if (
    !Number.isSafeInteger(taskId) ||
    taskId <= 0 ||
    !Number.isSafeInteger(versionePromemoria) ||
    versionePromemoria <= 0
  ) {
    throw new Error("Identificativo task non valido.");
  }
  if (Number.isNaN(dataScadenza.getTime()) || Number.isNaN(riferimento.getTime())) {
    throw new Error("Data non valida.");
  }

  const task = await tx.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) {
    throw new Error("Task non trovato durante la pianificazione.");
  }

  const notifiche: {
    taskId: number;
    tipo: TipoNotificaTask;
    versionePromemoria: number;
    chiaveIdempotenza: string;
    programmataPer: Date;
  }[] = [];

  function aggiungi(
    tipo: TipoNotificaTask,
    programmataPer: Date,
    destinatario: DestinatarioNotifica
  ) {
    notifiche.push({
      taskId,
      tipo,
      versionePromemoria,
      // Il dispatcher usa il suffisso per risolvere il destinatario della riga.
      chiaveIdempotenza: `task:${taskId}:v${versionePromemoria}:${tipo}:${destinatario}`,
      programmataPer,
    });
  }

  // L'assegnazione viene comunicata soltanto al collaboratore.
  if (nuovaAssegnazione && assegnatoAId !== null) {
    aggiungi(TipoNotificaTask.ASSEGNAZIONE, riferimento, "COLLABORATORE");
  } else if (nuovaTask && assegnatoAId === null) {
    // La creazione senza assegnatario avvisa il numero aziendale.
    aggiungi(TipoNotificaTask.ASSEGNAZIONE, riferimento, "AZIENDA");
  }

  if (dataScadenza.getTime() > riferimento.getTime()) {
    const giornoItaliano = getDataItaliana(dataScadenza);
    const ora = getOraValida(oraPromemoria);
    const orarioGiornaliero = parseLocalToUTC(`${giornoItaliano}T${ora}`);
    const destinatario = assegnatoAId === null ? "AZIENDA" : "COLLABORATORE";

    if (
      orarioGiornaliero.getTime() > riferimento.getTime() &&
      orarioGiornaliero.getTime() < dataScadenza.getTime()
    ) {
      aggiungi(TipoNotificaTask.GIORNO_SCADENZA, orarioGiornaliero, destinatario);
    }

    const quindiciMinutiPrima = new Date(dataScadenza.getTime() - QUINDICI_MINUTI);
    if (quindiciMinutiPrima.getTime() > riferimento.getTime()) {
      aggiungi(TipoNotificaTask.QUINDICI_MINUTI_PRIMA, quindiciMinutiPrima, destinatario);
    }
  }

  if (notifiche.length === 0) return 0;
  const result = await tx.notificaTask.createMany({
    data: notifiche,
    skipDuplicates: true,
  });
  return result.count;
}
