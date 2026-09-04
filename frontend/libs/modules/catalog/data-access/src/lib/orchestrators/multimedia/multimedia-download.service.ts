import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../api-client';
import { MultimediaVM } from './multimedia.view-model';

/**
 * Wynik pobierania paczki — ile plików wyszło, ile odpadło.
 *
 * Częściowy sukces jest tu normalnym wynikiem, nie awarią: jeden plik zniknięty z magazynu
 * nie jest powodem, żeby użytkownik nie dostał pozostałych dziewięciu.
 */
export interface MultimediaDownloadResult {
  readonly succeeded: number;
  readonly failed: number;

  /**
   * Zasoby opisane adresem zewnętrznym, pominięte świadomie.
   *
   * Pojedynczo otwierają się w nowej karcie, ale w paczce nie — dwadzieścia otwartych kart to
   * nie jest to, o co prosił ktoś, kto kliknął „pobierz wszystkie", a blokada wyskakujących
   * okien i tak zatrzymałaby wszystkie poza pierwszą.
   */
  readonly skippedExternal: number;
}

/**
 * Wydaje użytkownikowi oryginały plików multimedialnych.
 *
 * <b>Dlaczego przez `HttpClient`, a nie `<a href>` prosto do endpointu.</b> Zawartość jest za
 * uprawnieniem, a nawigacja przeglądarki nie dokłada nagłówka `Authorization` — dokładnie ten
 * sam powód, dla którego miniaturki idą przez `CatalogMultimediaContentService`. Bajty
 * pobieramy więc żądaniem z tokenem, a pobranie uruchamiamy z `blob:`-URL-a.
 *
 * <b>Dlaczego `download` na kotwicy tutaj DZIAŁA</b>, a w `JobDownloadService` jest tylko
 * podpowiedzią: tamten adres to presigned URL prowadzący wprost do magazynu, czyli inne
 * pochodzenie — atrybut jest wtedy ignorowany i nazwę narzuca `Content-Disposition`. `blob:`
 * jest tego samego pochodzenia co strona, więc nazwa pliku z katalogu trafia na dysk taka,
 * jaką widzi użytkownik w tabeli.
 *
 * <b>Ograniczenie paczki.</b> Pobranie wielu plików to N osobnych pobrań przeglądarki, a nie
 * jedno archiwum — przy pierwszym takim komplecie przeglądarka pyta użytkownika o zgodę na
 * „pobieranie wielu plików". Dla dziesiątek zdjęć to działa; dla setek właściwą drogą jest
 * archiwum składane po stronie serwera i wydawane jako artefakt zadania
 * (`docs/guides/backend/exports-artifacts.md`) — tego endpointu jeszcze nie ma.
 */
@Injectable({ providedIn: 'root' })
export class CatalogMultimediaDownloadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '';

  private readonly _pending = signal<ReadonlySet<string>>(new Set());

  /** Zasoby, dla których pobieranie właśnie trwa — po to, żeby widok mógł zablokować przycisk. */
  public readonly pending = computed(() => this._pending());

  public isDownloading(uuid: string): boolean {
    return this._pending().has(uuid);
  }

  /** Czy cokolwiek się teraz pobiera. */
  public readonly busy = computed(() => this._pending().size > 0);

  /**
   * Pobiera jeden plik. Zwraca `false`, gdy się nie udało — wołający decyduje, czy to warte
   * komunikatu; przy paczce pojedyncza porażka nie ma nim być.
   */
  public async download(item: MultimediaVM): Promise<boolean> {
    if (this.isDownloading(item.uuid)) {
      return false;
    }

    // Zasób opisany adresem zewnętrznym nie ma u nas bajtów — endpoint zawartości odpowie na
    // niego 404, i to poprawnie. Puszczamy więc użytkownika pod adres źródłowy zamiast
    // pokazywać mu błąd pobrania czegoś, czego nigdy nie mieliśmy.
    if (item.originalUrl) {
      openExternal(item.originalUrl);
      return true;
    }

    this._mark(item.uuid, true);

    try {
      const blob = await firstValueFrom(
        this.http.get(`${this.baseUrl}/multimedia/content/${item.uuid}`, { responseType: 'blob' }),
      );

      triggerBrowserDownload(blob, item.fileName);
      return true;
    } catch {
      // Brak pliku w magazynie i wygasłe uprawnienie wyglądają stąd tak samo i tak samo się
      // kończą: ten plik nie wyjdzie. Rozstrzyganie który to przypadek nie zmieniłoby akcji.
      return false;
    } finally {
      this._mark(item.uuid, false);
    }
  }

  /**
   * Pobiera paczkę — <b>po kolei, nie równolegle</b>.
   *
   * Każdy plik siedzi w pamięci karty jako blob do czasu zwolnienia adresu, więc równoległe
   * ściągnięcie galerii dwustu zdjęć 4K oznaczałoby ponad gigabajt w karcie naraz. Szeregowo
   * kosztuje to jeden plik naraz, a różnica w czasie jest bez znaczenia przy pobieraniu,
   * którego użytkownik i tak nie obserwuje sekundnikiem.
   */
  public async downloadMany(items: readonly MultimediaVM[]): Promise<MultimediaDownloadResult> {
    let succeeded = 0;
    let failed = 0;
    let skippedExternal = 0;

    for (const item of items) {
      if (item.originalUrl) {
        skippedExternal++;
        continue;
      }

      if (await this.download(item)) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { succeeded, failed, skippedExternal };
  }

  private _mark(uuid: string, active: boolean): void {
    this._pending.update(current => {
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
 * Uruchamia pobieranie z gotowych bajtów.
 *
 * Adres zwalniamy dopiero po oddaniu sterowania — przeglądarka czyta go asynchronicznie po
 * kliknięciu, a `revokeObjectURL` wywołane od razu potrafi wyścigowo unieważnić pobranie,
 * które jeszcze nie ruszyło.
 */
/**
 * Otwiera zasób leżący poza systemem.
 *
 * <b>Nowa karta, a nie pobranie</b> — atrybut `download` jest ignorowany dla innego pochodzenia,
 * więc i tak nie zdecydowalibyśmy o nazwie ani o tym, czy plik się zapisze. Zamiast udawać
 * pobranie, oddajemy sprawę przeglądarce i serwerowi, który ten plik wystawia.
 */
function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

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
