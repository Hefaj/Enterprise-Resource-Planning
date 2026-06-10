import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { WorkflowNode, WorkflowEdge, WorkflowNodeAction, WorkflowNodeType, ErpWorkflowConfig } from './erp-workflow.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

/**
 * Główny builder dla komponentu ErpWorkflow.
 */
export class ErpWorkflowBuilder extends ErpBaseBuilder<ErpWorkflowConfig> {
  constructor() {
    super();
    this._data.nodes = [];
    this._data.edges = [];
  }

  /** Ustawia listę węzłów workflow. */
  public setNodes(nodes: MaybeSignal<WorkflowNode[]>): this {
    this._data.nodes = nodes;
    return this;
  }

  /** Ustawia listę połączeń (krawędzi) między węzłami. */
  public setEdges(edges: MaybeSignal<WorkflowEdge[]>): this {
    this._data.edges = edges;
    return this;
  }

  /** Ustawia tryb tylko do odczytu. */
  public setReadonlyMode(readonly: MaybeSignal<boolean>): this {
    this._data.readonlyMode = readonly;
    return this;
  }

  /** Ustawia listę globalnych akcji dostępnych dla węzłów. */
  public setActions(actions: MaybeSignal<WorkflowNodeAction[]>): this {
    this._data.actions = actions;
    return this;
  }

  /** Ustawia strukturę dostępnych typów węzłów w menu. */
  public setAvailableNodeTypes(types: MaybeSignal<WorkflowNodeType[]>): this {
    this._data.availableNodeTypes = types;
    return this;
  }

  /** Callback wywoływany przy zmianie listy węzłów (np. dodanie, przesunięcie, usunięcie). */
  public setOnNodesChange(cb: (nodes: WorkflowNode[]) => void): this {
    this._data.onNodesChange = cb;
    return this;
  }

  /** Callback wywoływany przy zmianie listy połączeń. */
  public setOnEdgesChange(cb: (edges: WorkflowEdge[]) => void): this {
    this._data.onEdgesChange = cb;
    return this;
  }
}

/**
 * Builder dla pojedynczego typu węzła workflow (pomocniczy).
 */
export class ErpWorkflowNodeTypeBuilder extends ErpBaseBuilder<WorkflowNodeType> {
  constructor() {
    super();
    this._data.actions = [];
  }

  public setType(type: string): this {
    this._data.type = type;
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

  public setDefaultWidth(width: number): this {
    this._data.defaultWidth = width;
    return this;
  }

  public addAction(label: string, icon: string, command: WorkflowNodeAction['command']): this {
    this._data.actions?.push({ label, icon, command });
    return this;
  }
}
