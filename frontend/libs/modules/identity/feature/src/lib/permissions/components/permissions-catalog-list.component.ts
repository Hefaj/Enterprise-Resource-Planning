import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { PermissionCatalogOrchestrator, PermissionCatalogVM } from '@erp/identity/data-access';

import { PermissionsStore } from '../permissions.store';
import { PERMISSIONS_KEYS } from '../translation';

interface ModuleGroup {
  readonly module: string;
  readonly entries: PermissionCatalogVM[];
}

/** Katalog uprawnień grupowany po module. Wyszukiwanie (`PermissionsStore.search`, ustawiane
 * przez `PermissionsFilterComponent` po lewej) jest klient-side — cały katalog jest już w
 * pamięci, backend celowo nie paginuje (patrz `PermissionCatalogOrchestrator`). */
@Component({
  selector: 'erp-identity-permissions-catalog-list',
  standalone: true,
  imports: [CommonModule, ErpTranslatePipe],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">{{ PERMISSIONS_KEYS.title | erpTranslate }}</h1>
        <p class="page-subtitle">{{ PERMISSIONS_KEYS.subtitle | erpTranslate }}</p>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        @for (group of groups(); track group.module) {
          <div class="flex flex-col gap-1.5">
            <h4 class="module-title">{{ group.module }}</h4>
            <div class="flex flex-col gap-1">
              @for (entry of group.entries; track entry.code) {
                <button
                  type="button"
                  class="entry-row"
                  [class.selected]="store.selectedCode() === entry.code"
                  (click)="store.selectPermission(entry.code)"
                >
                  <span class="entry-code">{{ entry.code }}</span>
                  <span class="entry-desc">{{ entry.descriptionKey | erpTranslate }}</span>
                  @if (entry.isObsolete) {
                    <span class="badge">{{ PERMISSIONS_KEYS.obsoleteBadge | erpTranslate }}</span>
                  }
                </button>
              }
            </div>
          </div>
        }

        @if (groups().length === 0) {
          <p class="empty">{{ PERMISSIONS_KEYS.emptyMessage | erpTranslate }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .page-title {
        font: var(--tui-typography-heading-h3);
        margin: 0;
      }
      .page-subtitle {
        color: var(--tui-text-secondary);
        margin: 0;
      }
      .module-title {
        margin: 0;
        font: var(--tui-typography-text-s-bold);
        text-transform: uppercase;
        color: var(--tui-text-secondary);
      }
      .entry-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        text-align: left;
        padding: 0.4rem 0.6rem;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        background: none;
        cursor: pointer;
        width: 100%;
      }
      .entry-row:hover {
        background: var(--tui-background-neutral-1);
      }
      .entry-row.selected {
        background: var(--tui-background-neutral-1);
        border-color: var(--tui-border-normal);
      }
      .entry-code {
        font-family: monospace;
        font-size: 0.8rem;
        min-width: 14rem;
      }
      .entry-desc {
        color: var(--tui-text-secondary);
        font-size: 0.8rem;
        flex: 1;
      }
      .badge {
        font-size: 0.7rem;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        background: var(--tui-status-warning-pale);
        color: var(--tui-status-warning);
      }
      .empty {
        color: var(--tui-text-secondary);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsCatalogListComponent {
  protected readonly PERMISSIONS_KEYS = PERMISSIONS_KEYS;
  protected readonly store = inject(PermissionsStore);

  private readonly _orchestrator = inject(PermissionCatalogOrchestrator);

  protected readonly groups = computed<ModuleGroup[]>(() => {
    const search = this.store.search().trim().toLowerCase();
    const all = [...this._orchestrator.getViewModel()().values()];
    const filtered = search ? all.filter((e) => e.code.toLowerCase().includes(search) || e.module.toLowerCase().includes(search)) : all;

    const byModule = new Map<string, PermissionCatalogVM[]>();
    for (const entry of filtered) {
      const list = byModule.get(entry.module) ?? [];
      list.push(entry);
      byModule.set(entry.module, list);
    }

    return [...byModule.entries()].map(([module, entries]) => ({ module, entries: entries.sort((a, b) => a.code.localeCompare(b.code)) })).sort((a, b) => a.module.localeCompare(b.module));
  });

  public constructor() {
    this._orchestrator.loadAllAsync().catch((err) => console.error('[PermissionsCatalogListComponent] Nie udało się pobrać katalogu.', err));
  }
}
