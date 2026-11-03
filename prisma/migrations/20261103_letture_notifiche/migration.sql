-- Folavion - sincronizzazione delle letture delle notifiche interne.
-- La tabella esiste gia' sul branch Neon di test: IF NOT EXISTS evita di ricrearla.
-- Non aggiungiamo foreign key non presenti nella tabella originaria.
CREATE TABLE IF NOT EXISTS "LetturaNotificaInterna" (
    "utenteId" INTEGER NOT NULL,
    "chiave" VARCHAR NOT NULL,
    "vista" BOOLEAN NOT NULL DEFAULT false,
    "letta" BOOLEAN NOT NULL DEFAULT false,
    "aggiornataIl" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "LetturaNotificaInterna_pkey" PRIMARY KEY ("utenteId", "chiave")
);
