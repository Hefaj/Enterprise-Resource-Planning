import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { JOB_KEYS } from './keys';

/**
 * Scope tłumaczeń zadań masowych.
 *
 * Mieszka w warstwie `ui`, a nie w `feature` jak w Catalogu, bo to komponenty prezentacyjne
 * (`erp-job-item`) są tu głównym konsumentem kluczy — a `type:util` nie może zależeć
 * od `type:ui`, więc wspólnego mianownika niżej po prostu nie ma.
 *
 * Rejestrować wyłącznie w providerach agregujących modułu (trasa, loader komponentu z kontraktu),
 * NIGDY w dekoratorze `@Component` komponentu współdzielonego — to tworzy child injector
 * przesłaniający scope nadrzędny (patrz `docs/guides/frontend/translations.md`).
 */
export function provideJobTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'job',
      alias: 'job',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
