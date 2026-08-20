import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { RoleVM, UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../../../translation';
import { RoleHoldersTabStore } from './role-holders-tab.store';

/** Ilu użytkowników pobieramy na jedną zaznaczoną rolę — panel jest dowodem zasięgu, nie eksportem. */
const HOLDERS_PER_ROLE_LIMIT = 200;

/** Wiersz — użytkownik mający bezpośrednio jedną z zaznaczonych ról. */
interface RoleHolderRow {
  readonly roleUuid: string;
  readonly user: UserVM;
}

/**
 * Zakładka „Kto ma tę rolę" — posiadacze WSZYSTKICH zaznaczonych ról w JEDNEJ tabeli,
 * pogrupowani po roli (patrz `docs/frontend/pages.md` §6). Filtr `roleUuid` jest BEZPOŚREDNI
 * (nie przez hierarchię) — patrz `docs/backend/identity-authz.md`.
 */
@Component({
  selector: 'erp-identity-role-holders-tab',
  standalone: true,
  imports: [CommonModule, ErpTableComponent, ErpEmptyStateComponent],
  providers: [RoleHoldersTabStore],
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
export class RoleHoldersTabComponent {
  private readonly _tabStore = inject(RoleHoldersTabStore);
  private readonly _orchestrator = inject(UserOrchestrator);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly roles = this._tabStore.roles;

  /** UUID posiadaczy per rola — dociągane osobnym zapytaniem, bo to nie jest pole `RoleVM`. */
  private readonly _holderUuidsByRole = signal<Record<string, string[]>>({});
  private readonly _loading = signal<boolean>(false);

  protected readonly rows = computed<RoleHolderRow[]>(() => {
    const byRole = this._holderUuidsByRole();
    const vmMap = this._orchestrator.getViewModel()();

    return this.roles().flatMap((role) =>
      (byRole[role.uuid] ?? [])
        .map((uuid) => vmMap.get(uuid))
        .filter((user): user is UserVM => user !== undefined)
        .map((user) => ({ roleUuid: role.uuid, user })),
    );
  });

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: ROLES_KEYS.detail.emptySelection,
  };

  protected readonly tableConfig = computed<ErpTableConfig<RoleHolderRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<RoleHolderRow>>((table) =>
      table
        .setStateKey('identity-roles-holders-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.roleUuid}:${r.user.uuid}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setLoading(this._loading())
        .setSelectionMode('none')
        .setEmptyMessage(ROLES_KEYS.detail.holders.emptyMessage)
        .addColumn((c) =>
          c
            .setId('email')
            .setAccessorFn((row: RoleHolderRow) => row.user.email)
            .setHeader(ROLES_KEYS.detail.holders.columns.email)
            .setSize(240),
        )
        .addColumn((c) =>
          c
            .setId('displayName')
            .setAccessorFn((row: RoleHolderRow) => row.user.displayName)
            .setHeader(ROLES_KEYS.detail.holders.columns.displayName)
            .setSize(220),
        )
        .setGroupedRows<RoleVM>((g) =>
          g
            .setGroups(this.roles)
            .setGetGroupKey((r) => r.uuid)
            .setGetRowGroupKey((r: RoleHolderRow) => r.roleUuid)
            .setGetGroupTitle((r) => r.name ?? r.code)
            .setGetGroupSubtitle((r) => r.code)
            .setGetGroupIcon(() => '@tui.users')
            .setDefaultExpanded(true),
        ),
    ),
  );

  public constructor() {
    // Jedno zapytanie na zaznaczoną rolę, tylko dla ról, których jeszcze nie pobraliśmy.
    effect(() => {
      const uuids = this._tabStore.visibleRoleUuids();
      untracked(() => void this._load(uuids));
    });
  }

  private async _load(roleUuids: readonly string[]): Promise<void> {
    const missing = roleUuids.filter((uuid) => !(uuid in this._holderUuidsByRole()));
    if (missing.length === 0) return;

    this._loading.set(true);
    try {
      const results = await Promise.all(
        missing.map(async (roleUuid) => {
          // `autoLoad` — patrz komentarz w `PermissionHoldersTabComponent`.
          const response = await this._orchestrator.searchAsync(
            { roleUuid, page: 1, pageSize: HOLDERS_PER_ROLE_LIMIT },
            { autoLoad: true },
          );
          return [roleUuid, response.uuids ?? []] as const;
        }),
      );
      this._holderUuidsByRole.update((current) => ({ ...current, ...Object.fromEntries(results) }));
    } catch (err) {
      console.error('[RoleHoldersTabComponent] Nie udało się pobrać listy użytkowników z rolą.', err);
    } finally {
      this._loading.set(false);
    }
  }
}
