import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpTreeSelectConfig } from './erp-tree-select.types';
import { TreeNode } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpTreeSelectBuilder extends ErpInputBaseBuilder<ErpTreeSelectConfig> {
  /** Ustawia dostępne węzły drzewa. */
  public setOptions(options: MaybeSignal<TreeNode[]>): this {
    this._data.options = options;
    return this;
  }

  /** Callback wywoływany przy rozwinięciu węzła (lazy-loading dzieci). */
  public setOnNodeExpand(onNodeExpand: (node: TreeNode) => Promise<void> | void): this {
    this._data.onNodeExpand = onNodeExpand;
    return this;
  }

  /** Callback wywoływany przy doczytywaniu kolejnych stron (infinite scroll). */
  public setOnLoadMore(onLoadMore: (parentNode: TreeNode | null) => Promise<void> | void): this {
    this._data.onLoadMore = onLoadMore;
    return this;
  }
}
