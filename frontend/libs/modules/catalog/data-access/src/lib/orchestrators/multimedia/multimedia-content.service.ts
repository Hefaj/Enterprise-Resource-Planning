import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';

import { API_BASE_URL } from '../../api-client';

/**
 * Po ilu zasobach cache zaczyna zwalniać najstarsze adresy.
 *
 * `URL.createObjectURL` trzyma blob w pamięci karty aż do `revokeObjectURL` — bez limitu
 * przewinięcie galerii kilku tysięcy produktów zostawiłoby w niej komplet zdjęć.
 */
const MAX_CACHED_OBJECT_URLS = 300;

/**
 * Warianty pochodne wydawane przez backend. Nazwa wchodzi do ścieżki endpointu i do klucza
 * obiektu w magazynie, więc jest kontraktem — patrz `MultimediaVariants` po stronie serwera.
 */
export type MultimediaVariant = 'thumb' | 'preview';

/**
 * Wydaje adresy, pod którymi da się wyświetlić zawartość zasobu multimedialnego.
 *
 * <b>Dlaczego to w ogóle musi być serwis, a nie pole w ViewModelu.</b> Zawartość serwuje
 * endpoint modułu (`GET multimedia/content/{uuid}`), za sprawdzeniem uprawnienia — a `<img src>`
 * nie dokłada nagłówka `Authorization`. Wstawienie tego adresu wprost do `src` dałoby 401 przy
 * każdej miniaturce. Dlatego plik pobieramy `HttpClient`-em (interceptor dokłada token) i dopiero
 * powstały `blob:`-URL trafia do `src`.
 *
 * Alternatywą byłby podpisany adres prosto do magazynu, ale ten żyje minuty i jest bearer-owy —
 * w galerii przewijanej w tę i z powrotem wygasa w trakcie oglądania (patrz
 * `docs/backend/exports-artifacts.md` §9).
 */
@Injectable({ providedIn: 'root' })
export class CatalogMultimediaContentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '';

  /**
   * Adresy per zasób. Sygnał, a nie zwykła wartość, bo pobranie jest asynchroniczne, a komórka
   * tabeli ma się przerysować sama, gdy blob dojedzie — bez wiedzy o tym, kiedy go zamówiono.
   */
  private readonly urls = new Map<string, ReturnType<typeof signal<string | undefined>>>();

  /** Kolejność zamawiania — po niej idzie zwalnianie najstarszych wpisów. */
  private readonly order: string[] = [];

  /**
   * Adres zawartości zasobu. Pierwsze wywołanie zamawia pobranie, kolejne oddają ten sam sygnał.
   *
   * Zwraca `undefined`, dopóki plik nie dojedzie — i po nieudanym pobraniu, bo wtedy komórka ma
   * pokazać ikonę typu pliku, a nie zepsuty obrazek.
   */
  public contentUrl(uuid: string): Signal<string | undefined> {
    return this.fetch(uuid, `${this.baseUrl}/multimedia/content/${uuid}`);
  }

  /**
   * Adres wariantu pochodnego — miniaturki albo podglądu.
   *
   * **To jest domyślna droga dla galerii, a nie optymalizacja.** `contentUrl` pobiera oryginał:
   * przy zdjęciu 4K to ok. 6 MB na komórkę 40×40, a `blob:`-cache trzyma do
   * {@link MAX_CACHED_OBJECT_URLS} takich plików w pamięci karty. Miniaturka waży kilkanaście
   * kilobajtów, więc ten sam limit przestaje być problemem.
   *
   * Wołać dopiero, gdy `MultimediaVM.hasDerivatives` jest `true` — wcześniej wariantu nie ma
   * i endpoint odpowie 404 (świadomie, zamiast po cichu podać oryginał).
   */
  public variantUrl(uuid: string, variant: MultimediaVariant): Signal<string | undefined> {
    return this.fetch(`${uuid}:${variant}`, `${this.baseUrl}/multimedia/content/${uuid}/${variant}`);
  }

  /**
   * Wspólna ścieżka dla oryginału i wariantów. Klucz cache zawiera wariant, więc miniaturka
   * i podgląd tego samego zasobu nie nadpisują się nawzajem.
   */
  private fetch(cacheKey: string, requestUrl: string): Signal<string | undefined> {
    const cached = this.urls.get(cacheKey);

    if (cached) {
      return cached.asReadonly();
    }

    const url = signal<string | undefined>(undefined);
    this.urls.set(cacheKey, url);
    this.order.push(cacheKey);
    this.evictIfNeeded();

    this.http.get(requestUrl, { responseType: 'blob' }).subscribe({
      next: blob => url.set(URL.createObjectURL(blob)),
      // Brak zawartości nie jest awarią widoku: zasób może być opisany adresem zewnętrznym,
      // plik mógł zniknąć z magazynu, a wariant — jeszcze nie powstać. We wszystkich
      // przypadkach komórka pokaże ikonę.
      error: () => url.set(undefined),
    });

    return url.asReadonly();
  }

  private evictIfNeeded(): void {
    while (this.order.length > MAX_CACHED_OBJECT_URLS) {
      const evicted = this.order.shift();

      if (evicted === undefined) {
        return;
      }

      const url = this.urls.get(evicted)?.();
      this.urls.delete(evicted);

      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }
}
