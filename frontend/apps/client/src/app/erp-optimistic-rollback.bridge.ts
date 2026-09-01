import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ErpOptimisticStore, OptimisticRollback } from '@erp/shared/data-access';
import { ErpToastService, SHARED_KEYS, Translatable, parseJobErrorsSummary, resolveErrorCodeKey } from '@erp/shared/ui';

/**
 * Zamienia cofnięcie nakładki optymistycznej w toast — druga strona `ErpJobToastBridge`
 * (tam samo uzasadnienie): `ErpOptimisticStore` mieszka w `shared/data-access`,
 * `ErpToastService` w `shared/ui`, a te dwie biblioteki nie mogą się nawzajem widzieć
 * (`type:data-access` → `{data-access, util}`, `type:ui` → `{ui, util}`). Host jest jedyną
 * warstwą widzącą obie naraz.
 *
 * <p><b>Dlaczego nie toast o sukcesie.</b> Nakładka ma WŁASNĄ ścieżkę komunikatu — użytkownik
 * widzi skutek swojej akcji natychmiast na ekranie (karta w nowym stanie, komentarz na liście),
 * więc toast o powodzeniu byłby drugim, zbędnym potwierdzeniem tego samego. `notifyOnComplete`
 * (`ErpJobToastBridge`) zostaje nietknięty i dalej obsługuje operacje BEZ nakładki (masowe,
 * eksporty) — te dwa mosty się nie nakładają.</p>
 */
@Injectable({ providedIn: 'root' })
export class ErpOptimisticRollbackBridge {
  private readonly _optimistic = inject(ErpOptimisticStore);
  private readonly _toasts = inject(ErpToastService);
  private readonly _destroyRef = inject(DestroyRef);

  public constructor() {
    this._optimistic.rollbacks$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((rollback) => {
      this._notify(rollback);
    });
  }

  private _notify(rollback: OptimisticRollback): void {
    this._toasts.show({
      message: this._messageFor(rollback),
      appearance: 'negative',
    });
  }

  /**
   * Pierwszy kod z `errorsSummary` wygrywa — nakładka dotyczy JEDNEGO agregatu, więc zadanie
   * za nią stojące ma co najwyżej jeden nieudany element i co najwyżej jeden kod błędu do
   * pokazania. `failureMessage` z operacji jest fallbackiem, gdy kod nie ma tłumaczenia
   * (`resolveErrorCodeKey` zwraca `null`) albo gdy cofnięcie przyszło z samego HTTP, gdzie
   * `errorsSummary` w ogóle nie istnieje.
   */
  private _messageFor(rollback: OptimisticRollback): Translatable {
    const [firstError] = parseJobErrorsSummary(rollback.errorsSummary);
    const codeKey = firstError ? resolveErrorCodeKey(firstError.code) : null;

    if (codeKey) {
      return codeKey;
    }

    return rollback.failureMessage ?? SHARED_KEYS.optimistic.rollback.generic;
  }
}
