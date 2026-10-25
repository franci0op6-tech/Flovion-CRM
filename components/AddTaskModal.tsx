"use client";

import { useState } from "react";
import { createTask, CreateTaskState } from "@/app/actions/tasks";

export function AddTaskModal({ leadId, leadNome }: { leadId: number; leadNome: string }) {
  const [isOpen, setIsOpen] = useState(false);

  // Azione che avvolge la Server Action per chiudere il modale in caso di successo
  async function clientAction(formData: FormData) {
    formData.append("leadId", leadId.toString());
    const res = await createTask({ ok: false }, formData);
    if (res.ok) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
      >
        + Task
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Nuovo Task per {leadNome}</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form action={clientAction} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Descrizione</label>
                <input
                  type="text"
                  name="descrizione"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Scadenza</label>
                <input
                  type="datetime-local"
                  name="data_scadenza"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Annulla
                </button>
                <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}