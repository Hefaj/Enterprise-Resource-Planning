import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { USERS_KEYS } from './keys';

export function provideUsersTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'users',
      alias: 'users',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
