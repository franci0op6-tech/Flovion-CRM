
"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import type { Prisma } from "@prisma/client";

import {
  addNote,
  deleteNote,
  uploadDocument,
  deleteDocument,
} from "@/app/actions/leads";

type LeadDetailsModalProps = {
  lead: Prisma.LeadGetPayload<{
    include: {
      note: true;
      documenti: true;
    };
  }>;
  canManage?: boolean;
};

function formatDateFull(
  value: Date | string | null | undefined
): string {
  if (!value) return "Data non disponibile";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data non valida";
  }

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.443zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LeadDetailsModal({
  lead,
  canManage = false,
}: LeadDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCollaboratore = lead.tipo === "COLLABORATORE";

  function handleSubmitNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canManage || isPending) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.set("leadId", lead.id.toString());
    setError(null);

    startTransition(async () => {
      try {
        await addNote(formData);
        form.reset();
      } catch {
        setError("Impossibile salvare la nota.");
      }
    });
  }

  function handleSubmitDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canManage || isPending) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.set("leadId", lead.id.toString());
    setError(null);

    startTransition(async () => {
      try {
        await uploadDocument(formData);
        form.reset();
      } catch {
        setError("Impossibile caricare il documento.");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsOpen(true);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-900"
          title={
            isCollaboratore
              ? "Apri scheda collaboratore"
              : "Apri scheda cliente"
          }
          aria-label={
            isCollaboratore
              ? "Apri scheda collaboratore"
              : "Apri scheda cliente"
          }
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path
              fillRule="evenodd"
              d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <span className="font-medium text-slate-950">
          {lead.nome}
        </span>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setIsOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`lead-modal-title-${lead.id}`}
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h3
                id={`lead-modal-title-${lead.id}`}
                className="text-xl font-semibold text-slate-900"
              >
                {isCollaboratore
                  ? "Scheda Collaboratore"
                  : "Scheda Cliente"}
              </h3>

              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                aria-label="Chiudi scheda"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-400">
                  {lead.nome.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h4 className="text-2xl font-bold text-slate-950">
                    {lead.nome}
                  </h4>
                  <p className="text-sm font-medium text-slate-500">
                    Stato:{" "}
                    <span className="text-slate-900">
                      {lead.stato}
                    </span>
                  </p>
                </div>
              </div>

              {!canManage && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Scheda in sola lettura. Puoi consultare
                  le informazioni e scaricare i documenti.
                </div>
              )}

              <div className="mb-6 grid grid-cols-1 gap-6 rounded-xl border border-slate-100 bg-slate-50 p-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-900">
                    {lead.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Telefono
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {lead.telefono}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {isCollaboratore
                      ? "Ruolo / Mansione"
                      : "Servizio Richiesto"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {lead.servizio_richiesto || "Non specificato"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Provincia
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {lead.provincia || "Non specificata"}
                  </p>
                </div>
              </div>

              {!isCollaboratore && (
                <div className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo di impiego
                    </span>
                    <span className="mt-1 block font-medium text-slate-900">
                      {lead.tipoImpiego || "Non specificato"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reddito mensile netto
                    </span>
                    <span className="mt-1 block font-medium text-slate-900">
                      {lead.redditoNetto != null
                        ? new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(lead.redditoNetto)
                        : "Non specificato"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sei interessato a fare un mutuo?
                    </span>
                    <span className="mt-1 block font-medium text-slate-900">
                      {lead.interesseMutuo || "Non specificato"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hai altri finanziamenti in corso?
                    </span>
                    <span className="mt-1 block font-medium text-slate-900">
                      {lead.altriFinanziamenti || "Non specificato"}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <section>
                <h4 className="mb-3 text-sm font-semibold text-slate-900">
                  Storico Note
                </h4>

                <div className="mb-4 max-h-48 space-y-3 overflow-y-auto pr-2">
                  {lead.note.length > 0 ? (
                    lead.note.map((nota) => (
                      <div
                        key={nota.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <p className="text-xs font-medium text-slate-400">
                            {formatDateFull(nota.data)}
                          </p>

                          {canManage && (
                            <form action={deleteNote}>
                              <input
                                type="hidden"
                                name="id"
                                value={nota.id}
                              />
                              <button
                                type="submit"
                                disabled={isPending}
                                title="Elimina nota"
                                aria-label="Elimina nota"
                                className="text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
                              >
                                <DeleteIcon />
                              </button>
                            </form>
                          )}
                        </div>

                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {nota.testo_nota}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm italic text-slate-500">
                      Nessuna nota presente.
                    </p>
                  )}
                </div>

                {canManage && (
                  <form
                    onSubmit={handleSubmitNote}
                    className="flex flex-col gap-2"
                  >
                    <textarea
                      name="testo"
                      required
                      rows={3}
                      maxLength={5000}
                      placeholder="Scrivi un appunto sulla telefonata o dettagli operativi..."
                      className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm focus:border-slate-900 focus:outline-none"
                    />

                    <div className="mt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {isPending ? "Salvataggio..." : "Salva Nota"}
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <section className="mt-8 border-t border-slate-100 pt-6">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">
                  Documenti Allegati
                </h4>

                <div className="mb-4 max-h-40 space-y-2 overflow-y-auto pr-2">
                  {lead.documenti.length > 0 ? (
                    lead.documenti.map((documento) => (
                      <div
                        key={documento.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <a
                          href={`/api/documenti/${documento.id}`}
                          className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-indigo-600"
                          title="Scarica documento"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-5 w-5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
                              clipRule="evenodd"
                            />
                          </svg>

                          <span className="truncate text-sm font-medium">
                            {documento.nome_file}
                          </span>
                        </a>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="hidden text-xs text-slate-400 sm:inline">
                            {formatDateFull(
                              documento.data_caricamento
                            )}
                          </span>

                          {canManage && (
                            <form action={deleteDocument}>
                              <input
                                type="hidden"
                                name="id"
                                value={documento.id}
                              />
                              <button
                                type="submit"
                                disabled={isPending}
                                title="Elimina documento"
                                aria-label="Elimina documento"
                                className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                              >
                                <DeleteIcon />
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm italic text-slate-500">
                      Nessun documento caricato.
                    </p>
                  )}
                </div>

                {canManage && (
                  <form
                    onSubmit={handleSubmitDocument}
                    className="flex flex-col gap-3"
                  >
                    <input
                      type="file"
                      name="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-700"
                    />

                    <button
                      type="submit"
                      disabled={isPending}
                      className="self-end rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isPending ? "Caricamento..." : "Carica File"}
                    </button>
                  </form>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
