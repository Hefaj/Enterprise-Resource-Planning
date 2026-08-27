import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';

export { BOARD_KEYS } from './keys';

/**
 * Scope tłumaczeń tablicy.
 *
 * Dokłada scope modułowy (`taskManagement`), bo nazwy kolumn i priorytetów na kartach
 * przychodzą z bazy jako klucze, a nie z tego pliku
 * (`docs/frontend/task-management-pages.md` §8). `provideTaskManagementTranslations`
 * wciąga już `provideSharedTranslations`, więc nie powtarzamy go tutaj.
 */
export function provideBoardTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'board',
      alias: 'board',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    ...provideTaskManagementTranslations(),
  ];
}
