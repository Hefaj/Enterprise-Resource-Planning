import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { RoleOrchestrator, RoleVM } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../../../translation';
import { RoleContainersTabStore } from './role-containers-tab.store';

/** Wiersz — rola-kontener zawierająca zaznaczoną rolę jako składową. */
interface RoleContainerRow {
  readonly roleUuid: string;
  readonly container: RoleVM;
}

/**
 * Zakładka „Zawarta w" — role-kontenery WSZYSTKICH zaznaczonych ról w JEDNEJ tabeli,
 * pogrupowane po zaznaczonej roli (patrz `docs/guides/frontend/pages.md` §6). Odwrotny kierunek DAG,
 * tylko do odczytu: dodawanie/usuwanie idzie z poziomu roli-kontenera (zakładka „Role składowe"),
 * nie stąd — patrz `RoleOrchestrator.getContainerRoles()`.
 */
@Component({
  selector: 'erp-identity-role-containers-tab',
  standalone: true,
  imports: [CommonModule, ErpTableComponent, ErpEmptyStateComponent],
  providers: [RoleContainersTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else {
        <erp-table class="block h-full w-full" [config]="tableConfig()" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleContainersTabComponent {
  private readonly _tabStore = inject(RoleContainersTabStore);
  private readonly _orchestrator = inject(RoleOrchestrator);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly roles = this._tabStore.roles;

  protected readonly rows = computed<RoleContainerRow[]>(() =>
    this.roles().flatMap((role) =>
      this._orchestrator.getContainerRoles(role.uuid).map((container) => ({ roleUuid: role.uuid, container })),
    ),
  );

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: ROLES_KEYS.detail.emptySelection,
  };

  protected readonly tableConfig = computed<ErpTableConfig<RoleContainerRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<RoleContainerRow>>((table) =>
      table
        .setStateKey('identity-roles-containers-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.roleUuid}:${r.container.uuid}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setSelectionMode('none')
        .setEmptyMessage(ROLES_KEYS.detail.containers.emptyMessage)
        .addColumn((c) =>
          c
            .setId('code')
            .setAccessorFn((row: RoleContainerRow) => row.container.code)
            .setHeader(ROLES_KEYS.detail.containers.columns.code)
            .setSize(200),
        )
        .addColumn((c) =>
          c
            .setId('name')
            .setAccessorFn((row: RoleContainerRow) => row.container.name)
            .setHeader(ROLES_KEYS.detail.containers.columns.name)
            .setSize(220),
        )
        .setGroupedRows<RoleVM>((g) =>
          g
            .setGroups(this.roles)
            .setGetGroupKey((r) => r.uuid)
            .setGetRowGroupKey((r: RoleContainerRow) => r.roleUuid)
            .setGetGroupTitle((r) => r.name ?? r.code)
            .setGetGroupSubtitle((r) => r.code)
            .setGetGroupIcon(() => '@tui.arrow-up')
            .setDefaultExpanded(true),
        ),
    ),
  );
}
