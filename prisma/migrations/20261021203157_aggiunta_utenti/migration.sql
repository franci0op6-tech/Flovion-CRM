-- CreateTable
CREATE TABLE "Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "servizio_richiesto" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'Nuovo',
    "archiviato" BOOLEAN NOT NULL DEFAULT false,
    "data_creazione" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utenteId" INTEGER,
    CONSTRAINT "Lead_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descrizione" TEXT NOT NULL,
    "data_scadenza" DATETIME NOT NULL,
    "completato" BOOLEAN NOT NULL DEFAULT false,
    "leadId" INTEGER NOT NULL,
    CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "testo_nota" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" INTEGER NOT NULL,
    CONSTRAINT "Nota_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Utente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telegram_chat_id" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Utente_email_key" ON "Utente"("email");
