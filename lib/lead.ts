export const STATI_LEAD = [
  "Nuovo",
  "Da Contattare",
  "Raccolta Info",
  "In Lavorazione",
  "Chiuso",
] as const;

export type StatoLead = (typeof STATI_LEAD)[number];

export function isStatoLead(value: string): value is StatoLead {
  return (STATI_LEAD as readonly string[]).includes(value);
}

export function statoStyle(stato: string) {
  switch (stato) {
    case "Nuovo":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "Da Contattare":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "Raccolta Info":
      return "bg-violet-50 text-violet-800 ring-violet-200";
    case "In Lavorazione":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "Chiuso":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}
