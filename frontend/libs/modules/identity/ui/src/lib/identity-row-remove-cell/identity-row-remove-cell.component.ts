import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui';

/**
 * Generyczna komórka tabeli z pojedynczym przyciskiem "usuń" (odbierz rolę/uprawnienie,
 * usuń rolę składową...). Sama nie potwierdza ani nie woła API — `onRemove` dostaje cały
 * wiersz i to WYWOŁUJĄCY (komponent zakładki) decyduje, czy pokazać `TUI_CONFIRM` przed
 * wykonaniem komendy. Reużywana we wszystkich tabelach stron Users/Roles zamiast pisania
 * osobnej komórki akcji dla każdej tabeli.
 */
@Component({
  selector: 'erp-identity-row-remove-cell',
  standalone: true,
  imports: [ErpButtonComponent],
  template: `<erp-button [config]="buttonConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityRowRemoveCellComponent<T = unknown> {
  public readonly row = input.required<T>();
  public readonly onRemove = input.required<(row: T) => void | Promise<void>>();

  protected readonly buttonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('icon')
      .setIconStart('@tui.trash-2')
      .setSize('s')
      .setFn(() => this.onRemove()(this.row())),
  );
}
