"use client";

import { useState, useTransition } from "react";
import { LeadStatusSelect } from "./LeadStatusSelect";
import { AddTaskModal } from "./AddTaskModal";
import { LeadDetailsModal } from "./LeadDetailsModal";
import { EditLeadModal } from "./EditLeadModal";
import { toggleArchiveLead, deletePermanentlyLead } from "../app/actions/leads";
import { useRouter, useSearchParams } from "next/navigation";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function LeadsTableTabs({ 
  leads, 
  tipoSelezionato = "CLIENTE",
  countClienti = 0,
  countCollaboratori = 0 
}: { 
  leads: any[]; 
  tipoSelezionato?: string;
  countClienti?: number;
  countCollaboratori?: number;
}) {
  const [activeTab, setActiveTab] = useState("credito");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Funzione per cambiare macro-categoria (CLIENTE vs COLLABORATORE)
  const handleCambiaTipo = (nuovoTipo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tipo", nuovoTipo);
    router.push(`?${params.toString()}`);
  };

  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      lead.nome.toLowerCase().includes(query) || 
      lead.email.toLowerCase().includes(query) || 
      lead.telefono.toLowerCase().includes(query);
      
    if (!matchesSearch) return false;

    if (activeTab === "cestino") return lead.archiviato;
    if (lead.archiviato) return false;

    if (tipoSelezionato === "COLLABORATORE") {
      // Per i collaboratori non separiamo per utenze/noleggio, mostriamo tutti i collaboratori attivi
      return true;
    }

    // Filtri interni per i Clienti
    const s = (lead.servizio_richiesto || "").toLowerCase();
    const isUtenze = s.includes("luce") || s.includes("gas") || s.includes("internet") || s.includes("utenze");
    const isNoleggio = s.includes("noleggio") || s.includes("auto") || s.includes("breve") || s.includes("lungo");
    
    if (activeTab === "utenze") return isUtenze;
    if (activeTab === "noleggio") return isNoleggio;
    return !isUtenze && !isNoleggio; // Credito / Default
  });

  const handleToggleArchive = (id: number, currentStatus: boolean) => {
    const formData = new FormData();
    formData.append("id", id.toString());
    formData.append("archiviato", currentStatus ? "false" : "true");
    startTransition(() => {
      toggleArchiveLead(formData);
    });
  };

  const handleDeletePermanently = (id: number) => {
    if (!window.confirm("Sei sicuro di voler eliminare definitivamente questo lead? L'operazione è irreversibile.")) return;
    const formData = new FormData();
    formData.append("id", id.toString());
    startTransition(() => {
      deletePermanentlyLead(formData);
    });
  };

  return (
    <section>
      {/* SELETTORE MACRO-CATEGORIA: CLIENTE vs COLLABORATORE */}
      <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
        <button
          onClick={() => handleCambiaTipo("CLIENTE")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all shadow-sm ${
            tipoSelezionato === "CLIENTE"
              ? "bg-slate-900 text-white shadow-slate-900/10"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>Clienti</span>
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${tipoSelezionato === "CLIENTE" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
            {countClienti}
          </span>
        </button>

        <button
          onClick={() => handleCambiaTipo("COLLABORATORE")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all shadow-sm ${
            tipoSelezionato === "COLLABORATORE"
              ? "bg-slate-900 text-white shadow-slate-900/10"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>Collaboratori</span>
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${tipoSelezionato === "COLLABORATORE" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
            {countCollaboratori}
          </span>
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">
          {tipoSelezionato === "CLIENTE" 
            ? `Pipeline Clienti: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` 
            : "Pipeline Collaboratori Aziendali"}
        </h2>
        <p className="text-sm text-slate-500">
          {searchQuery ? `${filteredLeads.length} risultati trovati` : `${filteredLeads.length} contatti in questa sezione`}
        </p>
      </div>
      
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* SOTTO-TAB VISIBILI PER I CLIENTI O COLLABORATORI */}
        <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-xl">
          {tipoSelezionato === "CLIENTE" ? (
            <>
              <button onClick={() => setActiveTab("credito")} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "credito" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"}`}>Credito</button>
              <button onClick={() => setActiveTab("utenze")} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "utenze" ? "bg-white text-amber-600 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"}`}>Utenze</button>
              <button onClick={() => setActiveTab("noleggio")} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "noleggio" ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"}`}>Noleggio Auto</button>
            </>
          ) : (
            <button 
              onClick={() => setActiveTab("credito")} 
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab !== "cestino" 
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              Tutti i Collaboratori
            </button>
          )}
          
          <div className="w-px bg-slate-300 mx-1"></div>
          <button onClick={() => setActiveTab("cestino")} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === "cestino" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"}`}>Cestino</button>
        </div>

        <div className="relative w-full lg:w-80">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </div>
          <input type="text" placeholder="Cerca per nome, telefono..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Contatti</th>
              <th className="px-5 py-3 font-medium">Servizio / Ruolo</th>
              <th className="px-5 py-3 font-medium">Stato</th>
              <th className="px-5 py-3 font-medium">Creato</th>
              <th className="px-5 py-3 font-medium">Attività</th>
              <th className="px-5 py-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className={`hover:bg-slate-50/80 ${lead.archiviato ? 'opacity-70' : ''}`}>
                <td className="px-5 py-4"><LeadDetailsModal lead={lead} /></td>
                <td className="px-5 py-4 text-slate-600"><div>{lead.email}</div><div className="text-slate-400">{lead.telefono}</div></td>
                <td className="px-5 py-4 font-medium text-slate-700">{lead.servizio_richiesto}</td>
                <td className="px-5 py-4"><LeadStatusSelect leadId={lead.id} stato={lead.stato} tipo={lead.tipo} /></td>
                <td className="px-5 py-4 text-slate-500">{formatDate(lead.data_creazione)}</td>
                <td className="px-5 py-4 text-slate-500">{lead._count?.tasks || 0} task · {lead._count?.note || 0} note</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {!lead.archiviato && <AddTaskModal leadId={lead.id} leadNome={lead.nome} />}
                    
                    {/* TASTO MODIFICA */}
                    {!lead.archiviato && <EditLeadModal lead={lead} />}
                    
                    {/* TASTO ARCHIVIA / RIPRISTINA */}
                    <button onClick={() => handleToggleArchive(lead.id, lead.archiviato)} disabled={isPending} title={lead.archiviato ? "Ripristina" : "Archivia"} className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${lead.archiviato ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"}`}>
                      {lead.archiviato ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" /><path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zM7 11a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                      )}
                    </button>

                    {/* TASTO ELIMINA DEFINITIVAMENTE (VISIBILE SOLO NEL CESTINO) */}
                    {lead.archiviato && (
                      <button 
                        onClick={() => handleDeletePermanently(lead.id)} 
                        disabled={isPending} 
                        title="Elimina definitivamente" 
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                  {searchQuery ? `Nessun risultato per "${searchQuery}".` : activeTab === "cestino" ? "Il cestino è vuoto." : `Nessun contatto trovato in questa sezione.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}