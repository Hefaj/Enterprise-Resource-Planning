import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { JobService } from '@erp/shared/data-access';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { ErpJobItemComponent, JOB_KEYS } from '@erp/notification/ui';
import { JobFeedService } from '@erp/notification/data-access';
import { JOB_HISTORY_PAGE_SIZE } from '@erp/notification/util';

type HistoryFilter = 'all' | 'active' | 'finished';

/**
 * Pełna historia zadań masowych tej karty przeglądarki — cel linku „Zobacz wszystkie”
 * z popovera pod dzwonkiem.
 *
 * W przeciwieństwie do popovera odpytuje serwer z jawnym filtrem, więc pokazuje też zadania
 * starsze niż początkowa porcja feedu. Wynik i tak ląduje w tym samym store'rze
 * (`JobService`), bo `JobFeedService` przepisuje tam cache orkiestratora — dzięki temu
 * powrót na dzwonek nie gubi tego, co użytkownik przed chwilą dociągnął.
 */
@Component({
  selector: 'erp-job-history',
  standalone: true,
  imports: [TuiButton, TuiLoader, ErpJobItemComponent, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 p-4 h-full overflow-hidden">
      <header class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex flex-col gap-0.5">
          <h1 class="text-lg font-semibold" style="color: var(--tui-text-primary);">
            {{ keys.history.title | erpTranslate }}
          </h1>
          <span class="text-xs" style="color: var(--tui-text-tertiary);">
            {{ { key: keys.history.summary, params: { count: totalCount() } } | erpTranslate }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          @for (option of filterOptions; track option.value) {
            <button
              tuiButton
              type="button"
              size="s"
              [appearance]="filter() === option.value ? 'primary' : 'flat'"
              (click)="setFilter(option.value)"
            >
              {{ option.label | erpTranslate }}
            </button>
          }

          <button tuiButton type="button" size="s" appearance="flat" (click)="reload()">
            {{ keys.history.refresh | erpTranslate }}
          </button>
        </div>
      </header>

      <tui-loader [loading]="isLoading()" class="grow overflow-hidden">
        @if (jobs().length === 0) {
          <p class="py-10 text-sm text-center" style="color: var(--tui-text-tertiary);">
            {{ keys.history.empty | erpTranslate }}
          </p>
        } @else {
          <div
            class="flex flex-col h-full overflow-y-auto rounded-lg"
            style="border: 1px solid var(--tui-border-normal);"
          >
            @for (job of jobs(); track job.trackingID) {
              <erp-job-item [job]="job" />
            }
          </div>
        }
      </tui-loader>
    </section>
  `,
  host: {
    style: 'display: block; height: 100%; overflow: hidden;',
  },
})
export class JobHistoryComponent implements OnInit {
  private readonly _jobService = inject(JobService);
  private readonly _feed = inject(JobFeedService);

  protected readonly keys = JOB_KEYS;
  protected readonly filter = signal<HistoryFilter>('all');

  protected readonly filterOptions: readonly { value: HistoryFilter; label: string }[] = [
    { value: 'all', label: JOB_KEYS.history.filter.all },
    { value: 'active', label: JOB_KEYS.history.filter.active },
    { value: 'finished', label: JOB_KEYS.history.filter.finished },
  ];

  protected readonly isLoading = this._feed.isLoading;
  protected readonly totalCount = this._feed.totalCount;

  /**
   * Filtrowanie po stronie klienta jest tu celowe MIMO wysłania filtra do serwera: store
   * trzyma również zadania zlecone przed chwilą (wpisy optymistyczne), których zapytanie
   * nie zwróciło, bo replika jeszcze nie dojechała. Bez tego zadanie znikałoby z listy
   * na kilkaset milisekund zaraz po zleceniu.
   */
  protected readonly jobs = computed(() => {
    const all = this._jobService.jobs();
    switch (this.filter()) {
      case 'active':
        return all.filter(job => !job.isComplete);
      case 'finished':
        return all.filter(job => job.isComplete);
      default:
        return all;
    }
  });

  public ngOnInit(): void {
    void this.reload();
  }

  protected setFilter(value: HistoryFilter): void {
    this.filter.set(value);
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const filter = this.filter();

    await this._feed.reload({
      pageSize: JOB_HISTORY_PAGE_SIZE,
      isComplete: filter === 'all' ? undefined : filter === 'finished',
    });
  }
}
