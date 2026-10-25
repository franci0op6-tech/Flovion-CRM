import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteTask } from "@/app/actions/leads"; // Importiamo la funzione di eliminazione esistente

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function StoricoPage() {
  const session = await auth();
  const userId = Number(session?.user?.id);

  // @ts-ignore
  const userRole = session?.user?.ruolo; 
  // @ts-ignore
  const aziendaId = session?.user?.aziendaId;

  const filtroTasks = userRole === "ADMIN" ? { lead: { aziendaId } } : { lead: { aziendaId, utenteId: userId } };

  const tasksCompletatiLista = await prisma.task.findMany({
    where: { completato: true, ...filtroTasks },
    include: { lead: true },
    orderBy: { data_scadenza: "desc" },
  });

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Storico Task Completati</h1>
          <p className="text-sm text-slate-500">Tutti i promemoria portati a termine</p>
        </div>
        <a href="/" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
          ← Torna alla Dashboard
        </a>
      </div>

      {tasksCompletatiLista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Nessun task completato al momento.
        </div>
      ) : (
        <ul className="grid gap-3">
          {tasksCompletatiLista.map((task) => (
            <li key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-medium text-slate-900 line-through">
                    {task.descrizione}
                  </p>
                  <p className="text-sm text-slate-500">
                    {task.lead.nome} · Scadenza era: {formatDate(task.data_scadenza)}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    Completato ✓
                  </span>

                  {/* Bottone per eliminare il task dallo storico */}
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button 
                      type="submit" 
                      title="Elimina dallo storico" 
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}