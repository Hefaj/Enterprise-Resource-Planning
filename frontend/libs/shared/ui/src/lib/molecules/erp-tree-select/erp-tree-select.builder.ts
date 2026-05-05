import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTreeSelectConfig } from './erp-tree-select.types';
import { TreeNode } from 'primeng/api';

export class ErpTreeSelectBuilder extends ErpBaseBuilder<ErpTreeSelectConfig> {
  /** Ustawia dostępne węzły drzewa. */
  public setOptions(options: TreeNode[]): this {
    this._data.options = options;
    return this;
  }

  /** Tekst zastępczy wyświetlany, gdy nic nie jest zaznaczone. */
  public setPlaceholder(placeholder: string): this {
    this._data.placeholder = placeholder;
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
