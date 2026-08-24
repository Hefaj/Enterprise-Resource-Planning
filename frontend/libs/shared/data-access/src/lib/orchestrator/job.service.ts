import { Injectable, signal, computed, Signal, inject } from '@angular/core';
import { JobRecord, JobMeta } from './orchestrator.types';
import { SignalrSyncService } from '../sync/signalr-sync.service';

/** Klucz w localStorage z momentem ostatniego otwarcia listy powiadomień. */
const LAST_SEEN_STORAGE_KEY = 'erp_jobs_last_seen_at';

/**
 * Store feedu zadań masowych — jedno miejsce, z którego czytają zarówno dzwonek w nagłówku
 * hosta, jak i lista powiadomień ładowana z remota `notification`.
 *
 * <b>Dlaczego mieszka w `shared`, a nie w module notification.</b> Dzwonek stoi w shellu
 * (`scope:host`) i musi znać licznik, zanim ktokolwiek kliknie i pociągnie zdalny komponent.
 * Gdyby store żył w `@erp/notification/data-access`, host musiałby go zaimportować statycznie,
 * co przy Native Federation oznacza wciągnięcie remota do bundla hosta.
 *
 * <b>Dwa źródła zasilania, celowo.</b>
 * 1. Orkiestratory rejestrują zadanie {@link addJob} w chwili, gdy API zwróci `jobUuid` —
 *    wpis pojawia się natychmiast, zanim zdarzenie przejdzie przez outbox i RabbitMQ.
 * 2. `JobFeedService` z modułu notification wpycha tu stan z repliki serwera
 *    ({@link upsertFromServer}) — dzięki temu feed przeżywa odświeżenie strony i pokazuje
 *    zadania zlecone wcześniej.
 *
 * Scalanie po `trackingID` jest tu kluczowe: to ten sam identyfikator w obu ścieżkach
 * (`BatchResult.JobUuid` = `JobDto.uuid`), więc wpis optymistyczny nie duplikuje się
 * z rekordem z serwera, tylko zostaje przez niego nadpisany.
 *
 * Zdarzenia SignalR z kanału `jobs` niosą trackingID zakończonych zadań i służą wyłącznie
 * jako szybka ścieżka („już po”), zanim orkiestrator pobierze dokładny stan.
 */
