import { Injectable, Injector, Signal, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, firstValueFrom, timeout as rxTimeout, catchError, of } from 'rxjs';

import { JobService } from '../orchestrator/job.service';
import { JobRecord, JobStatus } from '../orchestrator/orchestrator.types';
import { ErpOptimisticOp, OptimisticEntry, OptimisticRollback } from './optimistic.types';

/** Po tym czasie przestajemy czekać na rozstrzygnięcie zadania i zdejmujemy nakładkę CICHO —
 * bez `onRollback`, bez wpisu na `rollbacks$`. Serwer zawsze wygrywa; to jest wyłącznie
 * zabezpieczenie przed nakładką wiszącą w nieskończoność, nie decyzja o wyniku operacji. */
const SETTLE_TIMEOUT_MS = 20_000;

const RESOLVED_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>([
  'completed',
  'completedWithErrors',
  'failed',
  'cancelled',
]);

/**
 * Rejestr globalnych nakładek optymistycznych — patrz `docs/guides/frontend/optimistic-updates.md`.
 *
 * <p><b>Dlaczego to nie jest część `IdentityMapStore`.</b> `_handleFullResync()` robi
 * `identityMap.clear()` na resync po rozłączeniu huba — nakładka MUSI przeżyć to czyszczenie,
 * bo dotyczy operacji, która wciąż trwa niezależnie od tego, co się stało z cache’m. Stąd osobny,
 * globalny (root-singleton) rejestr, kluczowany `(scope, key)`, a nie polem na wpisie
 * `IdentityMapStore`.</p>
 *
 * <p><b>Jak to działa z perspektywy czytającego.</b> `BaseOrchestrator` (agregaty) i
 * `IssueChildCache` (kolekcje dziecięce) przepuszczają DTO/listę przez {@link project} tuż przed
 * zwróceniem jej do UI — nakładka wygrywa z danymi z serwera aż do zdjęcia. Konsument w
 * `feature` nigdy nie odpytuje tego serwisu wprost o wartość; woła najwyżej {@link isPending},
 * żeby np. wyszarzyć wiersz w trakcie zapisu.</p>
 */
@Injectable({ providedIn: 'root' })
export class ErpOptimisticStore {
  private readonly _jobs = inject(JobService);
  private readonly _injector = inject(Injector);

  private static _nextId = 0;

  private readonly _entries = signal<ReadonlyMap<string, readonly OptimisticEntry[]>>(new Map());

  private readonly _rollbacks = new Subject<OptimisticRollback>();

  /** Strumień cofnięć — konsumowany przez `ErpOptimisticRollbackBridge` w hoście, jedyne miejsce
   * widzące naraz `shared/data-access` i `shared/ui`. */
  public readonly rollbacks$: Observable<OptimisticRollback> = this._rollbacks.asObservable();

  // ────────────────────────────────────────────────────────────────
  // Odczyt — czyste, bezpieczne wewnątrz computed()
  // ────────────────────────────────────────────────────────────────

  /**
   * Nakłada wszystkie zarejestrowane nakładki dla `(scope, key)` na `base`, w kolejności
   * zgłoszenia. Bez aktywnej nakładki zwraca `base` bez zmian — funkcja jest więc bezpieczna
   * do wołania zawsze, niezależnie od tego, czy coś akurat trwa.
   */
  public project<T>(scope: string, key: string, base: T | undefined): T | undefined {
    const entries = this._entries().get(compositeKey(scope, key));

    if (!entries || entries.length === 0) {
      return base;
    }

    let value: T | undefined = base;

    for (const entry of entries) {
      value = (entry.op as ErpOptimisticOp<T>).patch(value);
    }

    return value;
  }

  /** Czy dla `(scope, key)` leci choć jedna nierozstrzygnięta nakładka. */
  public isPending(scope: string, key: string): Signal<boolean> {
    const composite = compositeKey(scope, key);
    return computed(() => (this._entries().get(composite)?.length ?? 0) > 0);
  }

