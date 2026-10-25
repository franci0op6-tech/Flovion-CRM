"use client";

import { useState, useTransition } from "react";
import { addNote, deleteNote, uploadDocument, deleteDocument } from "@/app/actions/leads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDateFull(value: any) {
  if (!value) return "Data non disponibile";
  
  const date = new Date(value);
  
  if (isNaN(date.getTime())) return "Data non valida";

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LeadDetailsModal({ lead }: { lead: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isCollaboratore = lead.tipo === "COLLABORATORE";

  const handleSubmitNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("leadId", lead.id.toString());
    
    startTransition(() => {
      addNote(formData);
      (e.target as HTMLFormElement).reset();
    });
  };

  const handleSubmitDocument = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("leadId", lead.id.toString());
    
    startTransition(() => {
      uploadDocument(formData);
      (e.target as HTMLFormElement).reset();
    });
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          title={isCollaboratore ? "Apri scheda collaboratore" : "Apri scheda cliente"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="font-medium text-slate-950">{lead.nome}</span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-semibold text-slate-900">
                {isCollaboratore ? "Scheda Collaboratore" : "Scheda Cliente"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-400">
                  {lead.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-slate-950">{lead.nome}</h4>
                  <p className="text-sm font-medium text-slate-500">Stato: <span className="text-slate-900">{lead.stato}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 rounded-xl border border-slate-100 bg-slate-50 p-5 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{lead.email}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefono</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{lead.telefono}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {isCollaboratore ? "Ruolo / Mansione" : "Servizio Richiesto"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{lead.servizio_richiesto || "Non specificato"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provincia</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{lead.provincia || "Non specificata"}</p>
                </div>
              </div>
              
              {/* --- SEZIONE DATI FINANZIARI E LAVORATIVI (VISIBILE SOLO PER I CLIENTI) --- */}
              {!isCollaboratore && (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-5 mb-8 text-sm">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo di Impiego?</span>
                    <span className="mt-1 font-medium text-slate-900">{lead.tipoImpiego || "Non specificato"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Reddito Mensile Netto</span>
                    <span className="mt-1 font-medium text-slate-900">{lead.redditoNetto ? `€ ${lead.redditoNetto}` : "Non specificato"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Sei Interessato A Fare Un Mutuo?</span>
                    <span className="mt-1 font-medium text-slate-900">{lead.interesseMutuo || "Non specificato"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Hai Gia Altri Finanziamenti In Corso?</span>
                    <span className="mt-1 font-medium text-slate-900">{lead.altriFinanziamenti || "Non specificato"}</span>
                  </div>
                </div>
              )}
              {/* --- FINE SEZIONE FINANZIARIA --- */}

              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-900">Storico Note</h4>
                
                <div className="mb-4 max-h-48 overflow-y-auto space-y-3 pr-2">
                  {lead.note && lead.note.length > 0 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lead.note.map((n: any) => (
                      <div key={n.id} className="group rounded-xl bg-slate-50 p-4 border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-medium text-slate-400">{formatDateFull(n.data)}</p>
                          
                          <form action={deleteNote}>
                            <input type="hidden" name="id" value={n.id} />
                            <button
                              type="submit"
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="Elimina nota"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </form>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.testo_nota}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 italic rounded-xl border border-dashed border-slate-300 p-4 text-center">
                      Nessuna nota presente.
                    </p>
                  )}
                </div>

                <form onSubmit={handleSubmitNote} className="flex flex-col gap-2">
                  <textarea
                    name="testo"
                    required
                    placeholder="Scrivi un appunto sulla telefonata o dettagli operativi..."
                    className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? "Salvataggio..." : "Salva Nota"}
                    </button>
                  </div>
                </form>
              </div>

              {/* --- SEZIONE DOCUMENTI --- */}
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">Documenti Allegati</h4>
                
                <div className="mb-4 space-y-2 max-h-40 overflow-y-auto pr-2">
                  {lead.documenti && lead.documenti.length > 0 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lead.documenti.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 group">
                    <a 
                      href={doc.url_file} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-3 overflow-hidden text-slate-700 hover:text-indigo-600 transition-colors"
                      title="Apri documento"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 flex-shrink-0">
                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium truncate">{doc.nome_file}</span>
                    </a>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-400">{formatDateFull(doc.data_caricamento)}</span>
                      
                      <form action={deleteDocument}>
                        <input type="hidden" name="id" value={doc.id} />
                        <button
                          type="submit"
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Elimina documento"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 italic rounded-xl border border-dashed border-slate-300 p-4 text-center">
                      Nessun documento caricato.
                    </p>
                  )}
                </div>

                <form onSubmit={handleSubmitDocument} className="flex items-center gap-2">
                  <input
                    type="file"
                    name="file"
                    required
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-colors cursor-pointer"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isPending ? "Caricamento..." : "Carica File"}
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}