import { Injectable, Injector, inject } from '@angular/core';

/** Gotowy do użycia odnośnik do artefaktu wyprodukowanego przez zadanie. */
export interface ErpJobResultLink {
  /** Adres pobrania — krótko ważny, więc używa się go od razu, a nie zapamiętuje. */
  readonly url: string;

  /** Nazwa, pod jaką plik ma się zapisać. */
  readonly fileName: string;
}

/**
 * Zamienia `JobRecord.resultRef` na odnośnik do pobrania. Implementuje moduł, który zadanie
 * wykonał — tylko on wie, jakim endpointem zapytać o link.
 */
export type ErpJobResultResolver = (resultRef: string) => Promise<ErpJobResultLink>;

/**
 * Fabryka resolwera. Dostaje injector, bo resolwer prawie zawsze potrzebuje klienta HTTP
 * swojego modułu, a rejestr woła go z kontekstu, w którym `inject()` nie zadziała.
 */
export type ErpJobResultResolverLoader = (injector: Injector) => Promise<ErpJobResultResolver>;

/**
 * Rejestr resolwerów wyników zadań masowych, po typie komendy.
 *
 * <b>Po co to istnieje.</b> Feed powiadomień (dzwonek, historia zadań) mieszka w remocie
 * `notification`, a artefakt produkuje zupełnie inny moduł — dziś Catalog, jutro dowolny.
 * Granice NX zabraniają `scope:notification` sięgnąć do `scope:catalog`, i słusznie: gdyby
 * feed musiał znać każdego producenta artefaktów, każdy nowy eksport w systemie oznaczałby
 * zmianę w module powiadomień.
 *
 * Rozwiązanie jest tym samym wzorcem, co {@link ErpWidgetRegistryService} dla widżetów
 * i `ErpModalService` dla modali: aplikacja hosta (jedyna warstwa, która może zależeć od
 * kontraktów remotów) rejestruje przy STARTUP funkcję ładującą, a feed pyta o wynik po
 * `commandType`, nic nie wiedząc o module, z którego on pochodzi.
 *
 * <b>Dlaczego to działa od pierwszej sekundy.</b> Kontrakty WSZYSTKICH remotów ładują się
 * przy STARTUP (host potrzebuje ich do zbudowania menu), więc rejestracja nie czeka na to,
 * aż użytkownik odwiedzi moduł produkujący eksport. Sam resolwer jest już leniwy — jego
 * `data-access` dociąga się dopiero przy pierwszym kliknięciu „Pobierz".
 */
@Injectable({ providedIn: 'root' })
export class ErpJobResultRegistry {
  private readonly _injector = inject(Injector);
  private readonly _loaders = new Map<string, ErpJobResultResolverLoader>();
  private readonly _resolvers = new Map<string, Promise<ErpJobResultResolver>>();

  /**
   * Rejestruje loader resolwera dla danego typu komendy. Wołane przy STARTUP dla każdego
   * remota, który taki wystawia w swoim kontrakcie.
   */
  public register(commandType: string, loader: ErpJobResultResolverLoader): void {
    this._loaders.set(commandType, loader);
  }

  /**
   * Czy dla tego typu komendy ktokolwiek potrafi wydać odnośnik. Feed pyta o to, zanim
   * narysuje akcję „Pobierz" — przycisk, który nie ma co zrobić, jest gorszy niż jego brak.
   */
  public canResolve(commandType: string | null | undefined): boolean {
    return !!commandType && this._loaders.has(commandType);
  }

  /**
   * Wydaje odnośnik do artefaktu. Zwraca `null`, gdy nikt nie obsługuje tego typu komendy
   * albo gdy moduł producenta jest niedostępny — feed powiadomień nie może z tego powodu
   * przewrócić nagłówka.
   */
  public async resolve(commandType: string, resultRef: string): Promise<ErpJobResultLink | null> {
    const loader = this._loaders.get(commandType);
    if (!loader) {
      return null;
    }

    try {
      let resolver = this._resolvers.get(commandType);
      if (!resolver) {
        resolver = loader(this._injector);
        this._resolvers.set(commandType, resolver);
      }

      return await (await resolver)(resultRef);
    } catch (error) {
      console.warn(`[ErpJobResultRegistry] Nie udało się pobrać wyniku zadania "${commandType}".`, error);
      // Kolejna próba ma sens (remote mógł być chwilowo niedostępny, link mógł wygasnąć),
      // więc porzucamy zapamiętaną, nieudaną obietnicę.
      this._resolvers.delete(commandType);
      return null;
    }
  }
}
