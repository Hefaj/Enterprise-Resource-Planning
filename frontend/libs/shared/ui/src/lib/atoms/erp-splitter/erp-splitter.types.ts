import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export interface ErpSplitterPanel<TComp = any> {
  size?: MaybeSignal<number | undefined>;
  minSize?: MaybeSignal<number | undefined>;
  component: MaybeSignal<Type<TComp>>;
  config?: MaybeSignal<ErpComponentSignalInputs<TComp> | any>;
  styleClass?: MaybeSignal<string | undefined>;
  style?: MaybeSignal<Record<string, string> | undefined>;
}

export interface ErpSplitterConfig {
  layout?: MaybeSignal<'horizontal' | 'vertical' | undefined>;
  gutterSize?: MaybeSignal<number | undefined>;
  style?: MaybeSignal<Record<string, string> | undefined>;
  styleClass?: MaybeSignal<string | undefined>;
  panelSizes?: MaybeSignal<number[] | undefined>;
  minSizes?: MaybeSignal<number[] | undefined>;
  panels: MaybeSignal<ErpSplitterPanel[]>;
}
