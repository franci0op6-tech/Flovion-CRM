
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist } from "next/font/google";
import { requireCurrentUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import "./globals.css";

export const dynamic = "force-dynamic";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CRM · Dashboard operativa",
  description: "MVP CRM: lead, task di contatto e note.",
};

const temaPredefinito = {
  bgColor: "#0f172a",
  textColor: "#f8fafc",
  primaryColor: "#3b82f6",
  cardBgColor: "#1e293b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let tema = temaPredefinito;

  try {
    const currentUser = await requireCurrentUser();

    if (currentUser.aziendaId != null) {
      const impostazioni =
        await prisma.impostazioniGrafiche.findUnique({
          where: { aziendaId: currentUser.aziendaId },
          select: {
            bgColor: true,
            textColor: true,
            primaryColor: true,
            cardBgColor: true,
          },
        });

      if (impostazioni) {
        tema = impostazioni;
      }
    }
  } catch {
    // Pagine pubbliche, login o utenti non associati:
    // mantieni il tema predefinito.
  }

  return (
    <html lang="it">
      <body
        style={
          {
            "--color-bg": tema.bgColor,
            "--color-text": tema.textColor,
            "--color-primary": tema.primaryColor,
            "--color-card": tema.cardBgColor,
          } as CSSProperties
        }
        className={`${geist.variable} font-sans bg-[var(--color-bg)] text-[var(--color-text)] min-h-screen transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  );
}
