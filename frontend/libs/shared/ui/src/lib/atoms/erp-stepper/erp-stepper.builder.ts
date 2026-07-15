import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpStepperConfig } from './erp-stepper.types';

export class ErpStepperBuilder extends ErpBaseBuilder<ErpStepperConfig> {
  public setSteps(steps: MaybeSignal<Translatable[]>): this {
    this._data.steps = steps;
    return this;
  }

  public setActiveItemIndex(index: MaybeSignal<number>): this {
    this._data.activeItemIndex = index;
    return this;
  }

  public setOrientation(orientation: MaybeSignal<'horizontal' | 'vertical'>): this {
    this._data.orientation = orientation;
    return this;
  }

  public setActiveItemIndexChange(fn: (index: number) => void): this {
    this._data.activeItemIndexChange = fn;
    return this;
  }
}
