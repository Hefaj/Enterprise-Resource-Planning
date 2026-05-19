import { ChangeDetectionStrategy, Component, input, viewChild, computed, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ErpEmptyCardComponent } from '@erp/shared/ui/erp-empty-card';
import { ErpDrawerComponent } from '@erp/shared/ui/erp-drawer';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui/erp-button';
import { ErpPanelMenuComponent } from '@erp/shared/ui/erp-panel-menu';
import { ErpBreadcrumbComponent } from '@erp/shared/ui/erp-breadcrumb';
import { ErpUserMenuComponent } from '@erp/shared/ui/erp-user-menu';
import { ErpHostLayoutConfig } from './erp-host-layout.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

@Component({
  selector: 'erp-host-layout',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, ErpEmptyCardComponent, ErpDrawerComponent, ErpButtonComponent, ErpPanelMenuComponent, ErpBreadcrumbComponent, ErpUserMenuComponent],
  template: `
    @let _config = config();
    @let _menuConfig = unwrapConfig(_config.menuConfig);
    @let _breadcrumbConfig = unwrapConfig(_config.breadcrumbConfig);
    @let _userMenuConfig = unwrapConfig(_config.userMenuConfig);
    @let _menuBtnConfig = menuBtnConfig();
    @let _contentComponent = unwrapComponent(_config.contentComponent);
    @let _contentConfig = unwrapConfig(_config.contentConfig);

    <erp-drawer #drawer>
      @if (_menuConfig) {
        <erp-panel-menu [config]="_menuConfig" />
      }
    </erp-drawer>

    <div class="flex flex-col h-svh w-svw bg-slate-50 dark:bg-slate-900">
      <div class="h-16 flex items-center px-2 bg-white dark:bg-slate-900 shadow-xl">
        <erp-button
          [config]="_menuBtnConfig"
        />
        @if (_breadcrumbConfig) {
          <erp-breadcrumb
            class="w-full"
            [config]="_breadcrumbConfig"
          />
        }

        @if (_userMenuConfig) {
          <erp-user-menu [config]="_userMenuConfig" />
        }
      </div>
      <main class="flex-1 overflow-auto p-2">
        @if (_contentComponent) {
          <ng-container *ngComponentOutlet="_contentComponent; inputs: _contentConfig" />
        } @else {
          <erp-empty-card />
        }
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHostLayoutComponent implements OnInit {
  public config = input.required<ErpHostLayoutConfig>();

  protected drawer = viewChild.required<ErpDrawerComponent>('drawer');

  private _router = inject(Router);
  private _destroyRef = inject(DestroyRef);

  public ngOnInit(): void {
    this._router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this._destroyRef)
      )
      .subscribe(() => {
        const closeOnNav = this.unwrapConfig(this.config().closeMenuOnNavigation) ?? true;
        if (closeOnNav) {
          this.drawer().hide();
        }
      });
  }

  protected menuBtnConfig = computed(() =>
    ErpButtonBuilder.create((b) =>
      b.setSeverity('info')
       .setIcon('pi pi-bars')
       .setOnClick(() => this.drawer().show())
    )
  );

  protected unwrapConfig(signalConfig: any) {
    if (!signalConfig) return undefined;
    return unwrapSignal(signalConfig);
  }

  protected unwrapComponent(signalComponent: any) {
    if (!signalComponent) return null;
    return unwrapSignal(signalComponent);
  }
}
