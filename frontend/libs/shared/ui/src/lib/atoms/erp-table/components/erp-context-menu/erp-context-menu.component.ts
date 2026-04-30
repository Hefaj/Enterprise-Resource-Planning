import { Component, input, output, signal, computed } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { ContextMenuItem } from '../../models/context-menu.models';
import { MenuEntry } from '../../services/context-menu.service';
import { SelectionState } from '../../models/selection.models';

@Component({
  selector: 'erp-context-menu',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  template: `
    <div
      class="erp-menu-container 
                w-64 p-2 rounded-lg shadow-xl border
                bg-white border-slate-200 text-slate-700
                dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
    >
      @if (showSearch()) {
        <div class="mb-2 px-1">
          <input
            type="text"
            placeholder="Szukaj..."
            class="w-full p-2 text-sm rounded border outline-hidden transition-all
                   focus:ring-2 focus:ring-blue-500
                   bg-slate-50 border-slate-300 text-slate-900
                   dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
            (input)="onFilter($event)"
          />
        </div>
      }

      <cdk-virtual-scroll-viewport
        itemSize="40"
        class="h-64 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
      >
        <div
          *cdkVirtualFor="let entry of filteredItems()"
          class="menu-item-wrapper px-1"
        >
          @if (entry === 'separator') {
            <hr class="my-1 border-t border-slate-200 dark:border-slate-700" />
          } @else {
            <button
              type="button"
              class="group w-full flex items-center gap-3 p-2 text-sm text-left rounded-md transition-colors
                     hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed
                     dark:hover:bg-slate-800 dark:active:bg-slate-750"
              [disabled]="entry.disabled?.(selection())"
              (click)="itemClick.emit(entry)"
            >
              @if (entry.icon) {
                <i
                  [class]="entry.icon"
                  class="text-slate-500 dark:text-slate-400 group-hover:text-blue-500"
                ></i>
              }
              <span class="truncate">{{ entry.label }}</span>
            </button>
          }
        </div>
      </cdk-virtual-scroll-viewport>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .scrollbar-thin::-webkit-scrollbar {
      width: 4px;
    }
  `,
})
export class ErpContextMenuComponent {
  // Inputs
  public processedItems = input.required<MenuEntry[]>();
  public selection = input.required<SelectionState>();
  public showSearch = input<boolean>(false);

  // State
  public filter = signal('');
  public itemClick = output<ContextMenuItem>();

  // Logic: Obliczanie przefiltrowanej listy przy użyciu Signal computed (wydajność memoizacji)
  public filteredItems = computed(() => {
    const term = this.filter().toLowerCase();
    const items = this.processedItems();
    if (!term) return items;

    return items.filter((item) => item !== 'separator' && item.label.toLowerCase().includes(term));
  });

  public onFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filter.set(value);
  }
}
