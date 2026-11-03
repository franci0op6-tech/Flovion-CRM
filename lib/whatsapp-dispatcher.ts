

import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { inviaTemplateWhatsApp } from "@/lib/whatsapp";

const MAX_PER_ESECUZIONE = 20;

const MAX_TENTATIVI = 3;

const BLOCCO_MINUTI = 5;

type Statistiche = {

  attivo: boolean;

  esaminate: number;

  accettate: number;

  annullate: number;

  fallite: number;

  incerte: number;

  riprogrammate: number;

  bloccateRecuperate: number;

};

function statisticheIniziali(

  attivo: boolean

): Statistiche {

  return {

    attivo,

    esaminate: 0,

    accettate: 0,

    annullate: 0,

    fallite: 0,

    incerte: 0,

    riprogrammate: 0,

    bloccateRecuperate: 0,

  };

}

function dataProssimoTentativo(

  tentativi: number

): Date {

  const minuti = tentativi <= 1 ? 5 : 15;

  return new Date(

    Date.now() + minuti * 60_000

  );

}

function destinatarioAttuale(
  tipo: string,
  chiaveIdempotenza: string,
  collaboratore: string | null | undefined,
  azienda: string | null | undefined,
  modalita: string | undefined
): string | null {
  const numeroCollaboratore = collaboratore?.trim() || null;
  const numeroAzienda = azienda?.trim() || null;

  // Nuove notifiche: un destinatario esplicito per ciascuna riga.
  if (chiaveIdempotenza.endsWith(":COLLABORATORE")) return numeroCollaboratore;
  if (chiaveIdempotenza.endsWith(":AZIENDA")) return numeroAzienda;

  // Compatibilita con le notifiche precedenti al cambiamento.
  if (tipo === "ASSEGNAZIONE") return numeroCollaboratore;
  if (modalita === "COLLABORATORE") return numeroCollaboratore || numeroAzienda;
  return numeroAzienda;
}

/**

 * Le notifiche abbandonate non vengono

 * reinserite automaticamente nella coda.

 *

 * Un processo potrebbe essere stato interrotto

 * dopo la richiesta a Meta ma prima del salvataggio

 * della risposta.

 *

 * In quel caso riprovare potrebbe generare

 * un messaggio duplicato.

 */

async function recuperaNotificheBloccate():

  Promise<number> {

  const risultato =

    await prisma.notificaTask.updateMany({

      where: {

        stato: "IN_LAVORAZIONE",

        bloccataFinoAl: {

          lte: new Date(),

        },

      },

      data: {

        stato: "ESITO_INCERTO",

        bloccataFinoAl: null,

        prossimoTentativo: null,

        ultimoErrore:

          "Elaborazione interrotta o scaduta: esito da verificare manualmente.",

      },

    });

  return risultato.count;

}

