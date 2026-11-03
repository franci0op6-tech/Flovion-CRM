-- CreateEnum
CREATE TYPE "ModalitaPromemoriaWhatsApp" AS ENUM ('AZIENDA', 'COLLABORATORE');

-- CreateEnum
CREATE TYPE "TipoNotificaTask" AS ENUM ('ASSEGNAZIONE', 'GIORNO_SCADENZA', 'QUINDICI_MINUTI_PRIMA');

-- CreateEnum
CREATE TYPE "StatoNotificaTask" AS ENUM ('IN_ATTESA', 'IN_LAVORAZIONE', 'INVIATA', 'FALLITA', 'ESITO_INCERTO', 'ANNULLATA');

-- AlterTable
ALTER TABLE "Azienda" ADD COLUMN     "whatsappModalitaPromemoria" "ModalitaPromemoriaWhatsApp" NOT NULL DEFAULT 'AZIENDA',
ADD COLUMN     "whatsappNumero" TEXT,
ADD COLUMN     "whatsappOraPromemoria" TEXT NOT NULL DEFAULT '07:00';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assegnatoAId" INTEGER,
ADD COLUMN     "assegnatoIl" TIMESTAMP(3),
ADD COLUMN     "creatoDaId" INTEGER,
ADD COLUMN     "versionePromemoria" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Utente" DROP COLUMN IF EXISTS "telegram_chat_id",
ADD COLUMN     "whatsappNumero" TEXT;

-- CreateTable
CREATE TABLE "AccessoLead" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "utenteId" INTEGER NOT NULL,
    "concessoDaId" INTEGER,
    "concessoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocatoDaId" INTEGER,
    "revocatoIl" TIMESTAMP(3),

    CONSTRAINT "AccessoLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoricoAssegnazione" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER,
    "taskIdOriginale" INTEGER,
    "precedenteId" INTEGER,
    "nuovoId" INTEGER,
    "effettuataDaId" INTEGER,
    "effettuataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoricoAssegnazione_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificaTask" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "tipo" "TipoNotificaTask" NOT NULL,
    "stato" "StatoNotificaTask" NOT NULL DEFAULT 'IN_ATTESA',
    "chiaveIdempotenza" TEXT NOT NULL,
    "versionePromemoria" INTEGER NOT NULL,
    "programmataPer" TIMESTAMP(3) NOT NULL,
    "destinatario" TEXT,
    "tentativi" INTEGER NOT NULL DEFAULT 0,
    "prossimoTentativo" TIMESTAMP(3),
    "bloccataFinoAl" TIMESTAMP(3),
    "ultimoErrore" TEXT,
    "messaggioProviderId" TEXT,
    "inviataIl" TIMESTAMP(3),
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificaTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessoLead_utenteId_revocatoIl_idx" ON "AccessoLead"("utenteId", "revocatoIl");

-- CreateIndex
CREATE INDEX "AccessoLead_concessoDaId_idx" ON "AccessoLead"("concessoDaId");

-- CreateIndex
CREATE INDEX "AccessoLead_revocatoDaId_idx" ON "AccessoLead"("revocatoDaId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoLead_leadId_utenteId_key" ON "AccessoLead"("leadId", "utenteId");

-- CreateIndex
CREATE INDEX "StoricoAssegnazione_taskId_effettuataIl_idx" ON "StoricoAssegnazione"("taskId", "effettuataIl");

-- CreateIndex
CREATE INDEX "StoricoAssegnazione_taskIdOriginale_idx" ON "StoricoAssegnazione"("taskIdOriginale");

-- CreateIndex
CREATE INDEX "StoricoAssegnazione_precedenteId_idx" ON "StoricoAssegnazione"("precedenteId");

-- CreateIndex
CREATE INDEX "StoricoAssegnazione_nuovoId_idx" ON "StoricoAssegnazione"("nuovoId");

-- CreateIndex
CREATE INDEX "StoricoAssegnazione_effettuataDaId_idx" ON "StoricoAssegnazione"("effettuataDaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificaTask_chiaveIdempotenza_key" ON "NotificaTask"("chiaveIdempotenza");

-- CreateIndex
CREATE UNIQUE INDEX "NotificaTask_messaggioProviderId_key" ON "NotificaTask"("messaggioProviderId");

-- CreateIndex
CREATE INDEX "NotificaTask_stato_programmataPer_idx" ON "NotificaTask"("stato", "programmataPer");

-- CreateIndex
CREATE INDEX "NotificaTask_stato_prossimoTentativo_idx" ON "NotificaTask"("stato", "prossimoTentativo");

-- CreateIndex
CREATE INDEX "NotificaTask_taskId_versionePromemoria_idx" ON "NotificaTask"("taskId", "versionePromemoria");

-- CreateIndex
CREATE INDEX "Task_assegnatoAId_idx" ON "Task"("assegnatoAId");

-- CreateIndex
CREATE INDEX "Task_creatoDaId_idx" ON "Task"("creatoDaId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assegnatoAId_fkey" FOREIGN KEY ("assegnatoAId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatoDaId_fkey" FOREIGN KEY ("creatoDaId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoLead" ADD CONSTRAINT "AccessoLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoLead" ADD CONSTRAINT "AccessoLead_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoLead" ADD CONSTRAINT "AccessoLead_concessoDaId_fkey" FOREIGN KEY ("concessoDaId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoLead" ADD CONSTRAINT "AccessoLead_revocatoDaId_fkey" FOREIGN KEY ("revocatoDaId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoricoAssegnazione" ADD CONSTRAINT "StoricoAssegnazione_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoricoAssegnazione" ADD CONSTRAINT "StoricoAssegnazione_precedenteId_fkey" FOREIGN KEY ("precedenteId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoricoAssegnazione" ADD CONSTRAINT "StoricoAssegnazione_nuovoId_fkey" FOREIGN KEY ("nuovoId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoricoAssegnazione" ADD CONSTRAINT "StoricoAssegnazione_effettuataDaId_fkey" FOREIGN KEY ("effettuataDaId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificaTask" ADD CONSTRAINT "NotificaTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
