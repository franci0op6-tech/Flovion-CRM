"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export async function salvaColoriTema(formData: FormData) {
  const bgColor = formData.get("bgColor") as string;
  const textColor = formData.get("textColor") as string;
  const primaryColor = formData.get("primaryColor") as string;
  const cardBgColor = formData.get("cardBgColor") as string;

  await prisma.impostazioniGrafiche.upsert({
    where: { id: 1 },
    update: { bgColor, textColor, primaryColor, cardBgColor },
    create: { id: 1, bgColor, textColor, primaryColor, cardBgColor },
  });

  revalidatePath("/");
}