import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { IDENTITY_KEYS } from './keys';

/**
 * Scope tłumaczeń modułu Identity. Rejestrować wyłącznie w providerach agregujących modułu
 * (trasa, loader komponentu z kontraktu), NIGDY w dekoratorze `@Component` komponentu
 * współdzielonego — to tworzy child injector przesłaniający scope nadrzędny
 * (patrz `docs/frontend/translations.md`).
 */
export function provideIdentityTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'identity',
      alias: 'identity',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
