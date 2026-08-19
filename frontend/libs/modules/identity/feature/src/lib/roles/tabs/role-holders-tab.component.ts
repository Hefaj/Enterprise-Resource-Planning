import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTableComponent, ErpTableBuilder } from '@erp/shared/ui';
import { UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { RolesStore } from '../roles.store';
import { IDENTITY_KEYS } from '../../translation';

/** Zakładka "Kto ma tę rolę" — użytkownicy z BEZPOŚREDNIM przypisaniem tej roli, przez nowy
 * filtr backendowy `SearchUserAccountRequest.RoleUuid` (patrz plan implementacji §1). Świadomie
 * bezpośrednio, nie efektywnie — to jedyny zbiór, który da się tu realnie odebrać. */
@Component({
  selector: 'erp-identity-role-holders-tab',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `
    <div class="h-full w-full p-2">
      <erp-table class="block h-full w-full" [config]="tableConfig()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleHoldersTabComponent {
  private readonly _store = inject(RolesStore);
  private readonly _orchestrator = inject(UserOrchestrator);

  private readonly _holderUuids = signal<string[]>([]);
  private readonly _loading = signal<boolean>(true);

  protected readonly items = computed<UserVM[]>(() => {
    const vmMap = this._orchestrator.getViewModel()();
    return this._holderUuids()
      .map((uuid) => vmMap.get(uuid))
      .filter((vm): vm is UserVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const roleUuid = this._store.selectedUuid();
      untracked(() => this._load(roleUuid));
    });
  }

  private async _load(roleUuid: string | null): Promise<void> {
    if (!roleUuid) {
      this._holderUuids.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const response = await this._orchestrator.searchAsync({ roleUuid, page: 1, pageSize: 200 });
      this._holderUuids.set(response.uuids ?? []);
    } catch (err) {
      console.error('[RoleHoldersTabComponent] Nie udało się pobrać listy użytkowników z rolą.', err);
    } finally {
      this._loading.set(false);
    }
  }

  protected readonly tableConfig = computed(() =>
    new ErpTableBuilder<UserVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.uuid)
      .setItems(this.items)
      .setLoading(this._loading())
      .setSelectionMode('none')
      .setEmptyMessage(IDENTITY_KEYS.roles.detail.holders.emptyMessage)
      .addColumn((c) => c.setId('email').setAccessorKey('email').setHeader(IDENTITY_KEYS.roles.detail.holders.columns.email).setSize(240))
      .addColumn((c) =>
        c
          .setId('displayName')
          .setAccessorKey('displayName')
          .setHeader(IDENTITY_KEYS.roles.detail.holders.columns.displayName)
          .setSize(220),
      )
      .build(),
  );
}
