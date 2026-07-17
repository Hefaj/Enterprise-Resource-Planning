import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpInputSize } from '../erp-input/erp-input.types';

export type ErpInputNumberMode = 'integer' | 'decimal';
export type ErpInputNumberSign = 'positive' | 'negative' | 'any';

export interface ErpInputNumberConfig extends ErpInputBase {
  disabled?: MaybeSignal<boolean>;
  iconStart?: MaybeSignal<ErpIcon | undefined>;
  iconEnd?: MaybeSignal<ErpIcon | undefined>;
  size?: MaybeSignal<ErpInputSize>;
  value?: MaybeSignal<number | null>;
  label?: MaybeSignal<Translatable | undefined>;
  
  /** Określa tryb pola: całkowity ('integer') lub zmiennoprzecinkowy ('decimal'). Domyślnie 'integer'. */
  mode?: MaybeSignal<ErpInputNumberMode>;
  
  /** Liczba miejsc po przecinku w trybie 'decimal'. Domyślnie 2. */
  decimals?: MaybeSignal<number>;
  
  /** Dozwolony znak liczby: dodatnia ('positive'), ujemna ('negative') lub dowolna ('any'). Domyślnie 'any'. */
  sign?: MaybeSignal<ErpInputNumberSign>;
  
  /** Określa, czy pole posiada stepper (przyciski + / - do zmiany wartości). Domyślnie false. */
  stepper?: MaybeSignal<boolean>;
  
  /** Minimalna dopuszczalna wartość w polu. */
  min?: MaybeSignal<number>;
  
  /** Maksymalna dopuszczalna wartość w polu. */
  max?: MaybeSignal<number>;
  
  /** Krok dla steppera (np. 1, 0.5, 0.01). */
  step?: MaybeSignal<number>;
}
