import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';

import { ErpReportPivotRow } from './erp-report-pivot-label-cell.types';

/**
 * Komórka „etykieta" spłaszczonej tabeli przestawnej — grupa (dział) dostaje przycisk
 * rozwijania (dostępny klawiaturą, `aria-expanded`), liść (zagadnienie) zwykły wcięty tekst.
 *
 * <p>Wiersz grupy niesie też liczby (godziny per okres, suma) przez zwykłe kolumny tabeli —
 * ta komórka odpowiada wyłącznie za pierwszą kolumnę, żeby `erp-table` mógł wyrenderować
 * pivot jako zwykłe wiersze klienckie zamiast osobnego mechanizmu grupowania, który nie
 * przenosi liczb w wierszu rodzica.</p>
 */
@Component({
  selector: 'erp-report-pivot-label-cell',
  standalone: true,
  imports: [TuiIcon],
  template: `
    @let current = row();
    @if (current.kind === 'group') {
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-medium"
        [attr.aria-expanded]="expanded()"
        (click)="onToggle()(current)"
      >
        <tui-icon [icon]="expanded() ? '@tui.chevron-down' : '@tui.chevron-right'" />
        <span>{{ current.code }} — {{ current.name }}</span>
      </button>
    } @else {
      <span class="pl-6 text-[var(--tui-text-secondary)]">{{ current.key }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpReportPivotLabelCellComponent {
  public readonly row = input.required<ErpReportPivotRow>();
  public readonly isExpanded = input.required<(row: ErpReportPivotRow) => boolean>();
  public readonly onToggle = input.required<(row: ErpReportPivotRow) => void>();

  protected readonly expanded = computed(() => this.isExpanded()(this.row()));
}
