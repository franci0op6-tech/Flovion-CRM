/** Anteprima sola lettura del template Meta a 15 minuti. Non invia nulla. */
import { prisma } from "../lib/prisma";

const HOST_TEST = "ep-soft-shadow-b99bz7up.c-7.eu-central-1.aws.neon.tech";
const TASK_ID = 6;
const CRM_BASE = "https://flovion-crm.vercel.app";

function testoBreve(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "Attività nel CRM";
}

async function main() {
  if (process.env.WHATSAPP_INVIO_ABILITATO !== "false") {
    throw new Error("BLOCCATO: impostare esplicitamente WHATSAPP_INVIO_ABILITATO=false.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || new URL(databaseUrl).hostname !== HOST_TEST) {
    throw new Error("BLOCCATO: DATABASE_URL non punta all'host di TEST atteso.");
  }

  const task = await prisma.task.findUnique({
    where: { id: TASK_ID },
    select: {
      id: true,
      descrizione: true,
      data_scadenza: true,
      completato: true,
      versionePromemoria: true,
      lead: { select: { nome: true } },

    },
  });
  if (!task) throw new Error(`Task ${TASK_ID} non trovato nel database di test.`);
  const notifiche = await prisma.notificaTask.findMany({
    where: { taskId: TASK_ID, tipo: "QUINDICI_MINUTI_PRIMA" },
    select: {
      id: true, stato: true, chiaveIdempotenza: true,
      programmataPer: true, versionePromemoria: true,
    },
    orderBy: { id: "asc" },
  });

  const ora = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(task.data_scadenza);
  const cliente = testoBreve(task.lead.nome, 100);
  const descrizione = testoBreve(task.descrizione, 300);
  const url = `${CRM_BASE}/?task=${task.id}`;

  console.log("ANTEPRIMA WHATSAPP — SOLA LETTURA, NESSUN INVIO");
  console.log(`Task: ${task.id} | completato=${task.completato} | versione=${task.versionePromemoria}`);
  console.log("\nBODY del template folavion_promemoria_15_minuti:");
  console.log(`{{1}} Cliente: ${cliente}`);
  console.log(`{{2}} Descrizione: ${descrizione}`);
  console.log(`{{3}} Ora di scadenza (Italia): ${ora}`);
  console.log("\nPULSANTE Meta: sub_type=url, index=0, parametro dinamico:");
  console.log(`{{1}} suffisso: ${task.id}`);
  console.log(`URL finale previsto: ${url}`);
  console.log("\nNOTIFICHE A 15 MINUTI:");
  if (notifiche.length === 0) console.log("Nessuna notifica presente.");
  for (const n of notifiche) {
    const destinatario = n.chiaveIdempotenza.endsWith(":AZIENDA") ? "azienda"
      : n.chiaveIdempotenza.endsWith(":COLLABORATORE") ? "collaboratore" : "legacy";
    const differenza = task.data_scadenza.getTime() - n.programmataPer.getTime();
    const versioniCoerenti = n.versionePromemoria === task.versionePromemoria;
    console.log(`id=${n.id} | ${destinatario} | stato=${n.stato} | versioneOK=${versioniCoerenti} | minutiPrima=${differenza / 60000}`);
  }
  console.log("\nNOTA: non sono stati letti o stampati numeri WhatsApp né token.");
  console.log("Il pulsante pubblico funzionerà solo dopo il deploy del codice aggiornato su Vercel.");
  console.log("Template soggetto ad approvazione Meta e consenso dei destinatari.");
  console.log("SIMULAZIONE TERMINATA: nessuna modifica al database, nessuna chiamata Meta.");
}

main().catch((error: unknown) => {
  console.error("Anteprima non riuscita:", error instanceof Error ? error.message : "Errore sconosciuto");
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
