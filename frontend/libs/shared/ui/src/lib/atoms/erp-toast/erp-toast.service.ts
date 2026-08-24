import { Injectable, computed, signal } from '@angular/core';
import { ErpToastConfig } from './erp-toast.types';

/** Toast w kolejce — konfiguracja plus nadany identyfikator. */
export interface ErpToastEntry extends ErpToastConfig {
  readonly id: string;
}

/** Domyślny czas życia toasta bez akcji. */
const DEFAULT_AUTO_CLOSE_MS = 5000;

/** Ile toastów pokazujemy naraz, zanim najstarszy ustąpi miejsca. */
const MAX_VISIBLE = 4;

/**
 * Kolejka toastów aplikacji.
 *
 * <b>Dlaczego tutaj, a nie w `shared/data-access`.</b> Konfiguracja toasta niesie `Translatable`
 * i `ErpIcon` — typy z `shared/ui`. Granice NX (`type:data-access` → `{data-access, util}`)
 * nie pozwalają warstwie danych ich zobaczyć, więc serwis stoi przy swoim kontrakcie.
 * Konsekwencja jest jedna i do zaakceptowania: kod z warstwy `data-access` nie wystrzeli toasta
 * bezpośrednio — robi to za niego host (patrz `ErpJobToastBridge` w `apps/client`), czyli
 * warstwa, która jako jedyna może zależeć od obu.
 *
 * <b>Stos, nie pojedynczy toast.</b> Usunięty `ErpToastBridgeService` trzymał
 * jeden sygnał, więc drugi toast kasował pierwszy — a koniec operacji masowej i 403 z równoległego
 * żądania potrafią przyjść w tej samej sekundzie.
 *
 * <b>Jedna instancja na host i wszystkie remote'y.</b> `@erp/shared/*` nie jest w tablicy `skip`
 * w `federation.config.mjs`, więc jedzie jako `shared: singleton`. Umieszczenie tego serwisu
 * w bibliotece modułowej (te SĄ w `skip`, dla Vite HMR) dałoby każdemu remotowi własną kolejkę,
 * a toast wywołany z katalogu nigdy nie dotarłby do komponentu renderującego w hoście.
 */
@Injectable({ providedIn: 'root' })
export class ErpToastService {
  private readonly _toasts = signal<ErpToastEntry[]>([]);
  private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Widoczne toasty, najstarszy pierwszy. */
  public readonly toasts = computed(() => this._toasts());

  /**
   * Pokazuje toast i zwraca jego identyfikator. Podanie `id` w konfiguracji podmienia
   * istniejący wpis zamiast dokładać kolejny.
   */
  public show(config: ErpToastConfig): string {
    const id = config.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = this._normalize({ ...config, id });

    this._toasts.update(current => {
      const withoutSame = current.filter(toast => toast.id !== id);
      const next = [...withoutSame, entry];

      // Nadmiarowe toasty ustępują od najstarszego — nowy komunikat jest z definicji
      // bardziej aktualny niż ten sprzed pół minuty.
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });

    this._scheduleAutoClose(entry);
    return id;
  }

  /**
   * Podmienia istniejący toast w miejscu — tak jeden wpis obsługuje całą operację:
   * „generuję raport…" → „raport gotowy [Pobierz]". Gdy toasta już nie ma (użytkownik go
   * zamknął), nic się nie dzieje: wskrzeszanie zamkniętego komunikatu byłoby cofaniem
   * decyzji użytkownika.
   */
  public update(id: string, patch: Partial<ErpToastConfig>): void {
    const existing = this._toasts().find(toast => toast.id === id);
    if (!existing) {
      return;
    }

    const entry = this._normalize({ ...existing, ...patch, id });

    this._toasts.update(current => current.map(toast => (toast.id === id ? entry : toast)));
    this._scheduleAutoClose(entry);
  }

  public dismiss(id: string): void {
    this._clearTimer(id);
    this._toasts.update(current => current.filter(toast => toast.id !== id));
  }

  public dismissAll(): void {
    for (const id of [...this._timers.keys()]) {
      this._clearTimer(id);
    }

    this._toasts.set([]);
  }

  /**
   * Toast z akcją nigdy nie znika sam — pięć sekund to za mało, żeby przeczytać komunikat
   * i kliknąć, a przycisk uciekający sprzed kursora jest gorszy niż jego brak.
   */
  private _normalize(entry: ErpToastEntry): ErpToastEntry {
    if (entry.action) {
      return { ...entry, autoCloseMs: null };
    }

    return { ...entry, autoCloseMs: entry.autoCloseMs === undefined ? DEFAULT_AUTO_CLOSE_MS : entry.autoCloseMs };
  }

  private _scheduleAutoClose(entry: ErpToastEntry): void {
    this._clearTimer(entry.id);

    if (entry.autoCloseMs === null || entry.autoCloseMs === undefined) {
      return;
    }

    this._timers.set(
      entry.id,
      setTimeout(() => this.dismiss(entry.id), entry.autoCloseMs),
    );
  }

  private _clearTimer(id: string): void {
    const timer = this._timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._timers.delete(id);
    }
  }
}
