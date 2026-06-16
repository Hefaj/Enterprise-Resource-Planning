import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';

export { PRODUCT_KEYS } from './keys';

export function provideProductTranslations(): Provider {
  return provideTranslocoScope({
    scope: 'product',
    loader: {
      'pl-PL': () => import('./pl-PL.json'),
      'en-US': () => import('./en-US.json'),
    },
  });
}
