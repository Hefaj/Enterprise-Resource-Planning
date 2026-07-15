import { ChangeDetectionStrategy, Component, computed, input, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiDrawer } from '@taiga-ui/kit';
import { TuiPopup } from '@taiga-ui/core';
import { ErpButtonComponent, ErpButtonBuilder } from '../erp-button';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpDrawerConfig } from './erp-drawer.types';

@Component({
  selector: 'erp-drawer',
  standalone: true,
  imports: [
    CommonModule,
    TuiDrawer,
    TuiPopup,
    ErpButtonComponent,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    ::ng-deep .erp-drawer-popup .t-content {
      padding: 0 !important;
    }
  `],
  template: `
    @let openVal = _open();
    @let componentVal = _component();
    
    <tui-drawer
      *tuiPopup="openVal"
      class="erp-drawer-popup"
      [overlay]="_overlay()"
      [direction]="_direction()"
      (click.self)="handleClose()"
      [style.background]="'var(--tui-background-elevation-2)'"
      [style.width]="'300px'"
      [style.border-inline-end]="_direction() === 'start' ? '1px solid var(--tui-border-normal)' : 'none'"
      [style.border-inline-start]="_direction() === 'end' ? '1px solid var(--tui-border-normal)' : 'none'"
      [style.border-top-right-radius]="_direction() === 'start' ? 'var(--tui-radius-l)' : 'none'"
      [style.border-bottom-right-radius]="_direction() === 'start' ? 'var(--tui-radius-l)' : 'none'"
      [style.border-top-left-radius]="_direction() === 'end' ? 'var(--tui-radius-l)' : 'none'"
      [style.border-bottom-left-radius]="_direction() === 'end' ? 'var(--tui-radius-l)' : 'none'"
    >
      <header style="padding: 1.5rem; border-bottom: 1px solid var(--tui-border-normal); display: flex; justify-content: space-between; align-items: center; flex-direction: row;">
        <h3 style="font: var(--tui-typography-heading-h6); margin: 0; color: var(--tui-text-primary);">
          {{ (_title() | erpTranslate) || '' }}
        </h3>
        <erp-button
          [config]="closeButtonConfig"
          style="cursor: pointer; border-radius: var(--tui-radius-m); border: none; background: transparent; color: var(--tui-text-secondary); width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center;"
        />
      </header>

      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        @if (componentVal) {
          <ng-container *ngComponentOutlet="componentVal; inputs: _inputs()" />
        }
      </div>
    </tui-drawer>
  `
})
export class ErpDrawerComponent {
  readonly config = input.required<ErpDrawerConfig>();

  private readonly _router = inject(Router, { optional: true });
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly _open = computed(() => unwrapSignal(this.config().open) ?? false);
  protected readonly _title = computed(() => unwrapSignal(this.config().title));
  protected readonly _overlay = computed(() => unwrapSignal(this.config().overlay) ?? true);
  protected readonly _direction = computed(() => unwrapSignal(this.config().direction) ?? 'start');
  protected readonly _component = computed(() => this.config().component);
  protected readonly _inputs = computed(() => this.config().inputs);

  protected readonly closeButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('icon')
      .setIconStart('@tui.x')
      .setFn(() => this.handleClose())
  );

  constructor() {
    this._router?.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(this._destroyRef)
    ).subscribe(() => {
      const closeOnNav = unwrapSignal(this.config().closeOnNavigation) ?? false;
      if (closeOnNav) {
        this.handleClose();
      }
    });
  }

  protected handleClose(): void {
    const onClose = this.config().onClose;
    if (onClose) {
      onClose();
    }
  }
}
