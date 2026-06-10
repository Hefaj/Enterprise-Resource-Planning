import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpAvatarConfig } from './erp-avatar.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpAvatarBuilder extends ErpBaseBuilder<ErpAvatarConfig> {

  public setShape(shape: MaybeSignal<'square' | 'circle' | undefined>): this {
    this._data.shape = shape;
    return this;
  }

  public setSize(size: MaybeSignal<'normal' | 'large' | 'xlarge' | undefined>): this {
    this._data.size = size;
    return this;
  }

  public setLabel(label: MaybeSignal<string | undefined>): this {
    this._data.label = label;
    return this;
  }

  public setIcon(icon: MaybeSignal<string | undefined>): this {
    this._data.icon = icon;
    return this;
  }

  public setImage(image: MaybeSignal<string | undefined>): this {
    this._data.image = image;
    return this;
  }
}
