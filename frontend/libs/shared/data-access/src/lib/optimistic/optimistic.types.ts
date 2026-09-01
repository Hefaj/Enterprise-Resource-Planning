import { Translatable } from '../orchestrator/orchestrator.types';

/**
 * Jedna zarejestrowana nakładka optymistyczna — patrz `docs/frontend/optimistic-updates.md`.
 *
 * Wywołujący opisuje TYLKO to, co jest lokalnym niuansem jego mutacji (jak wygląda skutek,
 * jak wysłać komendę, czym jest wymuszony refetch po rozstrzygnięciu). Cykl życia — kiedy
 * nakładka pojawia się i znika, co się dzieje przy porażce — jest jeden dla całego systemu
 * i mieszka w {@link ErpOptimisticStore.runAsync}.
 */
export interface ErpOptimisticOp<TValue> {
  /** Sygnatura realtime tego, co nakładka patchuje — `'taskmgmt.issue'`, `'taskmgmt.issue_comment'`.
   * Ta sama sygnatura, którą orkiestrator/cache podaje jako `signalrSignature`. */
  readonly scope: string;

  /** Uuid agregatu (dla pojedynczego obiektu) albo uuid rodzica (dla kolekcji dziecięcej —
   * np. uuid zgłoszenia dla listy komentarzy). */
  readonly key: string;

  /**
   * Czysta funkcja patchująca — dla agregatu `TDto → TDto`, dla kolekcji `readonly T[] → readonly T[]`.
   * Wołana synchronicznie wewnątrz `project()`, więc nie może mieć efektów ubocznych ani
   * odwoływać się do niczego poza swoimi domknięciami.
   */
  readonly patch: (current: TValue | undefined) => TValue | undefined;

  /** Wysyła komendę i zwraca `jobUuid`. Rzut stąd (4xx, walidacja wejścia) zdejmuje nakładkę
   * natychmiast, bez czekania na zadanie — patrz cykl życia w `runAsync`. */
  readonly dispatchAsync: () => Promise<string>;

  /** Wymuszony refetch spod nakładki. MUSI się wykonać PRZED zdjęciem nakładki — inaczej stara
   * wartość miga na jedną klatkę między zdjęciem overlay a dojechaniem świeżych danych. */
  readonly settleAsync: () => Promise<void>;

  /** Oddaje użytkownikowi treść, którą właśnie próbował zapisać (tekst komentarza z powrotem
   * do edytora, opis z powrotem do pola) — wołane wyłącznie przy cofnięciu. */
  readonly onRollback?: () => void;

  /** Klucz komunikatu pokazywany, gdy zadanie nie poda własnego kodu błędu w `errorsSummary`. */
  readonly failureMessage?: Translatable;
}

/** Jeden wpis w rejestrze nakładek — para (operacja, identyfikator porządkujący kompozycję). */
export interface OptimisticEntry<TValue = unknown> {
  /** Rosnący licznik nadawany przy rejestracji — rozstrzyga kolejność kompozycji, gdy kilka
   * nakładek dotyczy tego samego klucza. */
  readonly id: number;
  readonly op: ErpOptimisticOp<TValue>;
}

/** Zdarzenie cofnięcia — emitowane na `rollbacks$`, konsumowane przez most w hoście
 * (`ErpOptimisticRollbackBridge`), który zamienia je na toast. */
export interface OptimisticRollback {
  readonly scope: string;
  readonly key: string;
  /** `job.errorsSummary`, gdy nakładka odpadła po stronie zadania (nie po samym HTTP). */
  readonly errorsSummary?: string | null;
  readonly failureMessage?: Translatable;
}
