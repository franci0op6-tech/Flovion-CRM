import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };

  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json(
      { errore: "Non disponibile" },
      { status: 404, headers }
    );
  }

  const secret = process.env.VERIFICA_DB_PREVIEW_SECRET;
  const bearer = request.headers.get("authorization");

  if (!secret || secret.length < 16 || !bearer?.startsWith("Bearer ")) {
    return NextResponse.json(
      { errore: "Non autorizzato" },
      { status: 401, headers }
    );
  }

  const ricevuto = Buffer.from(bearer.slice(7), "utf8");
  const atteso = Buffer.from(secret, "utf8");

  if (
    ricevuto.length !== atteso.length ||
    !timingSafeEqual(ricevuto, atteso)
  ) {
    return NextResponse.json(
      { errore: "Non autorizzato" },
      { status: 401, headers }
    );
  }

  let stato = "NON_TEST";

  try {
    const url = process.env.DATABASE_URL;

    if (
      url &&
      new URL(url).hostname ===
        "ep-soft-shadow-b99bz7up.c-7.eu-central-1.aws.neon.tech"
    ) {
      stato = "TEST";
    }
  } catch {
    stato = "NON_TEST";
  }

  return NextResponse.json({ database: stato }, { headers });
}
