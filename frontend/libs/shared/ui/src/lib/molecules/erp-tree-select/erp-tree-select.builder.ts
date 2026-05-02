import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTreeSelectConfig } from './erp-tree-select.types';
import { TreeNode } from 'primeng/api';

export class ErpTreeSelectBuilder extends ErpBaseBuilder<ErpTreeSelectConfig> {
  public setOptions(options: TreeNode[]): this {
    this._data.options = options;
    return this;
  }

  public setPlaceholder(placeholder: string): this {
    this._data.placeholder = placeholder;
    return this;
  }

  public setOnNodeExpand(onNodeExpand: (node: TreeNode) => Promise<void> | void): this {
    this._data.onNodeExpand = onNodeExpand;
    return this;
  }

  public setOnLoadMore(onLoadMore: (parentNode: TreeNode | null) => Promise<void> | void): this {
    this._data.onLoadMore = onLoadMore;
    return this;
  }
}
