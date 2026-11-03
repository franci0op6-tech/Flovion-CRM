
"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import type { Prisma } from "@prisma/client";

import { editTask } from "@/app/actions/leads";

type Task = Prisma.TaskGetPayload<object>;

type Assegnatario = {
  id: number;
  nome: string;
  email: string;
};

type EditTaskModalProps = {
  task: Task;
  assegnatari?: Assegnatario[];
  puoScegliereAssegnatario?: boolean;

  // Diventerà true quando editTask gestirà
  // anche la riassegnazione sul server.
  riassegnazioneAbilitata?: boolean;
};

function formatDateTimeRome(
  value: Date | string
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  function getPart(type: string): string {
    return (
      parts.find((part) => part.type === type)?.value ?? ""
    );
  }

  return (
    `${getPart("year")}-${getPart("month")}-${getPart("day")}` +
    `T${getPart("hour")}:${getPart("minute")}`
  );
}

export function EditTaskModal({
  task,
  assegnatari = [],
  puoScegliereAssegnatario = false,
  riassegnazioneAbilitata = false,
}: EditTaskModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dataFormattata = formatDateTimeRome(
    task.data_scadenza
  );

  const mostraAssegnatari =
    puoScegliereAssegnatario &&
    riassegnazioneAbilitata;

  function closeModal() {
    if (isPending) return;

    setError(null);
    setIsOpen(false);
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isPending) return;

    const formData = new FormData(
      event.currentTarget
    );

    formData.set("id", String(task.id));

    // Il campo di assegnazione non viene inviato
    // finché la Server Action non sarà aggiornata.
    if (!mostraAssegnatari) {
      formData.delete("assegnatoAId");
    }

    setError(null);

    startTransition(async () => {
      try {
        await editTask(formData);

        setIsOpen(false);
        setError(null);
      } catch {
        setError(
          "Impossibile salvare le modifiche. " +
          "Verifica i dati e riprova."
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
        title="Modifica task"
        aria-label="Modifica task"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-indigo-100 hover:text-indigo-600"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
        </svg>
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
            aria-labelledby={`edit-task-title-${task.id}`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3
                id={`edit-task-title-${task.id}`}
                className="text-lg font-semibold text-slate-900"
              >
                Modifica Task
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
              className="p-6"
            >
              <div className="mb-4">
                <label
                  htmlFor={`edit-task-desc-${task.id}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Descrizione
                </label>

                <input
                  id={`edit-task-desc-${task.id}`}
                  type="text"
                  name="descrizione"
                  defaultValue={task.descrizione}
                  required
                  maxLength={2000}
                  disabled={isPending}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor={`edit-task-date-${task.id}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Data e ora di scadenza
                </label>

                <input
                  id={`edit-task-date-${task.id}`}
                  type="datetime-local"
                  name="data_scadenza"
                  defaultValue={dataFormattata}
                  required
                  step={60}
                  disabled={isPending}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Orario italiano (Europe/Rome).
                </p>
              </div>

              {mostraAssegnatari && (
                <div className="mb-6">
                  <label
                    htmlFor={`edit-task-assignee-${task.id}`}
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Collaboratore assegnato
                  </label>

                  <select
                    id={`edit-task-assignee-${task.id}`}
                    name="assegnatoAId"
                    defaultValue={
                      task.assegnatoAId !== null
                        ? String(task.assegnatoAId)
                        : ""
                    }
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                  >
                    <option value="">
                      Nessun assegnatario
                    </option>

                    {task.assegnatoAId !== null &&
                      !assegnatari.some(
                        (utente) =>
                          utente.id === task.assegnatoAId
                      ) && (
                        <option
                          value={task.assegnatoAId}
                          disabled
                        >
                          Assegnatario attuale non disponibile
                        </option>
                      )}

                    {assegnatari.map((utente) => (
                      <option
                        key={utente.id}
                        value={utente.id}
                      >
                        {utente.nome} ({utente.email})
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                  Il nuovo collaboratore otterrà accesso
permanente al lead. I precedenti
collaboratori manterranno l&apos;accesso
finch&eacute; un amministratore non lo revocher&agrave;.
                  </p>
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

              <div className="flex justify-end gap-3">
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
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending
                    ? "Salvataggio..."
                    : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
