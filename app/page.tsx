import { auth, signOut } from "@/lib/auth";
import { AddLeadModal } from "@/components/AddLeadModal";
import { EditTaskModal } from "@/components/EditTaskModal";
import { LeadsTableTabs } from "@/components/LeadsTableTabs";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay, statoStyle } from "@/lib/lead";
import { completeTask, deleteTask } from "./actions/leads";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

// 🎨 FUNZIONE COLORI SERVIZI
function getServizioBg(servizio_richiesto?: string | null) {
  if (!servizio_richiesto) return "bg-white border-slate-200"; 
  
  const s = servizio_richiesto.toLowerCase();
  
  if (s.includes("credito") || s.includes("mutu") || s.includes("cessioni") || s.includes("prestiti")) {
    return "bg-green-50 border-green-200"; 
  }
  if (s.includes("utenze") || s.includes("luce") || s.includes("gas") || s.includes("internet")) {
    return "bg-yellow-50 border-yellow-200"; 
  }
  if (s.includes("noleggio")) {
    return "bg-blue-50 border-blue-200"; 
  }
  
  return "bg-white border-slate-200"; 
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tipoSelezionato = resolvedSearchParams.tipo || "CLIENTE"; // Default su CLIENTE

  const now = new Date();

  const session = await auth();
  const userId = Number(session?.user?.id);

  const userRole = session?.user?.ruolo;
  const aziendaId = session?.user?.aziendaId;
  
  const aziendaDB =
    typeof aziendaId === "number"
      ? await prisma.azienda.findUnique({
          where: { id: aziendaId },
          select: { nome: true },
        })
      : null;
  
  const nomeAzienda = aziendaDB?.nome || "CRM";

  const filtroBase = userRole === "ADMIN" ? { aziendaId } : { aziendaId, utenteId: userId };
  
  // Filtro specifico per i lead in base alla tab selezionata (CLIENTE o COLLABORATORE)
  const filtroLeads = { ...filtroBase, tipo: tipoSelezionato };
  const filtroTasks = userRole === "ADMIN" ? { lead: { aziendaId } } : { lead: { aziendaId, utenteId: userId } };
  
  const [tasksOggi, tasksFuturi, leads, totaleLeads, countClienti, countCollaboratori, taskCompletati, taskTotali] = await Promise.all([
    prisma.task.findMany({
      where: { completato: false, data_scadenza: { gte: startOfDay(now), lte: endOfDay(now) }, ...filtroTasks },
      include: { lead: true },
      orderBy: { data_scadenza: "asc" },
    }),
    prisma.task.findMany({
      where: { completato: false, data_scadenza: { gt: endOfDay(now) }, ...filtroTasks },
      include: { lead: true },
      orderBy: { data_scadenza: "asc" },
    }),
    prisma.lead.findMany({
      where: filtroLeads,
      include: { 
        _count: { select: { tasks: true, note: true } }, 
        note: { orderBy: { data: "desc" } }, 
        documenti: true 
      },
      orderBy: { data_creazione: "desc" },
    }),
    prisma.lead.count({ where: filtroLeads }),
    prisma.lead.count({ where: { ...filtroBase, tipo: "CLIENTE" } }),
    prisma.lead.count({ where: { ...filtroBase, tipo: "COLLABORATORE" } }),
    prisma.task.count({ where: { completato: true, ...filtroTasks } }),
    prisma.task.count({ where: filtroTasks })
  ]);
    
  const percentualeTask = taskTotali > 0 ? Math.round((taskCompletati / taskTotali) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {/* LOGO AZIENDALE */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <img 
              src="/icon.png" 
              alt="Logo" 
              className="h-full w-full object-contain p-1" 
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950 whitespace-nowrap">
              Dashboard ({nomeAzienda})
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Panoramica e gestione contatti
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <AddLeadModal />
          
          <a href="/storico" className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all">
            Storico
          </a>

          <a href="/profilo" className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all">
            Profilo
          </a>

          {/* ⚙️ ROTELLINA IMPOSTAZIONI LAYOUT */}
          <a 
            href="/impostazioni" 
            title="Impostazioni Layout" 
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1.15 1.74l-.37.18a2 2 0 0 1-2.64-.92l-.1-.18a2 2 0 0 0-2.73.73l-.15.1a2 2 0 0 1-2.58.54l-.3.15a2 2 0 0 0-2.3 1.05l-.1.18a2 2 0 0 0 .5 2.5l.15.12a2 2 0 0 1 .9 1.74v.37a2 2 0 0 1-1.74 1.15H2a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.18a2 2 0 0 1 1.74 1.15l.18.37a2 2 0 0 1-.92 2.64l-.18.1a2 2 0 0 0-.73 2.73l.1.15a2 2 0 0 1 .54 2.58l-.15.3a2 2 0 0 0 1.05 2.3l.18.1a2 2 0 0 0 2.5-.5l.12-.15a2 2 0 0 1-1.74-.9h.37a2 2 0 0 1-1.15-1.74V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </a>

          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button type="submit" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-all">
              Esci
            </button>
          </form>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            {tipoSelezionato === "CLIENTE" ? "Clienti in Pipeline" : "Collaboratori in Pipeline"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{totaleLeads}</p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Task Completati</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-slate-950">{taskCompletati}</p>
            <p className="text-sm font-medium text-emerald-600">/ {taskTotali}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Efficienza Operativa</p>
            <span className="text-sm font-semibold text-slate-950">{percentualeTask}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div 
              className="h-full bg-slate-900 transition-all duration-500 ease-out" 
              style={{ width: `${percentualeTask}%` }}
            ></div>
          </div>
        </div>
      </section>

      {/* SEZIONE: TASK DA FARE OGGI */}
      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Da fare oggi</h2>
          <p className="text-sm text-slate-500">
            {tasksOggi.length} promemoria di contatto
          </p>
        </div>

        {tasksOggi.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Nessun task in scadenza oggi. La pipeline è in ordine.
          </div>
        ) : (
          <ul className="grid gap-3">
            {tasksOggi.map((task) => (
              <li
                key={task.id}
                className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${getServizioBg(task.lead.servizio_richiesto)}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-medium text-slate-950">
                      {task.descrizione}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {task.lead.nome} · {task.lead.telefono}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={completeTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <button type="submit" title="Segna come completato" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                      </button>
                    </form>

                    <EditTaskModal task={task} />

                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <button type="submit" title="Elimina task" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg>
                      </button>
                    </form>

                    <div className="w-px h-6 bg-slate-200/50 mx-1"></div>

                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                      {formatTime(task.data_scadenza)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset bg-white/50 ${statoStyle(task.lead.stato)}`}>
                      {task.lead.stato}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SEZIONE: TASK FUTURI */}
      {tasksFuturi.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Prossimamente</h2>
          </div>
          <ul className="grid gap-3 opacity-90 hover:opacity-100 transition-opacity">
            {tasksFuturi.map((task) => (
              <li 
                key={task.id} 
                className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${getServizioBg(task.lead.servizio_richiesto)}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-medium text-slate-950">{task.descrizione}</p>
                    <p className="mt-1 text-sm text-slate-500">{task.lead.nome} · {formatDate(task.data_scadenza)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={completeTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <button type="submit" title="Segna come completato" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                      </button>
                    </form>

                    <EditTaskModal task={task} />

                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <button type="submit" title="Elimina task" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg>
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* TAB DI NAVIGAZIONE TRA CLIENTE E COLLABORATORE */}
      <LeadsTableTabs 
        leads={leads} 
        tipoSelezionato={tipoSelezionato} 
        countClienti={countClienti} 
        countCollaboratori={countCollaboratori} 
      />
    </main>
  );
}