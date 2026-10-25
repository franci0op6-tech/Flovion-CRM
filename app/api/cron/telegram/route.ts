import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // 1. Password di sicurezza per evitare che sconosciuti attivino la rotta
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== "SVEGLIA_CRM_123") {
    return NextResponse.json({ error: "Accesso negato" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Token Telegram mancante" }, { status: 500 });

  // 2. Calcola l'inizio e la fine di oggi
  const oggi = new Date();
  const inizioOggi = new Date(oggi.setHours(0, 0, 0, 0));
  const fineOggi = new Date(oggi.setHours(23, 59, 59, 999));

  // 3. Trova i task non completati in scadenza oggi
  const tasks = await prisma.task.findMany({
    where: {
      completato: false,
      data_scadenza: { gte: inizioOggi, lte: fineOggi }
    },
    include: {
      lead: { include: { utente: true } } // Ci serve l'utente per prendere la sua chat_id
    }
  });

  let messaggiInviati = 0;

  // 4. Invia un messaggio per ogni task trovato
  for (const task of tasks) {
    // Legge il telegram_chat_id dell'utente assegnato al cliente
    const chatId = task.lead.utente?.telegram_chat_id; 
    
    if (chatId) {
      const orario = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(task.data_scadenza);
      
      // Formattazione del testo per Telegram
      const messaggio = `🔔 *Promemoria Task CRM*\n\nOggi alle *${orario}* devi gestire:\n\n👤 *${task.lead.nome}*\n📞 ${task.lead.telefono || 'N/D'}\n📝 _${task.descrizione}_\n\nBuon lavoro!`;

      // Spedizione effettiva del messaggio
      // Spedizione effettiva del messaggio
      const risposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messaggio,
          parse_mode: "Markdown"
        }),
      });
      
      const dettagli = await risposta.json();
      if (!risposta.ok) {
        // Se Telegram rifiuta, blocchiamo tutto e mostriamo l'errore a schermo!
        return NextResponse.json({ 
          error: "Telegram ha bloccato il messaggio", 
          dettagli: dettagli 
        }, { status: 400 });
    } 
      messaggiInviati++;
    }
  }

  return NextResponse.json({ success: true, messaggi_inviati: messaggiInviati });
}