import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { PERMISSIONS_KEYS } from './keys';

export function providePermissionsTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'permissions',
      alias: 'permissions',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
