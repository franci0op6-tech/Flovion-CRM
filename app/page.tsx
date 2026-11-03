import { CentroNotifiche } from "@/components/CentroNotifiche";
import { LogoAzienda } from "@/components/LogoAzienda";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { AddLeadModal } from "@/components/AddLeadModal";
import { EditTaskModal } from "@/components/EditTaskModal";
import { LeadsTableTabs } from "@/components/LeadsTableTabs";
import { prisma } from "@/lib/prisma";
import { statoStyle } from "@/lib/lead";
import { completeTask, deleteTask } from "./actions/leads";
import {
  requireCurrentUser,
  leadReadAccessWhere,
} from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
export const dynamic = "force-dynamic";
const TIME_ZONE = "Europe/Rome";
function formatDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
function formatTime(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}
function getServizioBg(servizio?: string | null) {
  if (!servizio) {
    return "bg-white border-slate-200";
  }
  const s = servizio.toLowerCase();
  if (
    s.includes("credito") ||
    s.includes("mutu") ||
    s.includes("cessioni") ||
    s.includes("prestiti")
  ) {
    return "bg-green-50 border-green-200";
  }
  if (
    s.includes("utenze") ||
    s.includes("luce") ||
    s.includes("gas") ||
    s.includes("internet")
  ) {
    return "bg-yellow-50 border-yellow-200";
  }
  if (s.includes("noleggio")) {
    return "bg-blue-50 border-blue-200";
  }
  return "bg-white border-slate-200";
}
function getRomeDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}
function romeLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number
): Date {
  const expected = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    0,
    0,
    0
  );
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let result = expected;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(result));
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value);
    const actual = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute")
    );
    const difference = expected - actual;
    if (difference === 0) {
      break;
    }
    result += difference;
  }
  return new Date(result);
}
function getTodayBoundsRome(now: Date) {
  const { year, month, day } = getRomeDateParts(now);
  const start = romeLocalToUtc(year, month, day, 0);
  const nextDay = new Date(
    Date.UTC(year, month - 1, day + 1)
  );
  const end = romeLocalToUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    0
  );
  return { start, end };
}
type DashboardTask = Prisma.TaskGetPayload<{
  include: {
    lead: true;
  };
}>;
function TaskActions({
  task,
  canManage,
  canComplete,
  assegnatari,
  puoScegliereAssegnatario,
}: {
  task: DashboardTask;
  canManage: boolean;
  canComplete: boolean;
  assegnatari: {
    id: number;
    nome: string;
    email: string;
  }[];
  puoScegliereAssegnatario: boolean;
}) {
  if (!canManage && !canComplete) {
    return (
      <span
        className="rounded-full bg-white/70 px-3 py-1 text-xs text-slate-500"
        title="Non puoi modificare o completare questa attività."
      >
        Sola lettura
      </span>
    );
  }
  return (
    <>
      {canComplete && (
      <form action={completeTask}>
        <input
          type="hidden"
          name="id"
          value={task.id}
        />
        <button
          type="submit"
          title="Segna come completato"
          aria-label="Segna come completato"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 transition-colors hover:bg-emerald-100 hover:text-emerald-600"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </form>
      )}
      {canManage && (
        <>
      <EditTaskModal
        task={task}
        assegnatari={assegnatari}
        puoScegliereAssegnatario={puoScegliereAssegnatario}
        riassegnazioneAbilitata={true}
      />
      <form action={deleteTask}>
        <input
          type="hidden"
          name="id"
          value={task.id}
        />
        <button
          type="submit"
          title="Elimina task"
          aria-label="Elimina task"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.231.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </form>
        </>
      )}
    </>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; task?: string }>;
}) {
  const params = await searchParams;
  const tipoSelezionato =
    params.tipo === "COLLABORATORE"
      ? "COLLABORATORE"
      : "CLIENTE";
  const currentUser = await requireCurrentUser();
  if (params.task && /^[1-9]\d*$/.test(params.task) && Number.isSafeInteger(Number(params.task))) {
    redirect(`/tasks/${params.task}`);
  }
  const userId = currentUser.id;
  const userRole = currentUser.ruolo;
  const aziendaId = currentUser.aziendaId;
  const isSuperAdmin = userRole === "SUPERADMIN";
  const now = new Date();
  const { start, end } = getTodayBoundsRome(now);
  const aziendaDB =
    !isSuperAdmin && aziendaId != null
      ? await prisma.azienda.findUnique({
          where: { id: aziendaId },
          select: { nome: true },
        })
      : null;
  const nomeAzienda = isSuperAdmin
    ? "Tutte le aziende"
    : aziendaDB?.nome || "CRM";
  const filtroBase: Prisma.LeadWhereInput =
    leadReadAccessWhere(currentUser);
  const filtroLeads: Prisma.LeadWhereInput = {
    AND: [
      filtroBase,
      { tipo: tipoSelezionato },
    ],
  };
  let filtroTasks: Prisma.TaskWhereInput;
  if (userRole === "SUPERADMIN") {
    filtroTasks = {};
  } else if (userRole === "ADMIN") {
    filtroTasks = {
      lead: {
        aziendaId: aziendaId!,
      },
    };
  } else {
    filtroTasks = {
      lead: {
        aziendaId: aziendaId!,
      },
      OR: [
        {
          lead: {
            utenteId: userId,
          },
        },
        {
          assegnatoAId: userId,
        },
      ],
    };
  }
  const [
    tasksScaduti,
    tasksOggi,
    tasksFuturi,
    leads,
    totaleLeads,
    countClienti,
    countCollaboratori,
    taskCompletati,
    taskTotali,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [
          filtroTasks,
          {
            completato: false,
            data_scadenza: { lt: start },
          },
        ],
      },
      include: { lead: true },
      orderBy: { data_scadenza: "asc" },
    }),
    prisma.task.findMany({
      where: {
        AND: [
          filtroTasks,
          {
            completato: false,
            data_scadenza: {
              gte: start,
              lt: end,
            },
          },
        ],
      },
      include: {
        lead: true,
      },
      orderBy: {
        data_scadenza: "asc",
      },
    }),
    prisma.task.findMany({
      where: {
        AND: [
          filtroTasks,
          {
            completato: false,
            data_scadenza: {
              gte: end,
            },
          },
        ],
      },
      include: {
        lead: true,
      },
      orderBy: {
        data_scadenza: "asc",
      },
    }),
    prisma.lead.findMany({
      where: filtroLeads,
      include: {
        _count: {
          select: {
            tasks: true,
            note: true,
          },
        },
        note: {
          orderBy: {
            data: "desc",
          },
        },
        documenti: true,
      },
      orderBy: {
        data_creazione: "desc",
      },
    }),
    prisma.lead.count({
      where: filtroLeads,
    }),
    prisma.lead.count({
      where: {
        AND: [
          filtroBase,
          { tipo: "CLIENTE" },
        ],
      },
    }),
    prisma.lead.count({
      where: {
        AND: [
          filtroBase,
          { tipo: "COLLABORATORE" },
        ],
      },
    }),
    prisma.task.count({
      where: {
        AND: [
          filtroTasks,
          { completato: true },
        ],
      },
    }),
    prisma.task.count({
      where: filtroTasks,
    }),
  ]);
  // Identificativi dei lead gestibili e utenti assegnabili per azienda.
