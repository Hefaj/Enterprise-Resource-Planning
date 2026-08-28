import { JobService } from '@erp/shared/data-access';

/** Co ile sprawdzamy stan zadania. To odczyt sygnału, nie żądanie sieciowe — `JobService`
 * dostaje aktualizacje kanałem `jobs`. */
const POLL_INTERVAL_MS = 200;

/** Po tym czasie przestajemy czekać. Zadanie nadal może się udać; przestajemy tylko blokować
 * na nie interfejs. */
const TIMEOUT_MS = 10_000;

/**
 * Czeka, aż zadanie stojące za komendą się zakończy.
 *
 * <p><b>Po co to w ogóle jest.</b> Każda mutacja w tym systemie wraca z `jobUuid`
 * natychmiast, a wykonuje się później, w `BulkCommandRunner`. Widok, który odświeża dane
 * zaraz po `await`cie komendy, pobiera stan SPRZED własnej zmiany — i wygląda to jak zmiana,
 * która nie weszła. Dotyczy każdego ekranu pokazującego skutek własnej komendy od razu:
 * tablicy i paska powiązań (`docs/frontend/orchestrators.md` §6).</p>
 *
 * <p>Rzuca, gdy zadanie się nie powiodło — wywołujący ma wtedy cofnąć zmianę optymistyczną
 * albo pokazać komunikat. Przekroczenie czasu <b>nie</b> jest błędem: zadanie żyjące dłużej
 * niż dziesięć sekund nadal może się udać, a widok odświeży się zdarzeniem realtime.</p>
 */
export async function erpAwaitJobAsync(jobs: JobService, jobUuid: string): Promise<void> {
  const job = jobs.getJob(jobUuid);
  const attempts = Math.ceil(TIMEOUT_MS / POLL_INTERVAL_MS);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = job()?.status;

    if (status === 'failed' || status === 'completedWithErrors' || status === 'cancelled') {
      throw new Error(`Zadanie ${jobUuid} nie powiodło się (${status}).`);
    }

    if (status === 'completed') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
