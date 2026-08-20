import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpModalService,
  ErpSelectionScopeBannerBuilder,
  ErpSelectionScopeBannerComponent,
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { IdentityConfirmDialogService } from '@erp/identity/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { GRANT_USER_PERMISSION_MODAL_ID } from '@erp/identity/util';
import { USERS_KEYS } from '../../../../translation';
import { UserPermissionGrantRow, UserPermissionsTabStore } from './user-permissions-tab.store';

/**
 * Zakładka „Uprawnienia bezpośrednie" — nadania WSZYSTKICH zaznaczonych użytkowników w JEDNEJ
 * tabeli, pogrupowane po użytkowniku (patrz `docs/frontend/pages.md` §6). Uprawnienia
 * bezpośrednie to wyjątek z powodem, nie równoprawna ścieżka obok ról — patrz
 * `docs/backend/identity-authz.md` §2.
 *
 * Odbieranie nadania jest akcją zaznaczenia w toolbarze, nie przyciskiem w komórce wiersza
 * (`docs/frontend/pages.md` §10) — dzięki temu podlega bramkowaniu po uprawnieniach i zasięgu.
 */
@Component({
  selector: 'erp-identity-user-permissions-tab',
  standalone: true,
  imports: [
    CommonModule,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpTableComponent,
    ErpEmptyStateComponent,
    ErpSelectionScopeBannerComponent,
  ],
  providers: [UserPermissionsTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else if (resolving()) {
        <erp-empty-state [config]="resolvingConfig" />
      } @else {
        <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
          <erp-action-toolbar [config]="actionToolbar" />
          <erp-selection-scope-banner [config]="scopeBannerConfig" />
          <div class="flex-1 min-h-0">
            <erp-table class="block h-full w-full" [config]="tableConfig()" />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPermissionsTabComponent {
  private readonly _tabStore = inject(UserPermissionsTabStore);
  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(IdentityConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly resolving = this._tabStore.resolving;

  protected readonly users = this._tabStore.users;

  /** Wszystkie nadania widocznych użytkowników — jedna wspólna, płaska lista wierszy. */
  protected readonly rows = computed<UserPermissionGrantRow[]>(() =>
    this.users().flatMap((user) => (user.permissionGrants ?? []).map((grant) => ({ userUuid: user.uuid, grant }))),
  );

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage));

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

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-user-permissions-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('permissions')
          .setLabel(USERS_KEYS.detail.tabs.permissions)
          .setIcon('@tui.key')
          .addAction((a) =>
            a
              .setId('grant-permission')
              .setLabel(USERS_KEYS.commands.grantPermission.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openGrantModal()),
          ),
      )
      .addSelectionGroup((g) =>
        g
          .setId('permission-selection')
          .setLabel(USERS_KEYS.detail.permissions.revokeAction)
          .setIcon('@tui.trash-2')
          .addAction((a) =>
            a
              .setId('revoke-permission')
              .setLabel(USERS_KEYS.detail.permissions.revokeAction)
              .setIcon('@tui.trash-2')
              .setAppearance('warning')
              .setScopes(['explicit'])
              .setUnavailableHint(USERS_KEYS.detail.selectionScope.rowSelectionUnavailable)
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._onRevokeSelected()),
          ),
      )
      .setSelectionCount(this._tabStore.selectedChildrenCount)
      .setSelectionScope(this._tabStore.scopeKind)
      .setSelectionLabel(USERS_KEYS.detail.tabs.permissions)
      .setOnClearSelection(() => this._tabStore.clearChildSelection())
      .setPinnedActionIds(['grant-permission']),
  );

  protected readonly tableConfig = computed<ErpTableConfig<UserPermissionGrantRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<UserPermissionGrantRow>>((table) =>
      table
        .setStateKey('identity-users-permissions-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.userUuid}:${r.grant.permissionCode}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setSelectionMode(this.canManage() && this._tabStore.canSelectChildren() ? 'multi' : 'none')
        .setOnSelectionChange((state: ErpSelectionState<UserPermissionGrantRow>) =>
          this._tabStore.setSelectedChildren(state.selectedItems ?? []),
        )
        .setEmptyMessage(USERS_KEYS.detail.permissions.emptyMessage)
        .addColumn((c) =>
          c
            .setId('permissionCode')
            .setAccessorFn((row: UserPermissionGrantRow) => row.grant.permissionCode)
            .setHeader(USERS_KEYS.detail.permissions.columns.permissionCode)
            .setSize(240),
        )
        .addColumn((c) =>
          c
            .setId('reason')
            .setAccessorFn((row: UserPermissionGrantRow) => row.grant.reason)
            .setHeader(USERS_KEYS.detail.permissions.columns.reason)
            .setSize(260),
        )
        .addColumn((c) =>
          c
            .setId('grantedAt')
            .setAccessorFn((row: UserPermissionGrantRow) => row.grant.grantedAt)
            .setHeader(USERS_KEYS.detail.permissions.columns.grantedAt)
            .setSize(160)
            .setGrow(0)
            .setCellFormatter((value: Date) => (value ? new Date(value).toLocaleDateString() : '—')),
        )
        .setGroupedRows<UserVM>((g) =>
          g
            .setGroups(this.users)
            .setGetGroupKey((u) => u.uuid)
            .setGetRowGroupKey((r: UserPermissionGrantRow) => r.userUuid)
            .setGetGroupTitle((u) => u.displayName ?? u.email)
            .setGetGroupSubtitle((u) => u.email)
            .setGetGroupIcon(() => '@tui.user')
            .setDefaultExpanded(true),
        ),
    ),
  );

  /** Modal nadania uprawnienia adresuje CAŁY zasięg — nie tylko widoczną próbkę. */
  private _openGrantModal(): void {
    const targets = this._tabStore.batchTargets();
    this._modalService.open(GRANT_USER_PERMISSION_MODAL_ID, {
      targetUuids: targets.targetUuids,
      targetFilter: targets.targetFilter,
      targetCount: this._tabStore.scopeCount(),
    });
  }

  private _onRevokeSelected(): void {
    const pairs = Object.entries(this._tabStore.selectedPermissionsByUser()).flatMap(([userUuid, codes]) =>
      codes.map((permissionCode) => ({ userUuid, permissionCode })),
    );
    if (pairs.length === 0) return;

    this._confirm
      .confirm({
        title: USERS_KEYS.detail.permissions.revokeConfirmTitle,
        message: USERS_KEYS.detail.permissions.revokeConfirmMessage,
        yes: USERS_KEYS.detail.permissions.revokeConfirmYes,
        no: USERS_KEYS.detail.permissions.revokeConfirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        Promise.all(
          pairs.map(({ userUuid, permissionCode }) =>
            this._orchestrator.revokePermissionAsync({ uuid: userUuid, permissionCode }),
          ),
        )
          .then(() => this._tabStore.clearChildSelection())
          .catch((err) => console.error('[UserPermissionsTabComponent] Nie udało się odebrać uprawnienia.', err));
      });
  }
}
