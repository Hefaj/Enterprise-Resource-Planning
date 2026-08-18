import { computed, effect, inject, signal, untracked } from '@angular/core';
import { CatalogProductOrchestrator, ProductVM, SearchProductRequest } from '@erp/catalog/data-access';
import { ErpBatchTargets, erpBuildBatchTargets, erpSelectionScopeCount } from '@erp/shared/ui';
import { ProductStore } from '../product.store';

/**
 * Ilu produktów dotyczy podgląd zakładki, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const PRODUCT_SCOPE_PREVIEW_LIMIT = 10;

/**
 * Wspólna podstawa zakładek strony produktów zależnych od zaznaczenia (multimedia, gwarancje…).
 *
 * Zbiera w jednym miejscu całą obsługę „Zaznacz wszystko" opisaną w
 * `docs/frontend/selection-scope.md`, żeby każda kolejna zakładka nie odtwarzała jej po swojemu
 * (a najczęściej — nie pomijała, czytając `selection().selectedItems` wprost i pokazując pusty
 * ekran przy tysiącach zaznaczonych produktów):
 *
 * - zasięg (`scope`) zamiast surowego zaznaczenia — jedno źródło prawdy o celu operacji,
 * - próbka produktów w trybie `query` (rozwiązywana przez `ProductStore.resolveUuids`),
 * - blokada granularnego wyboru tam, gdzie panel pokazuje tylko próbkę,
 * - modele widoku brane z orkiestratora po UUID (aktualizacje z SignalR, zaznaczenie
 *   zmaterializowane działa identycznie jak ręczne),
 * - unieważnianie podzaznaczenia przy zmianie zbioru produktów.
 *
 * `TChild` to typ wiersza podrzędnego zakładki (plik multimediów, przypisanie gwarancji…) —
 * store trzyma zaznaczone wiersze w oryginalnej postaci, a zakładka wyprowadza z nich to,
 * czego potrzebuje jej akcja (`computed`).
 *
 * Klasa jest celowo NIEudekorowana — dziedziczą po niej store'y zakładek oznaczone
 * `@Injectable()` i rejestrowane na poziomie komponentu zakładki.
 */
export abstract class ProductScopeTabStore<TChild = unknown> {
  private readonly page = inject(ProductStore);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);

  /** Zasięg zaznaczenia produktów — to on rozstrzyga, co panel może pokazać i pozwolić zrobić. */
  public readonly scope = this.page.scope;
  public readonly scopeKind = this.page.scopeKind;

  /** Liczność zasięgu — w trybie `query` to szacunek z licznika wyników. */
  public readonly scopeCount = computed<number>(() => erpSelectionScopeCount(this.scope()));

  /** Czy zaznaczenie powstało z „Zaznacz wszystko" rozwiązanego do listy identyfikatorów. */
  public readonly isMaterialized = computed<boolean>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && scope.materialized;
  });

  /** Czy trwa rozwiązywanie zaznaczenia „wszystko" do listy identyfikatorów. */
  public readonly resolving = computed<boolean>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && scope.loading;
  });

  /**
   * Czy wolno wybierać pojedyncze wiersze podrzędne. Przy zaznaczeniu opisanym filtrem — nie:
   * checkbox obiecuje „operacja obejmie dokładnie to", a przy próbce z tysięcy produktów to
   * nieprawda. Tak samo zachowuje się tabela produktów, która przy „Zaznacz wszystko" blokuje
   * checkboxy wierszy.
   */
  public readonly canSelectChildren = computed<boolean>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && !scope.loading;
  });

  private readonly _previewUuids = signal<string[]>([]);

  /** UUID produktów, które zakładka faktycznie renderuje (komplet albo próbka). */
  public readonly visibleProductUuids = computed<string[]>(() => {
    const scope = this.scope();
    if (scope.kind === 'explicit') return scope.ids;
    if (scope.kind === 'query') return this._previewUuids();
    return [];
  });

  /**
   * Produkty renderowane przez zakładkę: komplet zaznaczonych (tryb `explicit`) albo próbka
   * kilku pierwszych pasujących do filtra (tryb `query`).
   *
   * Modele widoku bierzemy z orkiestratora po UUID — dzięki temu wiersze aktualizują się
   * z SignalR, a zaznaczenie zmaterializowane (które nie niesie ze sobą pozycji) działa
   * dokładnie tak samo jak ręczne.
   */
  public readonly products = computed<ProductVM[]>(() => {
    const uuids = this.visibleProductUuids();
    if (uuids.length === 0) return [];

    const scope = this.scope();
    const known = scope.kind === 'explicit' ? scope.items : [];
    const signalMap = this.productOrchestrator.getSignalViewModel();

    return uuids
      .map(uuid => {
        const vmSignal = signalMap.get(uuid);
        const latestVm = vmSignal ? vmSignal() : null;
        return latestVm ?? known.find(x => x.uuid === uuid);
      })
      .filter((vm): vm is ProductVM => vm !== undefined);
  });

  /** Ile produktów widać w panelu — liczba do zdania o zasięgu („Podgląd X z Y"). */
  public readonly shownProductCount = computed<number>(() => this.products().length);

  /** Podzaznaczenie wierszy zakładki (pliki, gwarancje…) — w postaci, w jakiej dała je tabela. */
  public readonly selectedChildren = signal<readonly TChild[]>([]);

  public readonly selectedChildrenCount = computed<number>(() => this.selectedChildren().length);

  protected constructor(private readonly previewLimit: number = PRODUCT_SCOPE_PREVIEW_LIMIT) {
    // Podgląd dla trybu filtra — kilka pierwszych produktów pasujących do zaznaczenia.
    effect(() => {
      const scope = this.scope();
      if (scope.kind !== 'query') {
        untracked(() => this._previewUuids.set([]));
        return;
      }

      untracked(() => {
        void this.page
          .resolveUuids(scope.filter, this.previewLimit)
          .then(uuids => {
            // Zaznaczenie mogło się zmienić w trakcie żądania — nieaktualnej próbki nie pokazujemy.
            if (this.scope().kind === 'query') {
              this._previewUuids.set(uuids);
            }
          });
      });
    });

    // Zmiana zbioru produktów unieważnia podzaznaczenie — inaczej akcja „usuń zaznaczone"
    // zadziałałaby na wiersze produktu, którego już nie ma w panelu.
    effect(() => {
      this.visibleProductUuids();
      untracked(() => {
        if (this.selectedChildren().length > 0) {
          this.selectedChildren.set([]);
        }
      });
    });
  }

  public setSelectedChildren(items: readonly TChild[]): void {
    this.selectedChildren.set(items);
  }

  public clearChildSelection(): void {
    this.selectedChildren.set([]);
  }

  /**
   * Cele operacji masowej dla bieżącego zasięgu. Zakładki NIE składają
   * `targetUuids`/`targetFilter` ręcznie — reguła „uuidy czy filtr" żyje w jednym miejscu.
   */
  public batchTargets(): ErpBatchTargets<SearchProductRequest> {
    return erpBuildBatchTargets<SearchProductRequest>(this.scope());
  }
}
