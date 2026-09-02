import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';

export { REPORT_KEYS } from './keys';

/** Scope tłumaczeń strony `/task-management/report` (raport godzin, faza 7, RPT-002). */
export function provideReportTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'report',
      alias: 'report',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    ...provideTaskManagementTranslations(),
  ];
}
