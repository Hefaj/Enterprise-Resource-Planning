import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { JobVM } from '@erp/notification/data-access';
import { JOB_KEYS } from '@erp/notification/ui';
import { JobDownloadService } from '../../job-download.service';

/**
 * Komórka z akcją pobrania artefaktu.
 *
 * Ta sama decyzja co w popoverze pod dzwonkiem, świadomie przez ten sam serwis
 * ({@link JobDownloadService}): przycisk pojawia się wyłącznie, gdy zadanie wskazało artefakt,
 * ktoś potrafi ten typ komendy obsłużyć i artefakt nie wygasł. Rozdzielenie tej logiki między
 * tabelę a popover skończyłoby się tym, że w jednym miejscu przycisk jest, a w drugim go nie ma.
 */
@Component({
  selector: 'erp-job-download-cell',
  standalone: true,
  imports: [TuiButton, ErpTranslatePipe],
  template: `
    @if (canDownload()) {
      <button
        tuiButton
        type="button"
        appearance="flat"
        size="xs"
        iconStart="@tui.download"
        [disabled]="downloading()"
        (click)="download()"
      >
        {{ keys.download | erpTranslate }}
      </button>
    } @else {
      <span [style.color]="'var(--tui-text-tertiary)'">—</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDownloadCellComponent {
  public readonly row = input.required<JobVM>();

  private readonly _downloads = inject(JobDownloadService);

  protected readonly keys = JOB_KEYS;

  protected readonly canDownload = computed(() => this._downloads.canDownload(this.row()));

  protected readonly downloading = computed(() => this._downloads.isDownloading(this.row()));

  protected download(): void {
    void this._downloads.download(this.row());
  }
}
