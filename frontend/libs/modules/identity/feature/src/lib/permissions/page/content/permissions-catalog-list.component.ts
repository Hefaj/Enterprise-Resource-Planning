import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { PermissionCatalogOrchestrator, PermissionCatalogVM } from '@erp/identity/data-access';
import { PermissionDescriptionCellComponent } from './permission-description-cell.component';

import { PermissionsStore } from '../permissions.store';
import { PERMISSIONS_KEYS } from '../../translation';

/** Grupa tabeli — moduł, do którego należy uprawnienie. */
interface ModuleGroup {
  readonly module: string;
}

/**
 * Katalog uprawnień w obszarze `content` — `erp-table` w trybie `client`, grupowana po module,
 * z zaznaczeniem wielokrotnym. Wyszukiwanie (`PermissionsStore.search`, ustawiane przez filtr po
 * lewej) jest klient-side — cały katalog jest już w pamięci, backend celowo nie paginuje
 * (patrz `PermissionCatalogOrchestrator`).
 *
 * Zaznaczenie karmi panel „kto ma uprawnienie" przez `PermissionsStore.scope` — panel pokazuje
 * posiadaczy WSZYSTKICH zaznaczonych uprawnień naraz (patrz `docs/guides/frontend/pages.md` §6).
 */
@Component({
  selector: 'erp-identity-permissions-catalog-list',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 p-2">
      <erp-table class="block h-full w-full" [config]="tableConfig()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsCatalogListComponent {
  protected readonly PERMISSIONS_KEYS = PERMISSIONS_KEYS;
  protected readonly store = inject(PermissionsStore);

  private readonly _orchestrator = inject(PermissionCatalogOrchestrator);

  public constructor() {
    // Katalog nie jest paginowany i nikt inny go na tej stronie nie ładuje — bez tego lista
    // była pusta, dopóki użytkownik nie otworzył modala nadania uprawnienia.
    void this._orchestrator.loadAllAsync().catch((err) =>
      console.error('[PermissionsCatalogListComponent] Nie udało się pobrać katalogu uprawnień.', err),
    );
  }

  protected readonly entries = computed<PermissionCatalogVM[]>(() => {
    const search = this.store.search().trim().toLowerCase();
    const all = [...this._orchestrator.getViewModel()().values()];
    const filtered = search
      ? all.filter((e) => e.code.toLowerCase().includes(search) || e.module.toLowerCase().includes(search))
      : all;

    return filtered.sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code));
  });

  protected readonly groups = computed<ModuleGroup[]>(() =>
    [...new Set(this.entries().map((e) => e.module))].map((module) => ({ module })),
  );

  protected readonly tableConfig = computed<ErpTableConfig<PermissionCatalogVM>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<PermissionCatalogVM>>((table) =>
      table
        .setStateKey('identity-permissions-catalog')
        .setMode('client')
        .setRowIdAccessor((row) => row.code)
        .setItems(this.entries)
        .setSelectionMode('multi')
        .setOnSelectionChange((state: ErpSelectionState<PermissionCatalogVM>) => this.store.setSelection(state))
        .setEmptyMessage(PERMISSIONS_KEYS.emptyMessage)
        .addColumn((c) =>
          c.setId('code').setAccessorKey('code').setHeader(PERMISSIONS_KEYS.columns.code).setSize(280),
        )
        .addColumn((c) =>
          c
            .setId('description')
            .setCell(PermissionDescriptionCellComponent)
            .setHeader(PERMISSIONS_KEYS.columns.description)
            .setEnableSorting(false)
            .setSize(320),
        )
        .addColumn((c) =>
          c
            .setId('obsolete')
            .setAccessorFn((row: PermissionCatalogVM) => (row.isObsolete ? PERMISSIONS_KEYS.obsoleteBadge : ''))
            .setHeader(PERMISSIONS_KEYS.columns.status)
            .setSize(120)
            .setGrow(0),
        )
        .setGroupedRows<ModuleGroup>((g) =>
          g
            .setGroups(this.groups)
            .setGetGroupKey((group) => group.module)
            .setGetRowGroupKey((row: PermissionCatalogVM) => row.module)
            .setGetGroupTitle((group) => group.module)
            .setGetGroupIcon(() => '@tui.key')
            .setDefaultExpanded(true),
        ),
    ),
  );
}
