import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ProductStore } from '../../product.store';

/**
 * Ilu produktów multimedia pokazuje panel, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const MULTIMEDIA_PREVIEW_PRODUCT_LIMIT = 10;

@Injectable() // Rejestrowany na poziomie MultimediaTabComponent, aby żył tylko tyle co zakładka
export class MultimediaTabStore {
  private readonly page = inject(ProductStore);

  /** Zasięg zaznaczenia produktów — to on rozstrzyga, co panel może pokazać i pozwolić zrobić. */
  public readonly scope = this.page.scope;
  public readonly scopeKind = this.page.scopeKind;

  /** Zaznaczenia multimediów (płaska lista — jedna wspólna tabela grupowana per produkt) */
  public readonly selectedMultimedia = signal<Set<string>>(new Set());

  private readonly _previewUuids = signal<string[]>([]);

  /** UUID produktów, których multimedia panel faktycznie renderuje. */
  public readonly visibleProductUuids = computed<string[]>(() => {
    const scope = this.scope();
    if (scope.kind === 'explicit') return scope.ids;
    if (scope.kind === 'query') return this._previewUuids();
    return [];
  });

  /**
   * Czy wolno wybierać pojedyncze pliki. Przy zaznaczeniu opisanym filtrem — nie: checkbox
   * obiecuje „operacja obejmie dokładnie to", a przy próbce z tysięcy produktów to nieprawda.
   * Tak samo zachowuje się tabela produktów, która przy „Zaznacz wszystko" blokuje checkboxy wierszy.
   */
  public readonly canSelectMedia = computed<boolean>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && !scope.loading;
  });

  /** Czy trwa rozwiązywanie zaznaczenia „wszystko" do listy identyfikatorów. */
  public readonly resolving = computed<boolean>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && scope.loading;
  });

  constructor() {
    // Podgląd dla trybu filtra — kilka pierwszych produktów pasujących do zaznaczenia.
    effect(() => {
      const scope = this.scope();
      if (scope.kind !== 'query') {
        untracked(() => this._previewUuids.set([]));
        return;
      }

      untracked(() => {
        void this.page
          .resolveUuids(scope.filter, MULTIMEDIA_PREVIEW_PRODUCT_LIMIT)
          .then(uuids => {
            // Zaznaczenie mogło się zmienić w trakcie żądania — nieaktualnej próbki nie pokazujemy.
            if (this.scope().kind === 'query') {
              this._previewUuids.set(uuids);
            }
          });
      });
    });

    // Zmiana zbioru produktów unieważnia wybór plików — inaczej akcja „usuń zaznaczone"
    // zadziałałaby na pliki produktu, którego już nie ma w panelu.
    effect(() => {
      this.visibleProductUuids();
      untracked(() => {
        if (this.selectedMultimedia().size > 0) {
          this.selectedMultimedia.set(new Set());
        }
      });
    });
  }
}
