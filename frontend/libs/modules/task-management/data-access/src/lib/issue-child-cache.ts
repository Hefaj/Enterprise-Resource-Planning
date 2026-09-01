import { Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SignalrSyncService } from '@erp/shared/data-access';

/**
 * Wspólna baza dla kolekcji wiszących przy zgłoszeniu: załączników, komentarzy i historii.
 *
 * <p><b>Dlaczego nie orkiestrator.</b> `BaseOrchestrator` stoi na wyszukiwaniu i cache’u
 * tożsamości po uuid — a te trzy kolekcje czyta się kompletem per zgłoszenie i backend nie
 * wystawia dla nich żadnego `search…`. Użycie orkiestratora wymagałoby udawania wyszukiwania,
 * którego nie ma. Ten sam wybór, co przy `ProjectWorkflowService`.</p>
 *
 * <p><b>Dlaczego wspólna baza, a nie trzy podobne serwisy.</b> Wszystkie trzy robią dokładnie
 * to samo: trzymają listę per zgłoszenie, sklejają równoległe żądania o to samo i odświeżają
 * to, co ktoś ogląda, gdy przyjdzie zdarzenie realtime. Trzecia kopia tego kodu byłaby
 * miejscem, w którym jedna z nich cicho przestaje słuchać.</p>
 *
 * <p><b>Zdarzenie realtime niesie uuidy DZIECI, nie zgłoszeń</b> — mapowania w drugą stronę
 * front nie ma i nie ma po co dokładać. Odświeżamy więc listy trzymane w cache’u; w praktyce
 * jest to jedna otwarta karta zgłoszenia.</p>
 */
export abstract class IssueChildCache<T> {
  private readonly _signalr = inject(SignalrSyncService);

  private readonly _byIssue = signal<ReadonlyMap<string, readonly T[]>>(new Map());
  private readonly _inFlight = new Map<string, Promise<readonly T[]>>();

  /** Stała referencja pustej listy — `itemsOf` musi zwracać ZAWSZE ten sam obiekt dla „jeszcze
   * nic nie ma", inaczej `computed()` widziałby „zmianę" przy każdej reewaluacji `_byIssue`
   * (nawet wywołanej przez INNE zgłoszenie) i budził wszystkich konsumentów w nieskończoność. */
  private static readonly _EMPTY: readonly never[] = [];

  /** Sygnały `itemsOf` cache’owane per uuid — bez tego każde wywołanie tworzyłoby nowy
   * `computed()`, tracąc pamięć poprzedniej wartości i wymuszając pełną reewaluację od zera. */
  private readonly _itemsSignals = new Map<string, Signal<readonly T[]>>();

  /** Pobranie kolekcji dla jednego zgłoszenia. */
  protected abstract fetchAsync(issueUuid: string): Promise<readonly T[]>;

  /** Nazwa serwisu w logach — używana wyłącznie przy błędzie pobrania. */
  protected abstract readonly label: string;

  /**
   * Kolekcja z cache’u — <b>nie odpala żądania</b> (do tego jest {@link loadAsync}).
   * Pusta lista jest poprawnym stanem przejściowym: sekcja renderuje się bez pozycji, zamiast
   * blokować kartę do czasu odpowiedzi.
   */
  public itemsOf(issueUuid: string | null | undefined): Signal<readonly T[]> {
    if (!issueUuid) {
      return computed(() => IssueChildCache._EMPTY);
    }

    let entry = this._itemsSignals.get(issueUuid);

    if (!entry) {
      entry = computed(() => this._byIssue().get(issueUuid) ?? IssueChildCache._EMPTY);
      this._itemsSignals.set(issueUuid, entry);
    }

    return entry;
  }

  /**
   * Dociąga kolekcję. Równoległe wywołania dla tego samego zgłoszenia dzielą jedno żądanie;
   * `force` pomija cache po własnej zmianie.
   */
  public async loadAsync(issueUuid: string, force = false): Promise<readonly T[]> {
    if (!issueUuid) {
      return [];
    }

    if (!force) {
      const cached = this._byIssue().get(issueUuid);
      if (cached) {
        return cached;
      }

      const pending = this._inFlight.get(issueUuid);
      if (pending) {
        return pending;
      }
    }

    const request = this._load(issueUuid).finally(() => this._inFlight.delete(issueUuid));
    this._inFlight.set(issueUuid, request);
    return request;
  }

  /** Wyrzuca z cache’u jedno zgłoszenie albo wszystkie. */
  public invalidate(issueUuid?: string): void {
    this._byIssue.update((map) => {
      if (!issueUuid) {
        return new Map();
      }

      const next = new Map(map);
      next.delete(issueUuid);
      return next;
    });
  }

  /**
   * Podpina odświeżanie na wskazane sygnatury. Wołane z konstruktora podklasy — tam jest
   * kontekst wstrzykiwania, którego wymaga `takeUntilDestroyed`.
   */
  protected watch(signatures: readonly string[]): void {
    for (const signature of signatures) {
      this._signalr.subscribe(signature);

      this._signalr
        .onUpdate(signature)
        .pipe(takeUntilDestroyed())
        .subscribe(() => void this._refreshCached());

      this._signalr
        .onDelete(signature)
        .pipe(takeUntilDestroyed())
        .subscribe(() => void this._refreshCached());
    }
  }

  private async _load(issueUuid: string): Promise<readonly T[]> {
    try {
      const items = await this.fetchAsync(issueUuid);
      this._byIssue.update((map) => new Map(map).set(issueUuid, items));
      return items;
    } catch (error) {
      // Brak dostępu do zgłoszenia wraca jako 404 — to nie jest awaria widoku, tylko granica
      // widoczności. Sekcja pokaże się pusta, a nie komunikatem o błędzie.
      console.error(`[${this.label}] Nie udało się pobrać danych zgłoszenia.`, error);
      return [];
    }
  }

  private async _refreshCached(): Promise<void> {
    await Promise.all([...this._byIssue().keys()].map((issueUuid) => this.loadAsync(issueUuid, true)));
  }
}
