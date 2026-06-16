import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { PRODUCT_KEYS } from './keys';

export function provideProductTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'product',
      alias: 'product',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations()
  ];
}
