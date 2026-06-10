import { TreeNode } from 'primeng/api';
import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpTreeSelection {
  selectedItems: string[];
  selectedChildrenOf: string[];
}

export interface ErpTreeSelectConfig extends ErpInputBase {
  options: MaybeSignal<TreeNode[]>;
  onNodeExpand?: (node: TreeNode) => Promise<void> | void;
  onLoadMore?: (parentNode: TreeNode | null) => Promise<void> | void;
}
