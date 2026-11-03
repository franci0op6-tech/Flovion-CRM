
"use client";

import { useState, useTransition } from "react";
import type { Prisma } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";

import { LeadStatusSelect } from "./LeadStatusSelect";
import { AddTaskModal } from "./AddTaskModal";
import { LeadDetailsModal } from "./LeadDetailsModal";
import { EditLeadModal } from "./EditLeadModal";

import {
  toggleArchiveLead,
  deletePermanentlyLead,
} from "@/app/actions/leads";

type LeadWithCounts = Prisma.LeadGetPayload<{
  include: {
    _count: {
      select: {
        tasks: true;
        note: true;
      };
    };
    note: true;
    documenti: true;
  };
}>;

type LeadsTableTabsProps = {
  leads: LeadWithCounts[];
  tipoSelezionato?: string;
  countClienti?: number;
  countCollaboratori?: number;
  assegnatariPerAzienda?: Record<
  number,
  { id: number; nome: string; email: string }[]
>;
puoScegliereAssegnatario?: boolean;
  canManageLeadIds?: number[];
};

type ActiveTab = "credito" | "utenze" | "noleggio" | "cestino";

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data non valida";
  }

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ArchiveIcon({ archived }: { archived: boolean }) {
  if (archived) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" />
      <path
        fillRule="evenodd"
        d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zM7 11a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LeadsTableTabs({
  leads,
  tipoSelezionato = "CLIENTE",
  countClienti = 0,
  countCollaboratori = 0,
  canManageLeadIds = [],
assegnatariPerAzienda = {},
puoScegliereAssegnatario = false,
}: LeadsTableTabsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("credito");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const manageableIds = new Set(canManageLeadIds);

  const isClienti = tipoSelezionato !== "COLLABORATORE";

  function handleCambiaTipo(nuovoTipo: "CLIENTE" | "COLLABORATORE") {
    const params = new URLSearchParams(searchParams.toString());

    params.set("tipo", nuovoTipo);
    setActiveTab("credito");
    setSearchQuery("");
    setActionError(null);

    router.push(`?${params.toString()}`);
  }

  function matchesCategory(lead: LeadWithCounts): boolean {
    if (activeTab === "cestino") {
      return lead.archiviato;
    }

    if (lead.archiviato) {
      return false;
    }

    if (!isClienti) {
      return true;
    }

    const servizio = lead.servizio_richiesto.toLowerCase();

    const isUtenze =
      servizio.includes("luce") ||
      servizio.includes("gas") ||
      servizio.includes("internet") ||
      servizio.includes("utenze");

    const isNoleggio =
      servizio.includes("noleggio") ||
      servizio.includes("auto") ||
      servizio.includes("breve") ||
      servizio.includes("lungo");

    if (activeTab === "utenze") {
      return isUtenze;
    }

    if (activeTab === "noleggio") {
      return isNoleggio;
    }

    return !isUtenze && !isNoleggio;
  }

  const query = searchQuery.trim().toLowerCase();

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.nome.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.telefono.toLowerCase().includes(query);

    return matchesSearch && matchesCategory(lead);
  });

  function handleToggleArchive(id: number, currentStatus: boolean) {
    if (!manageableIds.has(id) || isPending) return;

    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("archiviato", currentStatus ? "false" : "true");

    setActionError(null);

    startTransition(async () => {
      try {
        await toggleArchiveLead(formData);
      } catch {
        setActionError(
          "Impossibile aggiornare l'archiviazione del contatto."
        );
      }
    });
  }

  function handleDeletePermanently(id: number) {
    if (!manageableIds.has(id) || isPending) return;

    const confirmed = window.confirm(
      "Sei sicuro di voler eliminare definitivamente questo lead? " +
      "Verranno eliminati anche i dati collegati. " +
      "L'operazione è irreversibile."
    );

    if (!confirmed) return;

    const formData = new FormData();
    formData.set("id", String(id));

    setActionError(null);

    startTransition(async () => {
      try {
        await deletePermanentlyLead(formData);
      } catch {
        setActionError(
          "Impossibile eliminare definitivamente il contatto."
        );
      }
    });
  }

  function tabClass(selected: boolean, selectedColor = "text-slate-900") {
    return [
      "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
      selected
        ? `bg-white ${selectedColor} shadow-sm ring-1 ring-slate-200`
        : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900",
    ].join(" ");
  }

  return (
    <section>
      <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => handleCambiaTipo("CLIENTE")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${
            isClienti
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Clienti
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isClienti
                ? "bg-slate-800 text-slate-200"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {countClienti}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleCambiaTipo("COLLABORATORE")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${
            !isClienti
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Collaboratori
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              !isClienti
                ? "bg-slate-800 text-slate-200"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {countCollaboratori}
          </span>
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">
          {isClienti
            ? `Pipeline Clienti: ${
                activeTab.charAt(0).toUpperCase() +
                activeTab.slice(1)
              }`
            : "Pipeline Collaboratori Aziendali"}
        </h2>

        <p className="text-sm text-slate-500">
          {query
            ? `${filteredLeads.length} risultati trovati`
            : `${filteredLeads.length} contatti in questa sezione`}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap rounded-xl bg-slate-200/50 p-1">
          {isClienti ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("credito")}
                className={tabClass(
                  activeTab === "credito",
                  "text-emerald-700"
                )}
              >
                Credito
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("utenze")}
                className={tabClass(
                  activeTab === "utenze",
                  "text-amber-600"
                )}
              >
                Utenze
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("noleggio")}
                className={tabClass(
                  activeTab === "noleggio",
                  "text-blue-600"
                )}
              >
                Noleggio Auto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("credito")}
              className={tabClass(activeTab !== "cestino")}
            >
              Tutti i Collaboratori
            </button>
          )}

          <div className="mx-1 w-px bg-slate-300" />

          <button
            type="button"
            onClick={() => setActiveTab("cestino")}
            className={tabClass(activeTab === "cestino")}
          >
            Cestino
          </button>
        </div>

        <div className="relative w-full lg:w-80">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>

          <input
            type="search"
            placeholder="Cerca per nome, telefono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

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
            {filteredLeads.map((lead) => {
              const canManage = manageableIds.has(lead.id);

              return (
                <tr
                  key={lead.id}
                  className={`hover:bg-slate-50/80 ${
                    lead.archiviato ? "opacity-70" : ""
                  }`}
                >
                  <td className="px-5 py-4">
                    <LeadDetailsModal
                      lead={lead}
                      canManage={canManage}
                    />
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    <div className="break-all">{lead.email}</div>
                    <div className="text-slate-400">
                      {lead.telefono}
                    </div>
                  </td>

                  <td className="px-5 py-4 font-medium text-slate-700">
                    {lead.servizio_richiesto}
                  </td>

                  <td className="px-5 py-4">
                    {canManage ? (
                      <LeadStatusSelect
                        leadId={lead.id}
                        stato={lead.stato}
                        tipo={lead.tipo}
                      />
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {lead.stato}
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(lead.data_creazione)}
                  </td>

                  <td className="px-5 py-4 text-slate-500">
                    {lead._count.tasks} task · {lead._count.note} note
                  </td>

                  <td className="px-5 py-4">
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        {!lead.archiviato && (
                          <>
                            <AddTaskModal
  leadId={lead.id}
  leadNome={lead.nome}
  assegnatari={
    lead.aziendaId !== null
      ? assegnatariPerAzienda[lead.aziendaId] ?? []
      : []
  }
  puoScegliereAssegnatario={
    puoScegliereAssegnatario
  }
/>
                            <EditLeadModal lead={lead} />
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleArchive(
                              lead.id,
                              lead.archiviato
                            )
                          }
                          disabled={isPending}
                          title={
                            lead.archiviato
                              ? "Ripristina"
                              : "Archivia"
                          }
                          aria-label={
                            lead.archiviato
                              ? "Ripristina"
                              : "Archivia"
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
                            lead.archiviato
                              ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"
                          }`}
                        >
                          <ArchiveIcon archived={lead.archiviato} />
                        </button>

                        {lead.archiviato && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeletePermanently(lead.id)
                            }
                            disabled={isPending}
                            title="Elimina definitivamente"
                            aria-label="Elimina definitivamente"
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                          >
                            <DeleteIcon />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span
                        className="text-xs text-slate-400"
                        title="Questo contatto è disponibile in sola lettura."
                      >
                        Sola lettura
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredLeads.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-slate-500"
                >
                  {query
                    ? `Nessun risultato per "${searchQuery}".`
                    : activeTab === "cestino"
                      ? "Il cestino è vuoto."
                      : "Nessun contatto trovato in questa sezione."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
