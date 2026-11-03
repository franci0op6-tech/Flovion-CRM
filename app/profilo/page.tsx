import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import bcrypt from "bcryptjs";
import { requireCurrentUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProfiloPage() {
  const currentUser = await requireCurrentUser();
  const userRole = currentUser.ruolo;
  const profilo = await prisma.utente.findUnique({
    where: { id: currentUser.id },
    select: { nome: true, email: true, whatsappNumero: true },
  });
  if (!profilo) {
    throw new Error("Profilo non trovato.");
  }

  async function salvaWhatsAppPersonale(formData: FormData) {
    "use server";
    const utente = await requireCurrentUser();
    const numero = formData.get("whatsappNumero");
    if (typeof numero !== "string") {
      throw new Error("Numero WhatsApp non valido.");
    }
    const normalizzato = numero.trim().replace(/[\s().-]/g, "");
    if (normalizzato && !/^\+[1-9]\d{7,14}$/.test(normalizzato)) {
      throw new Error("Usa il formato internazionale, ad esempio +393331234567.");
    }
    await prisma.utente.update({
      where: { id: utente.id },
      data: { whatsappNumero: normalizzato || null },
    });
    revalidatePath("/profilo");
  }

  async function creaUtente(formData: FormData) {
    "use server";

    const currentUser = await requireCurrentUser();

    if (currentUser.ruolo !== "ADMIN") {
      throw new Error("Solo un ADMIN può creare collaboratori.");
    }

    const aziendaId = currentUser.aziendaId;

    if (
      typeof aziendaId !== "number" ||
      !Number.isSafeInteger(aziendaId) ||
      aziendaId <= 0
    ) {
      throw new Error("Azienda non valida o non associata.");
    }

    const nome = formData.get("nome");
    const email = formData.get("email");
    const password = formData.get("password");
    const ruolo = formData.get("ruolo");

    if (
      typeof nome !== "string" ||
      nome.trim().length < 2 ||
      nome.trim().length > 100
    ) {
      throw new Error("Nome non valido.");
    }

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      throw new Error("Email non valida.");
    }

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 72
    ) {
      throw new Error(
        "La password deve contenere tra 12 e 72 caratteri.",
      );
    }

    if (ruolo !== "USER") {
      throw new Error("Puoi creare soltanto utenti con ruolo USER.");
    }

    const emailNormalizzata = email.trim().toLowerCase();

    const azienda = await prisma.azienda.findUnique({
      where: { id: aziendaId },
      select: { id: true },
    });

    if (!azienda) {
      throw new Error("L'azienda associata non esiste.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      await prisma.utente.create({
        data: {
          nome: nome.trim(),
          email: emailNormalizzata,
          password: hashedPassword,
          ruolo: "USER",
          aziendaId,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new Error("Esiste già  un utente con questa email.");
      }

      throw error;
    }

    revalidatePath("/profilo");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Impostazioni Profilo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestisci il tuo account e le impostazioni.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
        >
          Torna alla Dashboard
        </Link>
      </header>

       <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
         <h2 className="text-lg font-semibold text-slate-950">WhatsApp personale</h2>
         <p className="mt-1 text-sm text-slate-600">
           {profilo.nome} ({profilo.email}). Questo numero riceve le assegnazioni
           e i promemoria dei task che ti sono assegnati.
         </p>
         <form action={salvaWhatsAppPersonale} className="mt-4 space-y-3">
           <label htmlFor="whatsappPersonale" className="block text-sm font-medium text-slate-700">
             Numero WhatsApp (formato internazionale)
           </label>
           <input
             id="whatsappPersonale"
             name="whatsappNumero"
             type="tel"
             autoComplete="tel"
             maxLength={24}
             placeholder="+393331234567"
             defaultValue={profilo.whatsappNumero ?? ""}
             className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
           />
           <p className="text-xs text-slate-500">
             Inserisci il tuo numero autorizzato a ricevere notifiche.
             Lascia vuoto e salva per rimuoverlo. I messaggi non vengono inviati finché
             WhatsApp non viene abilitato dagli amministratori.
           </p>
           <button type="submit" className="block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
             Salva numero personale
           </button>
         </form>
       </section>

      {userRole === "ADMIN" && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
          <div className="mb-4">
            <span className="mb-2 inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              Area Amministratore
            </span>

            <h2 className="text-lg font-semibold text-slate-950">
              Aggiungi Collaboratore
            </h2>

            <p className="text-sm text-slate-600">
              Crea un nuovo account. La password verrà  salvata tramite
              hashing crittografico.
            </p>
          </div>

          <form
            action={creaUtente}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label
                htmlFor="nome"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nome completo
              </label>
              <input
                id="nome"
                type="text"
                name="nome"
                minLength={2}
                maxLength={100}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Email (Login)
              </label>
              <input
                id="email"
                type="email"
                name="email"
                maxLength={254}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                minLength={12}
                maxLength={72}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="ruolo"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Ruolo
              </label>

              <select
                id="ruolo"
                name="ruolo"
                defaultValue="USER"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="USER">
                  USER (Vede solo i propri lead)
                </option>
              </select>
            </div>

            <div className="mt-2 sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Crea Account
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
