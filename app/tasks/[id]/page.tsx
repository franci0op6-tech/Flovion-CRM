import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { completeTask } from "@/app/actions/leads";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DettaglioTask({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  if (!/^[1-9]\d*$/.test(rawId)) notFound();
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) notFound();

  const utente = await requireCurrentUser();
  // I permessi sono applicati anche nella query: un link non dà accesso al task.
  let filtro: Prisma.TaskWhereInput = { id };
  if (utente.ruolo === "ADMIN") {
    if (utente.aziendaId == null) notFound();
    filtro = { id, lead: { is: { aziendaId: utente.aziendaId } } };
  } else if (utente.ruolo === "USER") {
    if (utente.aziendaId == null) notFound();
    filtro = {
      id,
      lead: { is: { aziendaId: utente.aziendaId } },
      OR: [
        { assegnatoAId: utente.id },
        { lead: { is: { utenteId: utente.id } } },
      ],
    };
  }
  const task = await prisma.task.findFirst({ where: filtro, include: { lead: true } });
  if (!task) notFound();
  const puoCompletare = !task.completato;
  const scadenza = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short",
  }).format(task.data_scadenza);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="text-sm text-blue-700 hover:underline">← Torna alla dashboard</Link>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task #{task.id}</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{task.descrizione}</h1>
        <dl className="mt-6 space-y-3 text-sm">
          <div><dt className="font-semibold text-slate-600">Cliente / contatto</dt><dd>{task.lead.nome}</dd></div>
          <div><dt className="font-semibold text-slate-600">Scadenza</dt><dd>{scadenza}</dd></div>
          <div><dt className="font-semibold text-slate-600">Stato</dt><dd>{task.completato ? "Completato" : "Da completare"}</dd></div>
        </dl>
        {puoCompletare && (
          <form action={completeTask} className="mt-8">
            <input type="hidden" name="id" value={task.id} />
            <button type="submit" className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">
              Segna come completato
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
