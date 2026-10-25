"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { z } from "zod";

// Schema Zod per validare i dati dei lead/collaboratori
const leadSchema = z.object({
  nome: z.string().min(2, "Il nome è obbligatorio").max(100),
  email: z.string().email("Email non valida"),
  telefono: z.string().min(5, "Telefono non valido").max(20),
  servizio_richiesto: z.string().min(1, "Seleziona un servizio"),
  provincia: z.string().optional().nullable(),
  tipo: z.string().optional(),
  tipoImpiego: z.string().optional().nullable(),
  redditoNetto: z.number().nullable().optional(),
  interesseMutuo: z.string().optional().nullable(),
  altriFinanziamenti: z.string().optional().nullable(),
});

export async function createLead(formData: FormData){
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");
  
  const userId = Number(session.user.id);
  const aziendaId = session.user.aziendaId;

if (aziendaId === null) {
  throw new Error("Utente non associato a un'azienda.");
}

  const rawData = {
    nome: formData.get("nome") as string,
    email: formData.get("email") as string,
    telefono: formData.get("telefono") as string,
    servizio_richiesto: formData.get("servizio_richiesto") as string,
    provincia: formData.get("provincia") as string,
    tipo: formData.get("tipo") as string || "CLIENTE",
    tipoImpiego: formData.get("tipoImpiego") as string,
    redditoNetto: formData.get("redditoNetto") ? parseFloat(formData.get("redditoNetto") as string) : null,
    interesseMutuo: formData.get("interesseMutuo") as string,
    altriFinanziamenti: formData.get("altriFinanziamenti") as string,
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
      aziendaId: aziendaId,  
    },
  });

  revalidatePath("/");
}

export async function updateLeadStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");
  const aziendaId = session.user.aziendaId;
  const userRole = session.user.ruolo;
  const userId = Number(session.user.id);
  
  if (aziendaId === null) {
    throw new Error("Utente non associato a un'azienda.");
  }

  const id = parseInt(formData.get("id") as string);
  const stato = formData.get("stato") as string;
  
  if (!id) return;

  // 🛡️ Controllo di sicurezza: verifica che il lead appartenga all'azienda dell'utente
  const filtroProprieta = userRole === "ADMIN" 
    ? { id, aziendaId } 
    : { id, aziendaId, utenteId: userId };

  const leadEsistente = await prisma.lead.findFirst({ where: filtroProprieta });
  if (!leadEsistente) throw new Error("Azione non autorizzata.");

  await prisma.lead.update({
    where: { id },
    data: { stato },
  });
  revalidatePath("/");
}

export async function createTask(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const leadId = parseInt(formData.get("leadId") as string);
  const descrizione = formData.get("descrizione") as string;
  const scadenza = formData.get("data_scadenza") as string;
  const data_scadenza = new Date(scadenza);
  
  // 1. Creiamo il task e includiamo il lead per sapere se è Cliente o Collaboratore
  const task = await prisma.task.create({
    data: { descrizione, data_scadenza, leadId },
    include: { lead: true }, 
  });

  // 2. Invio della notifica tramite Meta WhatsApp Cloud API
  try {
    const orario = data_scadenza.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const dataFormat = data_scadenza.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    
    const tipoContatto = task.lead.tipo === "COLLABORATORE" ? "Collaboratore" : "Cliente";
    const testoMessaggio = `🔔 *Nuovo Task / Promemoria*\n\n👤 *${tipoContatto}:* ${task.lead.nome}\n📝 *Attività:* ${descrizione}\n📅 *Scadenza:* ${dataFormat} ore ${orario}`;

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const DESTINATION_PHONE = process.env.WHATSAPP_DESTINATARIO;

    if (WHATSAPP_TOKEN && PHONE_NUMBER_ID && DESTINATION_PHONE) {
      await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: DESTINATION_PHONE,
          type: "text",
          text: {
            body: testoMessaggio
          }
        }),
      });
    }
  } catch (error) {
    console.error("Errore durante l'invio del messaggio WhatsApp con Meta:", error);
  }

  revalidatePath("/");
}

export async function addNote(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const leadId = parseInt(formData.get("leadId") as string);
  const testo = formData.get("testo") as string;
  
  await prisma.nota.create({
    data: {
      testo_nota: testo,
      leadId,
    },
  });
  revalidatePath("/");
}

export async function deleteNote(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const id = parseInt(formData.get("id") as string);
  
  await prisma.nota.delete({
    where: { id },
  });
  revalidatePath("/");
}

export async function toggleArchiveLead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");
  const aziendaId = session.user.aziendaId;
const userRole = session.user.ruolo;
const userId = Number(session.user.id);

