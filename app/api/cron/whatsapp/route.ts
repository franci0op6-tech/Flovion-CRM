import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eseguiDispatcherWhatsApp } from "@/lib/whatsapp-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizzato(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return false;
  const ricevuto = Buffer.from(bearer.slice(7), "utf8");
  const atteso = Buffer.from(secret, "utf8");
  return ricevuto.length === atteso.length && timingSafeEqual(ricevuto, atteso);
}

export async function GET(request: NextRequest) {
  // Nessuna operazione sul database prima della verifica del segreto.
  if (!autorizzato(request)) {
    return NextResponse.json({ ok: false, errore: "Non autorizzato" }, { status: 401 });
  }

  // Blocco indipendente dall'interruttore WhatsApp. Default sicuro: OFF.
  if (process.env.FOLAVION_CRON_ABILITATO !== "true") {
    return NextResponse.json({ ok: true, attivo: false, motivo: "Cron disabilitato" });
  }

  // Non permettere invii da preview o sviluppo; in locale resta spento.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ ok: true, attivo: false, motivo: "Ambiente non di produzione" });
  }

  if (process.env.WHATSAPP_INVIO_ABILITATO !== "true") {
    return NextResponse.json({ ok: true, attivo: false, motivo: "WhatsApp disabilitato" });
  }

  try {
    const risultato = await eseguiDispatcherWhatsApp();
    return NextResponse.json({ ok: true, ...risultato }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Errore cron WhatsApp:", error instanceof Error ? error.name : "Errore sconosciuto");
    return NextResponse.json({ ok: false, errore: "Esecuzione non riuscita" }, { status: 500 });
  }
}
