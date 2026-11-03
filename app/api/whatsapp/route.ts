
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eseguiDispatcherWhatsApp } from "@/lib/whatsapp-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headersNoCache = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  // 1. Verifica obbligatoria del segreto CRON.
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json(
      {
        success: false,
        error: "Cron non configurato.",
      },
      {
        status: 503,
        headers: headersNoCache,
      }
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        success: false,
        error: "Non autorizzato.",
      },
      {
        status: 401,
        headers: headersNoCache,
      }
    );
  }

  const ricevuto = Buffer.from(authorization.slice(7), "utf8");
  const atteso = Buffer.from(cronSecret, "utf8");

  const autorizzato =
    ricevuto.length === atteso.length &&
    timingSafeEqual(ricevuto, atteso);

  if (!autorizzato) {
    return NextResponse.json(
      {
        success: false,
        error: "Non autorizzato.",
      },
      {
        status: 401,
        headers: headersNoCache,
      }
    );
  }

  // 2. Il cron deve essere esplicitamente abilitato.
  if (process.env.FOLAVION_CRON_ABILITATO !== "true") {
    return NextResponse.json(
      {
        success: true,
        attivo: false,
        messaggio: "Cron WhatsApp disabilitato.",
        messaggiInviati: 0,
      },
      {
        headers: headersNoCache,
      }
    );
  }

  // 3. Il dispatcher automatico può funzionare
  // soltanto nell'ambiente Vercel Production.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      {
        success: true,
        attivo: false,
        messaggio: "Ambiente non di produzione.",
        messaggiInviati: 0,
      },
      {
        headers: headersNoCache,
      }
    );
  }

  // 4. L'invio WhatsApp deve essere esplicitamente abilitato.
  if (process.env.WHATSAPP_INVIO_ABILITATO !== "true") {
    return NextResponse.json(
      {
        success: true,
        attivo: false,
        messaggio: "Invio WhatsApp disabilitato.",
        messaggiInviati: 0,
      },
      {
        headers: headersNoCache,
      }
    );
  }

  // 5. Esegui il dispatcher soltanto dopo
  // aver superato tutti i controlli.
  try {
    const risultato = await eseguiDispatcherWhatsApp();

    return NextResponse.json(
      {
        success: true,
        ...risultato,
        messaggio: "Elaborazione della coda completata.",
      },
      {
        headers: headersNoCache,
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
        error: "Errore durante l'elaborazione delle notifiche.",
      },
      {
        status: 500,
        headers: headersNoCache,
      }
    );
  }
}
