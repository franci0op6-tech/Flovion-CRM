
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  requireCurrentUser,
  leadAccessWhere,
  canAssignTaskToUser,
} from "@/lib/permissions";
import { parseLocalToUTC } from "@/lib/utils";
import { pianificaNotificheTask } from "@/lib/task-notifications";

export type CreateTaskState = {
  ok: boolean;
  error?: string;
  taskId?: number;
};

function required(
  value: FormDataEntryValue | null
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parsePositiveId(
  value: string
): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id)
    ? id
    : null;
}

function parseDueDate(
  value: string
): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  ) {
    return null;
  }

  try {
    return parseLocalToUTC(value);
  } catch {
    return null;
  }
}

export async function createTask(
  _prevState: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  try {
    const currentUser =
      await requireCurrentUser();

    const leadId = parsePositiveId(
      required(formData.get("leadId"))
    );

    const descrizione = required(
      formData.get("descrizione")
    );

    const dataScadenzaRaw = required(
      formData.get("data_scadenza")
    );

    const assegnatarioRaw = required(
      formData.get("assegnatoAId")
    );

    if (!leadId) {
      return {
        ok: false,
        error: "Lead non valido.",
      };
    }

    if (!descrizione || !dataScadenzaRaw) {
      return {
        ok: false,
        error:
          "Compila tutti i campi obbligatori.",
      };
    }

    if (descrizione.length > 2000) {
      return {
        ok: false,
        error:
          "La descrizione è troppo lunga.",
      };
    }

    const data_scadenza = parseDueDate(
      dataScadenzaRaw
    );

    if (!data_scadenza) {
      return {
        ok: false,
        error:
          "Inserisci una data di scadenza valida.",
      };
    }

    /*
     * Verifica che l'utente abbia il permesso
     * di creare task sul lead selezionato.
     */
    const lead = await prisma.lead.findFirst({
      where: leadAccessWhere(
        currentUser,
        leadId
      ),
      select: {
        id: true,
        aziendaId: true,
        azienda: {
          select: {
            whatsappOraPromemoria: true,
          },
        },
      },
    });

    if (!lead) {
      return {
        ok: false,
        error:
          "Lead non trovato o non accessibile.",
      };
    }

    if (!lead.aziendaId || !lead.azienda) {
      return {
        ok: false,
        error:
          "Il lead deve appartenere a un'azienda valida.",
      };
    }

    /*
     * USER:
     * assegna automaticamente il task a sé.
     *
     * ADMIN e SUPERADMIN:
     * possono scegliere un utente USER
     * dell'azienda del lead.
     *
     * Se non viene selezionato nessuno,
     * il task rimane senza assegnatario.
     */
    let assegnatoAId: number | null = null;

    if (currentUser.ruolo === "USER") {
      assegnatoAId = currentUser.id;
    } else if (assegnatarioRaw !== "") {
      assegnatoAId = parsePositiveId(
        assegnatarioRaw
      );

      if (!assegnatoAId) {
        return {
          ok: false,
          error:
            "Collaboratore selezionato non valido.",
        };
      }
    }

    if (assegnatoAId !== null) {
      const consentito =
        await canAssignTaskToUser(
          currentUser,
          lead.id,
          assegnatoAId
        );

      if (!consentito) {
        return {
          ok: false,
          error:
            "Non puoi assegnare il task al collaboratore selezionato.",
        };
      }
    }

    /*
     * Fissiamo un unico istante di riferimento
     * per la registrazione dell'assegnazione
     * e la pianificazione delle notifiche.
     */
    const momentoCreazione = new Date();

    /*
     * Tutte le operazioni vengono eseguite
     * nella stessa transazione:
     *
     * 1. Creazione task
     * 2. Condivisione permanente del lead
     * 3. Storico assegnazione
     * 4. Pianificazione notifiche
     *
     * Nessuna notifica WhatsApp viene
     * effettivamente inviata qui.
     */
    const task = await prisma.$transaction(
      async (tx) => {
        const nuovoTask = await tx.task.create({
          data: {
            descrizione,
            data_scadenza,
            completato: false,
            reminderSent: false,
            leadId: lead.id,
            creatoDaId: currentUser.id,
            assegnatoAId,
            assegnatoIl:
              assegnatoAId !== null
                ? momentoCreazione
                : null,
            versionePromemoria: 1,
          },
          select: {
            id: true,
          },
        });

        if (assegnatoAId !== null) {
          /*
           * Condivisione permanente del lead.
           *
           * Riattiva un accesso precedentemente
           * revocato, se presente.
           */
          await tx.accessoLead.upsert({
            where: {
              leadId_utenteId: {
                leadId: lead.id,
                utenteId: assegnatoAId,
              },
            },
            create: {
              leadId: lead.id,
              utenteId: assegnatoAId,
              concessoDaId: currentUser.id,
              concessoIl: momentoCreazione,
            },
            update: {
              concessoDaId: currentUser.id,
              concessoIl: momentoCreazione,
              revocatoIl: null,
              revocatoDaId: null,
            },
          });

          /*
           * Storico dell'assegnazione.
           *
           * taskIdOriginale rimane disponibile
           * anche se il task sarà eliminato.
           */
          await tx.storicoAssegnazione.create({
            data: {
              taskId: nuovoTask.id,
              taskIdOriginale: nuovoTask.id,
              precedenteId: null,
              nuovoId: assegnatoAId,
              effettuataDaId: currentUser.id,
              effettuataIl: momentoCreazione,
            },
          });
        }

        /*
         * Inserimento in coda delle notifiche.
         *
         * ASSEGNAZIONE:
         * subito, se esiste un assegnatario.
         *
         * GIORNO_SCADENZA:
         * all'orario scelto dall'azienda.
         *
         * QUINDICI_MINUTI_PRIMA:
         * 15 minuti prima della scadenza.
         *
         * Il generatore non programma
         * promemoria già scaduti.
         */
        await pianificaNotificheTask({
          tx,
          taskId: nuovoTask.id,
          versionePromemoria: 1,
          dataScadenza: data_scadenza,
          assegnatoAId,
          oraPromemoria:
            lead.azienda!.whatsappOraPromemoria,
          nuovaAssegnazione:
            assegnatoAId !== null,
          riferimento: momentoCreazione,
        });

        return nuovoTask;
      }
    );

    revalidatePath("/");
    revalidatePath("/storico");

    return {
      ok: true,
      taskId: task.id,
    };
  } catch (error) {
    console.error(
      "Errore durante la creazione del task:",
      error instanceof Error
        ? error.name
        : "Errore sconosciuto"
    );

    return {
      ok: false,
      error:
        "Impossibile creare il task. Riprova più tardi.",
    };
  }
}
