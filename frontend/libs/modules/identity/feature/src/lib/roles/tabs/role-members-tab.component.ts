import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpTableComponent,
  ErpTableBuilder,
  ErpModalService,
} from '@erp/shared/ui';
import { IdentityRowRemoveCellComponent, IdentityConfirmDialogService } from '@erp/identity/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { RoleOrchestrator, RoleVM } from '@erp/identity/data-access';
import { ADD_ROLE_MEMBER_MODAL_ID } from '@erp/identity/util';
import { RolesStore } from '../roles.store';
import { IDENTITY_KEYS } from '../../translation';

/** Zakładka "Role składowe" — `role.members` (rozwiązane z `memberRoleUuids`), dodawanie i
 * usuwanie. Cykle DALEJ nie są wykrywane po stronie klienta — backend waliduje
 * (`role_cycle_detected`), patrz `docs/backend/identity-authz.md` §2. */
@Component({
  selector: 'erp-identity-role-members-tab',
  standalone: true,
  imports: [CommonModule, ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, ErpTableComponent],
  template: `
    <div class="flex flex-col h-full w-full gap-2 p-2" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
      <erp-action-toolbar [config]="actionToolbar" />
      <div class="flex-1 min-h-0">
        <erp-table class="block h-full w-full" [config]="tableConfig()" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleMembersTabComponent {
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
      .setMenuId('identity-role-members-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('members')
          .setLabel(IDENTITY_KEYS.roles.detail.tabs.members)
          .setIcon('@tui.git-branch')
          .addAction((a) =>
            a
              .setId('add-member')
              .setLabel(IDENTITY_KEYS.roles.commands.addMember.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage() || !!this.role()?.isSystem))
              .setFn(() => this._openAddMemberModal()),
          ),
      )
      .setPinnedActionIds(['add-member']),
  );

  private _openAddMemberModal(): void {
    const role = this.role();
    if (!role) return;
    const excludeUuids = [role.uuid, ...role.memberRoleUuids];
    this._modalService.open(ADD_ROLE_MEMBER_MODAL_ID, { containerRoleUuid: role.uuid }, { excludeUuids });
  }

  protected readonly tableConfig = computed(() => {
    const canManage = this.canManage() && !this.role()?.isSystem;
    const builder = new ErpTableBuilder<RoleVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.uuid)
      .setItems(computed(() => this.role()?.members ?? []))
      .setSelectionMode('none')
      .setEmptyMessage(IDENTITY_KEYS.roles.detail.members.emptyMessage)
      .addColumn((c) => c.setId('code').setAccessorKey('code').setHeader(IDENTITY_KEYS.roles.detail.members.columns.code).setSize(200))
      .addColumn((c) => c.setId('name').setAccessorKey('name').setHeader(IDENTITY_KEYS.roles.detail.members.columns.name).setSize(220));

    if (canManage) {
      builder.addColumn((c) =>
        c
          .setId('actions')
          .setHeader('')
          .setEnableSorting(false)
          .setSize(60)
          .setCell(IdentityRowRemoveCellComponent, { onRemove: (row: RoleVM) => this._onRemove(row) }),
      );
    }

    return builder.build();
  });

  private _onRemove(member: RoleVM): void {
    const containerRoleUuid = this.role()?.uuid;
    if (!containerRoleUuid) return;

    this._confirm
      .confirm({
        title: IDENTITY_KEYS.roles.detail.members.removeConfirmTitle,
        message: IDENTITY_KEYS.roles.detail.members.removeConfirmMessage,
        yes: IDENTITY_KEYS.roles.detail.members.removeConfirmYes,
        no: IDENTITY_KEYS.roles.detail.members.removeConfirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator
          .removeMemberAsync({ containerRoleUuid, memberRoleUuid: member.uuid })
          .catch((err) => console.error('[RoleMembersTabComponent] Nie udało się usunąć roli składowej.', err));
      });
  }
}
