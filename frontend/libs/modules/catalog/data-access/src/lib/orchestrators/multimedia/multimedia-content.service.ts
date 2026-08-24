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
    const cached = this.urls.get(uuid);

    if (cached) {
      return cached.asReadonly();
    }

    const url = signal<string | undefined>(undefined);
    this.urls.set(uuid, url);
    this.order.push(uuid);
    this.evictIfNeeded();

    this.http
      .get(`${this.baseUrl}/multimedia/content/${uuid}`, { responseType: 'blob' })
      .subscribe({
        next: blob => url.set(URL.createObjectURL(blob)),
        // Brak zawartości nie jest awarią widoku: zasób może być opisany adresem zewnętrznym
        // albo plik mógł zniknąć z magazynu. W obu przypadkach komórka pokaże ikonę.
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
