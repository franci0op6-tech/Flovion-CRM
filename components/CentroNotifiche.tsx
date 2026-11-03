"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Notifica = {
  id: number;
  tipo: "SCADUTO" | "OGGI" | "ASSEGNATO" | "AZIENDA";
  descrizione: string;
  cliente: string;
  scadenza: string;
};

const formatData = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});
const chiave = (n: Notifica) => `${n.id}:${n.tipo}:${n.scadenza}`;

export function CentroNotifiche({ notifiche, utenteId }: { notifiche: Notifica[]; utenteId: number }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [lette, setLette] = useState<string[]>([]);
  const [nuove, setNuove] = useState<string[]>([]);
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);
  const storageKey = `folavion:centro-notifiche:v1:utente:${utenteId}`;
  const ordinate = useMemo(() => [...notifiche].sort((a, b) => {
    const peso = { SCADUTO: 0, OGGI: 1, ASSEGNATO: 2, AZIENDA: 3 };
    return peso[a.tipo] - peso[b.tipo] || a.scadenza.localeCompare(b.scadenza);
  }), [notifiche]);
  const firme = useMemo(() => ordinate.map(chiave), [ordinate]);
  const firmeKey = firme.join("|");

  // Il database è la fonte di verità. Il localStorage viene importato una sola volta
  // per preservare le letture della precedente versione e non è più usato per scrivere.
  useEffect(() => {
    let cancellato = false;
    async function carica() {
      setPronto(false);
      setErrore("");
      try {
        const risposta = await fetch("/api/notifiche-letture", { cache: "no-store" });
        if (!risposta.ok) throw new Error(`Lettura notifiche: HTTP ${risposta.status}`);
        const dati: { lette?: string[]; note?: string[] } = await risposta.json();
        let letteRemote = Array.isArray(dati.lette) ? dati.lette : [];
        let noteRemote = Array.isArray(dati.note) ? dati.note : [];
        // Importazione una tantum per utente; la chiave non contiene dati segreti.
        const migrationKey = `${storageKey}:importato-su-neon`;
        try {
          if (!window.localStorage.getItem(migrationKey)) {
            const locale = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
            const vecchieLette = Array.isArray(locale.lette) ? locale.lette.filter((x: unknown): x is string => typeof x === "string") : [];
            const vecchieNote = Array.isArray(locale.note) ? locale.note.filter((x: unknown): x is string => typeof x === "string") : [];
            if (vecchieLette.length || vecchieNote.length) {
              const migrazione = await fetch("/api/notifiche-letture", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lette: vecchieLette.slice(-1000), note: vecchieNote.slice(-1000) }),
              });
              if (!migrazione.ok) throw new Error("Importazione delle letture locali non riuscita");
              letteRemote = [...new Set([...letteRemote, ...vecchieLette])];
              noteRemote = [...new Set([...noteRemote, ...vecchieNote])];
            }
            window.localStorage.setItem(migrationKey, "1");
          }
        } catch (e) {
          // Se il salvataggio locale non è disponibile, le letture remote funzionano comunque.
          if (e instanceof Error && e.message.includes("Importazione")) throw e;
        }
        if (cancellato) return;
        const attuali = [...new Set(firme)];
        const nuoveAssegnazioni = noteRemote.length > 0
          ? ordinate.filter(n => n.tipo === "ASSEGNATO" && !noteRemote.includes(chiave(n))).map(chiave)
          : [];
        setLette(letteRemote);
        setNuove(nuoveAssegnazioni);
        const daAnnotare = attuali.filter(k => !noteRemote.includes(k));
        if (daAnnotare.length) {
          const salvate = await fetch("/api/notifiche-letture", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: daAnnotare }),
          });
          if (!salvate.ok) throw new Error("Impossibile registrare le notifiche viste");
        }
        if (!cancellato) setPronto(true);
      } catch (e) {
        if (!cancellato) { setErrore(e instanceof Error ? e.message : "Sincronizzazione non riuscita"); setPronto(false); }
      }
    }
    void carica();
    return () => { cancellato = true; };
  }, [storageKey, firmeKey, firme, ordinate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [router]);

  const nonLette = pronto ? ordinate.filter(n => !lette.includes(chiave(n))).length : 0;
  const critiche = ordinate.filter(n => n.tipo === "SCADUTO" || n.tipo === "OGGI").length;

  async function segnaLette(ids: string[]) {
    if (!pronto || salvando || ids.length === 0) return;
    setSalvando(true);
    setErrore("");
    try {
      const risposta = await fetch("/api/notifiche-letture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lette: ids }),
      });
      if (!risposta.ok) throw new Error(`Salvataggio letture: HTTP ${risposta.status}`);
      setLette(curr => [...new Set([...curr, ...ids])]);
      setNuove(curr => curr.filter(id => !ids.includes(id)));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Salvataggio non riuscito");
    } finally { setSalvando(false); }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setAperto((val) => !val)}
        aria-label={`Centro notifiche: ${nonLette} non lette`}
        aria-expanded={aperto} aria-controls="pannello-notifiche-crm"
        className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        <span>Notifiche</span>
        {nonLette > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">{nonLette > 99 ? "99+" : nonLette}</span>}
      </button>
      {aperto && (
        <div id="pannello-notifiche-crm" className="absolute right-0 z-50 mt-2 w-[min(92vw,400px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div><h2 className="font-semibold text-slate-900">Centro notifiche</h2><p className="text-xs text-slate-500">{nonLette} non lette · {critiche} scadute o di oggi</p></div>
            <button type="button" onClick={() => setAperto(false)} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">Chiudi</button>
          </div>
          <div className="flex justify-end border-b border-slate-100 px-4 py-2">
            <button type="button" disabled={!pronto || salvando || nonLette === 0} onClick={() => void segnaLette(firme)} className="text-xs font-medium text-indigo-700 disabled:text-slate-400">Segna tutte come lette</button>
          </div>
          {errore && <p role="alert" className="px-4 py-2 text-xs text-rose-700">{errore}</p>}
          <div className="max-h-96 overflow-y-auto">
            {ordinate.length === 0 ? <p className="p-5 text-sm text-slate-500">Nessuna attività da segnalare.</p> :
              ordinate.slice(0, 50).map((n) => {
                const id = chiave(n);
                const letta = lette.includes(id);
                return <Link href={`/tasks/${n.id}`} key={id} onClick={() => { void segnaLette([id]); setAperto(false); }}
                  className={`block border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 last:border-0 ${!letta ? "bg-indigo-50/60" : ""}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${n.tipo === "SCADUTO" ? "text-rose-700" : n.tipo === "OGGI" ? "text-amber-700" : "text-indigo-700"}`}>
                      {n.tipo === "SCADUTO" ? "Scaduto" : n.tipo === "OGGI" ? "Scade oggi" : n.tipo === "AZIENDA" ? "Task aziendale" : "Assegnato a te"}
                      {nuove.includes(id) && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800">Nuovo</span>}
                    </span>
                    <span className="flex items-center gap-2">{!letta && <span aria-label="Non letta" className="h-2 w-2 rounded-full bg-indigo-600" />}<time className="text-xs text-slate-500">{formatData.format(new Date(n.scadenza))}</time></span>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{n.descrizione}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{n.cliente}</p>
                </Link>;
              })}
          </div>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">Si aggiorna ogni minuto con la pagina aperta. Letture sincronizzate su Neon tra dispositivi.</p>
        </div>
      )}
    </div>
  );
}