  /** Klucze z aktywną nakładką w danym zasięgu — np. do wyszarzenia kart na tablicy w trakcie
   * przeciągnięcia, bez iterowania po pojedynczych uuidach z zewnątrz. */
  public pendingKeys(scope: string): Signal<ReadonlySet<string>> {
    const prefix = `${scope}|`;

    return computed(() => {
      const result = new Set<string>();

      for (const composite of this._entries().keys()) {
        if (composite.startsWith(prefix)) {
          result.add(composite.slice(prefix.length));
        }
      }

      return result;
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Zapis — cykl życia nakładki
  // ────────────────────────────────────────────────────────────────

  /**
   * Uruchamia jedną nakładkę optymistyczną. Kolejność jest istotą mechanizmu:
   *
   * 1. Rejestruje wpis — nakładka jest natychmiast widoczna przez {@link project}.
   * 2. Woła `dispatchAsync()`. Odrzucenie stąd (4xx, pre-check wsadowy) cofa NATYCHMIAST,
   *    bez czekania na zadanie — błąd domenowy w `BulkCommandRunner` nigdy nie dochodzi tą drogą.
   * 3. Czeka reaktywnie na rozstrzygnięcie zadania (`completed` / `completedWithErrors` /
   *    `failed` / `cancelled`) — nie pętlą odpytującą jak `erpAwaitJobAsync`.
   * 4. Sukces (`completed`, `failedCount === 0`) → `settleAsync()` → DOPIERO POTEM zdjęcie
   *    nakładki, żeby stara wartość nie mignęła między zdjęciem a świeżymi danymi.
   * 5. Porażka → `settleAsync()`, zdjęcie nakładki, `onRollback()`, emisja na `rollbacks$`.
   * 6. Bezpiecznik ~20 s → `settleAsync()` + ciche zdjęcie, bez `onRollback` i bez emisji —
   *    zadanie może się jeszcze udać, serwer i tak wygra przez zwykły refetch/realtime.
   */
  public async runAsync<T>(op: ErpOptimisticOp<T>): Promise<void> {
    const id = ErpOptimisticStore._nextId++;
    const composite = compositeKey(op.scope, op.key);

    this._add(composite, { id, op: op as ErpOptimisticOp<unknown> });

    let jobUuid: string;

    try {
      jobUuid = await op.dispatchAsync();
    } catch {
      // Krok 2: rzut z samego HTTP — zadanie nigdy nie powstało, więc nie ma na co czekać.
      this._remove(composite, id);
      op.onRollback?.();
      this._rollbacks.next({ scope: op.scope, key: op.key, failureMessage: op.failureMessage });
      return;
    }

    const outcome = await this._settlementOf(await this.awaitJobAsync(jobUuid));

    try {
      await op.settleAsync();
    } finally {
      this._remove(composite, id);
    }

    if (outcome.kind === 'failed') {
      op.onRollback?.();
      this._rollbacks.next({
        scope: op.scope,
        key: op.key,
        errorsSummary: outcome.errorsSummary,
        failureMessage: op.failureMessage,
      });
    }

    // outcome.kind === 'timeout' | 'succeeded': cicho, bez onRollback i bez emisji.
  }

  /**
   * Czeka reaktywnie (bez pollingu) na status końcowy zadania, z sufitem {@link SETTLE_TIMEOUT_MS}
   * — zwraca `null`, jeśli zadanie nie rozstrzygnęło się w tym czasie. Publiczna, bo przydaje się
   * też poza {@link runAsync}: `BoardStore.dropAsync` wysyła DWIE komendy pod jedną nakładką
   * (zmiana stanu, potem pozycji) i musi poczekać na wynik pierwszej, zanim zdecyduje, czy w ogóle
   * wysłać drugą — bez pętli odpytującej jak stare `erpAwaitJobAsync`.
   *
   * <p>`toObservable` potrzebuje kontekstu wstrzykiwania — store jest root-singletonem, więc
   * łapiemy własny `Injector` w konstruktorze i przekazujemy go jawnie.</p>
   */
  public async awaitJobAsync(jobUuid: string, timeoutMs: number = SETTLE_TIMEOUT_MS): Promise<JobRecord | null> {
    const job$ = toObservable(this._jobs.getJob(jobUuid), { injector: this._injector }).pipe(
      filter((job): job is JobRecord => !!job && RESOLVED_STATUSES.has(job.status)),
    );

    return firstValueFrom(
      job$.pipe(
        rxTimeout(timeoutMs),
        catchError(() => of(null)),
      ),
    );
  }

  private _settlementOf(
    resolved: JobRecord | null,
  ): { kind: 'succeeded' | 'failed'; errorsSummary?: string | null } | { kind: 'timeout' } {
    if (!resolved) {
      return { kind: 'timeout' };
    }

    const succeeded = resolved.status === 'completed' && resolved.failedCount === 0;

    return succeeded
      ? { kind: 'succeeded' }
      : { kind: 'failed', errorsSummary: resolved.errorsSummary };
  }

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: rejestr
  // ────────────────────────────────────────────────────────────────

  private _add(composite: string, entry: OptimisticEntry): void {
    this._entries.update((map) => {
      const next = new Map(map);
      next.set(composite, [...(next.get(composite) ?? []), entry]);
      return next;
    });
  }

  private _remove(composite: string, id: number): void {
    this._entries.update((map) => {
      const existing = map.get(composite);
      if (!existing) {
        return map;
      }

      const filtered = existing.filter((entry) => entry.id !== id);
      const next = new Map(map);

      if (filtered.length === 0) {
        next.delete(composite);
      } else {
        next.set(composite, filtered);
      }

      return next;
    });
  }
}

function compositeKey(scope: string, key: string): string {
  return `${scope}|${key}`;
}
