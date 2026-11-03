
import { NextResponse } from "next/server";

import {
  eseguiDispatcherWhatsApp,
} from "@/lib/whatsapp-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  /*
   * Controllo di sicurezza del cron.
   *
   * Il secret viene letto dalle variabili
   * d'ambiente e non dall'URL.
   */
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json(
      {
        success: false,
        error: "Cron non configurato.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (
    authorization !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Non autorizzato.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  /*
   * Protezione aggiuntiva:
   *
   * Quando WhatsApp non è abilitato,
   * non avviamo nemmeno il dispatcher.
   *
   * In questo modo non vengono eseguite
   * query sulla tabella NotificaTask,
   * che non è ancora stata creata su Neon.
   */
  if (
    process.env.WHATSAPP_INVIO_ABILITATO !==
    "true"
  ) {
    return NextResponse.json(
      {
        success: true,
        attivo: false,
        messaggio:
          "Invio WhatsApp disabilitato. Nessuna notifica elaborata.",
        messaggiInviati: 0,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const risultato =
      await eseguiDispatcherWhatsApp();

    return NextResponse.json(
      {
        success: true,
        ...risultato,
        messaggio:
          "Elaborazione della coda completata.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Errore durante il dispatcher WhatsApp:",
      error instanceof Error
        ? error.name
        : "Errore sconosciuto"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Errore durante l'elaborazione delle notifiche.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
