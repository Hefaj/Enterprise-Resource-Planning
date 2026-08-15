import { DestroyRef, Injectable, effect, inject, signal, Signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs/operators';
import { JobService, SignalrSyncService, getOrCreateClientId } from '@erp/shared/data-access';
import {
  JOB_FEED_PAGE_SIZE,
  JOB_HISTORY_PAGE_SIZE,
  JOB_ARRIVAL_DEBOUNCE_MS,
  NOTIFICATION_JOB_SIGNATURE,
} from '@erp/notification/util';
import { NotificationJobOrchestrator } from './notification-job.orchestrator';
import { JobVM } from './job.view-model';

/**
 * Spina replikę zadań z serwera ze store'em feedu w `@erp/shared/data-access`.
 *
 * <b>Po co osobny serwis.</b> `JobService` (shared) jest tylko magazynem — musi żyć w `shared`,
 * bo czyta z niego dzwonek w shellu hosta, który nie może statycznie importować remota.
 * `NotificationJobOrchestrator` z kolei zna API i SignalR, ale nic nie wie o feedzie w nagłówku.
 * Ten serwis jest jedynym miejscem, w którym te dwa światy się spotykają: pobiera zadania
 * tej karty przeglądarki i utrzymuje store w zgodzie z tym, co orkiestrator ma w cache.
 *
 * <b>Dlaczego to działa w czasie rzeczywistym bez dodatkowego kodu.</b> Orkiestrator subskrybuje
 * sygnaturę `notification.job`; każda zmiana repliki (przyjęcie zadania, postęp, zakończenie)
 * generuje po stronie backendu `AggregateChanged` ze skanu ChangeTrackera, więc orkiestrator
 * sam dociąga świeży stan do cache. Efekt poniżej tylko przepisuje ten cache do store'u.
 */
@Injectable({ providedIn: 'root' })
export class JobFeedService {
  private readonly _orchestrator = inject(NotificationJobOrchestrator);
  private readonly _jobService = inject(JobService);
  private readonly _signalrSync = inject(SignalrSyncService);
  private readonly _destroyRef = inject(DestroyRef);

  /** Cache orkiestratora — jedna instancja computed, bo `getViewModel()` tworzy nową na każde wywołanie. */
  private readonly _viewModels = this._orchestrator.getViewModel();

  private readonly _bootstrapped = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _totalCount = signal(0);

  /** Czy trwa pobieranie historii z serwera. */
  public readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();

  /** Ile zadań tej karty zna serwer — mianownik paginacji na widoku historii. */
  public readonly totalCount: Signal<number> = this._totalCount.asReadonly();

  public constructor() {
    // Cache orkiestratora → store feedu. Bez `untracked` wokół zapisu efekt czytałby
    // sygnały zapisywane wewnątrz `JobService` i sam się retriggerował.
    effect(() => {
      const viewModels = [...this._viewModels().values()];
      if (viewModels.length === 0) {
        return;
      }

      untracked(() => this._jobService.upsertFromServer(viewModels as JobVM[]));
    });

    this._watchForNewJobs();
  }

  /**
   * Dociąga zadania, o których orkiestrator jeszcze nie wie.
   *
   * `BaseOrchestrator` świadomie odświeża wyłącznie agregaty obecne w swoim cache — inaczej
   * każda przeglądarka ładowałaby każdy agregat, o którym cokolwiek usłyszała. Dla feedu
   * powiadomień to jednak za mało: NOWE zadanie z definicji nie jest w cache, więc bez tego
   * pojawiłoby się dopiero po przeładowaniu strony.
   *
   * Reakcją na nieznany identyfikator jest ponowne `searchJob` z filtrem po `clientId`,
   * a NIE pobranie tego konkretnego zadania. Kanał `notification.job` jest wspólny dla
   * wszystkich klientów (grupa `agg:{sygnatura}`), więc lecą po nim także cudze zadania —
   * pobieranie ich po uuid zaśmiecałoby cache danymi, których i tak nie wolno pokazać.
   * Zapytanie z filtrem zwraca wyłącznie nasze.
   *
   * <b>„Nieznane" mierzy się cache'em ORKIESTRATORA, nie store'em feedu.</b> Zadanie zlecone
   * z tej karty trafia do `JobService` optymistycznie (`addJob`) w chwili odpowiedzi API —
   * gdyby pytać store'a, własne zadanie byłoby od razu „znane", więc nigdy nie zostałoby
   * dociągnięte do orkiestratora. A bez wpisu w orkiestratorze `BaseOrchestrator` ignoruje
   * kolejne zdarzenia dla tego uuid (odświeża tylko to, co ma w cache) i status stoi na
   * `pending` aż do przeładowania strony.
   *
   * Debounce zbija serię zdarzeń (postęp kolejnych chunków, ruch innych klientów) do jednego
   * zapytania — bez niego ruchliwy system generowałby zapytanie na każde zdarzenie.
   */
  private _watchForNewJobs(): void {
    this._signalrSync
      .onUpdate(NOTIFICATION_JOB_SIGNATURE)
      .pipe(
        filter(uuids => uuids.some(uuid => !this._viewModels().has(uuid))),
        debounceTime(JOB_ARRIVAL_DEBOUNCE_MS),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => {
        void this.reload({ pageSize: JOB_FEED_PAGE_SIZE });
      });
  }

  /**
   * Ładuje początkową porcję zadań tej karty przeglądarki. Idempotentne — wołane przy starcie
   * aplikacji z kontraktu remota, a przy nawigacji na widok historii może zostać wywołane
   * ponownie bez skutków ubocznych.
   */
  public async bootstrap(): Promise<void> {
    if (this._bootstrapped()) {
      return;
    }
    this._bootstrapped.set(true);

    await this.reload({ pageSize: JOB_FEED_PAGE_SIZE });
  }

  /**
   * Pobiera stronę historii zadań tej karty.
   *
   * Filtrujemy po `clientId`, nie po użytkowniku: dopóki backend nie ma uwierzytelniania,
   * identyfikator karty jest jedynym adresatem, jakiego zadanie faktycznie ma (patrz
   * `getOrCreateClientId` i `ExecutionContextMiddleware`). Gdy pojawi się JWT, zmienia się
   * tu jeden filtr, a nie kształt feedu.
   */
  public async reload(options?: {
    page?: number;
    pageSize?: number;
    isComplete?: boolean;
  }): Promise<void> {
    this._isLoading.set(true);

    try {
      const response = await this._orchestrator.searchAsync({
        clientId: getOrCreateClientId(),
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? JOB_HISTORY_PAGE_SIZE,
        isComplete: options?.isComplete,
        sorts: [{ field: 'createdAt', order: -1 }],
      });

      this._totalCount.set(response.totalCount ?? 0);
    } catch {
      // Błąd trafił już do `errors` orkiestratora — feed powiadomień nie może z tego powodu
      // przewrócić aplikacji ani wyczyścić tego, co użytkownik już widzi.
    } finally {
      this._isLoading.set(false);
    }
  }
}
