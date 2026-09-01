import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';

export { REQUEST_KEYS } from './keys';

/**
 * Scope tłumaczeń strony `/task-management/request` (`zlecenia międzydziałowe`, faza 5).
 *
 * Strona ponownie wykorzystuje `IssueTabComponent`/`IssueStore` (agregat pozostaje ten sam —
 * zlecenie to zgłoszenie w projekcie typu `Intake`), więc dokłada też scope `issue`, którego
 * te komponenty faktycznie używają.
 */
export function provideRequestTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'request',
      alias: 'request',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    ...provideTaskManagementTranslations(),
  ];
}
