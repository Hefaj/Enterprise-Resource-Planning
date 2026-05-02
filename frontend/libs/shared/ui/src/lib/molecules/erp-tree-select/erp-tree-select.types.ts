import { TreeNode } from 'primeng/api';
import { ErpInputBase } from '../../base/erp-input-base';

export interface ErpTreeSelection {
  selectedItems: string[];
  selectedChildrenOf: string[];
}

export interface ErpTreeSelectConfig extends ErpInputBase {
  options: TreeNode[];
  onNodeExpand?: (node: TreeNode) => Promise<void> | void;
  onLoadMore?: (parentNode: TreeNode | null) => Promise<void> | void;
}
