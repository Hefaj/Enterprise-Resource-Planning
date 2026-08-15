import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { JobVM } from '@erp/notification/data-access';
import { JOB_KEYS } from '@erp/notification/ui';

/**
 * Komórka opisu zadania — komponent, a nie `cellRichContent`, bo opis jest KLUCZEM
 * tłumaczenia (`meta.commandName` nadane przez moduł zlecający), a `lines[].text`
 * w tabeli renderuje się dosłownie, bez przejścia przez Transloco.
 *
 * Kolejność źródeł jest ta sama co w `erp-job-item`: klucz z metadanych → techniczna nazwa
 * typu komendy z backendu → ogólne „Operacja masowa".
 */
@Component({
  selector: 'erp-job-command-cell',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    <div class="flex flex-col min-w-0">
      <span class="truncate" [style.color]="'var(--tui-text-primary)'">{{ title() | erpTranslate }}</span>
      <span class="truncate text-xs" [style.color]="'var(--tui-text-tertiary)'">{{ row().trackingID }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCommandCellComponent {
  public readonly row = input.required<JobVM>();

  protected readonly title = computed(() => {
    const job = this.row();
    return job.meta?.commandName ?? job.commandType ?? JOB_KEYS.unknownCommand;
  });
}
