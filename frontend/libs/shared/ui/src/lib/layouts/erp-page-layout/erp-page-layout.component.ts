import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'erp-page-layout',
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="flex h-full w-full bg-surface-50 dark:bg-surface-950">
      <!-- Lewy panel: Filtry -->
      <aside
        class="border-r border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
        [class.w-80]="isSidebarVisible()"
        [class.w-0]="!isSidebarVisible()"
        [class.border-none]="!isSidebarVisible()"
      >
        <div class="w-80 flex flex-col h-full overflow-hidden">
          <div class="p-5 border-b border-surface-100 dark:border-surface-800 font-black text-[10px] tracking-[0.2em] uppercase text-surface-400 dark:text-surface-500 whitespace-nowrap">
            Filtrowanie
          </div>
          <div class="flex-1 overflow-y-auto p-6 min-w-80">
            <ng-content select="[filters]"></ng-content>
          </div>
        </div>
      </aside>


      <!-- Prawy panel: Kontent -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Opcjonalne nagłówki / zakładki -->
        <header class="bg-surface-0 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 px-4 py-2 flex items-center gap-2">
          <button
            pButton
            [icon]="isSidebarVisible() ? 'pi pi-align-left' : 'pi pi-filter'"
            class="!bg-transparent !border-none !text-surface-500 hover:!bg-surface-100 dark:hover:!bg-surface-800 !p-3 !rounded-xl transition-colors"
            (click)="toggleSidebar()"
          >
            <span class="sr-only">Przełącz filtry</span>
          </button>

          <div class="flex-1">
            <ng-content select="[header]"></ng-content>
          </div>
        </header>

        <!-- Główna zawartość -->
        <main class="flex-1 p-6 overflow-auto bg-surface-50 dark:bg-surface-950">
          <ng-content></ng-content>
        </main>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPageLayoutComponent {
  public isSidebarVisible = signal(true);

  public toggleSidebar(): void {
    this.isSidebarVisible.update((v) => !v);
  }
}