const aziendeLeadIds = [
  ...new Set(
    leads
      .map((lead) => lead.aziendaId)
      .filter((id): id is number => id !== null)
  ),
];
const assegnatariDB =
  currentUser.ruolo !== "USER" && aziendeLeadIds.length > 0
    ? await prisma.utente.findMany({
        where: {
          ruolo: "USER",
          aziendaId: {
            in: aziendeLeadIds,
          },
        },
        select: {
          id: true,
          nome: true,
          email: true,
          aziendaId: true,
        },
        orderBy: {
          nome: "asc",
        },
      })
    : [];
const assegnatariPerAzienda: Record<
  number,
  { id: number; nome: string; email: string }[]
> = {};
for (const utente of assegnatariDB) {
  if (utente.aziendaId === null) continue;
  if (!assegnatariPerAzienda[utente.aziendaId]) {
    assegnatariPerAzienda[utente.aziendaId] = [];
  }
  assegnatariPerAzienda[utente.aziendaId].push({
    id: utente.id,
    nome: utente.nome,
    email: utente.email,
  });
}
  const canManageLeadIds = leads
    .filter((lead) => {
      if (userRole === "SUPERADMIN") {
        return true;
      }
      if (userRole === "ADMIN") {
        return lead.aziendaId === aziendaId;
      }
      return (
        lead.aziendaId === aziendaId &&
        lead.utenteId === userId
      );
    })
    .map((lead) => lead.id);
  // Le azioni sui task mantengono i permessi lato server.
  function canManageTask(task: DashboardTask) {
    if (userRole === "SUPERADMIN") {
      return true;
    }
    if (userRole === "ADMIN") {
      return task.lead.aziendaId === aziendaId;
    }
    return (
      task.lead.aziendaId === aziendaId &&
      task.lead.utenteId === userId
    );
  }
  function canCompleteTask(task: DashboardTask) {
    if (task.completato) {
      return false;
    }
    if (canManageTask(task)) {
      return true;
    }
    return (
      userRole === "USER" &&
      task.lead.aziendaId === aziendaId &&
      task.assegnatoAId === userId
    );
  }
  const percentualeTask =
    taskTotali > 0
      ? Math.round(
          (taskCompletati / taskTotali) * 100
        )
      : 0;
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <LogoAzienda aziendaId={isSuperAdmin ? null : aziendaId} nome={nomeAzienda} width={48} height={48} />
          </div>
          <div>
            <h1 className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Dashboard ({nomeAzienda})
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Panoramica e gestione contatti
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CentroNotifiche
            utenteId={userId}
            notifiche={[
              ...tasksScaduti.map((task) => ({
                id: task.id,
                tipo: "SCADUTO" as const,
                descrizione: task.descrizione,
                cliente: task.lead.nome,
                scadenza: task.data_scadenza.toISOString(),
              })),
              ...tasksOggi.map((task) => ({
                id: task.id,
                tipo: "OGGI" as const,
                descrizione: task.descrizione,
                cliente: task.lead.nome,
                scadenza: task.data_scadenza.toISOString(),
              })),
              ...tasksFuturi
                .filter((task) => userRole !== "USER" || task.assegnatoAId === userId)
                .slice(0, 30)
                .map((task) => ({
                  id: task.id,
                  tipo: (userRole === "USER" ? "ASSEGNATO" : "AZIENDA") as "ASSEGNATO" | "AZIENDA",
                  descrizione: task.descrizione,
                  cliente: task.lead.nome,
                  scadenza: task.data_scadenza.toISOString(),
                })),
            ]}
          />
          <AddLeadModal />
          <a
            href="/storico"
            className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            Storico
          </a>
          <a
            href="/profilo"
            className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            Profilo
          </a>
          {userRole !== "USER" && (
            <a
              href="/impostazioni"
              title="Personalizza azienda e dashboard"
              aria-label="Personalizza azienda e dashboard"
              className="group inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-950 hover:text-white hover:shadow-md"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-hover:rotate-12">
                <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
                <circle cx="8" cy="7" r="2" fill="currentColor" stroke="none" />
                <circle cx="16" cy="17" r="2" fill="currentColor" stroke="none" />
              </svg>
              <span>Personalizza</span>
            </a>
          )}
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 hover:text-red-600"
            >
              Esci
            </button>
          </form>
        </div>
      </header>
      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            {tipoSelezionato === "CLIENTE"
              ? "Clienti in Pipeline"
              : "Collaboratori in Pipeline"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {totaleLeads}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Task Completati
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-slate-950">
              {taskCompletati}
            </p>
            <p className="text-sm font-medium text-emerald-600">
              / {taskTotali}
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Efficienza Operativa
            </p>
            <span className="text-sm font-semibold text-slate-950">
              {percentualeTask}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all duration-500"
              style={{ width: `${percentualeTask}%` }}
            />
          </div>
        </div>
      </section>
      {tasksScaduti.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-red-700">
              Task scaduti
            </h2>
            <p className="text-sm text-red-600">
              {tasksScaduti.length} attività da recuperare
            </p>
          </div>
          <ul className="grid gap-3">
            {tasksScaduti.map((task) => (
              <li
                key={task.id}
                className={`rounded-2xl border-2 border-red-200 p-4 shadow-sm transition-all hover:shadow-md ${getServizioBg(task.lead.servizio_richiesto)}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-medium text-slate-950">
                      {task.descrizione}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {task.lead.nome} · Scadenza: {formatDate(task.data_scadenza)} alle {formatTime(task.data_scadenza)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <TaskActions
                      task={task}
                      canManage={canManageTask(task)}
                      canComplete={canCompleteTask(task)}
                      assegnatari={
                        task.lead.aziendaId !== null
                          ? assegnatariPerAzienda[task.lead.aziendaId] ?? []
                          : []
                      }
                      puoScegliereAssegnatario={currentUser.ruolo !== "USER"}
                    />
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      Scaduto
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-950">
            Da fare oggi
          </h2>
          <p className="text-sm text-slate-500">
            {tasksOggi.length} promemoria di contatto
          </p>
        </div>
        {tasksOggi.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Nessun task in scadenza oggi.
          </div>
        ) : (
          <ul className="grid gap-3">
            {tasksOggi.map((task) => (
              <li
                key={task.id}
                className={`rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${getServizioBg(task.lead.servizio_richiesto)}`}
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
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <TaskActions
  task={task}
  canManage={canManageTask(task)}
                        canComplete={canCompleteTask(task)}
  assegnatari={
    task.lead.aziendaId !== null
      ? assegnatariPerAzienda[task.lead.aziendaId] ?? []
      : []
  }
  puoScegliereAssegnatario={currentUser.ruolo !== "USER"}
/>
                    <div className="mx-1 h-6 w-px bg-slate-200/50" />
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                      {formatTime(task.data_scadenza)}
                    </span>
                    <span
                      className={`rounded-full bg-white/50 px-3 py-1 text-xs font-medium ring-1 ring-inset ${statoStyle(task.lead.stato)}`}
                    >
                      {task.lead.stato}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {tasksFuturi.length > 0 && (
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Prossimamente
            </h2>
          </div>
          <ul className="grid gap-3">
            {tasksFuturi.map((task) => (
              <li
                key={task.id}
                className={`rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${getServizioBg(task.lead.servizio_richiesto)}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-medium text-slate-950">
                      {task.descrizione}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {task.lead.nome} · {formatDate(task.data_scadenza)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <TaskActions
                        task={task}
                        canManage={canManageTask(task)}
                        canComplete={canCompleteTask(task)}
                        assegnatari={
                          task.lead.aziendaId !== null
                            ? assegnatariPerAzienda[task.lead.aziendaId] ?? []
                            : []
                        }
                        puoScegliereAssegnatario={currentUser.ruolo !== "USER"}
                      />
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                      {formatTime(task.data_scadenza)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
<LeadsTableTabs
  leads={leads}
  tipoSelezionato={tipoSelezionato}
  countClienti={countClienti}
  countCollaboratori={countCollaboratori}
  canManageLeadIds={canManageLeadIds}
  assegnatariPerAzienda={assegnatariPerAzienda}
  puoScegliereAssegnatario={currentUser.ruolo !== "USER"}
/>
    </main>
  );
}
