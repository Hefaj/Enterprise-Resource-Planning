import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiProgressBar } from '@taiga-ui/kit';
import { ErpTranslatePipe, translatableErrorCode } from '@erp/shared/ui';
import {
  JobRecord,
  jobProgressPercent,
  jobStatusKind,
  JobStatusKind,
  parseJobErrorsSummary,
} from '@erp/notification/util';
import { JOB_KEYS } from '../translation';

/**
 * Wiersz zadania masowego — komponent czysto prezentacyjny.
 *
 * Dostaje gotowy `JobRecord` (ten sam kształt, niezależnie od tego, czy pochodzi z repliki
 * serwera, czy z optymistycznego wpisu orkiestratora) i sam wylicza z niego wszystko, co widać.
 * Zero wstrzykiwanych serwisów, zero wywołań API — dzięki temu ten sam wiersz obsługuje
 * i popover pod dzwonkiem, i pełną historię zadań.
 */
@Component({
  selector: 'erp-job-item',
  standalone: true,
  imports: [TuiButton, TuiIcon, TuiProgressBar, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-3 px-3 py-2.5 w-full items-start">
      <tui-icon
        [icon]="icon()"
        class="mt-0.5 shrink-0"
        [style.color]="'var(' + accentVariable() + ')'"
      />

      <div class="flex flex-col gap-1 min-w-0 grow">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-sm font-medium truncate" [style.color]="'var(--tui-text-primary)'">
            {{ title() | erpTranslate }}
          </span>
          <span class="text-xs shrink-0" [style.color]="'var(--tui-text-tertiary)'">
            {{ createdAtLabel() }}
          </span>
        </div>

        <span class="text-xs" [style.color]="'var(' + accentVariable() + ')'">
          {{ statusKey() | erpTranslate }}
          @if (countsLabel(); as counts) {
            <span [style.color]="'var(--tui-text-tertiary)'"> · {{ counts | erpTranslate }}</span>
          }
        </span>

        @if (!job().isComplete) {
          <!-- TaigaUI stylizuje natywny progress; brak wartości (dopóki replika serwera
               nie poda liczby elementów) daje pasek nieokreślony, i o to chodzi. -->
          <progress
            tuiProgressBar
            size="xs"
            class="mt-0.5"
            [max]="100"
            [value]="progressPercent()"
          ></progress>
        }

        @if (errors().length > 0) {
          <ul class="flex flex-col gap-0.5 mt-0.5" [style.color]="'var(--tui-status-negative)'">
            @for (error of errors(); track error.code) {
              <!-- Surowy kod zostaje w tooltipie: użytkownik czyta zdanie, a support ma po czym
                   szukać w logach, nawet gdy tłumaczenie zostanie później przeredagowane. -->
              <li class="text-xs break-words" [attr.title]="error.code">
                {{ error.label | erpTranslate }}
                @if (error.count > 1) {
                  <span [style.color]="'var(--tui-text-tertiary)'">
                    {{ { key: keys.errorCount, params: { count: error.count } } | erpTranslate }}
                  </span>
                }
              </li>
            }
          </ul>
        }

        <!-- Akcja pojawia się wyłącznie wtedy, gdy rodzic potwierdził, że ma czym ją obsłużyć
             (wejście canDownload) — przycisk, który nie ma co zrobić, jest gorszy niż jego brak. -->
        @if (canDownload()) {
          <button
            tuiButton
            type="button"
            appearance="flat"
            size="xs"
            class="self-start mt-1"
            iconStart="@tui.download"
            [disabled]="downloading()"
            (click)="downloadRequested.emit(job())"
          >
            {{ keys.download | erpTranslate }}
          </button>
        }
      </div>
    </div>
  `,
})
export class ErpJobItemComponent {
  public readonly job = input.required<JobRecord>();

  /**
   * Czy pokazać akcję pobrania. Decyduje RODZIC, nie ten komponent: to on wie, czy
   * `ErpJobResultRegistry` ma resolwer dla tego typu komendy i czy artefakt nie wygasł.
   * Wiersz zadania zostaje w ten sposób nadal czysto prezentacyjny — używa go i popover
   * pod dzwonkiem, i pełna historia.
   */
  public readonly canDownload = input(false);

  /** Trwa pobieranie — blokuje przycisk, żeby jedno kliknięcie nie zamieniło się w pięć. */
  public readonly downloading = input(false);

  public readonly downloadRequested = output<JobRecord>();

  protected readonly keys = JOB_KEYS;

  protected readonly kind = computed<JobStatusKind>(() => jobStatusKind(this.job()));

  /** `null` (brak atrybutu `value`) = pasek nieokreślony — patrz `jobProgressPercent`. */
  protected readonly progressPercent = computed(() => jobProgressPercent(this.job()));

  /**
   * Opis zadania: klucz tłumaczenia nadany przez moduł zlecający (przeżywa odświeżenie strony,
   * bo backend przechowuje go w `uiMetadata`), a gdy go brak — techniczna nazwa typu komendy.
   * Dopiero gdy nie ma ani jednego, ani drugiego, wchodzi ogólne „Operacja masowa”.
   */
  protected readonly title = computed(() => {
    const job = this.job();
    return job.meta?.commandName ?? job.commandType ?? JOB_KEYS.unknownCommand;
  });

  /**
   * Podsumowanie błędów rozłożone na czytelne zdania.
   *
   * Backend przysyła zagregowane kody (`"multimedia_still_referenced: 1"`), bo nie zna języka
   * użytkownika — zamiana kodu na tekst należy do frontu i idzie przez scope `shared`, jedyny
   * widoczny zarówno tutaj, jak i w module, który zlecił zadanie. Kod bez tłumaczenia zostaje
   * pokazany dosłownie: nowa reguła domenowa trafia do backendu wcześniej niż jej opis.
   */
  protected readonly errors = computed(() =>
    parseJobErrorsSummary(this.job().errorsSummary).map(entry => ({
      ...entry,
      label: translatableErrorCode(entry.code),
    }))
  );

  protected readonly statusKey = computed(() => {
    const job = this.job();

    // Zakończone, ale bez rozstrzygniętego statusu — sygnał z kanału `jobs` wyprzedził
    // dociągnięcie dokładnego stanu z API. Osobny komunikat zamiast zgadywania wyniku.
    if (job.isComplete && (job.status === 'pending' || job.status === 'running')) {
      return JOB_KEYS.status.finishing;
    }

    return JOB_KEYS.status[job.status];
  });

  protected readonly countsLabel = computed(() => {
    const job = this.job();
    if (job.totalCount <= 0) {
      return null;
    }

    return {
      key: JOB_KEYS.progress,
      params: { done: job.succeededCount + job.failedCount, total: job.totalCount },
    };
  });

  protected readonly icon = computed(() => {
    switch (this.kind()) {
      case 'success':
        return '@tui.circle-check';
      case 'warning':
        return '@tui.triangle-alert';
      case 'error':
        return '@tui.circle-x';
      case 'neutral':
        return '@tui.circle-dot';
      default:
        return '@tui.loader';
    }
  });

  /** Zmienna motywu TaigaUI sterująca kolorem ikony i etykiety statusu. */
  protected readonly accentVariable = computed(() => {
    switch (this.kind()) {
      case 'success':
        return '--tui-status-positive';
      case 'warning':
        return '--tui-status-warning';
      case 'error':
        return '--tui-status-negative';
      case 'neutral':
        return '--tui-text-tertiary';
      default:
        return '--tui-status-info';
    }
  });

  protected readonly createdAtLabel = computed(() =>
    this.job().createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  );
}
