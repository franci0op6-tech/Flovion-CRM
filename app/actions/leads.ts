"use server";



import { requireCurrentUser } from "@/lib/permissions";
import { parseLocalToUTC } from "@/lib/utils";
import { pianificaNotificheTask } from "@/lib/task-notifications";

import { prisma } from "@/lib/prisma";

import { revalidatePath } from "next/cache";

import { unlink } from "node:fs/promises";

import { join } from "node:path";

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { fileTypeFromBuffer } from "file-type";

import { r2, r2BucketName } from "@/lib/r2";

import { z } from "zod";



// Schema Zod per validare i dati dei lead/collaboratori

const leadSchema = z.object({

  nome: z.string().min(2, "Il nome è obbligatorio").max(100),

  email: z.string().email("Email non valida"),

  telefono: z.string().min(5, "Telefono non valido").max(20),

  servizio_richiesto: z.string().min(1, "Seleziona un servizio"),

  provincia: z.string().optional().nullable(),

  tipo: z.enum(["CLIENTE", "COLLABORATORE"]).optional(),

  tipoImpiego: z.string().optional().nullable(),

  redditoNetto: z.number().nullable().optional(),

  interesseMutuo: z.string().optional().nullable(),

  altriFinanziamenti: z.string().optional().nullable(),

});







export async function createLead(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const aziendaId = currentUser.aziendaId;

  const userId = currentUser.id;



  // Per ora il SUPERADMIN può creare lead solo se seleziona

  // un'azienda tramite un flusso dedicato, da implementare.

  if (

    typeof aziendaId !== "number" ||

    !Number.isSafeInteger(aziendaId) ||

    aziendaId <= 0

  ) {

    throw new Error("Utente non associato a un'azienda valida.");

  }



  const azienda = await prisma.azienda.findUnique({

    where: { id: aziendaId },

    select: { id: true },

  });



  if (!azienda) {

    throw new Error("L'azienda associata non esiste.");

  }



  const rawData = {

    nome: formData.get("nome"),

    email: formData.get("email"),

    telefono: formData.get("telefono"),

    servizio_richiesto: formData.get("servizio_richiesto"),

    provincia: formData.get("provincia"),

    tipo: formData.get("tipo") || "CLIENTE",

    tipoImpiego: formData.get("tipoImpiego"),

    redditoNetto: formData.get("redditoNetto")

      ? Number.parseFloat(formData.get("redditoNetto") as string)

      : null,

    interesseMutuo: formData.get("interesseMutuo"),

    altriFinanziamenti: formData.get("altriFinanziamenti"),

  };



  const validation = leadSchema.safeParse(rawData);



  if (!validation.success) {

    throw new Error("Dati non validi inseriti nel form.");

  }



  const data = validation.data;



  await prisma.lead.create({

    data: {

      nome: data.nome,

      email: data.email,

      telefono: data.telefono,

      servizio_richiesto: data.servizio_richiesto,

      provincia: data.provincia,

      tipo: data.tipo || "CLIENTE",

      tipoImpiego: data.tipoImpiego,

      redditoNetto: data.redditoNetto,

      interesseMutuo: data.interesseMutuo,

      altriFinanziamenti: data.altriFinanziamenti,

      utenteId: userId,

      aziendaId,

    },

  });



  revalidatePath("/");

}









export async function updateLeadStatus(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const id = Number(formData.get("id"));

  const stato = formData.get("stato");



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID lead non valido.");

  }



  if (typeof stato !== "string" || !stato.trim()) {

    throw new Error("Stato del lead non valido.");

  }



  const where =

    currentUser.ruolo === "SUPERADMIN"

      ? { id }

      : currentUser.ruolo === "ADMIN"

        ? {

            id,

            aziendaId: currentUser.aziendaId!,

          }

        : {

            id,

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const leadEsistente = await prisma.lead.findFirst({

    where,

    select: { id: true },

  });



  if (!leadEsistente) {

    throw new Error("Lead non trovato o accesso non autorizzato.");

  }



  await prisma.lead.update({

    where: { id: leadEsistente.id },

    data: { stato: stato.trim() },

  });



  revalidatePath("/");

}











