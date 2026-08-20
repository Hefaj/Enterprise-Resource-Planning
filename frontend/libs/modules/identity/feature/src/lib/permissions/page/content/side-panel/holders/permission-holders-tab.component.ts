import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { PermissionCatalogVM, UserOrchestrator, UserVM } from '@erp/identity/data-access';

import { PERMISSIONS_KEYS } from '../../../../translation';
import { PermissionHoldersTabStore } from './permission-holders-tab.store';

/** Ilu posiadaczy pobieramy na jedno zaznaczone uprawnienie — panel jest dowodem, nie eksportem. */
const HOLDERS_PER_PERMISSION_LIMIT = 200;

/** Wiersz — użytkownik mający jedno z zaznaczonych uprawnień. */
interface PermissionHolderRow {
  readonly code: string;
  readonly user: UserVM;
}

/**
 * Prawy panel strony `/identity/permissions` — „kto ma uprawnienie" dla WSZYSTKICH zaznaczonych
 * kodów w JEDNEJ tabeli, pogrupowanej po uprawnieniu (patrz `docs/frontend/pages.md` §6).
 *
 * Filtr `SearchUserAccountRequest.PermissionCode` jest EFEKTYWNY (przez całą hierarchię ról) —
 * w odróżnieniu od filtra `roleUuid` na stronie Ról tu chodzi o pełny obraz „kto realnie może",
 * nie o to, co da się bezpośrednio odebrać z jednego miejsca.
 */
@Component({
  selector: 'erp-identity-permission-holders-tab',
  standalone: true,
  imports: [CommonModule, ErpTableComponent, ErpTranslatePipe, ErpEmptyStateComponent],
  providers: [PermissionHoldersTabStore],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-2 p-3">
      @if (scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else {
        <p class="hint">{{ PERMISSIONS_KEYS.holders.hint | erpTranslate }}</p>
        <div class="flex-1 min-h-0">
          <erp-table class="block h-full w-full" [config]="tableConfig()" />
        </div>
      }
    </div>
  `,
  styles: [
    `
      .hint {
        margin: 0;
        color: var(--tui-text-tertiary);
        font-size: 0.75rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionHoldersTabComponent {
  protected readonly PERMISSIONS_KEYS = PERMISSIONS_KEYS;

  private readonly _tabStore = inject(PermissionHoldersTabStore);
  private readonly _orchestrator = inject(UserOrchestrator);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly permissions = this._tabStore.permissions;

  private readonly _holderUuidsByCode = signal<Record<string, string[]>>({});
  private readonly _loading = signal<boolean>(false);

  protected readonly rows = computed<PermissionHolderRow[]>(() => {
    const byCode = this._holderUuidsByCode();
    const vmMap = this._orchestrator.getViewModel()();

    return this.permissions().flatMap((permission) =>
      (byCode[permission.code] ?? [])
        .map((uuid) => vmMap.get(uuid))
        .filter((user): user is UserVM => user !== undefined)
        .map((user) => ({ code: permission.code, user })),
    );
  });

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: PERMISSIONS_KEYS.holders.emptySelection,
  };

  protected readonly tableConfig = computed<ErpTableConfig<PermissionHolderRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<PermissionHolderRow>>((table) =>
      table
        .setStateKey('identity-permissions-holders-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.code}:${r.user.uuid}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setLoading(this._loading())
        .setSelectionMode('none')
        .setEmptyMessage(PERMISSIONS_KEYS.holders.emptyMessage)
        .addColumn((c) =>
          c
            .setId('email')
            .setAccessorFn((row: PermissionHolderRow) => row.user.email)
            .setHeader(PERMISSIONS_KEYS.holders.columns.email)
            .setSize(240),
        )
        .addColumn((c) =>
          c
            .setId('displayName')
            .setAccessorFn((row: PermissionHolderRow) => row.user.displayName)
            .setHeader(PERMISSIONS_KEYS.holders.columns.displayName)
            .setSize(220),
        )
        .setGroupedRows<PermissionCatalogVM>((g) =>
          g
            .setGroups(this.permissions)
            .setGetGroupKey((p) => p.code)
            .setGetRowGroupKey((r: PermissionHolderRow) => r.code)
            .setGetGroupTitle((p) => p.code)
            .setGetGroupSubtitle((p) => p.module)
            .setGetGroupIcon(() => '@tui.key')
            .setDefaultExpanded(true),
        ),
    ),
  );

  public constructor() {
    // Jedno zapytanie na zaznaczone uprawnienie, tylko dla kodów jeszcze niepobranych.
    effect(() => {
      const codes = this._tabStore.visiblePermissionCodes();
      untracked(() => void this._load(codes));
    });
  }

  private async _load(codes: readonly string[]): Promise<void> {
    const missing = codes.filter((code) => !(code in this._holderUuidsByCode()));
    if (missing.length === 0) return;

    this._loading.set(true);
    try {
      const results = await Promise.all(
        missing.map(async (code) => {
          // `autoLoad` — samo `searchAsync` zwraca WYŁĄCZNIE uuidy; bez tego modele widoku
          // nigdy nie trafiają do identity-mapy i tabela pokazuje same nagłówki grup.
          const response = await this._orchestrator.searchAsync(
            { permissionCode: code, page: 1, pageSize: HOLDERS_PER_PERMISSION_LIMIT },
            { autoLoad: true },
          );
          return [code, response.uuids ?? []] as const;
        }),
      );
      this._holderUuidsByCode.update((current) => ({ ...current, ...Object.fromEntries(results) }));
    } catch (err) {
      console.error('[PermissionHoldersTabComponent] Nie udało się pobrać listy posiadaczy.', err);
    } finally {
      this._loading.set(false);
    }
  }
}
