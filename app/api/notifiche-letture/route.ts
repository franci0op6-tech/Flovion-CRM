import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Tabella indipendente dallo schema Prisma esistente, senza modificare Task/NotificaTask.
// Il client non sceglie l'utente: l'identità arriva dalla sessione autenticata.
type Riga = { chiave: string; letta: boolean; vista: boolean };

export async function GET() {
  try {
    const utente = await requireCurrentUser();
    const righe = await prisma.$queryRaw<Riga[]>`
      SELECT "chiave", "letta", "vista"
      FROM "LetturaNotificaInterna"
      WHERE "utenteId" = ${utente.id}
      ORDER BY "aggiornataIl" DESC LIMIT 2000
    `;
    return NextResponse.json({ lette: righe.filter(r => r.letta).map(r => r.chiave), note: righe.filter(r => r.vista).map(r => r.chiave) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET notifiche-letture:", error);
    return NextResponse.json({ error: "Impossibile leggere le notifiche" }, { status: 500 });
  }
}

function controllaChiavi(valore: unknown): string[] | null {
  if (valore === undefined) return [];
  if (!Array.isArray(valore) || valore.length > 1000) return null;
  if (!valore.every(v => typeof v === "string" && v.length <= 255 && /^\d+:(SCADUTO|OGGI|ASSEGNATO|AZIENDA):\d{4}-\d{2}-\d{2}T/.test(v))) return null;
  return [...new Set(valore as string[])];
}

export async function POST(request: Request) {
  try {
    const utente = await requireCurrentUser();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Body non valido" }, { status: 400 });
    const obj = body as Record<string, unknown>;
    const lette = controllaChiavi(obj.lette);
    const note = controllaChiavi(obj.note);
    if (lette === null || note === null) return NextResponse.json({ error: "Chiavi non valide" }, { status: 400 });
    // Upsert parametrizzati: nessuna interpolazione SQL proveniente dal browser.
    await prisma.$transaction(async tx => {
      for (const key of note!) {
        await tx.$executeRaw`
          INSERT INTO "LetturaNotificaInterna" ("utenteId", "chiave", "vista", "letta", "aggiornataIl")
          VALUES (${utente.id}, ${key}, true, false, NOW())
          ON CONFLICT ("utenteId", "chiave") DO UPDATE SET "vista" = true, "aggiornataIl" = NOW()
        `;
      }
      for (const key of lette!) {
        await tx.$executeRaw`
          INSERT INTO "LetturaNotificaInterna" ("utenteId", "chiave", "vista", "letta", "aggiornataIl")
          VALUES (${utente.id}, ${key}, true, true, NOW())
          ON CONFLICT ("utenteId", "chiave") DO UPDATE SET "vista" = true, "letta" = true, "aggiornataIl" = NOW()
        `;
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST notifiche-letture:", error);
    return NextResponse.json({ error: "Salvataggio non riuscito" }, { status: 500 });
  }
}
