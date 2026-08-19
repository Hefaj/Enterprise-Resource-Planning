import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { UserOrchestrator } from '@erp/identity/data-access';
import { IdentityConfirmDialogService } from '@erp/identity/ui';

import { UsersStore } from './users.store';
import { IdentityUsersTableComponent } from './components/identity-users-table.component';
import { IDENTITY_KEYS } from '../translation';

/** Nagłówek + pasek akcji + tabela listy użytkowników (wybór pojedynczy, radio). Zaznaczenie
 * wiersza ustawia wybranego użytkownika w `UsersStore`, co pokazuje panel zakładek w sąsiednim
 * obszarze siatki (`rightPanel`) — wzorzec identyczny jak `ProductComponent`. */
@Component({
  selector: 'erp-identity-users-content',
  standalone: true,
  imports: [ErpTranslatePipe, ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, IdentityUsersTableComponent],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">{{ IDENTITY_KEYS.users.title | erpTranslate }}</h1>
        <p class="page-subtitle">{{ IDENTITY_KEYS.users.subtitle | erpTranslate }}</p>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-2" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
        <erp-action-toolbar [config]="actionToolbar" />

        <div class="flex-1 min-h-0">
          <erp-identity-users-table
            stateKey="identity-users"
            [filters]="store.filters()"
            (loadingChange)="store.setLoading($event)"
            (selectionChange)="store.selectUser($event)"
          />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page-title { font: var(--tui-typography-heading-h3); margin: 0; }
      .page-subtitle { color: var(--tui-text-secondary); margin: 0; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersContentComponent {
  protected readonly IDENTITY_KEYS = IDENTITY_KEYS;
  protected readonly store = inject(UsersStore);

  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _confirm = inject(IdentityConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  private readonly _selectionCount = computed(() => (this.store.selectedUuid() ? 1 : 0));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-users-toolbar')
      .addSelectionGroup((g) =>
        g
          .setId('user-actions')
          .setLabel(IDENTITY_KEYS.users.detail.forceLogout.label)
          .setIcon('@tui.log-out')
          .addAction((a) =>
            a
              .setId('force-logout')
              .setLabel(IDENTITY_KEYS.users.detail.forceLogout.label)
              .setIcon('@tui.log-out')
              .setAppearance('warning')
              .setHidden(computed(() => !this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage)))
              .setFn(() => this._onForceLogout()),
          ),
      )
      .setSelectionCount(this._selectionCount)
      .setSelectionScope(computed(() => (this.store.selectedUuid() ? 'explicit' : 'none')))
      .setSelectionLabel(IDENTITY_KEYS.users.title)
      .setOnClearSelection(() => this.store.selectUser(null))
      .setPinnedActionIds(['force-logout']),
  );

  private _onForceLogout(): void {
    const uuid = this.store.selectedUuid();
    if (!uuid) return;

    this._confirm
      .confirm({
        title: IDENTITY_KEYS.users.detail.forceLogout.confirmTitle,
        message: IDENTITY_KEYS.users.detail.forceLogout.confirmMessage,
        yes: IDENTITY_KEYS.users.detail.forceLogout.confirmYes,
        no: IDENTITY_KEYS.users.detail.forceLogout.confirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator.forceLogoutAsync(uuid).catch((err) => console.error('[UsersContentComponent] Nie udało się wymusić wylogowania.', err));
      });
  }
}
