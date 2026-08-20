import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErpActionToolbarBuilder, ErpActionToolbarComponent, ErpActionToolbarContextDirective, ErpActionToolbarZoneDirective, ErpModalService, ErpTranslatePipe } from '@erp/shared/ui';
import { IdentityConfirmDialogService } from '@erp/identity/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { RoleOrchestrator } from '@erp/identity/data-access';
import { ADD_ROLE_PERMISSION_MODAL_ID } from '@erp/identity/util';
import { RolesStore } from '../roles.store';
import { ROLES_KEYS } from '../translation';

/** Zakładka "Uprawnienia" panelu szczegółów roli — chipsy `permissions` + dodawanie/usuwanie.
 * Zablokowana dla ról systemowych (`isSystem`) — patrz `RoleSeeder.AdministratorRoleCode`
 * w `docs/backend/identity-authz.md` §7 Faza 2. */
@Component({
  selector: 'erp-identity-role-permissions-tab',
  standalone: true,
  imports: [CommonModule, ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, ErpTranslatePipe],
  template: `
    @if (role(); as r) {
      <div
        class="flex flex-col h-full w-full gap-2 p-2 overflow-y-auto"
        erpActionToolbarZone
        [erpActionToolbarContext]="actionToolbar"
      >
        <erp-action-toolbar [config]="actionToolbar" />

        @if (r.permissions.length === 0) {
          <p class="empty">{{ ROLES_KEYS.detail.permissions.emptyMessage | erpTranslate }}</p>
        }

        <div class="flex flex-wrap gap-1.5">
          @for (code of r.permissions; track code) {
            <span class="chip">
              {{ code }}
              @if (canManage() && !r.isSystem) {
                <button
                  type="button"
                  class="chip-remove"
                  (click)="onRemove(code)"
                >
                  ×
                </button>
              }
            </span>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .empty {
        margin: 0;
        color: var(--tui-text-secondary);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.5rem;
        border-radius: 1rem;
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-primary);
        font-size: 0.75rem;
        border: 1px solid var(--tui-border-normal);
      }
      .chip-remove {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        color: var(--tui-text-tertiary);
        font-size: 0.9rem;
      }
      .chip-remove:hover {
        color: var(--tui-status-negative);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsTabComponent {
  protected readonly ROLES_KEYS = ROLES_KEYS;

  private readonly _store = inject(RolesStore);
  private readonly _orchestrator = inject(RoleOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(IdentityConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  /** Patrz komentarz przy tym samym wzorcu w `UserRolesTabComponent` — `NgComponentOutlet`
   * przyjmuje tylko migawkę wartości, więc zakładka sama czyta bieżący wybór ze store'a. */
  protected readonly role = computed(() => {
    const uuid = this._store.selectedUuid();
    return uuid ? this._orchestrator.getOne(uuid)() : undefined;
  });

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.RoleManage));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-role-permissions-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('permissions')
          .setLabel(ROLES_KEYS.detail.tabs.permissions)
          .setIcon('@tui.key')
          .addAction((a) =>
            a
              .setId('add-permission')
              .setLabel(ROLES_KEYS.commands.addPermission.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage() || !!this.role()?.isSystem))
              .setFn(() => this._openAddPermissionModal()),
          ),
      )
      .setPinnedActionIds(['add-permission']),
  );

  private _openAddPermissionModal(): void {
    const role = this.role();
    if (!role) return;
    this._modalService.open(ADD_ROLE_PERMISSION_MODAL_ID, { targetUuids: [role.uuid] }, { excludeCodes: role.permissions });
  }

  protected onRemove(code: string): void {
    const roleUuid = this.role()?.uuid;
    if (!roleUuid) return;

    this._confirm
      .confirm({
        title: ROLES_KEYS.detail.permissions.removeConfirmTitle,
        message: ROLES_KEYS.detail.permissions.removeConfirmMessage,
        yes: ROLES_KEYS.detail.permissions.removeConfirmYes,
        no: ROLES_KEYS.detail.permissions.removeConfirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator.removePermissionAsync({ uuid: roleUuid, permissionCode: code }).catch((err) => console.error('[RolePermissionsTabComponent] Nie udało się usunąć uprawnienia.', err));
      });
  }
}
