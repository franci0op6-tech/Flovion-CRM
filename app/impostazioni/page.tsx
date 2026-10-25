import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salvaColoriTema } from "../actions/impostazioni";


export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  const session = await auth();
  const aziendaId = Number(session?.user?.aziendaId);

  // Recuperiamo i dati dell'azienda
  const azienda = await prisma.azienda.findUnique({
    where: { id: aziendaId },
  });

  // Recuperiamo le impostazioni grafiche salvate (con valori di default se non esistono)
  const tema = await prisma.impostazioniGrafiche.findUnique({
    where: { id: 1 },
  }) || {
    bgColor: "#0f172a",
    textColor: "#f8fafc",
    primaryColor: "#3b82f6",
    cardBgColor: "#1e293b",
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Impostazioni Layout & Azienda</h1>
          <p className="text-sm text-slate-500">Gestisci le preferenze e l&apos;identità visiva</p>
        </div>
        <Link
  href="/"
  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
>
  ← Torna alla Dashboard
</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Nome Azienda</h2>
          <p className="text-sm text-slate-500 mb-2">Il nome attualmente associato al tuo CRM.</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-800 font-medium max-w-md">
            {azienda?.nome || "Nessuna azienda associata"}
          </div>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h2 className="text-lg font-medium text-slate-900">Logo Aziendale</h2>
          <p className="text-sm text-slate-500 mb-2">Assicurati che il file del logo si trovi nella cartella pubblica del progetto con il nome <code className="text-xs bg-slate-100 p-1 rounded">logo.png</code>.</p>
          
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2">
              {/* Anteprima del logo */}
              <img src="/logo.png" alt="Logo Azienda" className="max-h-full max-w-full object-contain" />
            </div>
            <span className="text-xs text-slate-400">Anteprima logo caricato da /public/logo.png</span>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Sezione Personalizzazione Colori e Layout */}
        <div>
          <h2 className="text-lg font-medium text-slate-900">Personalizzazione Colori & Tema</h2>
          <p className="text-sm text-slate-500 mb-4">Scegli i colori per personalizzare l&apos;aspetto visivo del CRM.</p>

          <form action={salvaColoriTema} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colore Sfondo Principale</label>
              <input type="color" name="bgColor" defaultValue={tema.bgColor} className="w-full h-10 rounded border border-slate-300 cursor-pointer p-1 bg-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colore Testi</label>
              <input type="color" name="textColor" defaultValue={tema.textColor} className="w-full h-10 rounded border border-slate-300 cursor-pointer p-1 bg-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colore Primario (Bottoni / Accenti)</label>
              <input type="color" name="primaryColor" defaultValue={tema.primaryColor} className="w-full h-10 rounded border border-slate-300 cursor-pointer p-1 bg-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colore Sfondo Card / Sezioni</label>
              <input type="color" name="cardBgColor" defaultValue={tema.cardBgColor} className="w-full h-10 rounded border border-slate-300 cursor-pointer p-1 bg-white" />
            </div>

            <button type="submit" className="rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 text-sm transition-colors">
              Salva e applica colori
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}