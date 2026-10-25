"use client";

import { updateLeadStatus } from "@/app/actions/leads";
import { useTransition } from "react";

export function LeadStatusSelect({ leadId, stato, tipo }: { leadId: number; stato: string; tipo?: string }) {
  const [isPending, startTransition] = useTransition();
  const isCollaboratore = tipo === "COLLABORATORE";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStato = e.target.value;
    const formData = new FormData();
    formData.append("id", leadId.toString());
    formData.append("stato", newStato);

    startTransition(() => {
      updateLeadStatus(formData);
    });
  };

  return (
    <select
      value={stato}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50 font-medium"
    >
      {isCollaboratore ? (
        <>
          <option value="Attivo">Attivo</option>
          <option value="In prova">In prova</option>
          <option value="Sospeso">Sospeso</option>
          <option value="Inattivo">Inattivo</option>
        </>
      ) : (
        <>
          <option value="Nuovo">Nuovo</option>
          <option value="Da Contattare">Da Contattare</option>
          <option value="In Lavorazione">In Lavorazione</option>
          <option value="Attesa Verifiche">Attesa Verifiche</option>
          <option value="Chiuso Vinto">Chiuso Vinto</option>
          <option value="Chiuso Perso">Chiuso Perso</option>
        </>
      )}
    </select>
  );
}