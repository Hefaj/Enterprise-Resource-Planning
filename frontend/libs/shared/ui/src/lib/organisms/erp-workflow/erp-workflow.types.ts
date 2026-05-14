import { MaybeSignal } from '../../base/erp-signal-utils';

export interface WorkflowNode<TMetadata = Record<string, unknown>> {
  id: string;
  type: 'start' | 'end' | 'action' | 'condition' | 'and' | 'or' | 'loop' | string;
  label: string;
  position: { x: number; y: number };
  status?: 'pending' | 'in-progress' | 'completed' | 'error';
  metadata?: TMetadata;
  actions?: WorkflowNodeAction[];
  width?: number;
  height?: number;
}

export interface WorkflowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowNodeAction {
  label: string;
  icon?: string;
  command: (event: { originalEvent: Event; node: WorkflowNode }) => void;
}

export interface WorkflowNodeType {
  type?: string;
  label: string;
  defaultWidth?: number;
  icon?: string;
  items?: WorkflowNodeType[];
  actions?: WorkflowNodeAction[];
}

export interface ErpWorkflowConfig {
  nodes: MaybeSignal<WorkflowNode[]>;
  edges: MaybeSignal<WorkflowEdge[]>;
  readonlyMode?: MaybeSignal<boolean>;
  actions?: MaybeSignal<WorkflowNodeAction[]>;
  availableNodeTypes?: MaybeSignal<WorkflowNodeType[]>;

  // Callbacks for state changes if not using signals for nodes/edges
  onNodesChange?: (nodes: WorkflowNode[]) => void;
  onEdgesChange?: (edges: WorkflowEdge[]) => void;
}
