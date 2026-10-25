"use client";

import { useState, useTransition } from "react";
import { createLead } from "@/app/actions/leads";

export function AddLeadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tipoSelezionato, setTipoSelezionato] = useState("CLIENTE");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("tipo", tipoSelezionato); // Assicura che il tipo selezionato venga inviato
    
    startTransition(() => {
      createLead(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
      >
        + Nuovo Contatto
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Nuovo Contatto</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* SELETTORE TIPO: CLIENTE O COLLABORATORE */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo di Contatto</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoSelezionato("CLIENTE")}
                    className={`rounded-lg py-2 text-sm font-semibold transition-all border ${
                      tipoSelezionato === "CLIENTE"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoSelezionato("COLLABORATORE")}
                    className={`rounded-lg py-2 text-sm font-semibold transition-all border ${
                      tipoSelezionato === "COLLABORATORE"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Collaboratore
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome e Cognome</label>
                <input
                  type="text"
                  name="nome"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefono</label>
                <input
                  type="tel"
                  name="telefono"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
               <label className="mb-1 block text-sm font-medium text-slate-700">Provincia</label>
                <input
                 type="text"
                  name="provincia"
                  placeholder="Es. Milano, NA..."
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {tipoSelezionato === "CLIENTE" ? "Servizio Richiesto" : "Ruolo / Area Collaborazione"}
                </label>
                <select
                  name="servizio_richiesto"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                >
                  <option value="" disabled>Seleziona...</option>
                  
                  {tipoSelezionato === "CLIENTE" ? (
                    <>
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
                    </>
                  ) : (
                    <optgroup label="Collaboratori">
                      <option value="Agente Partner">Agente Partner</option>
                      <option value="Segnalatore">Segnalatore</option>
                      <option value="Consulente Commerciale">Consulente Commerciale</option>
                      <option value="Altro Collaboratore">Altro Collaboratore</option>
                    </optgroup>
                  )}
                </select>
              </div>

              {/* --- CAMPI FINANZIARI (Visibili soprattutto per i clienti) --- */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tipo di Impiego</label>
                  <input
                    type="text"
                    name="tipoImpiego"
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
                    placeholder="Es. 1600"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Interessato a Mutuo?</label>
                  <select
                    name="interesseMutuo"
                    defaultValue=""
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  >
                    <option value="">Seleziona...</option>
                    <option value="Si">Sì</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Altri Finanziamenti?</label>
                  <select
                    name="altriFinanziamenti"
                    defaultValue=""
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  >
                    <option value="">Seleziona...</option>
                    <option value="Si">Sì</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Annulla
                </button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                  {isPending ? "Salvataggio..." : tipoSelezionato === "CLIENTE" ? "Salva Cliente" : "Salva Collaboratore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}