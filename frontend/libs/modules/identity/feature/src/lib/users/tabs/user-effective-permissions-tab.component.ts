import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { UserOrchestrator } from '@erp/identity/data-access';
import { UsersStore } from '../users.store';
import { USERS_KEYS } from '../translation';

interface ModuleGroup {
  readonly module: string;
  readonly codes: string[];
}

/**
 * Zakładka "Efektywne uprawnienia" — płaski, tylko-do-odczytu zbiór (bezpośrednie + przez
 * wszystkie role w łańcuchu dziedziczenia). BEZ rozwinięcia „skąd" — backend eksponuje ścieżkę
 * dziedziczenia (`GetMyPermissionSources`) tylko dla `/me` (patrz `docs/backend/identity-authz.md`
 * §9, „Właściwa autoryzacja service-to-service..."), rozszerzenie na dowolnego użytkownika to
 * osobny przyrost backendowy, świadomie nieuwzględniony w tym zadaniu.
 */
@Component({
  selector: 'erp-identity-user-effective-permissions-tab',
  standalone: true,
  imports: [CommonModule, ErpTranslatePipe],
  template: `
    <div class="flex flex-col h-full w-full gap-3 p-3 overflow-y-auto">
      <p class="hint">{{ USERS_KEYS.detail.effective.hint | erpTranslate }}</p>

      @if (groups().length === 0) {
        <p class="empty">{{ USERS_KEYS.detail.effective.emptyMessage | erpTranslate }}</p>
      }

      @for (group of groups(); track group.module) {
        <div class="flex flex-col gap-1">
          <h4 class="module-title">{{ group.module }}</h4>
          <div class="flex flex-wrap gap-1">
            @for (code of group.codes; track code) {
              <span class="chip">{{ code }}</span>
            }
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
      .empty {
        margin: 0;
        color: var(--tui-text-secondary);
      }
      .module-title {
        margin: 0;
        font: var(--tui-typography-text-s-bold);
        text-transform: uppercase;
        color: var(--tui-text-secondary);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.5rem;
        border-radius: 1rem;
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-primary);
        font-size: 0.75rem;
        border: 1px solid var(--tui-border-normal);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEffectivePermissionsTabComponent {
  protected readonly USERS_KEYS = USERS_KEYS;

  private readonly _store = inject(UsersStore);
  private readonly _orchestrator = inject(UserOrchestrator);

  protected readonly groups = computed<ModuleGroup[]>(() => {
    const uuid = this._store.selectedUuid();
    const codes = uuid ? this._orchestrator.getEffectivePermissions(uuid)() : [];

    const byModule = new Map<string, string[]>();
    for (const code of codes) {
      const module = code.split('.')[0] ?? code;
      const list = byModule.get(module) ?? [];
      list.push(code);
      byModule.set(module, list);
    }

    return [...byModule.entries()].map(([module, moduleCodes]) => ({ module, codes: moduleCodes.sort() })).sort((a, b) => a.module.localeCompare(b.module));
  });

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
