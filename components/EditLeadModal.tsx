"use client";

import { useState, useTransition } from "react";
import { editLead } from "@/app/actions/leads";

import type { Prisma } from "@prisma/client";

type Lead = Prisma.LeadGetPayload<object>;

export function EditLeadModal({ lead }: { lead: Lead }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isCollaboratore = lead.tipo === "COLLABORATORE";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("id", lead.id.toString());
    
    startTransition(() => {
      editLead(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title={isCollaboratore ? "Modifica Collaboratore" : "Modifica Cliente"}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">
                {isCollaboratore ? "Modifica Collaboratore" : "Modifica Dati Cliente"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome e Cognome</label>
                <input
                  type="text"
                  name="nome"
                  required
                  defaultValue={lead.nome}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={lead.email}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefono</label>
                <input
                  type="tel"
                  name="telefono"
                  required
                  defaultValue={lead.telefono}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* CAMBIO DINAMICO DEL CAMPO SERVIZIO / RUOLO */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {isCollaboratore ? "Ruolo / Mansione" : "Servizio Richiesto"}
                </label>
                {isCollaboratore ? (
                  <input
                    type="text"
                    name="servizio_richiesto"
                    defaultValue={lead.servizio_richiesto || ""}
                    placeholder="Es. Segretaria, Agente, Partner..."
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                ) : (
                  <select
                    name="servizio_richiesto"
                    required
                    defaultValue={lead.servizio_richiesto}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  >
                    <optgroup label="Credito">
                      <option value="Mutui">Mutui</option>
                      <option value="Cessioni del quinto">Cessioni del quinto</option>
                      <option value="Prestiti personali">Prestiti personali</option>
                      <option value="Prestiti aziendali">Prestiti aziendali</option>
                    </optgroup>
                    <optgroup label="Utenze">
                      <option value="Luce">Luce</option>
                      <option value="Gas">Gas</option>
                      <option value="Internet">Internet</option>
                    </optgroup>
                    <optgroup label="Noleggio Auto">
                      <option value="Noleggio breve">Noleggio breve</option>
                      <option value="Noleggio lungo termine">Noleggio lungo termine</option>
                    </optgroup>
                  </select>
                )}
              </div>

              {/* --- CAMPI AGGIUNTIVI (VISIBILI SOLO PER I CLIENTI) --- */}
              {!isCollaboratore && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Provincia</label>
                    <input
                      type="text"
                      name="provincia"
                      defaultValue={lead.provincia || ""}
                      placeholder="Es. Milano"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tipo di Impiego</label>
                    <input
                      type="text"
                      name="tipoImpiego"
                      defaultValue={lead.tipoImpiego || ""}
                      placeholder="Es. Dipendente"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Reddito Netto (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="redditoNetto"
                      defaultValue={lead.redditoNetto || ""}
                      placeholder="Es. 1600"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Interessato a Mutuo?</label>
                    <select
                      name="interesseMutuo"
                      defaultValue={lead.interesseMutuo || ""}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    >
                      <option value="">Seleziona...</option>
                      <option value="Si">Sì</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Altri Finanziamenti?</label>
                    <select
                      name="altriFinanziamenti"
                      defaultValue={lead.altriFinanziamenti || ""}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    >
                      <option value="">Seleziona...</option>
                      <option value="Si">Sì</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              )}
              {/* --- FINE CAMPI AGGIUNTIVI --- */}
              
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Annulla
                </button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                  {isPending ? "Salvataggio..." : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}