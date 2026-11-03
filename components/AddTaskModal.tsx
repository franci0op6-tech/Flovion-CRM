
"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { createTask } from "@/app/actions/tasks";

export type TaskAssigneeOption = {
  id: number;
  nome: string;
  email: string;
};

type AddTaskModalProps = {
  leadId: number;
  leadNome: string;

  // Fornito dal server per ADMIN e SUPERADMIN.
  assegnatari?: TaskAssigneeOption[];

  // Per USER rimane false.
  puoScegliereAssegnatario?: boolean;
};

export function AddTaskModal({
  leadId,
  leadNome,
  assegnatari = [],
  puoScegliereAssegnatario = false,
}: AddTaskModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function closeModal() {
    if (isPending) return;

    setIsOpen(false);
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    formData.set("leadId", String(leadId));

    setError(null);

    startTransition(async () => {
      try {
        const result = await createTask(
          { ok: false },
          formData
        );

        if (result.ok) {
          setIsOpen(false);
          setError(null);
          return;
        }

        setError(
          result.error ||
            "Non è stato possibile creare il task."
        );
      } catch {
        setError(
          "Si è verificato un errore durante il salvataggio."
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
      >
        + Task
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`add-task-title-${leadId}`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3
                id={`add-task-title-${leadId}`}
                className="text-lg font-semibold text-slate-900"
              >
                Nuovo Task per {leadNome}
              </h3>

              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                aria-label="Chiudi finestra"
                className="text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <div>
                <label
                  htmlFor={`task-desc-${leadId}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Descrizione
                </label>

                <input
                  id={`task-desc-${leadId}`}
                  type="text"
                  name="descrizione"
                  required
                  maxLength={2000}
                  disabled={isPending}
                  placeholder="Es. Ricontattare il cliente"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor={`task-date-${leadId}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Scadenza
                </label>

                <input
                  id={`task-date-${leadId}`}
                  type="datetime-local"
                  name="data_scadenza"
                  required
                  step={60}
                  disabled={isPending}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Inserisci data e ora italiane.
                </p>
              </div>

              {puoScegliereAssegnatario ? (
                <div>
                  <label
                    htmlFor={`task-assignee-${leadId}`}
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Assegna a un collaboratore
                  </label>

                  <select
                    id={`task-assignee-${leadId}`}
                    name="assegnatoAId"
                    defaultValue=""
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                  >
                    <option value="">
                      Nessun assegnatario
                    </option>

                    {assegnatari.map((utente) => (
                      <option
                        key={utente.id}
                        value={utente.id}
                      >
                        {utente.nome} ({utente.email})
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-xs text-slate-500">
                    Assegnando il task, il collaboratore
                    otterrà accesso permanente alla scheda
                    del cliente.
                  </p>

                  {assegnatari.length === 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Nessun collaboratore disponibile
                      per questo cliente.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Il task verrà assegnato automaticamente
                  al tuo account.
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Salvataggio..." : "Salva Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
