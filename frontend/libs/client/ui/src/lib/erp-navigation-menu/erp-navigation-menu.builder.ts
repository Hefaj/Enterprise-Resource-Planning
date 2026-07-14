import { ErpBaseBuilder } from 'frontend/libs/shared/ui/src/lib/base/erp-base-builder';
import { ErpNavigationMenuConfig, ErpNavigationItem } from './erp-navigation-menu.types';

export class ErpNavigationMenuBuilder extends ErpBaseBuilder<ErpNavigationMenuConfig> {

  public setItems(items: ErpNavigationItem[]): this {
    this._data.items = items;
    return this;
  }

  public setShowSingle(showSingle: boolean): this {
    this._data.showSingle = showSingle;
    return this;
  }
}