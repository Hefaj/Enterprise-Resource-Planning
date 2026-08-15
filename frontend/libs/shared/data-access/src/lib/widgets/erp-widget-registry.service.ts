import { Injectable, Injector, Provider, Type, inject } from '@angular/core';

/** Co loader widżetu oddaje hostowi: klasę komponentu i providery jego modułu. */
export interface ErpWidgetDefinition {
  readonly component: Type<unknown>;
  readonly providers: Provider[];
}

/** Widżet gotowy do wstawienia w `ngComponentOutlet`. */
export interface ErpResolvedWidget {
  readonly component: Type<unknown>;
  readonly injector: Injector;
}

/** Identyfikator widżetu listy zadań masowych — kontrakt między hostem a remotem `notification`. */
export const JOB_LIST_WIDGET_ID = 'notification.jobs';

/**
 * Rejestr komponentów, które host osadza we własnym layoucie, a które należą do remotów.
 *
 * <b>Po co to istnieje.</b> Host miał dotąd dwie drogi po zawartość remota: trasy i modale.
 * Lista zadań w nagłówku nie jest ani jednym, ani drugim — jest widżetem w cudzym layoucie.
 * Statyczny import odpada, bo w trybie mikrofrontendów wciągnąłby remota do bundla hosta.
 *
 * Rejestr rozwiązuje to tak samo, jak `ErpModalService` rozwiązuje modale: aplikacja (jedyna
 * warstwa, która może zależeć od `contract`) rejestruje przy STARTUP funkcję ładującą, a shell
 * prosi o widżet po identyfikatorze, nic nie wiedząc o module, z którego on pochodzi.
 *
 * Ładowanie jest leniwe i wykonywane raz — wynik pierwszego wywołania jest zapamiętywany
 * razem z gotowym injectorem, więc kolejne otwarcia popovera nie tworzą nowego child injectora
 * (a tym samym nowej instancji scope'u tłumaczeń).
 */
@Injectable({ providedIn: 'root' })
export class ErpWidgetRegistryService {
  private readonly _injector = inject(Injector);
  private readonly _loaders = new Map<string, () => Promise<ErpWidgetDefinition>>();
  private readonly _resolved = new Map<string, Promise<ErpResolvedWidget | null>>();

  /** Rejestruje loader widżetu. Wołane przy STARTUP dla każdego remota, który jakiś wystawia. */
  public register(widgetId: string, loader: () => Promise<ErpWidgetDefinition>): void {
    this._loaders.set(widgetId, loader);
  }

  /** Czy ktokolwiek zarejestrował ten widżet — pozwala hostowi nie rysować pustego panelu. */
  public has(widgetId: string): boolean {
    return this._loaders.has(widgetId);
  }

  /**
   * Ładuje widżet i buduje dla niego injector z providerami jego modułu.
   *
   * Providery lądują w child injectorze widżetu, a NIE w globalnym injectorze hosta —
   * scope Transloco remota nie może przesłaniać scope'ów pozostałych modułów
   * (patrz docs/frontend/translations.md).
   *
   * Zwraca `null`, gdy remote jest niedostępny — nagłówek ma wtedy pokazać pustą listę,
   * a nie wywalić całą aplikację.
   */
  public load(widgetId: string): Promise<ErpResolvedWidget | null> {
    const cached = this._resolved.get(widgetId);
    if (cached) {
      return cached;
    }

    const pending = this._load(widgetId);
    this._resolved.set(widgetId, pending);
    return pending;
  }

  private async _load(widgetId: string): Promise<ErpResolvedWidget | null> {
    const loader = this._loaders.get(widgetId);
    if (!loader) {
      console.warn(`[ErpWidgetRegistry] Brak zarejestrowanego loadera dla widżetu "${widgetId}".`);
      return null;
    }

    try {
      const definition = await loader();

      return {
        component: definition.component,
        injector: definition.providers.length > 0
          ? Injector.create({ providers: definition.providers, parent: this._injector })
          : this._injector,
      };
    } catch (error) {
      console.warn(`[ErpWidgetRegistry] Nie udało się załadować widżetu "${widgetId}".`, error);
      // Kolejna próba ma sens (remote mógł być chwilowo niedostępny), więc porzucamy
      // zapamiętaną, nieudaną obietnicę.
      this._resolved.delete(widgetId);
      return null;
    }
  }
}
