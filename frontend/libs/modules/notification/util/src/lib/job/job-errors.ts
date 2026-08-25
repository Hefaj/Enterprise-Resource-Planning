/** Jeden kod błędu z podsumowania zadania masowego wraz z liczbą elementów, które go zwróciły. */
export interface JobErrorSummaryEntry {
  /** Surowy kod z backendu, np. `multimedia_still_referenced`. */
  code: string;
  /** Ile elementów zadania odpadło z tym kodem. */
  count: number;
}

/**
 * Rozbiera `job.errorsSummary` na pary kod → liczba.
 *
 * <p>Format (`"code_a: 12; code_b: 3"`, malejąco po liczbie) powstaje w JEDNYM miejscu
 * w backendzie — `BulkCommandRunner.BuildErrorsSummaryAsync` — i stamtąd wędruje bez zmian
 * przez zdarzenie `JobCompleted`, replikę w module Notification i `JobDto`. Dlatego parsowanie
 * po stronie klienta jest bezpieczne; gdyby kiedyś kody miały nieść parametry (np. nazwy
 * kolidujących produktów), właściwą odpowiedzią jest zmiana kontraktu na strukturę, a nie
 * rozbudowa tego parsera.</p>
 *
 * <p>Wpisy, których nie da się rozebrać, są pomijane — podsumowanie jest informacją poboczną
 * i nie ma powodu, żeby jeden nieoczekiwany fragment wywracał całe powiadomienie.</p>
 */
export function parseJobErrorsSummary(summary: string | null | undefined): JobErrorSummaryEntry[] {
  if (!summary) {
    return [];
  }

  const entries: JobErrorSummaryEntry[] = [];

  for (const part of summary.split(';')) {
    const separatorIndex = part.lastIndexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const code = part.slice(0, separatorIndex).trim();
    const count = Number.parseInt(part.slice(separatorIndex + 1).trim(), 10);

    if (code.length > 0 && Number.isFinite(count)) {
      entries.push({ code, count });
    }
  }

  return entries;
}
