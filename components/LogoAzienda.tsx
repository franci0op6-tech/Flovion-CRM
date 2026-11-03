"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  aziendaId: number | null;
  nome: string;
  width?: number;
  height?: number;
};

export function LogoAzienda({ aziendaId, nome, width = 48, height = 48 }: Props) {
  const [errore, setErrore] = useState(false);
  if (aziendaId === null || errore) {
    return (
      <div aria-label={`Logo di ${nome}`} className="flex h-full w-full items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-600">
        {nome.trim().charAt(0).toUpperCase() || "F"}
      </div>
    );
  }
  return (
    <Image
      src={`/api/azienda-logo?aziendaId=${aziendaId}`}
      alt={`Logo di ${nome}`}
      width={width}
      height={height}
      unoptimized
      onError={() => setErrore(true)}
      className="h-full w-full object-contain"
    />
  );
}
