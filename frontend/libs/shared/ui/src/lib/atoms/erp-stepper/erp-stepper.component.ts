import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiStepper } from '@taiga-ui/kit';
import { ErpStepperConfig } from './erp-stepper.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';

@Component({
  selector: 'erp-stepper',
  standalone: true,
  imports: [CommonModule, TuiStepper, ErpTranslatePipe],
  template: `
    @let _steps = steps();
    @let _active = activeItemIndex();
    @let _orientation = orientation();

    <tui-stepper
      [activeItemIndex]="_active"
      [orientation]="_orientation"
      (activeItemIndexChange)="onActiveIndexChange($event)"
    >
      @for (step of _steps; track $index) {
        <button
          tuiStep
          [disabled]="$index !== _active"
        >
          {{ step | erpTranslate }}
        </button>
      }
    </tui-stepper>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpStepperComponent {
  public config = input.required<ErpStepperConfig>();

  protected steps = computed(() => unwrapSignal(this.config().steps) || []);
  protected activeItemIndex = computed(() => {
    const idx = unwrapSignal(this.config().activeItemIndex);
    return idx === undefined ? 0 : idx;
  });
  protected orientation = computed(() => unwrapSignal(this.config().orientation) || 'horizontal');

  protected onActiveIndexChange(index: number): void {
    const changeFn = this.config().activeItemIndexChange;
    if (changeFn) {
      changeFn(index);
    }
  }
}
