import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTableComponent, ErpTableBuilder, ErpTranslatePipe } from '@erp/shared/ui';
import { UserOrchestrator } from '@erp/identity/data-access';
import { UsersStore } from '../users.store';
import { USERS_KEYS } from '../translation';

interface EffectivePermissionRow {
  readonly module: string;
  readonly code: string;
}

/**
 * Zakładka "Efektywne uprawnienia" — płaski, tylko-do-odczytu zbiór (bezpośrednie + przez
 * wszystkie role w łańcuchu dziedziczenia), w `erp-table` (`mode: 'client'`), nie w ręcznie
 * renderowanej liście chipów. BEZ rozwinięcia „skąd" — backend eksponuje ścieżkę dziedziczenia
 * (`GetMyPermissionSources`) tylko dla `/me` (patrz `docs/backend/identity-authz.md` §9,
 * „Właściwa autoryzacja service-to-service..."), rozszerzenie na dowolnego użytkownika to
 * osobny przyrost backendowy, świadomie nieuwzględniony w tym zadaniu.
 */
@Component({
  selector: 'erp-identity-user-effective-permissions-tab',
  standalone: true,
  imports: [CommonModule, ErpTranslatePipe, ErpTableComponent],
  template: `
    <div class="flex flex-col h-full w-full gap-2 p-2">
      <p class="hint">{{ USERS_KEYS.detail.effective.hint | erpTranslate }}</p>

      <div class="flex-1 min-h-0">
        <erp-table
          class="block h-full w-full"
          [config]="tableConfig()"
        />
      </div>
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

  private readonly _store = inject(UsersStore);
  private readonly _orchestrator = inject(UserOrchestrator);

  protected readonly rows = computed<EffectivePermissionRow[]>(() => {
    const uuid = this._store.selectedUuid();
    const codes = uuid ? this._orchestrator.getEffectivePermissions(uuid)() : [];

    return codes
      .map((code) => ({ module: code.split('.')[0] ?? code, code }))
      .sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code));
  });

  protected readonly tableConfig = computed(() =>
    new ErpTableBuilder<EffectivePermissionRow>()
      .setMode('client')
      .setRowIdAccessor((x) => x.code)
      .setItems(this.rows)
      .setSelectionMode('none')
      .setEmptyMessage(USERS_KEYS.detail.effective.emptyMessage)
      .addColumn((c) => c.setId('module').setAccessorKey('module').setHeader(USERS_KEYS.detail.effective.columns.module).setSize(200))
      .addColumn((c) => c.setId('code').setAccessorKey('code').setHeader(USERS_KEYS.detail.effective.columns.code).setSize(280))
      .build(),
  );

  public constructor() {
    effect(() => {
      const uuid = this._store.selectedUuid();
      if (!uuid) return;
      untracked(() => {
        this._orchestrator.loadEffectivePermissionsAsync(uuid).catch((err) => console.error('[UserEffectivePermissionsTabComponent] Nie udało się pobrać efektywnych uprawnień.', err));
      });
    });
  }
}