@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly _signalrSync = inject(SignalrSyncService);
  private readonly _jobs = signal(new Map<string, JobRecord>());
  private readonly _lastSeenAt = signal<number>(readLastSeenAt());

  public constructor() {
    // JobService jest root-singletonem żyjącym całą sesję — subskrypcja grupy 'jobs' na hubie
    // nigdy nie jest zwalniana (brak odpowiadającego `unsubscribe`), co jest tu poprawne.
    // `onUpdate` sam w sobie nie ma już efektu ubocznego (patrz SignalrSyncService) — trzeba
    // jawnie zarejestrować zainteresowanie.
    this._signalrSync.subscribe('jobs');

    this._signalrSync.onUpdate('jobs').subscribe(trackingIDs => {
      this._jobs.update(jobs => {
        const updated = new Map(jobs);
        for (const trackingID of trackingIDs) {
          const existing = updated.get(trackingID);
          if (!existing || existing.isComplete) {
            continue;
          }

          // Świadomie NIE zgadujemy tu statusu końcowego. Kanał `jobs` niesie sam fakt
          // zakończenia, bez informacji, czy wszystko się powiodło — ustawienie
          // `status: 'completed'` byłoby zmyśleniem sukcesu dla zadania, które poległo.
          // Dokładny stan dojdzie chwilę później przez `upsertFromServer`.
          updated.set(trackingID, {
            ...existing,
            isComplete: true,
            changedAt: Date.now(),
          });
        }
        return updated;
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  // API Odczytu
  // ────────────────────────────────────────────────────────────────

  /** Wszystkie znane zadania, najnowsze pierwsze. */
  public readonly jobs: Signal<JobRecord[]> = computed(() =>
    [...this._jobs().values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  );

  /** Zadania jeszcze nieukończone — to one napędzają wskaźnik aktywności przy dzwonku. */
  public readonly activeJobs: Signal<JobRecord[]> = computed(() =>
    this.jobs().filter(job => !job.isComplete),
  );

  public readonly activeCount: Signal<number> = computed(() => this.activeJobs().length);

  /**
   * Liczba zadań, które zmieniły stan po ostatnim otwarciu listy powiadomień.
   *
   * Stan „przeczytane” jest w całości kliencki: backend nie ma endpointu oznaczania
   * powiadomień jako przeczytanych (i celowo nie zwraca już pola `unRead`, które zawsze
   * kłamało `true`). Znacznik czasu w localStorage jest tu wystarczający — jest wspólny
   * dla kart tej samej przeglądarki, co odpowiada temu, jak użytkownik myśli o „widziałem to”.
   */
  public readonly unreadCount: Signal<number> = computed(() => {
    const lastSeenAt = this._lastSeenAt();
    return this.jobs().filter(job => job.changedAt > lastSeenAt).length;
  });

  /** Czy wśród znanych zadań jest jakiekolwiek zakończone niepowodzeniem. */
  public readonly hasFailures: Signal<boolean> = computed(() =>
    this.jobs().some(job => job.failedCount > 0 || job.status === 'failed'),
  );

  /** Reaktywny sygnał dla konkretnego zadania po trackingID. */
  public getJob(trackingID: string): Signal<JobRecord | undefined> {
    return computed(() => this._jobs().get(trackingID));
  }

  /** Wszystkie zadania wywołane przez konkretny modal (queueID). */
  public getJobsByQueueID(queueID: string): Signal<JobRecord[]> {
    return computed(() => this.jobs().filter(job => job.queueID === queueID));
  }

  // ────────────────────────────────────────────────────────────────
  // API Zapisu
  // ────────────────────────────────────────────────────────────────

  /**
   * Rejestruje zadanie zaraz po tym, jak endpoint operacji masowej zwrócił `jobUuid`.
   * Wpis jest optymistyczny — liczniki są jeszcze nieznane i zostaną uzupełnione,
   * gdy replika serwera dojdzie przez {@link upsertFromServer}.
   */
  public addJob(trackingID: string, queueID?: string, meta?: JobMeta): void {
    if (!trackingID) {
      return;
    }

    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.set(trackingID, {
        trackingID,
        queueID: queueID ?? null,
        meta: meta ?? null,
        status: 'pending',
        totalCount: 0,
        succeededCount: 0,
        failedCount: 0,
        isComplete: false,
        createdAt: meta?.timestamp ?? new Date(),
        changedAt: Date.now(),
        optimistic: true,
      });
      return updated;
    });
  }

  /**
   * Wpycha stan z repliki serwera. Rekord z serwera jest źródłem prawdy dla wszystkiego
   * poza `meta`: wpis optymistyczny mógł nieść metadane, których backend nie zna
   * (starsze zadanie zlecone, zanim front zaczął wysyłać `uiMetadata`), więc lokalna
   * wartość zostaje, gdy serwer nie ma własnej.
   */
  public upsertFromServer(records: readonly JobRecord[]): void {
    if (records.length === 0) {
      return;
    }

    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      for (const record of records) {
        const existing = updated.get(record.trackingID);
        const changed = !existing || hasMeaningfulChange(existing, record);

        updated.set(record.trackingID, {
          ...record,
          meta: record.meta ?? existing?.meta ?? null,
          optimistic: false,
          changedAt: changed ? Date.now() : (existing?.changedAt ?? Date.now()),
        });
      }
      return updated;
    });
  }

  /** Oznacza cały feed jako przejrzany — wołane, gdy użytkownik otworzy listę powiadomień. */
  public markAllSeen(): void {
    const now = Date.now();
    this._lastSeenAt.set(now);
    try {
      localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(now));
    } catch {
      // Prywatny tryb przeglądarki albo zapełniony storage — licznik zresetuje się
      // przy następnym starcie sesji, ale nic poza tym się nie psuje.
    }
  }

  /** Usuwa zadanie ze śledzenia. */
  public removeJob(trackingID: string): void {
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.delete(trackingID);
      return updated;
    });
  }

  /**
   * Czyści zakończone zadania z lokalnego feedu (nie usuwa ich z historii na serwerze).
   *
   * @param keep Opcjonalny predykat chroniący wybrane zadania przed usunięciem z feedu.
   * Istnieje dla zadań, które zostawiły po sobie artefakt: „Wyczyść" przy pozycji z przyciskiem
   * „Pobierz" czyta się jak „skasuj plik", a nim nie jest — plik zostaje w magazynie do
   * `expireOn` niezależnie od tego, co użytkownik zrobi z listą powiadomień.
   */
  public clearFinished(keep?: (job: JobRecord) => boolean): void {
    this._jobs.update(jobs => {
      const updated = new Map<string, JobRecord>();
      for (const [trackingID, job] of jobs) {
        if (!job.isComplete || keep?.(job)) {
          updated.set(trackingID, job);
        }
      }
      return updated;
    });
  }
}

/**
 * Czy rekord z serwera niesie zmianę, którą użytkownik powinien zauważyć.
 *
 * Bez tego sprawdzenia każde przeładowanie feedu (np. resync po reconnect) odświeżałoby
 * `changedAt` wszystkich zadań i zapalało licznik nieprzeczytanych dla rzeczy, które
 * użytkownik już widział.
 */
function hasMeaningfulChange(previous: JobRecord, next: JobRecord): boolean {
  return previous.status !== next.status
    || previous.isComplete !== next.isComplete
    || previous.succeededCount !== next.succeededCount
    || previous.failedCount !== next.failedCount;
}

function readLastSeenAt(): number {
  try {
    const raw = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}
