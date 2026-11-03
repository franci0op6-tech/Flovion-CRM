import "server-only";

import type { TipoNotificaTask } from "@prisma/client";

type InvioParams = {
  destinatario: string;
  tipo: TipoNotificaTask;
  taskId: number;
  nomeCliente: string;
  descrizione: string;
  scadenza: Date;
};

export type RisultatoInvioWhatsApp =
  | { stato: "DISABILITATO"; motivo: string }
  | { stato: "ACCETTATO"; messaggioProviderId: string }
  | { stato: "RIFIUTATO"; codiceHttp: number; motivo: string }
  | { stato: "ESITO_INCERTO"; motivo: string };

function getNomeTemplate(tipo: TipoNotificaTask): string | undefined {
  switch (tipo) {
    case "ASSEGNAZIONE": return process.env.WHATSAPP_TEMPLATE_ASSEGNAZIONE;
    case "GIORNO_SCADENZA": return process.env.WHATSAPP_TEMPLATE_GIORNO;
    case "QUINDICI_MINUTI_PRIMA": return process.env.WHATSAPP_TEMPLATE_15_MINUTI;
  }
}

function normalizzaNumero(numero: string): string | null {
  const pulito = numero.replace(/[\s().-]/g, "");
  const senzaPiu = pulito.startsWith("+") ? pulito.slice(1) : pulito;
  return /^[1-9]\d{7,14}$/.test(senzaPiu) ? senzaPiu : null;
}

function valoreTesto(testo: string, max: number): string {
  const risultato = testo.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return risultato.slice(0, max) || "Attività nel CRM";
}

function configurazioneInvio() {
  if (process.env.WHATSAPP_INVIO_ABILITATO !== "true") return null;
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const versione = process.env.WHATSAPP_GRAPH_VERSION || "v26.0";
  const lingua = process.env.WHATSAPP_TEMPLATE_LINGUA || "it";
  if (!token || !phoneId || !/^\d+$/.test(phoneId) || !/^v\d+\.\d+$/.test(versione) || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(lingua)) return null;
  return { token, phoneId, versione, lingua };
}

/**
 * Il template 15 minuti deve avere 3 variabili nel BODY:
 * {{1}} nome cliente, {{2}} descrizione, {{3}} ora locale.
 * Deve inoltre avere un pulsante URL dinamico indice 0 con suffisso {{1}} (task ID).
 * I template ASSEGNAZIONE/GIORNO restano statici, come in precedenza.
 */
export async function inviaTemplateWhatsApp({ destinatario, tipo, taskId, nomeCliente, descrizione, scadenza }: InvioParams): Promise<RisultatoInvioWhatsApp> {
  if (process.env.WHATSAPP_INVIO_ABILITATO !== "true") {
    return { stato: "DISABILITATO", motivo: "L'invio WhatsApp non è ancora abilitato." };
  }
  const config = configurazioneInvio();
  if (!config) return { stato: "DISABILITATO", motivo: "Configurazione WhatsApp incompleta." };
  const numero = normalizzaNumero(destinatario);
  if (!numero) return { stato: "RIFIUTATO", codiceHttp: 0, motivo: "Numero del destinatario non valido." };
  const template = getNomeTemplate(tipo);
  if (!template || !/^[a-z0-9_]+$/.test(template)) {
    return { stato: "DISABILITATO", motivo: "Nome del template WhatsApp non configurato." };
  }
  if (!Number.isSafeInteger(taskId) || taskId <= 0 || Number.isNaN(scadenza.getTime())) {
    return { stato: "RIFIUTATO", codiceHttp: 0, motivo: "Dati del task non validi." };
  }
  const components: Array<Record<string, unknown>> = [];
  if (tipo === "QUINDICI_MINUTI_PRIMA") {
    const ora = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(scadenza);
    const testo = (value: string) => ({ type: "text", text: value });
    components.push({
      type: "body",
      parameters: [
        testo(valoreTesto(nomeCliente, 100)),
        testo(valoreTesto(descrizione, 300)),
        testo(ora),
      ],
    });
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [testo(String(taskId))] });
  }
  const body = {
    messaging_product: "whatsapp", recipient_type: "individual", to: numero, type: "template",
    template: { name: template, language: { code: config.lingua }, ...(components.length ? { components } : {}) },
  };
  const url = `https://graph.facebook.com/${config.versione}/${config.phoneId}/messages`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { stato: "ESITO_INCERTO", motivo: "Connessione interrotta: esito del messaggio sconosciuto." };
  }
  if (!response.ok) {
    return { stato: "RIFIUTATO", codiceHttp: response.status, motivo: `Meta ha rifiutato la richiesta (HTTP ${response.status}).` };
  }
  let result: unknown;
  try { result = await response.json(); }
  catch { return { stato: "ESITO_INCERTO", motivo: "Risposta Meta non leggibile." }; }
  if (typeof result !== "object" || result === null || !("messages" in result) || !Array.isArray(result.messages)) {
    return { stato: "ESITO_INCERTO", motivo: "Risposta Meta senza identificativo del messaggio." };
  }
  const item: unknown = result.messages[0];
  if (typeof item !== "object" || item === null || !("id" in item) || typeof item.id !== "string" || !item.id) {
    return { stato: "ESITO_INCERTO", motivo: "Identificativo messaggio Meta non valido." };
  }
  return { stato: "ACCETTATO", messaggioProviderId: item.id };
}
