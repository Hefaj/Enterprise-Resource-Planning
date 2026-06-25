import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpListConfig {
  items: MaybeSignal<any[] | undefined>;
  itemLabel?: MaybeSignal<string | ((item: any) => string) | undefined>;
  itemValue?: MaybeSignal<string | ((item: any) => any) | undefined>;
  virtualScroll?: MaybeSignal<boolean | undefined>;
  virtualScrollItemSize?: MaybeSignal<number | undefined>;
  readonly?: MaybeSignal<boolean | undefined>;
  selectionMode?: MaybeSignal<'single' | 'multiple' | 'none' | undefined>;
  multiple?: MaybeSignal<boolean | undefined>;
  checkbox?: MaybeSignal<boolean | undefined>;
  filter?: MaybeSignal<boolean | undefined>;
  filterPlaceholder?: MaybeSignal<string | undefined>;
  scrollHeight?: MaybeSignal<string | undefined>;
  itemComponent?: MaybeSignal<Type<any> | undefined>;
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
}
