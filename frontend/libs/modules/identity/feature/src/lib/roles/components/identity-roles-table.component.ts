import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErpTableComponent, ErpTableBuilder, ErpTableConfig, ErpSelectionState } from '@erp/shared/ui';
import { RoleOrchestrator, RoleVM } from '@erp/identity/data-access';

import { ROLES_KEYS } from '../translation';

/** Tabela ról w trybie 'client' — CAŁY zbiór ról jest już w cache orkiestratora (strona ładuje
 * go raz na starcie, patrz `RolesStore`), więc nie ma tu żadnego serwerowego wyszukiwania.
 * Wybór pojedynczego wiersza (radio, `selectionMode: 'single'`), nie klik w wiersz. */
@Component({
  selector: 'erp-identity-roles-table',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `<erp-table
    class="block h-full w-full"
    [config]="tableConfig()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityRolesTableComponent {
  private readonly _orchestrator = inject(RoleOrchestrator);

  public loadingChange = output<boolean>();
  public selectionChange = output<string | null>();

  private readonly _loading = signal<boolean>(true);
  protected readonly items = computed<RoleVM[]>(() => [...this._orchestrator.getViewModel()().values()]);

  public constructor() {
    effect(() => {
      this._loading.set(true);
      this.loadingChange.emit(true);
      this._orchestrator
        .searchAsync({ page: 1, pageSize: 500 })
        .catch((err) => console.error('[IdentityRolesTableComponent] Nie udało się pobrać listy ról.', err))
        .finally(() => {
          this._loading.set(false);
          this.loadingChange.emit(false);
        });
    });
  }

  protected readonly tableConfig = computed<ErpTableConfig<RoleVM>>(() =>
    new ErpTableBuilder<RoleVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.uuid)
      .setItems(this.items)
      .setLoading(this._loading())
      .setSelectionMode('single')
      .setEmptyMessage(ROLES_KEYS.table.emptyMessage)
      .setOnSelectionChange((state: ErpSelectionState<RoleVM>) => this.selectionChange.emit(state.selectedIds[0] ?? null))
      .addColumn((c) => c.setId('code').setAccessorKey('code').setHeader(ROLES_KEYS.table.columns.code).setSize(200))
      .addColumn((c) => c.setId('name').setAccessorKey('name').setHeader(ROLES_KEYS.table.columns.name).setSize(220))
      .addColumn((c) =>
        c
          .setId('isSystem')
          .setAccessorKey('isSystem')
          .setHeader(ROLES_KEYS.table.columns.isSystem)
          .setSize(100)
          .setCellFormatter((value: boolean) => (value ? '✓' : '—')),
      )
      .addColumn((c) =>
        c
          .setId('permissionCount')
          .setAccessorFn((row) => row.permissions?.length ?? 0)
          .setHeader(ROLES_KEYS.table.columns.permissionCount)
          .setEnableSorting(false)
          .setSize(120),
      )
      .addColumn((c) =>
        c
          .setId('memberCount')
          .setAccessorFn((row) => row.memberRoleUuids?.length ?? 0)
          .setHeader(ROLES_KEYS.table.columns.memberCount)
          .setEnableSorting(false)
          .setSize(120),
      )
      .build(),
  );
}
