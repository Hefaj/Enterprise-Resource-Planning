import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpSelectionScopeBannerBuilder,
  ErpSelectionScopeBannerComponent,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { USERS_KEYS } from '../../../../translation';
import { UserEffectivePermissionsTabStore } from './user-effective-permissions-tab.store';

/** Wiersz — jeden kod uprawnienia jednego z zaznaczonych użytkowników. */
interface EffectivePermissionRow {
  readonly userUuid: string;
  readonly module: string;
  readonly code: string;
}

/**
 * Zakładka „Efektywne uprawnienia" — płaski, tylko-do-odczytu zbiór (bezpośrednie + przez
 * wszystkie role w łańcuchu dziedziczenia) WSZYSTKICH zaznaczonych użytkowników w jednej
 * tabeli, pogrupowany po użytkowniku (patrz `docs/guides/frontend/pages.md` §6).
 *
 * BEZ rozwinięcia „skąd" — backend eksponuje ścieżkę dziedziczenia (`GetMyPermissionSources`)
 * tylko dla `/me` (patrz `docs/architecture/security.md` §9), rozszerzenie na dowolnego
 * użytkownika to osobny przyrost backendowy.
 */
@Component({
  selector: 'erp-identity-user-effective-permissions-tab',
  standalone: true,
  imports: [
    CommonModule,
    ErpTranslatePipe,
    ErpTableComponent,
    ErpEmptyStateComponent,
    ErpSelectionScopeBannerComponent,
  ],
  providers: [UserEffectivePermissionsTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else if (resolving()) {
        <erp-empty-state [config]="resolvingConfig" />
      } @else {
        <div class="flex flex-col h-full w-full gap-2">
          <p class="hint">{{ USERS_KEYS.detail.effective.hint | erpTranslate }}</p>
          <erp-selection-scope-banner [config]="scopeBannerConfig" />
          <div class="flex-1 min-h-0">
            <erp-table class="block h-full w-full" [config]="tableConfig()" />
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .hint {
        margin: 0;
        color: var(--tui-text-tertiary);
        font-size: 0.8rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEffectivePermissionsTabComponent {
  protected readonly USERS_KEYS = USERS_KEYS;

  private readonly _tabStore = inject(UserEffectivePermissionsTabStore);
  private readonly _orchestrator = inject(UserOrchestrator);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly resolving = this._tabStore.resolving;
  protected readonly users = this._tabStore.users;

  protected readonly rows = computed<EffectivePermissionRow[]>(() =>
    this.users().flatMap((user) =>
      this._orchestrator
        .getEffectivePermissions(user.uuid)()
        .map((code) => ({ userUuid: user.uuid, module: code.split('.')[0] ?? code, code }))
        .sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code)),
    ),
  );

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: USERS_KEYS.detail.emptySelection,
  };

  protected readonly resolvingConfig: ErpEmptyStateConfig = {
    icon: '@tui.loader',
    message: USERS_KEYS.detail.selectionScope.resolving,
  };

  protected readonly scopeBannerConfig = ErpSelectionScopeBannerBuilder.create((b) =>
    b
      .setScope(this._tabStore.scope)
      .setShownCount(this._tabStore.shownUserCount)
      .setPreviewTitle(USERS_KEYS.detail.selectionScope.previewTitle)
      .setPreviewDescription(USERS_KEYS.detail.selectionScope.previewDescription)
      .setAllTitle(USERS_KEYS.detail.selectionScope.allTitle),
  );

  protected readonly tableConfig = computed<ErpTableConfig<EffectivePermissionRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<EffectivePermissionRow>>((table) =>
      table
        .setStateKey('identity-users-effective-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.userUuid}:${r.code}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setSelectionMode('none')
        .setEmptyMessage(USERS_KEYS.detail.effective.emptyMessage)
        .addColumn((c) =>
          c.setId('module').setAccessorKey('module').setHeader(USERS_KEYS.detail.effective.columns.module).setSize(160).setGrow(0),
        )
        .addColumn((c) =>
          c.setId('code').setAccessorKey('code').setHeader(USERS_KEYS.detail.effective.columns.code).setSize(280),
        )
        .setGroupedRows<UserVM>((g) =>
          g
            .setGroups(this.users)
            .setGetGroupKey((u) => u.uuid)
            .setGetRowGroupKey((r: EffectivePermissionRow) => r.userUuid)
            .setGetGroupTitle((u) => u.displayName ?? u.email)
            .setGetGroupSubtitle((u) => u.email)
            .setGetGroupIcon(() => '@tui.list-checks')
            .setDefaultExpanded(true),
        ),
    ),
  );

  public constructor() {
    // Efektywne uprawnienia nie są polem `UserVM` — trzeba je dociągnąć per użytkownik.
    // Dociągamy je dla WSZYSTKICH widocznych rodziców (komplet albo próbka), raz na UUID.
    effect(() => {
      const uuids = this._tabStore.visibleUserUuids();
      untracked(() => {
        for (const uuid of uuids) {
          if (this._requested.has(uuid)) continue;
          this._requested.add(uuid);
          void this._orchestrator.loadEffectivePermissionsAsync(uuid);
        }
      });
    });
  }

  private readonly _requested = new Set<string>();
}
