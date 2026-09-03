import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { JobRecord, JobService } from '@erp/shared/data-access';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { ErpJobItemComponent, JOB_KEYS } from '@erp/notification/ui';
import { JobFeedService } from '@erp/notification/data-access';
import { JobDownloadService } from '../../../job-download.service';
import { JOBS_ROUTE, JOB_POPOVER_LIMIT } from '@erp/notification/util';

/**
 * Lista zadań masowych pokazywana pod przyciskiem zadań (`erp-tasks`) w nagłówku klienta.
 *
 * To jedyny komponent, który host pobiera z remota `notification` dla widżetu zadań — ładowany
 * leniwie przez `loadJobListComponent()` z kontraktu, dopiero gdy użytkownik pierwszy raz kliknie
 * przycisk (patrz `entry.widgets.ts`). Host zna wyłącznie licznik z `JobService`; cała reszta
 * wiedzy o zadaniach zostaje po stronie tego modułu.
 *
 * Dane czyta z `JobService`, a nie wprost z orkiestratora, bo w tym store'u zadania z serwera
 * są już scalone z wpisami optymistycznymi zarejestrowanymi w chwili wysłania komendy.
 */
@Component({
  selector: 'erp-job-list',
  standalone: true,
  imports: [RouterLink, TuiButton, ErpJobItemComponent, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full" style="min-width: 22rem; max-width: 26rem;">
      @if (hasFinished()) {
        <header
          class="flex items-center gap-1 px-2 pt-2 flex-shrink-0"
          style="border-bottom: 1px solid var(--tui-border-normal);"
        >
          <span class="flex-1"></span>
          <button tuiButton type="button" appearance="flat" size="xs" class="mb-2" (click)="clearFinished()">
            {{ keys.clearFinished | erpTranslate }}
          </button>
        </header>
      }

      @if (visibleJobs().length === 0) {
        <p class="px-3 py-6 text-sm text-center flex-shrink-0" style="color: var(--tui-text-tertiary);">
          {{ keys.empty | erpTranslate }}
        </p>
      } @else {
        <div class="flex flex-col overflow-y-auto flex-shrink-0" style="max-height: 17rem;">
          @for (job of visibleJobs(); track job.trackingID) {
            <erp-job-item
              [job]="job"
              [canDownload]="downloads.canDownload(job)"
              [downloading]="downloads.isDownloading(job)"
              (downloadRequested)="download($event)"
            />
          }
        </div>
      }

      <footer class="px-3 py-2 flex-shrink-0" style="border-top: 1px solid var(--tui-border-normal);">
        <a
          tuiButton
          appearance="flat"
          size="s"
          [routerLink]="historyRoute()"
          (click)="closeRequested.emit()"
        >
          {{ keys.showAll | erpTranslate }}
        </a>
      </footer>
    </div>
  `,
})
export class JobListComponent implements OnInit {
  private readonly _jobService = inject(JobService);
  private readonly _feed = inject(JobFeedService);

  protected readonly downloads = inject(JobDownloadService);

  /**
   * Trasa pełnej historii. Domyślnie adres remota zamontowanego w hoście; aplikacja remota
   * uruchomiona samodzielnie w dev montuje własne trasy w korzeniu, więc podaje `/jobs`.
   */
  public readonly historyRoute = input<string>(`/notification/${JOBS_ROUTE}`);

  /** Ile pozycji pokazać, zanim odeślemy użytkownika do pełnej historii. */
  public readonly limit = input<number>(JOB_POPOVER_LIMIT);

  /** Prośba o zamknięcie popovera — host decyduje, jak go zamknąć. */
  public readonly closeRequested = output<void>();

  protected readonly keys = JOB_KEYS;

  protected readonly visibleJobs = computed(() => this._jobService.jobs().slice(0, this.limit()));

  protected readonly hasFinished = computed(() =>
    this._jobService.jobs().some(job => job.isComplete),
  );

  public ngOnInit(): void {
    // Idempotentne — host woła to samo przy starcie, żeby licznik przy przycisku był poprawny
    // jeszcze zanim ktokolwiek otworzy listę. Tutaj jest siatką bezpieczeństwa dla trybu,
    // w którym remote działa samodzielnie i nikt bootstrapu nie wywołał.
    void this._feed.bootstrap();
  }

  protected download(job: JobRecord): void {
    void this.downloads.download(job);
  }

  /**
   * Czyści WYŁĄCZNIE lokalny store — na serwerze zadania zostają i widać je w historii.
   * Zadania z artefaktem są z tego wyłączone: „Wyczyść" przy pozycji z przyciskiem „Pobierz"
   * czyta się jak „skasuj plik", a nim nie jest.
   */
  protected clearFinished(): void {
    this._jobService.clearFinished(job => this.downloads.canDownload(job));
  }
}
