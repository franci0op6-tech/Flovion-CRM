
/**
 * lib/utils.ts
 *
 * Converte una data inserita in un input datetime-local
 * dall'orario italiano (Europe/Rome) a una data UTC.
 *
 * Funziona indipendentemente dal fuso orario del server.
 */

const TIME_ZONE = "Europe/Rome";

function getLocalParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  function getPart(type: string): number {
    const value = parts.find(
      (part) => part.type === type
    )?.value;

    return Number(value);
  }

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
}

export function parseLocalToUTC(
  localDateTimeString: string
): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(
      localDateTimeString
    );

  if (!match) {
    throw new Error("Formato data non valido.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    year < 100 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Data o ora non valida.");
  }

  // Verifica che la data esista realmente.
  const calendarCheck = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new Error("Data non valida.");
  }

  const localAsUTC = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  );

  /*
   * Cerca gli istanti UTC che corrispondono
   * all'ora locale italiana richiesta.
   *
   * Consideriamo tutti gli offset possibili
   * per Europe/Rome: UTC+1 e UTC+2.
   */
  const possibleDates = [
    new Date(localAsUTC - 60 * 60 * 1000),
    new Date(localAsUTC - 2 * 60 * 60 * 1000),
  ];

  const matches = possibleDates.filter((candidate) => {
    const parts = getLocalParts(candidate);

    return (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    );
  });

  if (matches.length === 0) {
    throw new Error(
      "Questo orario non esiste nel fuso italiano a causa del cambio dell'ora."
    );
  }

  /*
   * Durante il passaggio all'ora solare,
   * alcuni orari si ripetono due volte.
   *
   * Se l'ora è ambigua, scegliamo
   * la prima occorrenza.
   */
  matches.sort(
    (a, b) => a.getTime() - b.getTime()
  );

  return matches[0];
}
