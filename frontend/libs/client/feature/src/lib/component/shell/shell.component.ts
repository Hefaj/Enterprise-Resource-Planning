import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TuiNavigation } from '@taiga-ui/layout';
import { ErpBreadcrumbComponent, ErpBreadcrumbBuilder } from '@erp/shared/ui/erp-breadcrumb';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui/erp-button';
import { ErpDrawerComponent, ErpDrawerBuilder } from '@erp/shared/ui/erp-drawer';
import { ErpBreadcrumbService, ErpNavRegistryService } from '@erp/shared/data-access';
import { ThemeService } from '@erp/client/util';
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
  `],
  host: {
    style: 'display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;'
  }
})
export class ShellLayoutComponent {
  private readonly _themeService = inject(ThemeService);
  private readonly _breadcrumbService = inject(ErpBreadcrumbService);
  private readonly _navRegistry = inject(ErpNavRegistryService);

  public readonly isDarkMode = this._themeService.isDarkMode;
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
    this._themeService.toggleTheme();
  }
}