if (aziendaId === null) {
  throw new Error("Utente non associato a un'azienda.");
}

  const id = parseInt(formData.get("id") as string);
  const isArchived = formData.get("archiviato") === "true";
  
  if (!id) return;

  const filtroProprieta = userRole === "ADMIN" 
    ? { id, aziendaId } 
    : { id, aziendaId, utenteId: userId };

  const leadEsistente = await prisma.lead.findFirst({ where: filtroProprieta });
  if (!leadEsistente) throw new Error("Azione non autorizzata.");

  await prisma.lead.update({
    where: { id },
    data: { archiviato: isArchived },
  });
  revalidatePath("/");
}

export async function completeTask(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const id = parseInt(formData.get("id") as string);
  await prisma.task.update({
    where: { id },
    data: { completato: true },
  });
  revalidatePath("/");
}

export async function deleteTask(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const id = parseInt(formData.get("id") as string);
  await prisma.task.delete({
    where: { id },
  });
  revalidatePath("/");
}

export async function editLead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");
  const aziendaId = session.user.aziendaId;
  const userRole = session.user.ruolo;
  const userId = Number(session.user.id);
  
  if (aziendaId === null) {
    throw new Error("Utente non associato a un'azienda.");
  }

  const id = parseInt(formData.get("id") as string);
  if (!id) throw new Error("ID non valido.");

  // 🛡️ Controllo di sicurezza IDOR (impedisce di modificare lead di altre aziende)
  const filtroProprieta = userRole === "ADMIN" 
    ? { id, aziendaId } 
    : { id, aziendaId, utenteId: userId };

  const leadEsistente = await prisma.lead.findFirst({ where: filtroProprieta });
  if (!leadEsistente) {
    throw new Error("Accesso negato o risorsa non trovata nella tua azienda.");
  }

  const rawData = {
    nome: formData.get("nome") as string,
    email: formData.get("email") as string,
    telefono: formData.get("telefono") as string,
    servizio_richiesto: formData.get("servizio_richiesto") as string,
    provincia: formData.get("provincia") as string,
    tipo: formData.get("tipo") as string || "CLIENTE",
    tipoImpiego: formData.get("tipoImpiego") as string,
    redditoNetto: formData.get("redditoNetto") ? parseFloat(formData.get("redditoNetto") as string) : null,
    interesseMutuo: formData.get("interesseMutuo") as string,
    altriFinanziamenti: formData.get("altriFinanziamenti") as string,
  };

  const validation = leadSchema.safeParse(rawData);
  if (!validation.success) {
    throw new Error("Dati non validi forniti durante la modifica.");
  }

  const data = validation.data;

  await prisma.lead.update({
    where: { id },
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const file = formData.get("file") as File;
  const leadId = formData.get("leadId") as string;

  if (!file || !file.name || !leadId) return;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const nomeUnivoco = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const pathFisico = join(process.cwd(), "public/uploads", nomeUnivoco);

  await writeFile(pathFisico, buffer);

  await prisma.documento.create({
    data: {
      nome_file: file.name,
      url_file: `/uploads/${nomeUnivoco}`,
      leadId: Number(leadId),
    }
  });

  revalidatePath("/");
}

export async function deleteDocument(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const id = Number(formData.get("id"));
  if (!id) return;

  const documento = await prisma.documento.findUnique({ where: { id } });
  if (!documento) return;

  try {
    const nomeFile = documento.url_file.replace('/uploads/', '');
    const pathFisico = join(process.cwd(), "public/uploads", nomeFile);
    await unlink(pathFisico);
  } catch {
    console.log("File non trovato nel disco, proseguo...");
  }

  await prisma.documento.delete({ where: { id } });

  revalidatePath("/");
}

export async function editTask(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");

  const id = Number(formData.get("id"));
  const descrizione = formData.get("descrizione") as string;
  const data_scadenza = new Date(formData.get("data_scadenza") as string);

  if (!id) return;

  await prisma.task.update({
    where: { id },
    data: { descrizione, data_scadenza },
  });

  revalidatePath("/");
}

// --- ELIMINAZIONE DEFINITIVA DAL CESTINO ---
export async function deletePermanentlyLead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accesso negato");
  const aziendaId = session.user.aziendaId;
  const userRole = session.user.ruolo;
  const userId = Number(session.user.id);
  
  if (aziendaId === null) {
    throw new Error("Utente non associato a un'azienda.");
  }

  const id = parseInt(formData.get("id") as string);
  if (!id) return;

  const filtroProprieta = userRole === "ADMIN" 
    ? { id, aziendaId } 
    : { id, aziendaId, utenteId: userId };

  const leadEsistente = await prisma.lead.findFirst({ where: filtroProprieta });
  if (!leadEsistente) throw new Error("Azione non autorizzata.");

  await prisma.task.deleteMany({ where: { leadId: id } });
  await prisma.nota.deleteMany({ where: { leadId: id } });
  await prisma.documento.deleteMany({ where: { leadId: id } });

  await prisma.lead.delete({
    where: { id },
  });

  revalidatePath("/");
}