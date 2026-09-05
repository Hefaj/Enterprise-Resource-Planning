import { ChangeDetectorRef, Inject, OnDestroy, Optional, Pipe, PipeTransform } from '@angular/core';
import { TRANSLOCO_LANG, TRANSLOCO_SCOPE, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, Subscription } from 'rxjs';
import { Translatable } from './erp-signal-utils';

@Pipe({
  name: 'erpTranslate',
  standalone: true,
  pure: false
})
export class ErpTranslatePipe extends TranslocoPipe implements PipeTransform, OnDestroy {
  private pendingLoadSubscription: Subscription | null = null;

  constructor(
    private readonly translocoService: TranslocoService,
    @Optional() @Inject(TRANSLOCO_SCOPE) providerScope: any,
    @Optional() @Inject(TRANSLOCO_LANG) providerLang: any,
    private readonly cdRef: ChangeDetectorRef
  ) {
    super(translocoService, providerScope, providerLang, cdRef);
  }

  override transform(value: Translatable | null | undefined, params?: any): string {
    if (!value) return '';
    const key = typeof value === 'string' ? value : value.key;
    const resolvedParams = typeof value === 'string' ? params : value.params || params;
    let result = typeof value === 'string' ? super.transform(value, params) : super.transform(value.key, resolvedParams);

    // Caretaker note: konsument spoza drzewa, które wstrzyknęło potrzebny scope przez
    // `provideTranslocoScope` (np. `erp-breadcrumb` w powłoce, renderujący klucze modułu poza
    // jego routowanym poddrzewem — `docs/guides/frontend/translations.md`), potrafi wywołać ten
    // pipe ZANIM scope się doładuje. Bazowy `TranslocoPipe` subskrybuje `langChanges$` tylko RAZ
    // na klucz i cache'uje wtedy nieprzetłumaczony klucz NA STAŁE — język się nie zmienia, więc
    // subskrypcja nigdy nie odpali ponownie samoistnie.
    if (typeof key === 'string' && result === key) {
      // Scope mógł się już doładować za innego konsumenta w międzyczasie (np. te same badge'e
      // stanu/priorytetu w treści strony) — sprawdzamy to OD RAZU, zanim uzbroimy nasłuch,
      // bo `events$` to zwykły `Subject`: zdarzenie sprzed subskrypcji jest bezpowrotnie stracone.
      const freshValue = this.translocoService.translate(key, resolvedParams);
      if (freshValue !== key) {
        result = freshValue;
        (this as unknown as { lastValue: string }).lastValue = freshValue;
      } else if (!this.pendingLoadSubscription) {
        this.pendingLoadSubscription = this.translocoService.events$
          .pipe(filter((event) => event.type === 'translationLoadSuccess'))
          .subscribe(() => {
            this.pendingLoadSubscription?.unsubscribe();
            this.pendingLoadSubscription = null;
            (this as unknown as { lastKey?: string }).lastKey = undefined;
            this.cdRef.markForCheck();
          });
      }
    }

    return result;
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.pendingLoadSubscription?.unsubscribe();
    this.pendingLoadSubscription = null;
  }
}
