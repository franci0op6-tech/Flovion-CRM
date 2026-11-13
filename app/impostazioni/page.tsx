import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { salvaColoriTema } from "../actions/impostazioni";
import { salvaNomeAzienda, salvaLogoAzienda, eliminaLogoAzienda } from "../actions/branding";
import { LogoAzienda } from "@/components/LogoAzienda";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type ImpostazioniPageProps = {
  searchParams: Promise<{ aziendaId?: string }>;
};

export default async function ImpostazioniPage({
  searchParams,
}: ImpostazioniPageProps) {
  const currentUser = await requireCurrentUser();
  const params = await searchParams;
  const isSuperAdmin = currentUser.ruolo === "SUPERADMIN";

  if (currentUser.ruolo === "USER") {
    redirect("/");
  }

  const aziende = isSuperAdmin
    ? await prisma.azienda.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      })
    : [];

  let aziendaId: number;

  if (isSuperAdmin) {
    if (aziende.length === 0) {
      return (
        <main className="mx-auto max-w-4xl px-6 py-10">
          <h1 className="text-2xl font-semibold">Impostazioni</h1>
          <p className="mt-4 text-slate-600">
            Non ci sono aziende da configurare.
          </p>
          <Link className="mt-4 inline-block text-blue-600" href="/">
            Torna alla Dashboard
          </Link>
        </main>
      );
    }

    const requestedId = Number(params.aziendaId);
    const selectedAzienda = aziende.find(
      (azienda) => azienda.id === requestedId,
    );

    aziendaId = selectedAzienda?.id ?? aziende[0].id;
  } else {
    if (currentUser.aziendaId == null) {
      redirect("/");
    }

    aziendaId = currentUser.aziendaId;
  }

  const azienda = await prisma.azienda.findUnique({
    where: { id: aziendaId },
    select: { id: true, nome: true, whatsappNumero: true },
  });

  if (!azienda) {
    redirect("/");
  }

  async function salvaWhatsAppAziendale(formData: FormData) {
    "use server";
    const utente = await requireCurrentUser();
    if (utente.ruolo !== "SUPERADMIN" && utente.ruolo !== "ADMIN") {
      throw new Error("Non autorizzato.");
    }
    const richiesto = Number(formData.get("aziendaId"));
    if (!Number.isSafeInteger(richiesto) || richiesto <= 0) {
      throw new Error("Azienda non valida.");
    }
    if (utente.ruolo === "ADMIN" && utente.aziendaId !== richiesto) {
      throw new Error("Non puoi modificare un'altra azienda.");
    }
    const numero = formData.get("whatsappNumero");
    if (typeof numero !== "string") {
      throw new Error("Numero WhatsApp non valido.");
    }
    const normalizzato = numero.trim().replace(/[\s().-]/g, "");
    if (normalizzato && !/^\+[1-9]\d{7,14}$/.test(normalizzato)) {
      throw new Error("Usa il formato internazionale, ad esempio +393331234567.");
    }
    await prisma.azienda.update({
      where: { id: richiesto },
      data: { whatsappNumero: normalizzato || null },
      select: { id: true },
    });
    revalidatePath("/impostazioni");
  }

  const tema = (await prisma.impostazioniGrafiche.findUnique({
    where: { aziendaId },
  })) ?? {
    bgColor: "#0f172a",
    textColor: "#f8fafc",
    primaryColor: "#3b82f6",
    cardBgColor: "#1e293b",
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">
            Impostazioni Layout & Azienda
          </h1>
          <p className="text-sm text-slate-500">
            Gestisci le preferenze e l&apos;identità  visiva
          </p>
        </div>

        <Link
          href="/"
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50"
        >
          ← Torna alla Dashboard
        </Link>
      </div>

      {isSuperAdmin && (
        <form
          method="GET"
          action="/impostazioni"
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <label
            htmlFor="aziendaId"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Seleziona l&apos;azienda da configurare
          </label>

          <select
            id="aziendaId"
            name="aziendaId"
            defaultValue={String(azienda.id)}
            className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            {aziende.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="ml-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Seleziona
          </button>
        </form>
      )}

       <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
         <h2 className="text-lg font-semibold text-slate-950">WhatsApp aziendale</h2>
         <p className="mt-1 text-sm text-slate-600">
           Numero che riceve i promemoria aziendali dei task.
           Non è il numero mittente della Cloud API configurato su Meta.
         </p>
         <form action={salvaWhatsAppAziendale} className="mt-4 space-y-3">
           <input type="hidden" name="aziendaId" value={azienda.id} />
           <label htmlFor="whatsappAzienda" className="block text-sm font-medium text-slate-700">
             Numero destinatario WhatsApp dell&apos;azienda
           </label>
           <input
             id="whatsappAzienda"
             name="whatsappNumero"
             type="tel"
             autoComplete="tel"
             maxLength={24}
             placeholder="+393331234567"
             defaultValue={azienda.whatsappNumero ?? ""}
             className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
           />
           <p className="text-xs text-slate-500">
             Utilizza un numero autorizzato a ricevere notifiche. Lascia vuoto e salva per rimuoverlo.
             Nessun messaggio viene inviato durante il salvataggio.
           </p>
           <button type="submit" className="block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
             Salva numero aziendale
           </button>
         </form>
       </section>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Nome aziendale</h2>
          <p className="mb-3 text-sm text-slate-500">
            Questo nome comparirà nella dashboard di tutti gli utenti dell&apos;azienda.
          </p>
          <form action={salvaNomeAzienda} className="max-w-lg space-y-3">
            <input type="hidden" name="aziendaId" value={azienda.id} />
            <label htmlFor="nomeAziendale" className="block text-sm font-medium text-slate-700">Nome visualizzato</label>
            <input id="nomeAziendale" name="nome" type="text" required minLength={2} maxLength={100}
              defaultValue={azienda.nome}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              Salva nome aziendale
            </button>
          </form>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h2 className="text-lg font-semibold text-slate-900">Logo aziendale</h2>
          <p className="mt-1 text-sm text-slate-500">
            Carica un logo PNG, JPG o WebP (massimo 2 MB). Verrà mostrato nella dashboard al posto del logo fisso.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-36 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
              <LogoAzienda aziendaId={azienda.id} nome={azienda.nome} width={120} height={64} />
            </div>
            <div className="text-sm text-slate-500">Anteprima del logo attuale</div>
          </div>
          <form action={salvaLogoAzienda} className="mt-4 flex max-w-xl flex-col gap-3">
            <input type="hidden" name="aziendaId" value={azienda.id} />
            <label htmlFor="logoAziendale" className="text-sm font-medium text-slate-700">Seleziona il nuovo logo</label>
            <input id="logoAziendale" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required
              className="block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
            <button type="submit" className="w-fit rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Carica e applica logo
            </button>
          </form>
          <form action={eliminaLogoAzienda} className="mt-3">
            <input type="hidden" name="aziendaId" value={azienda.id} />
            <button type="submit" className="text-sm font-medium text-rose-700 underline underline-offset-4 hover:text-rose-900">
              Rimuovi logo personalizzato
            </button>
          </form>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h2 className="text-lg font-medium text-slate-900">
            Personalizzazione Colori & Tema
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Scegli i colori per personalizzare l&apos;aspetto visivo del CRM.
          </p>

          <form
            action={salvaColoriTema}
            className="max-w-md space-y-4"
          >
            {isSuperAdmin && (
              <input
                type="hidden"
                name="aziendaId"
                value={azienda.id}
              />
            )}

            <div>
              <label
                htmlFor="bgColor"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Colore Sfondo Principale
              </label>
              <input
                id="bgColor"
                type="color"
                name="bgColor"
                defaultValue={tema.bgColor}
                className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
              />
            </div>

            <div>
              <label
                htmlFor="textColor"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Colore Testi
              </label>
              <input
                id="textColor"
                type="color"
                name="textColor"
                defaultValue={tema.textColor}
                className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
              />
            </div>

            <div>
              <label
                htmlFor="primaryColor"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Colore Primario (Bottoni / Accenti)
              </label>
              <input
                id="primaryColor"
                type="color"
                name="primaryColor"
                defaultValue={tema.primaryColor}
                className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
              />
            </div>

            <div>
              <label
                htmlFor="cardBgColor"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Colore Sfondo Card / Sezioni
              </label>
              <input
                id="cardBgColor"
                type="color"
                name="cardBgColor"
                defaultValue={tema.cardBgColor}
                className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
              />
            </div>

            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Salva e applica colori
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
