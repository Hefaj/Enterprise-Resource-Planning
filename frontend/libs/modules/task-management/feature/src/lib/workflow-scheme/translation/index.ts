import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';
export { WORKFLOW_KEYS } from './keys';
export function provideWorkflowTranslations(): Provider[] {
  return [provideTranslocoScope({ scope: 'workflow', alias: 'workflow', loader: { 'pl-PL': () => import('./pl-PL.json'), 'en-US': () => import('./en-US.json') } }), ...provideTaskManagementTranslations()];
}
