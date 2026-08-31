import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IssueVM } from '@erp/task-management/data-access';
import { ErpIssueKeyComponent } from '@erp/task-management/ui';

/**
 * Komórka „klucz" tabeli zgłoszeń — `erp-issue-key` (klucz + ikona typu) z wcięciem
 * w trybie drzewa (`LNK-006`). Wcięcie liczy `getLevel`, przekazane statycznie przez
 * `cellInputs` przy budowie kolumny — poziom zależy od pozycji wiersza na całej stronie,
 * nie od samej wartości komórki.
 *
 * <p><b>Wyszarzenie poza filtrem (`LNK-006` AC2)</b>: w trybie drzewa backend dosyła CAŁE
 * poddrzewo pasujących korzeni, niezależnie od reszty filtrów — inaczej drzewo z wyciętymi
 * gałęziami kłamałoby o strukturze. `matchesFilter`, tak samo statycznie przekazane, mówi
 * komórce, czy dany wiersz sam spełnia aktywny filtr, czy jest tu wyłącznie dla ciągłości
 * drzewa — widoczny, ale wyróżniony, nigdy ukryty.</p>
 */
@Component({
  selector: 'erp-task-management-issue-key-cell',
  standalone: true,
  imports: [ErpIssueKeyComponent],
  template: `
    <div class="flex items-center" [style.padding-left.px]="this.indent()" [class.opacity-40]="!this.matches()">
      <erp-issue-key
        [config]="{
          issueKey: this.row().key,
          typeIcon: this.row().typeIcon,
          typeName: this.row().typeName,
          link: ['/task-management/issue', this.row().key],
        }"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueKeyCellComponent {
  public readonly row = input.required<IssueVM>();

  public readonly getLevel = input<((row: IssueVM) => number) | undefined>(undefined);

  /** `undefined` = poza trybem drzewa albo brak wiedzy o dopasowaniu — wiersz zostaje pełny. */
  public readonly matchesFilter = input<((row: IssueVM) => boolean) | undefined>(undefined);

  protected readonly indent = computed(() => (this.getLevel()?.(this.row()) ?? 0) * 16);

  protected readonly matches = computed(() => this.matchesFilter()?.(this.row()) ?? true);
}
