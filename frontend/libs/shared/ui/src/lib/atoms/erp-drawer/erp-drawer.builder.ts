import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpDrawerConfig } from './erp-drawer.types';

export class ErpDrawerBuilder extends ErpBaseBuilder<ErpDrawerConfig> {
  public setOpen(open: MaybeSignal<boolean>): this {
    this._data.open = open;
    return this;
  }

  public setTitle(title: MaybeSignal<Translatable>): this {
    this._data.title = title;
    return this;
  }

  public setOverlay(overlay: MaybeSignal<boolean>): this {
    this._data.overlay = overlay;
    return this;
  }

  public setDirection(direction: MaybeSignal<'start' | 'end'>): this {
    this._data.direction = direction;
    return this;
  }

  public setComponent(component: Type<any>): this {
    this._data.component = component;
    return this;
  }

  public setOnClose(onClose: () => void): this {
    this._data.onClose = onClose;
    return this;
  }
}
