import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ErpButtonComponent } from '../erp-button';
import { ErpButtonConfig } from '../erp-button/erp-button.types';

/**
 * Komórka „akcje wiersza" — kolumna z przyciskami zamiast wartości. Generyczna: nie zna kształtu
 * wiersza, tylko woła `getActions(row)` dostarczone przez wywołującego w `cellInputs`.
 *
 * Zastępuje wzorzec „własna kolumna akcji" powtórzony osobno w kilku tabelach konfiguracyjnych —
 * jedno miejsce zamiast N kopii tego samego `@for (action of row.actions)`.
 */
@Component({
  selector: 'erp-row-actions-cell',
  standalone: true,
  imports: [ErpButtonComponent],
  template: `
    <div class="flex items-center justify-end gap-1">
      @for (action of _actions(); track $index) {
        <erp-button [config]="action" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpRowActionsCellComponent<TRow = unknown> {
  public readonly row = input.required<TRow>();
  public readonly getActions = input.required<(row: TRow) => ErpButtonConfig[]>();

  protected readonly _actions = computed(() => this.getActions()(this.row()));
}
