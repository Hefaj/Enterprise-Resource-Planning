import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { MULTIMEDIA_KEYS } from './keys';

export function provideMultimediaTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'multimedia',
      alias: 'multimedia',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
