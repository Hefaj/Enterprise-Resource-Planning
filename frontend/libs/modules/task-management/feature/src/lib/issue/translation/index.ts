import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';

export { ISSUE_KEYS } from './keys';

/**
 * Scope tłumaczeń agregatu `Issue` — napisy stron listy i karty zgłoszenia.
 *
 * Dokłada scope modułowy (`taskManagement`), bo obie te strony renderują nazwy stanów, przejść
 * i priorytetów, których klucze przychodzą z bazy, a nie z tego pliku
 * (`docs/frontend/task-management-pages.md` §8). `provideTaskManagementTranslations`
 * wciąga już `provideSharedTranslations`, więc nie powtarzamy go tutaj.
 */
export function provideIssueTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'issue',
      alias: 'issue',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    ...provideTaskManagementTranslations(),
  ];
}
