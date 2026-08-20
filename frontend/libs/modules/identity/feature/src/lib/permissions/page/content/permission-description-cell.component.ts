import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { PermissionCatalogVM } from '@erp/identity/data-access';

/**
 * Komórka opisu uprawnienia. `descriptionKey` to KLUCZ tłumaczenia (katalog jest definiowany
 * w kodzie backendu, patrz `docs/backend/identity-authz.md` §3), więc musi przejść przez
 * `erpTranslate` — zwykła kolumna z akcesorem pokazałaby surowy klucz.
 */
@Component({
  selector: 'erp-identity-permission-description-cell',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `<span class="truncate">{{ row().descriptionKey | erpTranslate }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionDescriptionCellComponent {
  public readonly row = input.required<PermissionCatalogVM>();
}
