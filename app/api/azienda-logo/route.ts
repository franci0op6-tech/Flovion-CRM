import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, r2BucketName } from "@/lib/r2";
import { requireCurrentUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const utente = await requireCurrentUser();
  const aziendaId = Number(new URL(request.url).searchParams.get("aziendaId"));
  if (!Number.isSafeInteger(aziendaId) || aziendaId <= 0) {
    return new Response("Richiesta non valida", { status: 400 });
  }
  if (utente.ruolo !== "SUPERADMIN" && utente.aziendaId !== aziendaId) {
    return new Response("Non autorizzato", { status: 403 });
  }
  try {
    const oggetto = await r2.send(new GetObjectCommand({
      Bucket: r2BucketName,
      Key: `branding/azienda-${aziendaId}/logo`,
    }));
    if (!oggetto.Body) return new Response(null, { status: 404 });
    const contenuto = Buffer.from(await oggetto.Body.transformToByteArray());
    return new Response(new Uint8Array(contenuto), {
      headers: {
        "Content-Type": oggetto.ContentType && ["image/png", "image/jpeg", "image/webp"].includes(oggetto.ContentType)
          ? oggetto.ContentType : "application/octet-stream",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "name" in error &&
        (error.name === "NoSuchKey" || error.name === "NotFound")) {
      return new Response(null, { status: 404 });
    }
    console.error("Impossibile leggere il logo aziendale da R2.");
    return new Response("Logo temporaneamente non disponibile", { status: 503 });
  }
}
