// lib/utils.ts
export function parseLocalToUTC(localDateTimeString: string): Date {
    if (!localDateTimeString) return new Date();
    return new Date(localDateTimeString);
  }