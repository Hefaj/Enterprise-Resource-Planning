import { InjectionToken, Signal } from '@angular/core';

/**
 * Użytkownik w postaci, w jakiej widzi go reszta systemu: identyfikator i to, co da się
 * pokazać człowiekowi.
 *
 * <p><c>uuid</c> to claim <c>sub</c> z Keycloaka — ten sam identyfikator, który backend zapisuje
 * w <c>assignee_uuid</c>, <c>author_uuid</c> czy <c>actor_uuid</c>. Front nigdzie nie zamienia
 * go na coś innego; zamienia go wyłącznie <b>na potrzeby wyświetlenia</b>.</p>
 */
export interface ErpUserRef {
  readonly uuid: string;

  /** Nazwa wyświetlana z Keycloaka. Nigdy pusta — przy braku danych backend wpisuje e-mail. */
  readonly displayName: string;

  readonly email: string;

  /** Konto wyłączone. Nadal wraca po uuid, bo historyczne przypisania muszą mieć nazwisko. */
  readonly isActive: boolean;
}

/** Zapytanie wyszukiwarki katalogu — kształt narzucony przez `searchFn` w `erp-input-picker`. */
export interface ErpUserDirectoryQuery {
  readonly text?: string;
  readonly page?: number;
  readonly pageSize?: number;

  /** Czy dopuścić konta wyłączone. Domyślnie nie — picker wskazuje osobę do pracy. */
  readonly includeInactive?: boolean;
}

/** Odpowiedź wyszukiwarki: identyfikatory strony i rozmiar całego zbioru. */
export interface ErpUserDirectoryPage {
  readonly uuids: readonly string[];
  readonly totalCount: number;
}

/**
 * Katalog użytkowników — <b>port</b>, nie implementacja.
 *
 * <p><b>Dlaczego port, a nie zwykły serwis wstrzykiwany wprost.</b> Implementacja rozmawia
 * po HTTP z mikroserwisem Identity, więc mieszka w <c>@erp/shared/data-access</c>. Komponenty
 * korzystające z katalogu (picker, wyświetlenie nazwiska) mieszkają w <c>@erp/shared/ui</c>,
 * a reguła <c>@nx/enforce-module-boundaries</c> zabrania <c>type:ui</c> zależeć od
 * <c>type:data-access</c>. Kontrakt w <c>type:util</c> widzą obie strony i nikt niczego nie
 * obchodzi — to ta sama droga, którą poszedł <c>IDENTITY_PERMISSIONS_API_BASE_URL</c>
 * w <c>@erp/shared/auth</c>.</p>
 */
export interface ErpUserDirectory {
  /**
   * Użytkownik po uuid. <b>Sygnał, a nie obietnica</b>: komórka tabeli i nagłówek komentarza
   * renderują się natychmiast, a nazwisko dorysowuje się samo, gdy dojedzie paczka.
   *
   * Pierwsze wywołanie zamawia pobranie; kolejne oddają ten sam sygnał.
   */
  getOne(uuid: string | null | undefined): Signal<ErpUserRef | undefined>;

  /** Dociąga komplet użytkowników do cache’u — jedno żądanie na paczkę uuidów. */
  loadAsync(uuids: readonly string[]): Promise<void>;

  /** Wyszukiwanie po fragmencie nazwy albo adresu; oddaje identyfikatory, nie obiekty. */
  searchAsync(query: ErpUserDirectoryQuery): Promise<ErpUserDirectoryPage>;

  /** Pełne pozycje dla podanych uuidów — druga połowa kontraktu pickera. */
  getManyAsync(uuids: readonly string[]): Promise<readonly ErpUserRef[]>;
}

/**
 * Token katalogu. Dostarcza go <c>provideErpUserDirectory()</c> z
 * <c>@erp/shared/data-access</c> — w hoście i w każdym remote'cie.
 *
 * <p>Komponenty wstrzykują go <b>opcjonalnie</b>: brak katalogu (test, Storybook, aplikacja
 * bez Identity) ma dawać uuid zamiast nazwiska, a nie wyjątek przy renderowaniu.</p>
 */
export const ERP_USER_DIRECTORY = new InjectionToken<ErpUserDirectory>('ERP_USER_DIRECTORY');