export async function addNote(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const leadId = Number(formData.get("leadId"));

  const testo = formData.get("testo");



  if (!Number.isSafeInteger(leadId) || leadId <= 0) {

    throw new Error("ID lead non valido.");

  }



  if (typeof testo !== "string" || !testo.trim() || testo.length > 5000) {

    throw new Error("Il testo della nota non è valido.");

  }



  const where =

    currentUser.ruolo === "SUPERADMIN"

      ? { id: leadId }

      : currentUser.ruolo === "ADMIN"

        ? {

            id: leadId,

            aziendaId: currentUser.aziendaId!,

          }

        : {

            id: leadId,

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const lead = await prisma.lead.findFirst({

    where,

    select: { id: true },

  });



  if (!lead) {

    throw new Error("Lead non trovato o accesso non autorizzato.");

  }



  await prisma.nota.create({

    data: {

      testo_nota: testo.trim(),

      leadId: lead.id,

    },

  });



  revalidatePath("/");

}











export async function deleteNote(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const id = Number(formData.get("id"));



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID nota non valido.");

  }



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  const nota = await prisma.nota.findFirst({

    where: {

      id,

      lead:

        currentUser.ruolo === "SUPERADMIN"

          ? {}

          : currentUser.ruolo === "ADMIN"

            ? { aziendaId: currentUser.aziendaId! }

            : {

                aziendaId: currentUser.aziendaId!,

                utenteId: currentUser.id,

              },

    },

    select: { id: true },

  });



  if (!nota) {

    throw new Error("Nota non trovata o accesso non autorizzato.");

  }



  await prisma.nota.delete({

    where: { id: nota.id },

  });



  revalidatePath("/");

}









export async function toggleArchiveLead(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const id = Number(formData.get("id"));

  const isArchived = formData.get("archiviato") === "true";



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID lead non valido.");

  }



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  const filtroProprieta =

    currentUser.ruolo === "SUPERADMIN"

      ? { id }

      : currentUser.ruolo === "ADMIN"

        ? {

            id,

            aziendaId: currentUser.aziendaId!,

          }

        : {

            id,

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const leadEsistente = await prisma.lead.findFirst({

    where: filtroProprieta,

    select: { id: true },

  });



  if (!leadEsistente) {

    throw new Error("Lead non trovato o accesso non autorizzato.");

  }



  await prisma.lead.update({

    where: { id: leadEsistente.id },

    data: { archiviato: isArchived },

  });



  revalidatePath("/");

}









export async function completeTask(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const id = Number(formData.get("id"));

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("ID task non valido.");
  }

  if (
    currentUser.ruolo !== "SUPERADMIN" &&
    currentUser.aziendaId == null
  ) {
    throw new Error("Utente non associato a un'azienda.");
  }

  // Il completamento è un permesso specifico del task:
  // l'assegnatario USER può completarlo, ma NON modificare il lead.
  const permessi =
    currentUser.ruolo === "SUPERADMIN"
      ? {}
      : currentUser.ruolo === "ADMIN"
        ? { lead: { is: { aziendaId: currentUser.aziendaId! } } }
        : {
            lead: { is: { aziendaId: currentUser.aziendaId! } },
            OR: [
              { assegnatoAId: currentUser.id },
              { lead: { is: { utenteId: currentUser.id } } },
            ],
          };

  const risultato = await prisma.$transaction(async (tx) => {
    // Il filtro dei permessi è parte dell'UPDATE, così un cambio di
    // assegnatario non permette a un ex assegnatario di completare il task.
    const aggiornamento = await tx.task.updateMany({
      where: {
        id,
        completato: false,
        ...permessi,
      },
      data: { completato: true },
    });

    if (aggiornamento.count !== 1) {
      return false;
    }

    // Annulliamo tutte le notifiche pendenti, anche ASSEGNAZIONE.
    // Le notifiche inviate vengono conservate nello storico.
    await tx.notificaTask.updateMany({
      where: {
        taskId: id,
        stato: { in: ["IN_ATTESA", "FALLITA"] },
      },
      data: {
        stato: "ANNULLATA",
        prossimoTentativo: null,
        ultimoErrore: "Task completato.",
      },
    });

    return true;
  });

  if (!risultato) {
    throw new Error(
      "Task non trovato, già completato o accesso non autorizzato."
    );
  }

  revalidatePath("/");
}


