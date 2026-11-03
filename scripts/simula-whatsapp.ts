/**
 * Simulazione di sola lettura della coda WhatsApp.
 * NON importa il dispatcher e NON invia messaggi.
 * Esecuzione: npx tsx scripts/simula-whatsapp.ts
 */
import { prisma } from "../lib/prisma";

const HOST_TEST = "ep-soft-shadow-b99bz7up";
const TIPI = ["ASSEGNAZIONE", "GIORNO_SCADENZA", "QUINDICI_MINUTI_PRIMA"];

function numeroMascherato(numero: string | null | undefined): string {
  if (!numero?.trim()) return "NON CONFIGURATO";
  const n = numero.trim();
  return `CONFIGURATO (...${n.slice(-3)})`;
}

function destinatarioAttuale(
  tipo: string,
  chiaveIdempotenza: string,
  collaboratore: string | null | undefined,
  azienda: string | null | undefined,
  modalita: string | null | undefined,
): { origine: string; numero: string | null } {
  const numeroCollaboratore = collaboratore?.trim() || null;
  const numeroAzienda = azienda?.trim() || null;
  if (chiaveIdempotenza.endsWith(":COLLABORATORE")) {
    return { origine: "collaboratore", numero: numeroCollaboratore };
  }
  if (chiaveIdempotenza.endsWith(":AZIENDA")) {
    return { origine: "azienda", numero: numeroAzienda };
  }
  // Compatibilità con le notifiche create prima della modifica.
  if (tipo === "ASSEGNAZIONE") {
    return { origine: "collaboratore (legacy)", numero: numeroCollaboratore };
  }
  if (modalita === "COLLABORATORE") {
    return numeroCollaboratore
      ? { origine: "collaboratore (legacy)", numero: numeroCollaboratore }
      : { origine: "azienda (fallback legacy)", numero: numeroAzienda };
  }
  return { origine: "azienda (legacy)", numero: numeroAzienda };
}

async function main() {
  if (process.env.WHATSAPP_INVIO_ABILITATO !== "false") {
    throw new Error("Sicurezza: imposta WHATSAPP_INVIO_ABILITATO=false prima della simulazione.");
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL non configurata.");
  const host = new URL(rawUrl).hostname;
  if (!host.startsWith(HOST_TEST)) {
    throw new Error("Sicurezza: DATABASE_URL non punta all'endpoint Neon di TEST atteso. Nessuna query eseguita.");
  }

  const ora = new Date();
  const notifiche = await prisma.notificaTask.findMany({
    where: { stato: "IN_ATTESA" },
    include: {
      task: {
        include: {
          assegnatoA: { select: { id: true, whatsappNumero: true } },
          lead: {
            include: {
              azienda: {
                select: { whatsappNumero: true, whatsappModalitaPromemoria: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ programmataPer: "asc" }, { id: "asc" }],
    take: 50,
  });

  console.log("SIMULAZIONE WHATSAPP — SOLA LETTURA");
  console.log("Host test verificato; nessuna scrittura o chiamata a Meta.");
  console.log(`Ora UTC: ${ora.toISOString()} — notifiche IN_ATTESA esaminate: ${notifiche.length}\n`);

  for (const n of notifiche) {
    const task = n.task;
    const oraPrevista = n.prossimoTentativo && n.prossimoTentativo > n.programmataPer
      ? n.prossimoTentativo : n.programmataPer;
    const pronta = oraPrevista <= ora;
    const destinatario = destinatarioAttuale(
      n.tipo,
      n.chiaveIdempotenza,
      task.assegnatoA?.whatsappNumero,
      task.lead.azienda?.whatsappNumero,
      task.lead.azienda?.whatsappModalitaPromemoria,
    );
    const motivo = !TIPI.includes(n.tipo)
      ? "TIPO NON RICONOSCIUTO"
      : task.completato
        ? "ANNULLARE: TASK COMPLETATO"
        : task.versionePromemoria !== n.versionePromemoria
          ? "ANNULLARE: VERSIONE OBSOLETA"
          : !destinatario.numero
            ? "NON INVIABILE: NUMERO MANCANTE"
            : pronta
              ? "CANDIDATA ALL'INVIO (solo simulazione)"
              : "PROGRAMMATA PER IL FUTURO";
    console.log([
      `notifica=${n.id}`,
      `task=${task.id}`,
      `tipo=${n.tipo}`,
      `v=${n.versionePromemoria}/${task.versionePromemoria}`,
      `programmata=${n.programmataPer.toISOString()}`,
      `destinatario=${destinatario.origine}: ${numeroMascherato(destinatario.numero)}`,
      `ESITO=${motivo}`,
    ].join(" | "));
  }
  console.log("\nSIMULAZIONE TERMINATA: nessuna notifica modificata; nessun messaggio inviato.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Errore simulazione.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
