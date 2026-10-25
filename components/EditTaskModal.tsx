"use client";

import { useState, useTransition } from "react";
import { editTask } from "@/app/actions/leads";

export function EditTaskModal({ task }: { task: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Formattiamo la data dal database per renderla compatibile con l'input datetime-local di HTML
  const dataFormattata = new Date(task.data_scadenza).toISOString().slice(0, 16);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("id", task.id.toString());
    
    startTransition(() => {
      editTask(formData);
      setIsOpen(false); // Chiude la modale dopo il salvataggio
    });
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        title="Modifica task" 
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Modifica Task</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Descrizione</label>
                <input 
                  type="text" 
                  name="descrizione" 
                  defaultValue={task.descrizione}
                  required 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" 
                />
              </div>
              
              <div className="mb-6">
                <label className="mb-1 block text-sm font-medium text-slate-700">Data e Ora di scadenza</label>
                <input 
                  type="datetime-local" 
                  name="data_scadenza" 
                  defaultValue={dataFormattata}
                  required 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" 
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Annulla
                </button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
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