export async function deleteTask(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const id = Number(formData.get("id"));



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID task non valido.");

  }



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  const filtroLead =

    currentUser.ruolo === "SUPERADMIN"

      ? {}

      : currentUser.ruolo === "ADMIN"

        ? { aziendaId: currentUser.aziendaId! }

        : {

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const task = await prisma.task.findFirst({

    where: {

      id,

      lead: { is: filtroLead },

    },

    select: { id: true },

  });



  if (!task) {

    throw new Error("Task non trovato o accesso non autorizzato.");

  }



  await prisma.task.delete({

    where: { id: task.id },

  });



  revalidatePath("/");

  revalidatePath("/storico");

}











export async function editLead(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const id = Number(formData.get("id"));



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID lead non valido.");

  }



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  const filtroProprieta =

    currentUser.ruolo === "SUPERADMIN"

      ? { id }

      : currentUser.ruolo === "ADMIN"

        ? {

            id,

            aziendaId: currentUser.aziendaId!,

          }

        : {

            id,

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const leadEsistente = await prisma.lead.findFirst({

    where: filtroProprieta,

    select: { id: true },

  });



  if (!leadEsistente) {

    throw new Error("Lead non trovato o accesso non autorizzato.");

  }



  const rawData = {

    nome: formData.get("nome") as string,

    email: formData.get("email") as string,

    telefono: formData.get("telefono") as string,

    servizio_richiesto: formData.get("servizio_richiesto") as string,

    provincia: formData.get("provincia") as string,

    tipo: (formData.get("tipo") as string) || "CLIENTE",

    tipoImpiego: formData.get("tipoImpiego") as string,

    redditoNetto: formData.get("redditoNetto")

      ? Number.parseFloat(formData.get("redditoNetto") as string)

      : null,

    interesseMutuo: formData.get("interesseMutuo") as string,

    altriFinanziamenti: formData.get("altriFinanziamenti") as string,

  };



  const validation = leadSchema.safeParse(rawData);



  if (!validation.success) {

    throw new Error("Dati non validi forniti durante la modifica.");

  }



  const data = validation.data;



  await prisma.lead.update({

    where: { id: leadEsistente.id },

    data: {

      nome: data.nome,

      email: data.email,

      telefono: data.telefono,

      servizio_richiesto: data.servizio_richiesto,

      provincia: data.provincia,

      tipo: data.tipo,

      tipoImpiego: data.tipoImpiego,

      redditoNetto: data.redditoNetto,

      interesseMutuo: data.interesseMutuo,

      altriFinanziamenti: data.altriFinanziamenti,

    },

  });



  revalidatePath("/");

}















