import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { JobVM } from '@erp/notification/data-access';
import { jobStatusKind, JobStatusKind } from '@erp/notification/util';
import { JOB_KEYS } from '@erp/notification/ui';

/**
 * Komórka statusu — ta sama logika mapowania co w `erp-job-item` (ikona, kolor, klucz
 * tłumaczenia liczone przez `jobStatusKind`), żeby wiersz tabeli i wiersz popovera
 * nie rozjechały się w interpretacji tego samego rekordu.
 */
@Component({
  selector: 'erp-job-status-cell',
  standalone: true,
  imports: [TuiIcon, ErpTranslatePipe],
  template: `
    <span class="inline-flex items-center gap-1.5" [style.color]="'var(' + accentVariable() + ')'">
      <tui-icon [icon]="icon()" class="shrink-0" />
      <span class="truncate">{{ statusKey() | erpTranslate }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobStatusCellComponent {
  public readonly row = input.required<JobVM>();

  protected readonly kind = computed<JobStatusKind>(() => jobStatusKind(this.row()));

  protected readonly statusKey = computed(() => {
    const job = this.row();

    // Zakończone bez rozstrzygniętego statusu — sygnał z kanału `jobs` wyprzedził dociągnięcie
    // dokładnego stanu z API. Osobny komunikat zamiast zgadywania wyniku.
    if (job.isComplete && (job.status === 'pending' || job.status === 'running')) {
      return JOB_KEYS.status.finishing;
    }

    return JOB_KEYS.status[job.status];
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
}
