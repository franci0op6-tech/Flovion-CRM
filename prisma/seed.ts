
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      "La variabile ADMIN_PASSWORD non è impostata."
    );
  }

  const email = "francesco@crm.it";

  // Crea l'azienda solo se non esiste.
  const azienda = await prisma.azienda.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: "Flovion",
    },
  });

  // Se l'account esiste già, non modificarlo.
  const utenteEsistente = await prisma.utente.findUnique({
    where: { email },
    select: { id: true },
  });

  if (utenteEsistente) {
    console.log(
      "L'account esiste già: nessuna modifica all'utente."
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(
    adminPassword,
    12
  );

  await prisma.utente.create({
    data: {
      nome: "Francesco Errico",
      email,
      password: hashedPassword,
      ruolo: "ADMIN",
      aziendaId: azienda.id,
    },
  });

  console.log(
    `Azienda "${azienda.nome}" e account iniziale configurati.`
  );
}

main()
  .catch((error) => {
    console.error("Errore durante il seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
