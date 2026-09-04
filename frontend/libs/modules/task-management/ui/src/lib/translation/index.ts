import { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';

export { TASKMANAGEMENT_KEYS } from './keys';

/**
 * Scope modułowy Task Management — nazwy stanów, przejść, priorytetów i rodzajów projektu.
 *
 * <p><b>Dlaczego modułowy, a nie per agregat.</b> Nazwy stanów i przejść <b>nie są napisami
 * w szablonie</b>: schemat trzyma je jako <c>name_key</c> w bazie i wskazuje nimi wprost na ten
 * registry (patrz `WorkflowSchemeDefaults` w `TaskManagement.Domain` i
 * `docs/modules/task-management/screens.md` §8). Renderuje je lista zgłoszeń, karta zgłoszenia,
 * a od fazy 2 także tablica i konfiguracja projektu — czyli cztery różne scope'y agregatów.
 * Wciśnięcie ich w scope jednego z nich zmusiłoby pozostałe do ładowania cudzego scope'u.</p>
 *
 * <p>Mieszka w warstwie `ui`, dokładnie jak `provideJobTranslations` w Notification: `type:util`
 * nie może zależeć od `type:ui`, więc niżej nie ma wspólnego mianownika.</p>
 *
 * <p>Rejestrować wyłącznie w providerach agregujących modułu (trasa, loader komponentu
 * z kontraktu), <b>NIGDY</b> w dekoratorze `@Component` komponentu współdzielonego — to tworzy
 * child injector przesłaniający scope nadrzędny (patrz `docs/guides/frontend/translations.md`).</p>
 */
export function provideTaskManagementTranslations(): Provider[] {
  return [
    provideTranslocoScope({
      scope: 'taskManagement',
      alias: 'taskManagement',
      loader: {
        'pl-PL': () => import('./pl-PL.json'),
        'en-US': () => import('./en-US.json'),
      },
    }),
    provideSharedTranslations(),
  ];
}
