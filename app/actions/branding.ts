"use server";

import { revalidatePath } from "next/cache";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "@/lib/prisma";
import { r2, r2BucketName } from "@/lib/r2";
import { requireCurrentUser } from "@/lib/permissions";

const MAX_LOGO = 2 * 1024 * 1024;

async function aziendaAutorizzata(formData: FormData): Promise<number> {
  const utente = await requireCurrentUser();
  if (utente.ruolo !== "ADMIN" && utente.ruolo !== "SUPERADMIN") {
    throw new Error("Non autorizzato a modificare l'azienda.");
  }
  const aziendaId = Number(formData.get("aziendaId"));
  if (!Number.isSafeInteger(aziendaId) || aziendaId <= 0) {
    throw new Error("Azienda non valida.");
  }
  if (utente.ruolo === "ADMIN" && utente.aziendaId !== aziendaId) {
    throw new Error("Non puoi modificare un'altra azienda.");
  }
  const esiste = await prisma.azienda.findUnique({ where: { id: aziendaId }, select: { id: true } });
  if (!esiste) throw new Error("Azienda non trovata.");
  return aziendaId;
}

function aggiornaPagine() {
  revalidatePath("/");
  revalidatePath("/impostazioni");
}

export async function salvaNomeAzienda(formData: FormData) {
  const aziendaId = await aziendaAutorizzata(formData);
  const valore = formData.get("nome");
  if (typeof valore !== "string") throw new Error("Nome aziendale non valido.");
  const nome = valore.trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 100) {
    throw new Error("Il nome deve contenere da 2 a 100 caratteri.");
  }
  await prisma.azienda.update({ where: { id: aziendaId }, data: { nome } });
  aggiornaPagine();
}

export async function salvaLogoAzienda(formData: FormData) {
  const aziendaId = await aziendaAutorizzata(formData);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_LOGO) {
    throw new Error("Seleziona un'immagine valida di massimo 2 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const tipo = await fileTypeFromBuffer(buffer);
  const consentiti = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!tipo || !consentiti.has(tipo.mime)) {
    throw new Error("Logo non valido: carica PNG, JPG o WebP.");
  }
  await r2.send(new PutObjectCommand({
    Bucket: r2BucketName,
    Key: `branding/azienda-${aziendaId}/logo`,
    Body: buffer,
    ContentType: tipo.mime,
    ContentLength: buffer.byteLength,
    CacheControl: "no-store",
  }));
  aggiornaPagine();
}

export async function eliminaLogoAzienda(formData: FormData) {
  const aziendaId = await aziendaAutorizzata(formData);
  await r2.send(new DeleteObjectCommand({
    Bucket: r2BucketName,
    Key: `branding/azienda-${aziendaId}/logo`,
  }));
  aggiornaPagine();
}
