import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpAvatar } from './erp-avatar.component';

export class ErpAvatarBuilder extends ErpBaseBuilder<ErpAvatar> {
  public setShape(shape: 'square' | 'circle'): this {
    this._data.shape = shape;
    return this;
  }

  public setSize(size: 'normal' | 'large' | 'xlarge'): this {
    this._data.size = size;
    return this;
  }

  public setLabel(label: string): this {
    this._data.label = label;
    return this;
  }

  public setIcon(icon: string): this {
    this._data.icon = icon;
    return this;
  }

  public setImage(image: string): this {
    this._data.image = image;
    return this;
  }
}
