import { ChangeDetectionStrategy, Component, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

import { ErpPageLayoutConfig } from './erp-page-layout.types';

@Component({
  selector: 'erp-page-layout',
  imports: [CommonModule, ButtonModule],
  template: `
    @let _config = config();
    
    <div class="flex h-full w-full bg-surface-50 dark:bg-surface-950 overflow-hidden">
      <!-- Lewy panel: Filtry -->
      @if (_config.leftSidebar) {
        <aside
        class="group relative h-full border-r border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 flex flex-col transition-all duration-300 ease-in-out z-20"
        [class.w-80]="isSidebarVisible()"
        [class.w-0]="!isSidebarVisible()"
      >
        <!-- Hot Zone (Strefa łapania hovera, gdy zamknięte) -->
        @if (!isSidebarVisible()) {
          <div class="absolute top-0 -right-10 w-14 h-full z-10 cursor-pointer"></div>
          
          <!-- Wizualny sygnał (Cienka linia/glow na krawędzi) -->
          <div class="absolute inset-y-0 right-0 w-0.75 bg-primary-500/20 group-hover:bg-primary-500/50 transition-all duration-300 blur-[1px]"></div>
        }

        <!-- Toggle Button (Uchwyt) -->
        <div 
          class="absolute top-10 z-30 transition-all duration-300 pointer-events-auto"
          [style.right]="isSidebarVisible() ? '-1rem' : '-1.5rem'"
          [class.opacity-0]="!isSidebarVisible()"
          [class.group-hover:opacity-100]="!isSidebarVisible()"
          [class.scale-75]="!isSidebarVisible()"
          [class.group-hover:scale-100]="!isSidebarVisible()"
        >
          <button
            pButton
            [icon]="isSidebarVisible() ? 'pi pi-chevron-left' : 'pi pi-filter'"
            class="w-8! h-8! rounded-full! shadow-lg! border! border-primary-200! dark:border-primary-800! bg-surface-0! dark:bg-surface-900! text-primary-600! dark:text-primary-400! hover:bg-primary-50! dark:hover:bg-primary-900! transition-all"
            (click)="toggleSidebar()"
          >
          </button>
        </div>

        <!-- Sidebar Content -->
        <div 
          class="w-80 flex flex-col h-full overflow-hidden transition-all duration-200"
          [class.opacity-100]="isSidebarVisible()"
          [class.opacity-0]="!isSidebarVisible()"
          [class.pointer-events-none]="!isSidebarVisible()"
          [style.transition-delay]="isSidebarVisible() ? '150ms' : '0ms'"
        >
          <div class="p-5 border-b border-surface-100 dark:border-surface-800 font-black text-[10px] tracking-[0.2em] uppercase text-surface-400 dark:text-surface-500 whitespace-nowrap">
            Filtrowanie
          </div>
          <div class="flex-1 overflow-y-auto p-6 min-w-80">
            <ng-container
              *ngComponentOutlet="_config.leftSidebar.component; inputs: _config.leftSidebar.config"
            ></ng-container>
          </div>
        </div>
      </aside>
      }

      <!-- Prawy panel: Kontent -->
      <div class="flex-1 flex flex-col min-w-0 relative">
        <!-- Główna zawartość -->
        <main class="flex-1 p-6 overflow-auto bg-surface-50 dark:bg-surface-950">
          @if (_config.main) {
            <ng-container
              *ngComponentOutlet="_config.main.component; inputs: _config.main.config"
            ></ng-container>
          }
        </main>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPageLayoutComponent {
  public config = input.required<ErpPageLayoutConfig>();

  public isSidebarVisible = signal(true);

  public toggleSidebar(): void {
    this.isSidebarVisible.update((v) => !v);
  }
}

