import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { GRANTAUDIT_KEYS } from './keys';

export function provideGrantAuditTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'grantAudit',
      alias: 'grantAudit',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
