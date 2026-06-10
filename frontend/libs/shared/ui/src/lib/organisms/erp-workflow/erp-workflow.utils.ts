import { WorkflowNodeAction, WorkflowNodeType } from './erp-workflow.types';

/**
 * Tworzy grupę typów węzłów w menu dodawania.
 */
export function workflowGroup(label: string, icon: string, items: WorkflowNodeType[]): WorkflowNodeType {
  return { label, icon, items };
}

/**
 * Definiuje typ węzła workflow.
 */
export function workflowNode(
  type: string, 
  label: string, 
  config: Partial<Omit<WorkflowNodeType, 'type' | 'label'>> = {}
): WorkflowNodeType {
  return { 
    type, 
    label, 
    defaultWidth: 200, 
    ...config 
  };
}

/**
 * Definiuje akcję dostępną dla węzła.
 */
export function workflowAction(
  label: string, 
  icon: string, 
  command: WorkflowNodeAction['command']
): WorkflowNodeAction {
  return { label, icon, command };
}
