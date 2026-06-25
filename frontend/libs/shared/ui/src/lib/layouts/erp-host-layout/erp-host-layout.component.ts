import { ChangeDetectionStrategy, Component, input, viewChild, computed, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpDrawerComponent } from '../../atoms/erp-drawer';
import { ErpButtonComponent, ErpButtonBuilder } from '../../atoms/erp-button';
import { ErpHostLayoutConfig } from './erp-host-layout.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

@Component({
  selector: 'erp-host-layout',
  standalone: true,
  imports: [CommonModule, ErpDrawerComponent, ErpButtonComponent],
  template: `
    @let _menuBtnConfig = menuBtnConfig();

    <erp-drawer #drawer>
      <ng-content select="[menu]"></ng-content>
    </erp-drawer>

    <div class="flex flex-col h-svh w-svw bg-slate-50 dark:bg-slate-900">
      <div class="h-16 flex items-center px-2 bg-surface-0 dark:bg-surface-900 shadow-xl">
        <erp-button
          [config]="_menuBtnConfig"
        />
        <div class="w-full flex items-center px-2">
          <ng-content select="[breadcrumb]"></ng-content>
        </div>

        <div class="flex items-center gap-2 mr-2">
          <ng-content select="[header-actions]"></ng-content>
        </div>

        <ng-content select="[user-menu]"></ng-content>
      </div>
      <main class="flex-1 overflow-auto p-2">
        <ng-content></ng-content>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHostLayoutComponent implements OnInit {
  public config = input<ErpHostLayoutConfig>({});

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
}
