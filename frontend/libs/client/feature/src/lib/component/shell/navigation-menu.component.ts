import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TuiDataList, TuiIcon } from '@taiga-ui/core';
import { ErpNavRegistryService } from '@erp/shared/data-access';
import { ShellLayoutComponent } from './shell.component';

@Component({
  selector: 'app-navigation-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiDataList,
    TuiIcon
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-data-list style="box-shadow: none; background: transparent; padding: 0;">
      @for (item of navMenu(); track item.id || item.route || $index) {
        @if (item.children && item.children.length > 0) {
          <tui-opt-group [label]="item.label">
            @for (child of item.children; track child.id || child.route || $index) {
              <a
                tuiOption
                [routerLink]="child.route"
                (click)="closeMenu()"
                style="display: flex; align-items: center; gap: 0.75rem; text-decoration: none; padding: 0.75rem 1rem; color: var(--tui-text-primary); border-radius: var(--tui-radius-m); transition: background 0.15s; margin-bottom: 0.25rem;"
                routerLinkActive="active-link"
                [routerLinkActiveOptions]="{exact: false}"
              >
                @if (child.iconId) {
                  <tui-icon [icon]="child.iconId" style="opacity: 0.7;" />
                }
                <span>{{ child.label }}</span>
              </a>
            }
          </tui-opt-group>
        } @else {
          <a
            tuiOption
            [routerLink]="item.route"
            (click)="closeMenu()"
            style="display: flex; align-items: center; gap: 0.75rem; text-decoration: none; padding: 0.75rem 1rem; color: var(--tui-text-primary); border-radius: var(--tui-radius-m); transition: background 0.15s; margin-bottom: 0.25rem;"
            routerLinkActive="active-link"
            [routerLinkActiveOptions]="{exact: true}"
          >
            @if (item.iconId) {
              <tui-icon [icon]="item.iconId" style="opacity: 0.7;" />
            }
            <span>{{ item.label }}</span>
          </a>
        }
      }
    </tui-data-list>
  `,
  styles: [`
    a.active-link {
      background: var(--tui-background-neutral-1-hover) !important;
      font-weight: 600;
    }
  `]
})
export class NavigationMenuComponent {
  private readonly _navRegistry = inject(ErpNavRegistryService);
  private readonly _shell = inject(ShellLayoutComponent);

  public readonly navMenu = this._navRegistry.$navMenu;

  protected closeMenu(): void {
    this._shell.menuOpen.set(false);
  }
}
