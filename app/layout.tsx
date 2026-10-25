import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CRM · Dashboard operativa",
  description: "MVP CRM: lead, task di contatto e note.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Recuperiamo le preferenze dal database (con valori di fallback di sicurezza)
  const tema = await prisma.impostazioniGrafiche.findUnique({
    where: { id: 1 },
  }) || {
    bgColor: "#0f172a",
    textColor: "#f8fafc",
    primaryColor: "#3b82f6",
    cardBgColor: "#1e293b",
  };

  return (
    <html lang="it">
      <body
        style={
          {
            "--color-bg": tema.bgColor,
            "--color-text": tema.textColor,
            "--color-primary": tema.primaryColor,
            "--color-card": tema.cardBgColor,
          } as React.CSSProperties
        }
        className={`${geist.variable} font-sans bg-[var(--color-bg)] text-[var(--color-text)] min-h-screen transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  );
}