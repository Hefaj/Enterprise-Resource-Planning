import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';

export { PROJECT_KEYS } from './keys';

/**
 * Scope tłumaczeń agregatu `Project` — lista projektów i karta projektu.
 *
 * Dokłada scope modułowy (`taskManagement`), bo nazwy pól niestandardowych przychodzą z bazy
 * jako klucze tłumaczeń, a nie z tego pliku (`docs/frontend/task-management-pages.md` §8).
 */
export function provideProjectTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'project',
      alias: 'project',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    ...provideTaskManagementTranslations(),
  ];
}
