import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTableComponent, ErpTableBuilder, ErpTranslatePipe } from '@erp/shared/ui';
import { UserOrchestrator, UserVM } from '@erp/identity/data-access';

import { PermissionsStore } from '../../../permissions.store';
import { PERMISSIONS_KEYS } from '../../../../translation';

/** Prawy panel strony `/identity/permissions` — "kto ma to uprawnienie" dla wybranego kodu,
 * przez nowy filtr backendowy `SearchUserAccountRequest.PermissionCode` (patrz plan
 * implementacji §1). W odróżnieniu od filtra `roleUuid` na stronie Ról, ten jest EFEKTYWNY
 * (przez całą hierarchię ról) — tu chodzi o pełny obraz „kto realnie może", nie o to, co da
 * się bezpośrednio odebrać z jednego miejsca. */
@Component({
  selector: 'erp-identity-permission-holders-panel',
  standalone: true,
  imports: [CommonModule, ErpTableComponent, ErpTranslatePipe],
  template: `
    @if (store.selectedCode(); as code) {
      <div class="flex flex-col h-full w-full min-h-0 gap-2 p-3">
        <h4 class="title">{{ code }}</h4>
        <p class="hint">{{ PERMISSIONS_KEYS.holders.hint | erpTranslate }}</p>
        <div class="flex-1 min-h-0">
          <erp-table
            class="block h-full w-full"
            [config]="tableConfig()"
          />
        </div>
      </div>
    } @else {
      <div class="flex h-full w-full items-center justify-center p-4">
        <p class="empty">{{ PERMISSIONS_KEYS.holders.emptySelection | erpTranslate }}</p>
      </div>
    }
  `,
  styles: [
    `
      .title {
        margin: 0;
        font-family: monospace;
        font: var(--tui-typography-text-m-bold);
      }
      .hint {
        margin: 0;
        color: var(--tui-text-tertiary);
        font-size: 0.75rem;
      }
      .empty {
        color: var(--tui-text-tertiary);
        text-align: center;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionHoldersPanelComponent {
  protected readonly PERMISSIONS_KEYS = PERMISSIONS_KEYS;
  protected readonly store = inject(PermissionsStore);

  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _holderUuids = signal<string[]>([]);
  private readonly _loading = signal<boolean>(false);

  protected readonly items = computed<UserVM[]>(() => {
    const vmMap = this._orchestrator.getViewModel()();
    return this._holderUuids()
      .map((uuid) => vmMap.get(uuid))
      .filter((vm): vm is UserVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const code = this.store.selectedCode();
      untracked(() => this._load(code));
    });
  }

  private async _load(code: string | null): Promise<void> {
    if (!code) {
      this._holderUuids.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const response = await this._orchestrator.searchAsync({ permissionCode: code, page: 1, pageSize: 200 });
      this._holderUuids.set(response.uuids ?? []);
    } catch (err) {
      console.error('[PermissionHoldersPanelComponent] Nie udało się pobrać listy użytkowników.', err);
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
      .setEmptyMessage(PERMISSIONS_KEYS.holders.emptyMessage)
      .addColumn((c) => c.setId('email').setAccessorKey('email').setHeader(PERMISSIONS_KEYS.holders.columns.email).setSize(240))
      .addColumn((c) => c.setId('displayName').setAccessorKey('displayName').setHeader(PERMISSIONS_KEYS.holders.columns.displayName).setSize(220))
      .build(),
  );
}