export async function eseguiDispatcherWhatsApp():

  Promise<Statistiche> {

  /**

 * Finché l'invio non viene abilitato:

 * - nessuna query;

 * - nessun aggiornamento;

 * - nessun messaggio WhatsApp.

 */

  if (

    process.env.WHATSAPP_INVIO_ABILITATO !==

    "true"

  ) {

    return statisticheIniziali(false);

  }

  const statistiche = statisticheIniziali(true);

  /**

 * Recupero conservativo delle notifiche

 * lasciate bloccate da precedenti esecuzioni.

 */

  statistiche.bloccateRecuperate =

    await recuperaNotificheBloccate();

  const adesso = new Date();

  const candidate =

    await prisma.notificaTask.findMany({

      where: {

        stato: "IN_ATTESA",

        programmataPer: {

          lte: adesso,

        },

        OR: [

          {

            prossimoTentativo: null,

          },

          {

            prossimoTentativo: {

              lte: adesso,

            },

          },

        ],

      },

      select: {

        id: true,

      },

      orderBy: [

        {

          programmataPer: "asc",

        },

        {

          id: "asc",

        },

      ],

      take: MAX_PER_ESECUZIONE,

    });

  for (const candidata of candidate) {

    const momentoPrenotazione = new Date();

    /**

 * Prenotazione atomica.

 *

 * L'update riesce soltanto se la notifica

 * è ancora disponibile.

 */

    const prenotazione =

      await prisma.notificaTask.updateMany({

        where: {

          id: candidata.id,

          stato: "IN_ATTESA",

          programmataPer: {

            lte: momentoPrenotazione,

          },

          OR: [

            {

              prossimoTentativo: null,

            },

            {

              prossimoTentativo: {

                lte: momentoPrenotazione,

              },

            },

          ],

        },

        data: {

          stato: "IN_LAVORAZIONE",

          tentativi: {

            increment: 1,

          },

          bloccataFinoAl: new Date(

            momentoPrenotazione.getTime() +

              BLOCCO_MINUTI * 60_000

          ),

        },

      });

    if (prenotazione.count !== 1) {

      continue;

    }

    statistiche.esaminate++;

    try {

      const notifica =

        await prisma.notificaTask.findUnique({

          where: {

            id: candidata.id,

          },

          include: {

            task: {

              include: {

                assegnatoA: {

                  select: {

                    id: true,

                    whatsappNumero: true,

                  },

                },

                lead: {

                  include: {

                    azienda: {

                      select: {

                        whatsappNumero: true,

                        whatsappModalitaPromemoria: true,

                      },

                    },

                  },

                },

              },

            },

          },

        });

      if (

        !notifica ||

        notifica.stato !== "IN_LAVORAZIONE"

      ) {

        continue;

      }

      const tentativi = notifica.tentativi;

      /**

 * La finalizzazione modifica soltanto

 * una notifica ancora prenotata

 * da questa elaborazione.

 */

      const finalizza = async (

        data: Prisma.NotificaTaskUpdateManyMutationInput

      ): Promise<boolean> => {

        const aggiornamento =

          await prisma.notificaTask.updateMany({

            where: {

              id: candidata.id,

              stato: "IN_LAVORAZIONE",

              tentativi,

            },

            data: {

              ...data,

              bloccataFinoAl: null,

            },

          });

        return aggiornamento.count === 1;

      };

      const task = notifica.task;

      /**

 * Versione superata:

 * il task è stato modificato

 * dopo la pianificazione.

 */

      if (

        task.versionePromemoria !==

        notifica.versionePromemoria

      ) {

        if (

          await finalizza({

            stato: "ANNULLATA",

            ultimoErrore:

              "Notifica relativa a una versione precedente del task.",

            prossimoTentativo: null,

          })

        ) {

          statistiche.annullate++;

        }

        continue;

      }

      if (task.completato) {
        if (
          await finalizza({
            stato: "ANNULLATA",
            ultimoErrore: "Il task risulta completato.",
            prossimoTentativo: null,
          })
        ) {

          statistiche.annullate++;

        }

        continue;

      }

      const azienda = task.lead.azienda;

      const destinatario = destinatarioAttuale(

        notifica.tipo,

        notifica.chiaveIdempotenza,

        task.assegnatoA?.whatsappNumero,

        azienda?.whatsappNumero,

        azienda?.whatsappModalitaPromemoria

      );

      if (!destinatario) {

        if (

          await finalizza({

            stato: "FALLITA",

            ultimoErrore:

              "Numero WhatsApp del destinatario non disponibile.",

            prossimoTentativo: null,

          })

        ) {

          statistiche.fallite++;

        }

        continue;

      }

      /**

 * Registriamo il destinatario prima

 * della chiamata a Meta.

 *

 * Questo consente di sapere quale

 * numero era stato selezionato

 * anche in caso di interruzione.

 */

      const destinatarioRegistrato =

        await prisma.notificaTask.updateMany({

          where: {

            id: candidata.id,

            stato: "IN_LAVORAZIONE",

            tentativi,

          },

          data: {

            destinatario,

          },

        });

      if (destinatarioRegistrato.count !== 1) {

        continue;

      }

      /**

 * Ultimo controllo prima dell'invio.

 *

 * Rileggiamo il task e le impostazioni

 * per verificare eventuali modifiche

 * avvenute durante l'elaborazione.

 */

      const verifica =

        await prisma.notificaTask.findUnique({

          where: {

            id: candidata.id,

          },

          include: {

            task: {

              include: {

                assegnatoA: {

                  select: {

                    whatsappNumero: true,

                  },

                },

                lead: {

                  include: {

                    azienda: {

                      select: {

                        whatsappNumero: true,

                        whatsappModalitaPromemoria: true,

                      },

                    },

                  },

                },

              },

            },

          },

        });

      if (

        !verifica ||

        verifica.stato !== "IN_LAVORAZIONE" ||

        verifica.tentativi !== tentativi

      ) {

        continue;

      }

      const taskAggiornato = verifica.task;

      const numeroAggiornato = destinatarioAttuale(

        verifica.tipo,

        verifica.chiaveIdempotenza,

        taskAggiornato.assegnatoA?.whatsappNumero,

        taskAggiornato.lead.azienda?.whatsappNumero,

        taskAggiornato.lead.azienda

          ?.whatsappModalitaPromemoria

      );

      const obsoleta =

        verifica.versionePromemoria !==

          taskAggiornato.versionePromemoria ||

        taskAggiornato.completato ||

        numeroAggiornato !== destinatario;

      if (obsoleta) {

        if (

          await finalizza({

            stato: "ANNULLATA",

            ultimoErrore:

              "Task o destinatario modificato prima dell'invio.",

            prossimoTentativo: null,

          })

        ) {

          statistiche.annullate++;

        }

        continue;

      }

      /**

 * Invio effettivo:

 * questo punto viene raggiunto solo

 * se l'interruttore generale è attivo.

 */

      const esito = await inviaTemplateWhatsApp({

        destinatario,

        tipo: verifica.tipo,

        taskId: taskAggiornato.id,

        nomeCliente: taskAggiornato.lead.nome,

        descrizione: taskAggiornato.descrizione,

        scadenza: taskAggiornato.data_scadenza,

      });

      if (esito.stato === "ACCETTATO") {

        if (

          await finalizza({

            stato: "INVIATA",

            destinatario,

            messaggioProviderId:

              esito.messaggioProviderId,

            inviataIl: new Date(),

            ultimoErrore: null,

            prossimoTentativo: null,

          })

        ) {

          statistiche.accettate++;

        }

        continue;

      }

      if (esito.stato === "ESITO_INCERTO") {

        if (

          await finalizza({

            stato: "ESITO_INCERTO",

            destinatario,

            ultimoErrore: esito.motivo,

            prossimoTentativo: null,

          })

        ) {

          statistiche.incerte++;

        }

        continue;

      }

      if (esito.stato === "DISABILITATO") {

        if (

          await finalizza({

            stato: "FALLITA",

            destinatario,

            ultimoErrore: esito.motivo,

            prossimoTentativo: null,

          })

        ) {

          statistiche.fallite++;

        }

        continue;

      }

      /**

 * Ritentiamo soltanto HTTP 429.

 *

 * Per HTTP 5xx scegliamo

 * ESITO_INCERTO: è possibile che

 * la richiesta sia stata elaborata

 * anche se il server ha avuto un errore.

 */

      if (esito.codiceHttp >= 500) {

        if (

          await finalizza({

            stato: "ESITO_INCERTO",

            destinatario,

            ultimoErrore: esito.motivo,

            prossimoTentativo: null,

          })

        ) {

          statistiche.incerte++;

        }

        continue;

      }

      if (

        esito.codiceHttp === 429 &&

        tentativi < MAX_TENTATIVI

      ) {

        if (

          await finalizza({

            stato: "IN_ATTESA",

            destinatario,

            ultimoErrore: esito.motivo,

            prossimoTentativo:

              dataProssimoTentativo(tentativi),

          })

        ) {

          statistiche.riprogrammate++;

        }

        continue;

      }

      if (

        await finalizza({

          stato: "FALLITA",

          destinatario,

          ultimoErrore: esito.motivo,

          prossimoTentativo: null,

        })

      ) {

        statistiche.fallite++;

      }

    } catch (error) {

      /**

 * Non reinseriamo automaticamente

 * una notifica nella coda dopo

 * un errore inatteso.

 *

 * La chiamata a Meta potrebbe

 * essere già stata effettuata.

 */

      console.error(

        "Errore durante l'elaborazione della notifica:",

        candidata.id,

        error instanceof Error

          ? error.name

          : "Errore sconosciuto"

      );

      await prisma.notificaTask.updateMany({

        where: {

          id: candidata.id,

          stato: "IN_LAVORAZIONE",

        },

        data: {

          stato: "ESITO_INCERTO",

          ultimoErrore:

            "Elaborazione interrotta: verificare l'esito.",

          prossimoTentativo: null,

          bloccataFinoAl: null,

        },

      });

      statistiche.incerte++;

    }

  }

  return statistiche;

}
