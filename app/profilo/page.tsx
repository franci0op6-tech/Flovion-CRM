import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import bcrypt from "bcryptjs"; // Libreria per criptare le password

export default async function ProfiloPage() {
  // 1. Controlla chi è loggato
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userRole = session.user.ruolo;

  // 2. Recupera i dati attuali
  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });

  // 3. Azione: Aggiorna Telegram
  async function aggiornaProfilo(formData: FormData) {
    "use server";
    const chatId = formData.get("telegram_chat_id") as string;
    await prisma.utente.update({
      where: { id: Number(session!.user!.id) },
      data: { telegram_chat_id: chatId || null },
    });
    revalidatePath("/profilo");
  }

  // 4. Azione ADMIN: Crea Nuovo Utente
// 4. Azione ADMIN: Crea Nuovo Utente
async function creaUtente(formData: FormData) {
    "use server";
    
    // 4a. Leggiamo l'azienda di chi sta creando l'utente
    const aziendaId = session?.user?.aziendaId;

if (typeof aziendaId !== "number") {
  throw new Error("Azienda non valida o non associata.");
}

    const nome = formData.get("nome") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const ruolo = formData.get("ruolo") as string;

    // Cripta la password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4b. Salviamo il nuovo utente legandolo a quell'azienda
    await prisma.utente.create({
      data: { 
        nome, 
        email, 
        password: hashedPassword, 
        ruolo,
        aziendaId: aziendaId // <-- INSERITO QUI!
      },
    });
    revalidatePath("/profilo");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Impostazioni Profilo
          </h1>
          <p className="mt-1 text-sm text-slate-500">Gestisci le tue preferenze e notifiche</p>
        </div>
        <Link 
          href="/" 
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Torna alla Dashboard
        </Link>
      </header>

      <div className="flex flex-col gap-8">
        {/* SEZIONE 1: IMPOSTAZIONI PERSONALI (Visibile a tutti) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Notifiche Telegram</h2>
          <p className="mb-6 text-sm text-slate-600">
            Collega il tuo account Telegram per ricevere in tempo reale i promemoria dei task. 
          </p>

          <form action={aggiornaProfilo} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Telegram Chat ID
              </label>
              <input 
                type="text" 
                name="telegram_chat_id"
                defaultValue={utente?.telegram_chat_id || ""}
                placeholder="Es. 1205115934"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            
            <button 
              type="submit"
              className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Salva Modifiche
            </button>
          </form>
        </section>

        {/* SEZIONE 2: PANNELLO ADMIN (Visibile SOLO agli ADMIN) */}
        {userRole === "ADMIN" && (
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
            <div className="mb-4">
              <span className="mb-2 inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Area Amministratore
              </span>
              <h2 className="text-lg font-semibold text-slate-950">Aggiungi Collaboratore</h2>
              <p className="text-sm text-slate-600">
                Crea un nuovo account. La password verrà criptata automaticamente in modo sicuro.
              </p>
            </div>

            <form action={creaUtente} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome completo</label>
                <input type="text" name="nome" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email (Login)</label>
                <input type="email" name="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input type="password" name="password" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ruolo</label>
                <select name="ruolo" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600">
                  <option value="USER">USER (Vede solo i propri lead)</option>
                  <option value="ADMIN">ADMIN (Vede tutto)</option>
                </select>
              </div>
              <div className="sm:col-span-2 mt-2">
                <button type="submit" className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
                  Crea Account
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}