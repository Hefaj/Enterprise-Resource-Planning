import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpPopoverConfig } from './erp-popover.types';

export class ErpPopoverBuilder extends ErpBaseBuilder<ErpPopoverConfig> {
  /**
   * Ustawia dynamiczny komponent wyświetlany w popoverze wraz z silnie typowanymi danymi wejściowymi.
   */
  public setComponent<C>(component: MaybeSignal<Type<C>>, inputs?: MaybeSignal<ErpComponentSignalInputs<C>>): this {
    this._data.component = component;
    if (inputs !== undefined) {
      this._data.componentInputs = inputs as any;
    }
    return this;
  }

  /**
   * Ustawia element, do którego ma zostać dołączony popover.
   * Domyślnie jest to 'body'.
   */
  public setAppendTo(appendTo: MaybeSignal<any | string>): this {
    this._data.appendTo = appendTo;
    return this;
  }

  /**
   * Ustawia niestandardową klasę CSS dla popovera.
   */
  public setStyleClass(styleClass: MaybeSignal<string>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  /**
   * Ustawia opcje animacji (motion) dla popovera (zastępuje dawne showTransitionOptions/hideTransitionOptions).
   */
  public setMotionOptions(options: MaybeSignal<any>): this {
    this._data.motionOptions = options;
    return this;
  }

  /**
   * Określa, czy popover może zostać zamknięty poprzez kliknięcie poza nim lub naciśnięcie Escape.
   * Domyślnie true.
   */
  public setDismissable(dismissable: MaybeSignal<boolean>): this {
    this._data.dismissable = dismissable;
    return this;
  }
}
