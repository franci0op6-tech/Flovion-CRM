import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const secretKey = url.searchParams.get("key");

    if (secretKey !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Authentication Error" }, { status: 401 });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const destinatario = process.env.WHATSAPP_DESTINATARIO;

    if (!token || !phoneId || !destinatario) {
      return NextResponse.json({ error: "Credenziali WhatsApp mancanti nel .env" }, { status: 500 });
    }

    let notificheInviate = 0;

    // TEST IMMEDIATO: Prendiamo TUTTI i task attivi non ancora notificati, senza filtri di orario restrittivi
    const upcomingTasks = await prisma.task.findMany({
      where: {
        reminderSent: false,
        completato: false,
      },
      include: { lead: true },
    });

    if (upcomingTasks.length === 0) {
      return NextResponse.json({ success: true, message: "Nessun task attivo trovato da notificare." });
    }

    for (const task of upcomingTasks) {
      const taskTitle = task.descrizione || "Task senza titolo";
      const orario = new Date(task.data_scadenza).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tipoContatto = task.lead?.tipo === "COLLABORATORE" ? "Collaboratore" : "Cliente";
      const nomeContatto = task.lead?.nome || "Contatto sconosciuto";

      const messageText = `⏰ *Promemoria CRM*: Scadenza imminente!\n\n👤 *${tipoContatto}:* ${nomeContatto}\n📝 *Attività:* ${taskTitle}\n🕒 *Previsto per le:* ${orario}`;

      const response = await fetch(
        `https://graph.facebook.com/v17.0/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: destinatario,
            type: "text",
            text: { body: messageText },
          }),
        }
      );

      if (response.ok) {
        await prisma.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        });
        notificheInviate++;
      } else {
        const errorData = await response.json();
        console.error("Errore Meta API:", errorData);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Notifiche inviate con successo! Totale: ${notificheInviate}` 
    });

  } catch (error) {
    console.error("Errore nell'invio del promemoria:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}