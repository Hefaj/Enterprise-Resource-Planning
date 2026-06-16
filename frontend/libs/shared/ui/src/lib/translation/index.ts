import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';

export { SHARED_KEYS } from './keys';

export function provideSharedTranslations(): Provider {
  return provideTranslocoScope({
    scope: 'shared',
    alias: 'shared',
    loader: {
      'pl-PL': () => import('./pl-PL.json'),
      'en-US': () => import('./en-US.json'),
    },
  });
}
