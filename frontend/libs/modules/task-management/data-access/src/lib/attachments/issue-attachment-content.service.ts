import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL, IssueAttachmentDto } from '../api-client';

/**
 * Po ilu plikach cache zaczyna zwalniać najstarsze adresy.
 *
 * `URL.createObjectURL` trzyma blob w pamięci karty aż do `revokeObjectURL`. Limit jest tu
 * niższy niż w galerii Catalogu (300), bo załączniki ogląda się kartami po kilka–kilkanaście
 * pozycji, a pojedynczy zrzut ekranu waży więcej niż miniaturka produktu.
 */
const MAX_CACHED_OBJECT_URLS = 60;

/**
 * Wydaje zawartość załączników zgłoszenia — podgląd i pobranie oryginału.
 *
 * <p><b>Dlaczego przez `HttpClient`, a nie adres wprost w `src`/`href`.</b> Zawartość serwuje
 * `GET issue/attachment/content/{uuid}` za sprawdzeniem uprawnienia, a ani `<img src>`, ani
 * nawigacja przeglądarki nie dokładają nagłówka `Authorization` — wstawienie tego adresu wprost
 * dałoby 401 przy każdej miniaturce. Plik pobiera więc `HttpClient` (interceptor dokłada token),
 * a do `src` trafia dopiero `blob:`-URL. Ta sama decyzja co w
 * `CatalogMultimediaContentService` (`docs/frontend/multimedia.md` §3).</p>
 *
 * <p><b>Miniaturek nie ma.</b> Załączniki zgłoszenia nie mają wariantów pochodnych — backend
 * generuje je dla biblioteki mediów Catalogu, nie tutaj. Podgląd idzie z oryginału, dlatego
 * zamawia go dopiero kafelek obrazu, a nie każdy wiersz listy.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueAttachmentContentService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL, { optional: true }) ?? '';

  private readonly _urls = new Map<string, ReturnType<typeof signal<string | undefined>>>();
  private readonly _order: string[] = [];

  private readonly _pending = signal<ReadonlySet<string>>(new Set());

  /** Czy pobranie tego załącznika właśnie trwa — po to, żeby widok zablokował przycisk. */
  public isDownloading(uuid: string): boolean {
    return this._pending().has(uuid);
  }

  /**
   * Trwały adres zawartości — ten sam, który trafia do `<img src>` w treści opisu.
   *
   * Sam w sobie nie da się wyświetlić bez tokenu; służy jako <b>kanoniczny identyfikator
   * zasobu w zapisanym HTML-u</b>. Do renderowania idzie {@link contentUrl}.
   */
  public apiUrl(uuid: string): string {
    return `${this._baseUrl}/issue/attachment/content/${uuid}`;
  }

  /**
   * Adres do wyświetlenia. Pierwsze wywołanie zamawia pobranie, kolejne oddają ten sam sygnał.
   *
   * Zwraca `undefined`, dopóki plik nie dojedzie — i po nieudanym pobraniu, bo wtedy kafelek
   * ma pokazać ikonę typu pliku, a nie zepsuty obrazek.
   */
  public contentUrl(uuid: string): Signal<string | undefined> {
    const cached = this._urls.get(uuid);

    if (cached) {
      return cached.asReadonly();
    }

    const url = signal<string | undefined>(undefined);
    this._urls.set(uuid, url);
    this._order.push(uuid);
    this._evictIfNeeded();

    this._http.get(this.apiUrl(uuid), { responseType: 'blob' }).subscribe({
      next: (blob) => url.set(URL.createObjectURL(blob)),
      error: () => url.set(undefined),
    });

    return url.asReadonly();
  }

  /**
   * Wydaje plik użytkownikowi. Zwraca `false`, gdy się nie udało — wołający decyduje, czy to
   * warte komunikatu.
   *
   * `download` na kotwicy działa, bo `blob:` jest tego samego pochodzenia co strona: nazwa
   * z katalogu trafia na dysk taka, jaką użytkownik widzi na karcie.
   */
  public async downloadAsync(attachment: IssueAttachmentDto): Promise<boolean> {
    if (this.isDownloading(attachment.uuid)) {
      return false;
    }

    this._mark(attachment.uuid, true);

    try {
      const blob = await firstValueFrom(
        this._http.get(this.apiUrl(attachment.uuid), { responseType: 'blob' }),
      );

      triggerBrowserDownload(blob, attachment.fileName);
      return true;
    } catch {
      // Brak pliku w magazynie i cofnięte uprawnienie wyglądają stąd tak samo i tak samo się
      // kończą: ten plik nie wyjdzie. Rozstrzyganie, który to przypadek, nie zmieniłoby akcji.
      return false;
    } finally {
      this._mark(attachment.uuid, false);
    }
  }

  /** Zwalnia adresy zamówione dla podanych załączników — np. po zamknięciu karty zgłoszenia. */
  public release(uuids: readonly string[]): void {
    for (const uuid of uuids) {
      const url = this._urls.get(uuid)?.();
      this._urls.delete(uuid);

      const position = this._order.indexOf(uuid);
      if (position >= 0) {
        this._order.splice(position, 1);
      }

      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }

  private _evictIfNeeded(): void {
    while (this._order.length > MAX_CACHED_OBJECT_URLS) {
      const evicted = this._order.shift();

      if (evicted === undefined) {
        return;
      }

      const url = this._urls.get(evicted)?.();
      this._urls.delete(evicted);

      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }

  private _mark(uuid: string, active: boolean): void {
    this._pending.update((current) => {
      const next = new Set(current);

      if (active) {
        next.add(uuid);
      } else {
        next.delete(uuid);
      }

      return next;
    });
  }
}

/**
 * Uruchamia pobranie z gotowych bajtów.
 *
 * Adres zwalniamy dopiero po oddaniu sterowania — przeglądarka czyta go asynchronicznie po
 * kliknięciu, a `revokeObjectURL` wywołane od razu potrafi wyścigowo unieważnić pobranie,
 * które jeszcze nie ruszyło.
 */
function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
