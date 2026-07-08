import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { DOCUMENT_KEYS } from './keys';

export function provideDocumentTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'document',
      alias: 'document',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations()
  ];
}
