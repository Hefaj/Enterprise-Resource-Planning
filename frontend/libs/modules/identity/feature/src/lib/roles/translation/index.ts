import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { ROLES_KEYS } from './keys';

export function provideRolesTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'roles',
      alias: 'roles',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
