import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTableComponent, ErpTableBuilder } from '@erp/shared/ui';
import { RoleOrchestrator, RoleVM } from '@erp/identity/data-access';
import { RolesStore } from '../roles.store';
import { IDENTITY_KEYS } from '../../translation';

/** Zakładka "Zawarta w" — role-kontenery zawierające tę rolę jako składową (odwrotny kierunek
 * DAG). Tylko do odczytu: dodawanie/usuwanie idzie z poziomu roli-kontenera (zakładka "Role
 * składowe" TEJ roli), nie stąd — patrz `RoleOrchestrator.getContainerRoles()`. */
@Component({
  selector: 'erp-identity-role-containers-tab',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `
    <div class="h-full w-full p-2">
      <erp-table class="block h-full w-full" [config]="tableConfig()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleContainersTabComponent {
  private readonly _store = inject(RolesStore);
  private readonly _orchestrator = inject(RoleOrchestrator);

  protected readonly tableConfig = computed(() =>
    new ErpTableBuilder<RoleVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.uuid)
      .setItems(
        computed(() => {
          const uuid = this._store.selectedUuid();
          return uuid ? this._orchestrator.getContainerRoles(uuid) : [];
        }),
      )
      .setSelectionMode('none')
      .setEmptyMessage(IDENTITY_KEYS.roles.detail.containers.emptyMessage)
      .addColumn((c) => c.setId('code').setAccessorKey('code').setHeader(IDENTITY_KEYS.roles.detail.containers.columns.code).setSize(200))
      .addColumn((c) => c.setId('name').setAccessorKey('name').setHeader(IDENTITY_KEYS.roles.detail.containers.columns.name).setSize(220))
      .build(),
  );
}
