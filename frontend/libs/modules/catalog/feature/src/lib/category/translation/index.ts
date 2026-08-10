import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { CATEGORY_KEYS } from './keys';

export function provideCategoryTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'category',
      alias: 'category',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
