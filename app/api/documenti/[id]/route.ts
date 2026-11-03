
import {
  GetObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { r2, r2BucketName } from "@/lib/r2";
import {
  requireCurrentUser,
  leadReadAccessWhere,
} from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Verifica autenticazione prima di accedere ai documenti.
  let currentUser: Awaited<ReturnType<typeof requireCurrentUser>>;

  try {
    currentUser = await requireCurrentUser();
  } catch {
    return new Response("Accesso non autorizzato.", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return new Response("ID documento non valido.", {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const documento = await prisma.documento.findUnique({
      where: { id },
      select: {
        id: true,
        nome_file: true,
        url_file: true,
        leadId: true,
      },
    });

    if (!documento) {
      return new Response("Documento non trovato.", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    // Controlla i permessi di LETTURA sul lead.
    // Sono inclusi i lead condivisi con il collaboratore.
    const accessoConsentito = await prisma.lead.findFirst({
      where: leadReadAccessWhere(
        currentUser,
        documento.leadId
      ),
      select: {
        id: true,
      },
    });

    if (!accessoConsentito) {
      return new Response("Accesso negato.", {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const chiave = documento.url_file;

    // Accetta solo chiavi dell'archivio privato
    // nel formato documenti/UUID.
    const formatoChiaveValido =
      /^documenti\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoChiaveValido.test(chiave)) {
      return new Response(
        "Documento non disponibile nell'archivio privato.",
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const risultato = await r2.send(
      new GetObjectCommand({
        Bucket: r2BucketName,
        Key: chiave,
      })
    );

    if (!risultato.Body) {
      return new Response("File non disponibile.", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    // Rimuove caratteri non sicuri dal nome del file.
    const nomeSicuro =
      documento.nome_file
        .replace(/[\r\n"\\]/g, "_")
        .replace(/[^\x20-\x7E]/g, "_")
        .slice(0, 200) || "documento";

    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nomeSicuro}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
    });

    if (risultato.ContentLength != null) {
      headers.set(
        "Content-Length",
        String(risultato.ContentLength)
      );
    }

    return new Response(
      risultato.Body.transformToWebStream(),
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      error.name === "NoSuchKey"
    ) {
      return new Response("File non trovato nell'archivio.", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    // Non registrare credenziali o dati sensibili.
    console.error(
      "Errore durante il download del documento."
    );

    return new Response(
      "Impossibile scaricare il documento.",
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
