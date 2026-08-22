import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { WARRANTY_KEYS } from './keys';

export function provideWarrantyTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'warranty',
      alias: 'warranty',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
