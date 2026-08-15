import { JobRecord, JobStatus } from '@erp/shared/data-access';

/**
 * Re-eksport kształtu zadania dla warstwy `ui` tego modułu.
 *
 * Komponenty prezentacyjne (`erp-job-item`) potrzebują tego typu, ale `type:ui` nie może
 * zależeć od `type:data-access` — a `type:util` może. Re-eksport samego TYPU (zero kodu
 * w runtime) jest tu właściwym seamem: „tak wygląda zadanie z punktu widzenia tego modułu”.
 * Gdyby `JobRecord` miał kiedyś zyskać pola specyficzne dla notification, to jest miejsce,
 * w którym powstałby jego lokalny wariant.
 */
export type { JobRecord, JobStatus };

/**
 * Kod liczbowy statusu → status tekstowy używany przez frontend.
 *
 * Backend wystawia `NotificationJobStatus` jako liczbę (Microsoft.AspNetCore.OpenApi serializuje
 * enum bez nazw, więc NSwag generuje `status: number`), a kolejność wartości jest jawnie
 * udokumentowana jako część kontraktu — patrz
 * `backend/modules/Notification/Notification.Domain/Aggregates/Jobs/NotificationJobStatus.cs`.
 * To jedyne miejsce we froncie, które zna te liczby; dalej w górę idzie już tylko `JobStatus`.
 */
const STATUS_BY_CODE: readonly JobStatus[] = [
  'pending',
  'running',
  'completed',
  'completedWithErrors',
  'failed',
  'cancelled',
];

export function toJobStatus(code: number | null | undefined): JobStatus {
  // Nieznany kod (nowszy backend niż front) traktujemy jak „w toku”, nie jak błąd —
  // zadanie o nieznanym statusie nie jest zadaniem, które zawiodło.
  return STATUS_BY_CODE[code ?? 0] ?? 'running';
}

/**
 * Rodzaj wizualny wiersza — sterowanie kolorem, ikoną i kluczem tłumaczenia w jednym miejscu,
 * zamiast rozsianych po szablonach warunków na `status` i liczniki.
 */
export type JobStatusKind = 'active' | 'success' | 'warning' | 'error' | 'neutral';

export function jobStatusKind(job: JobRecord): JobStatusKind {
  // `isComplete` bez rozstrzygniętego statusu to okno między sygnałem z kanału `jobs`
  // a dociągnięciem dokładnego stanu z API — świadomie neutralne, żeby nie migać
  // zielonym „gotowe” przy zadaniu, które zaraz okaże się nieudane.
  if (job.isComplete && (job.status === 'pending' || job.status === 'running')) {
    return 'neutral';
  }

  switch (job.status) {
    case 'completed':
      return 'success';
    case 'completedWithErrors':
      return 'warning';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'neutral';
    default:
      return 'active';
  }
}

/**
 * Postęp w procentach (0–100).
 *
 * Zwraca `null`, gdy liczba elementów nie jest jeszcze znana — dotyczy wpisu optymistycznego,
 * zarejestrowanego zanim replika serwera dojdzie przez RabbitMQ. UI rysuje wtedy pasek
 * nieokreślony zamiast fałszywego zera.
 */
export function jobProgressPercent(job: JobRecord): number | null {
  if (job.totalCount <= 0) {
    return job.isComplete ? 100 : null;
  }

  const done = job.succeededCount + job.failedCount;
  return Math.min(100, Math.round((done / job.totalCount) * 100));
}

/** Czy zadanie warto pokazywać z paskiem postępu (trwa i zna swój rozmiar). */
export function isJobInProgress(job: JobRecord): boolean {
  return !job.isComplete;
}