export async function uploadDocument(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const file = formData.get("file");

  const leadId = Number(formData.get("leadId"));



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  if (!(file instanceof File) || file.size === 0) {

    throw new Error("Seleziona un file valido.");

  }



  if (!Number.isSafeInteger(leadId) || leadId <= 0) {

    throw new Error("ID lead non valido.");

  }



  if (file.size > 10 * 1024 * 1024) {

    throw new Error("Il file non può superare 10 MB.");

  }



  const filtroLead =

    currentUser.ruolo === "SUPERADMIN"

      ? { id: leadId }

      : currentUser.ruolo === "ADMIN"

        ? {

            id: leadId,

            aziendaId: currentUser.aziendaId!,

          }

        : {

            id: leadId,

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const lead = await prisma.lead.findFirst({

    where: filtroLead,

    select: { id: true },

  });



  if (!lead) {

    throw new Error("Lead non trovato o accesso non autorizzato.");

  }



  const buffer = Buffer.from(await file.arrayBuffer());

  const tipoFile = await fileTypeFromBuffer(buffer);



  const tipiConsentiti: Record<string, string> = {

    "application/pdf": "pdf",

    "image/jpeg": "jpg",

    "image/png": "png",

    "image/webp": "webp",

  };



  if (!tipoFile || tipiConsentiti[tipoFile.mime] !== tipoFile.ext) {

    throw new Error(

      "Formato non consentito. Carica un PDF, JPEG, PNG o WebP valido.",

    );

  }



  const nomeOriginale =

    file.name

      .split(/[\\/]/)

      .pop()

      ?.replace(/[\u0000-\u001f\u007f]/g, "")

      .trim()

      .slice(0, 255) || `documento.${tipoFile.ext}`;



  const chiave = `documenti/${crypto.randomUUID()}`;



  await r2.send(

    new PutObjectCommand({

      Bucket: r2BucketName,

      Key: chiave,

      Body: buffer,

      ContentLength: buffer.length,

      ContentType: tipoFile.mime,

    }),

  );



  try {

    await prisma.documento.create({

      data: {

        nome_file: nomeOriginale,

        url_file: chiave,

        leadId: lead.id,

      },

    });

  } catch (error) {

    try {

      await r2.send(

        new DeleteObjectCommand({

          Bucket: r2BucketName,

          Key: chiave,

        }),

      );

    } catch (cleanupError) {

      console.error(

        "Errore durante la pulizia del documento R2:",

        cleanupError,

      );

    }



    throw error;

  }



  revalidatePath("/");

}

























export async function deleteDocument(formData: FormData) {

  const currentUser = await requireCurrentUser();



  const id = Number(formData.get("id"));



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID documento non valido.");

  }



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  const filtroLead =

    currentUser.ruolo === "SUPERADMIN"

      ? {}

      : currentUser.ruolo === "ADMIN"

        ? { aziendaId: currentUser.aziendaId! }

        : {

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const documento = await prisma.documento.findFirst({

    where: {

      id,

      lead: { is: filtroLead },

    },

    select: {

      id: true,

      url_file: true,

    },

  });



  if (!documento) {

    throw new Error("Documento non trovato o accesso non autorizzato.");

  }



  const chiave = documento.url_file;



  if (chiave.startsWith("documenti/")) {

    await r2.send(

      new DeleteObjectCommand({

        Bucket: r2BucketName,

        Key: chiave,

      }),

    );

  } else if (chiave.startsWith("/uploads/")) {

    const nomeFile = chiave.slice("/uploads/".length);



    if (

      !nomeFile ||

      nomeFile.includes("/") ||

      nomeFile.includes("\\") ||

      nomeFile === "." ||

      nomeFile === ".."

    ) {

      throw new Error("Percorso del documento non valido.");

    }



    const pathFisico = join(

      process.cwd(),

      "public",

      "uploads",

      nomeFile,

    );



    try {

      await unlink(pathFisico);

    } catch (error) {

      const codice =

        typeof error === "object" &&

        error !== null &&

        "code" in error

          ? error.code

          : undefined;



      if (codice !== "ENOENT") {

        throw new Error("Impossibile eliminare il file locale.");

      }

    }

  } else {

    throw new Error("Posizione del documento non riconosciuta.");

  }



  await prisma.documento.delete({

    where: { id: documento.id },

  });



  revalidatePath("/");

}



















export async function editTask(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const id = Number(formData.get("id"));
  const descrizioneRaw = formData.get("descrizione");
  const scadenzaRaw = formData.get("data_scadenza");
  const assegnatarioRaw = formData.get("assegnatoAId");

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("ID task non valido.");
  }
  if (
    typeof descrizioneRaw !== "string" ||
    !descrizioneRaw.trim() ||
    descrizioneRaw.trim().length > 2000 ||
    typeof scadenzaRaw !== "string"
  ) {
    throw new Error("Compila correttamente tutti i campi obbligatori.");
  }

  const descrizione = descrizioneRaw.trim();
  let data_scadenza: Date;
  try {
    data_scadenza = parseLocalToUTC(scadenzaRaw);
  } catch {
    throw new Error("Data e ora di scadenza non valide.");
  }

  // Un campo omesso significa: mantieni l'assegnatario attuale.
  // Un campo presente ma vuoto significa: rimuovi l'assegnazione.
  const modificaAssegnatario = assegnatarioRaw !== null;
  let nuovoAssegnatarioId: number | null = null;
  if (modificaAssegnatario) {
    if (currentUser.ruolo === "USER") {
      throw new Error("Solo un amministratore può riassegnare un task.");
    }
    if (typeof assegnatarioRaw !== "string") {
      throw new Error("Assegnatario non valido.");
    }
    if (assegnatarioRaw !== "") {
      if (!/^[1-9]\d*$/.test(assegnatarioRaw)) {
        throw new Error("Assegnatario non valido.");
      }
      nuovoAssegnatarioId = Number(assegnatarioRaw);
      if (!Number.isSafeInteger(nuovoAssegnatarioId)) {
        throw new Error("Assegnatario non valido.");
      }
    }
  }

  const momentoModifica = new Date();

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: {
        id,
        lead: {
          is: currentUser.ruolo === "SUPERADMIN"
            ? {}
            : currentUser.ruolo === "ADMIN"
              ? { aziendaId: currentUser.aziendaId! }
              : { aziendaId: currentUser.aziendaId!, utenteId: currentUser.id },
        },
      },
      select: {
        id: true,
        leadId: true,
        data_scadenza: true,
        assegnatoAId: true,
        lead: {
          select: {
            aziendaId: true,
            azienda: { select: { whatsappOraPromemoria: true } },
          },
        },
        versionePromemoria: true,
      },
    });

    if (!task) {
      throw new Error("Task non trovato o accesso non autorizzato.");
    }

    const assegnatarioFinale = modificaAssegnatario
      ? nuovoAssegnatarioId
      : task.assegnatoAId;
    const assegnazioneCambiata =
      assegnatarioFinale !== task.assegnatoAId;
    const scadenzaCambiata =
      task.data_scadenza.getTime() !== data_scadenza.getTime();

    if (assegnazioneCambiata && assegnatarioFinale !== null) {
      if (!task.lead.aziendaId) {
        throw new Error("Il lead non è associato a un'azienda.");
      }
      const utente = await tx.utente.findFirst({
        where: {
          id: assegnatarioFinale,
          aziendaId: task.lead.aziendaId,
          ruolo: "USER",
        },
        select: { id: true },
      });
      if (!utente) {
        throw new Error("Collaboratore non autorizzato per questa azienda.");
      }
    }

    const taskAggiornato = await tx.task.update({
      where: { id: task.id },
      data: {
        descrizione,
        data_scadenza,
        ...(assegnazioneCambiata
          ? { assegnatoAId: assegnatarioFinale, assegnatoIl: assegnatarioFinale === null ? null : momentoModifica }
          : {}),
        ...(assegnazioneCambiata || scadenzaCambiata
          ? { versionePromemoria: { increment: 1 }, reminderSent: false }
          : {}),
      },
      select: { id: true, versionePromemoria: true },
    });

    if (assegnazioneCambiata) {
      await tx.storicoAssegnazione.create({
        data: {
          taskId: task.id,
          taskIdOriginale: task.id,
          precedenteId: task.assegnatoAId,
          nuovoId: assegnatarioFinale,
          effettuataDaId: currentUser.id,
        },
      });

      if (assegnatarioFinale !== null) {
        await tx.accessoLead.upsert({
          where: {
            leadId_utenteId: {
              leadId: task.leadId,
              utenteId: assegnatarioFinale,
            },
          },
          create: {
            leadId: task.leadId,
            utenteId: assegnatarioFinale,
            concessoDaId: currentUser.id,
          },
          update: {
            revocatoIl: null,
            revocatoDaId: null,
          },
        });
      }
      // L'accesso del precedente assegnatario NON viene revocato.
    }

    if (assegnazioneCambiata || scadenzaCambiata) {
      await tx.notificaTask.updateMany({
        where: {
          taskId: task.id,
          stato: { in: ["IN_ATTESA", "FALLITA"] },
        },
        data: { stato: "ANNULLATA" },
      });
      if (!task.lead.aziendaId || !task.lead.azienda) {
        throw new Error("Azienda del lead non disponibile per i promemoria.");
      }

      await pianificaNotificheTask({
        tx,
        taskId: taskAggiornato.id,
        versionePromemoria: taskAggiornato.versionePromemoria,
        dataScadenza: data_scadenza,
        assegnatoAId: assegnatarioFinale,
        oraPromemoria: task.lead.azienda.whatsappOraPromemoria,
        nuovaAssegnazione: assegnazioneCambiata && assegnatarioFinale !== null,
        riferimento: momentoModifica,
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/storico");
}


// --- ELIMINAZIONE DEFINITIVA DAL CESTINO ---









export async function deletePermanentlyLead(formData: FormData) {

  const currentUser = await requireCurrentUser();

  const id = Number(formData.get("id"));



  if (!Number.isSafeInteger(id) || id <= 0) {

    throw new Error("ID lead non valido.");

  }



  if (

    currentUser.ruolo !== "SUPERADMIN" &&

    currentUser.aziendaId == null

  ) {

    throw new Error("Utente non associato a un'azienda.");

  }



  const filtroProprieta =

    currentUser.ruolo === "SUPERADMIN"

      ? { id }

      : currentUser.ruolo === "ADMIN"

        ? {

            id,

            aziendaId: currentUser.aziendaId!,

          }

        : {

            id,

            aziendaId: currentUser.aziendaId!,

            utenteId: currentUser.id,

          };



  const documenti = await prisma.$transaction(async (tx) => {

    const lead = await tx.lead.findFirst({

      where: filtroProprieta,

      select: {

        id: true,

        documenti: {

          select: {

            url_file: true,

          },

        },

      },

    });



    if (!lead) {

      throw new Error("Lead non trovato o accesso non autorizzato.");

    }



    await tx.task.deleteMany({

      where: { leadId: lead.id },

    });



    await tx.nota.deleteMany({

      where: { leadId: lead.id },

    });



    await tx.documento.deleteMany({

      where: { leadId: lead.id },

    });



    await tx.lead.delete({

      where: { id: lead.id },

    });



    return lead.documenti;

  });



  const directoryUploads = join(

    process.cwd(),

    "public",

    "uploads",

  );



  for (const documento of documenti) {

    const posizione = documento.url_file;



    try {

      if (posizione.startsWith("documenti/")) {

        await r2.send(

          new DeleteObjectCommand({

            Bucket: r2BucketName,

            Key: posizione,

          }),

        );

      } else if (posizione.startsWith("/uploads/")) {

        const nomeFile = posizione.slice("/uploads/".length);



        if (

          !nomeFile ||

          nomeFile.includes("/") ||

          nomeFile.includes("\\") ||

          nomeFile === "." ||

          nomeFile === ".."

        ) {

          console.error("Percorso del documento locale non valido.");

          continue;

        }



        try {

          await unlink(join(directoryUploads, nomeFile));

        } catch (error) {

          const codice =

            typeof error === "object" &&

            error !== null &&

            "code" in error

              ? error.code

              : undefined;



          if (codice !== "ENOENT") {

            throw error;

          }

        }

      }

    } catch (error) {

      console.error(

        "Impossibile eliminare un documento dopo la cancellazione del lead:",

        error,

      );

    }

  }



  revalidatePath("/");

  revalidatePath("/storico");

}
