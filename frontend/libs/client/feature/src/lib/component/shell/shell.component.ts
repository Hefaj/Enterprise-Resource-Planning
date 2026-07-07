import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TUI_DARK_MODE, TuiButton, TuiDataList, TuiIcon, TuiPopup } from '@taiga-ui/core';
import { TuiDrawer } from '@taiga-ui/kit';
import { TuiNavigation } from '@taiga-ui/layout';
import { ErpBreadcrumbComponent, ErpBreadcrumbBuilder } from '@erp/shared/ui/erp-breadcrumb';
import { ErpBreadcrumbService, ErpNavRegistryService } from '@erp/shared/data-access';

@Component({
  selector: 'erp-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    ErpBreadcrumbComponent,
    TuiButton,
    TuiDataList,
    TuiIcon,
    TuiPopup,
    TuiDrawer,
    TuiNavigation,
  ],
  templateUrl: './shell.component.html',
  styles: [`
    a.active-link {
      background: var(--tui-background-neutral-1-hover) !important;
      font-weight: 600;
    }
  `]
})
export class ShellLayoutComponent {
  public readonly isDarkMode = inject(TUI_DARK_MODE);
  private readonly _breadcrumbService = inject(ErpBreadcrumbService);
  private readonly _navRegistry = inject(ErpNavRegistryService);

  public readonly navMenu = this._navRegistry.$navMenu;
  public readonly menuOpen = signal(false);

  public readonly breadcrumbConfig = ErpBreadcrumbBuilder.create((b) =>
    b.setItems(
      computed(() => {
        const data = this._breadcrumbService.breadcrumb();
        return [data.home, ...data.items];
      })
    )
  );

  public toggleTheme(): void {
    const nextTheme = !this.isDarkMode();
    this.isDarkMode.set(nextTheme);
    localStorage.setItem('erp-theme', nextTheme ? 'dark' : 'light');
  }
}
