import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { TuiNavigation } from '@taiga-ui/layout';
import { ErpBreadcrumbComponent, ErpBreadcrumbBuilder } from '@erp/shared/ui/erp-breadcrumb';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui/erp-button';
import { ErpDrawerComponent, ErpDrawerBuilder } from '@erp/shared/ui/erp-drawer';
import { ErpBreadcrumbService, ErpNavRegistryService } from '@erp/shared/data-access';
import { NavigationMenuComponent } from './navigation-menu.component';

@Component({
  selector: 'erp-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    ErpBreadcrumbComponent,
    ErpButtonComponent,
    ErpDrawerComponent,
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

  public readonly menuButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('icon')
      .setIconStart('@tui.menu')
      .setFn(() => this.menuOpen.set(true))
  );

  public readonly themeButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('icon')
      .setIconStart(computed(() => this.isDarkMode() ? '@tui.sun' : '@tui.moon'))
      .setFn(() => this.toggleTheme())
  );

  public readonly menuDrawerConfig = ErpDrawerBuilder.create((b) =>
    b
      .setOpen(this.menuOpen)
      .setTitle('Nawigacja')
      .setOverlay(true)
      .setDirection('start')
      .setComponent(NavigationMenuComponent)
      .setOnClose(() => this.menuOpen.set(false))
  );

  public toggleTheme(): void {
    const nextTheme = !this.isDarkMode();
    this.isDarkMode.set(nextTheme);
    localStorage.setItem('erp-theme', nextTheme ? 'dark' : 'light');
  }
}
