import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { WorkflowNodeAction, WorkflowNodeType } from './erp-workflow.types';

/**
 * Builder dla pojedynczego typu węzła workflow.
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

/**
 * Główny builder do budowania listy dostępnych typów węzłów (hierarchii).
 */
export class ErpWorkflowBuilder {
  private _types: WorkflowNodeType[] = [];

  public static create(configure: (builder: ErpWorkflowBuilder) => void): WorkflowNodeType[] {
    const builder = new ErpWorkflowBuilder();
    configure(builder);
    return builder.build();
  }

  /**
   * Dodaje prosty węzeł.
   */
  public addNode(
    type: string, 
    label: string, 
    configure?: (b: ErpWorkflowNodeTypeBuilder) => void
  ): this {
    const builder = new ErpWorkflowNodeTypeBuilder();
    builder.setType(type).setLabel(label).setDefaultWidth(200);
    
    if (configure) {
      configure(builder);
    }
    
    this._types.push(builder.build());
    return this;
  }

  /**
   * Dodaje grupę węzłów (podmenu).
   */
  public addGroup(
    label: string, 
    icon: string, 
    configure: (builder: ErpWorkflowBuilder) => void
  ): this {
    const subBuilder = new ErpWorkflowBuilder();
    configure(subBuilder);
    
    this._types.push({
      label,
      icon,
      items: subBuilder.build()
    });
    
    return this;
  }

  public build(): WorkflowNodeType[] {
    return this._types;
  }
}
