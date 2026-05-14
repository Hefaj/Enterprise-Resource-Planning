import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpCardConfig {
  header?: MaybeSignal<string | undefined>;
  title?: MaybeSignal<string | undefined>;
  subtitle?: MaybeSignal<string | undefined>;
  styleClass?: MaybeSignal<string | undefined>;
  contentStyleClass?: MaybeSignal<string | undefined>;
  contentComponent?: Type<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentConfig?: ErpComponentSignalInputs<any>;
  footerComponent?: Type<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  footerConfig?: ErpComponentSignalInputs<any>;
  headerComponent?: Type<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headerConfig?: ErpComponentSignalInputs<any>;
}
