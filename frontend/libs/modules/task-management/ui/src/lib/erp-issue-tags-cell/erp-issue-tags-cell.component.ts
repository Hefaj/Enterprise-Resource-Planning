import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ErpTagChipItem, ErpTagChipsComponent } from '../erp-tag-chips';

/** Wiersz musi nieść tylko `tagUuids` — komórka nie zna reszty kształtu `IssueVM`. */
export interface ErpIssueTagsCellRow {
  readonly tagUuids?: readonly string[];
}

/**
 * Komórka „tagi" tabeli zgłoszeń — chipsy (`erp-tag-chips`) zamiast tekstowej listy nazw
 * oddzielonych przecinkiem (`docs/modules/task-management/screens.md` §9.2/§10). Nazwę tagu
 * rozwiązuje `getTagName`, statyczna funkcja przekazana przez `cellInputs` — komórka sama nie
 * zna orkiestratora tagów.
 */
@Component({
  selector: 'erp-issue-tags-cell',
  standalone: true,
  imports: [ErpTagChipsComponent],
  template: `<erp-tag-chips [config]="{ items: _items(), size: 'xs' }" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpIssueTagsCellComponent {
  public readonly row = input.required<ErpIssueTagsCellRow>();
  public readonly getTagName = input.required<(uuid: string) => string | undefined>();

  protected readonly _items = computed<ErpTagChipItem[]>(() => {
    const resolve = this.getTagName();

    return (this.row().tagUuids ?? [])
      .map((uuid) => resolve(uuid))
      .filter((name): name is string => !!name)
      .map((name) => ({ value: name, label: name, translate: false, appearance: 'neutral' as const }));
  });
}
