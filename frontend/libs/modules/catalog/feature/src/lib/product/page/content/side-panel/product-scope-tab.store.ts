import { inject } from '@angular/core';
import { CatalogProductOrchestrator, ProductVM, SearchProductRequest } from '@erp/catalog/data-access';
import { ERP_SCOPE_PREVIEW_LIMIT, ErpScopeTabStore } from '@erp/shared/ui';
import { ProductStore } from '../../product.store';

/**
 * Ilu produktów dotyczy podgląd zakładki, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const PRODUCT_SCOPE_PREVIEW_LIMIT = ERP_SCOPE_PREVIEW_LIMIT;

/**
 * Wspólna podstawa zakładek strony produktów zależnych od zaznaczenia (multimedia, gwarancje…).
 *
 * Cała mechanika (zasięg, próbka w trybie `query`, blokada granularnego wyboru, modele widoku
 * po UUID, unieważnianie podzaznaczenia) mieszka w `ErpScopeTabStore` — wspólnym dla wszystkich
 * stron aplikacji, patrz `docs/frontend/pages.md` §6. Tutaj zostaje wyłącznie podłączenie
 * zasięgu strony produktów i orkiestratora produktów oraz aliasy nazw z domeny („produkt"
 * zamiast ogólnego „rodzic"), żeby zakładki czytały się dziedzinowo.
 */
export abstract class ProductScopeTabStore<TChild = unknown> extends ErpScopeTabStore<
  ProductVM,
  SearchProductRequest,
  TChild
> {
  /** UUID produktów, które zakładka faktycznie renderuje (komplet albo próbka). */
  public readonly visibleProductUuids = this.visibleParentUuids;

  /** Produkty renderowane przez zakładkę — grupy wspólnej tabeli wierszy podrzędnych. */
  public readonly products = this.parents;

  /** Ile produktów widać w panelu — liczba do zdania o zasięgu („Podgląd X z Y"). */
  public readonly shownProductCount = this.shownParentCount;

  protected constructor(previewLimit: number = PRODUCT_SCOPE_PREVIEW_LIMIT) {
    const page = inject(ProductStore);
    const orchestrator = inject(CatalogProductOrchestrator);

    super({
      scope: page.scope,
      parentById: (uuid) => orchestrator.getSignalViewModel().get(uuid)?.(),
      resolveUuids: (filter, limit) => page.resolveUuids(filter, limit),
      previewLimit,
    });
  }
}
