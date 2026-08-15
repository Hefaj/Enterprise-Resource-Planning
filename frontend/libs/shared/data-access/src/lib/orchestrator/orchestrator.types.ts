/**
 * Podstawowe typy, interfejsy i obiekty konfiguracyjne dla architektury orkiestratora.
 *
 * Te typy są współdzielone we wszystkich modułach i stanowią podstawę dla:
 * - Konfiguracji BaseOrchestrator
 * - Polityki grupowania/ponawiania DataLoader
 * - Ustawień LRU IdentityMapStore
 * - Śledzenia Command → Job
 */

// ────────────────────────────────────────────────────────────────
// Konfiguracja Orkiestratora
// ────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  /** Domyślny rozmiar strony dla zapytań wyszukiwania. */
  readonly defaultPageSize: number;

  /** Maksymalna liczba UUID w pojedynczym zapytaniu API (dzielenie na części). */
  readonly maxChunkSize: number;

  /** Okno bufora w ms do grupowania pojedynczych wywołań loadAsync. */
  readonly bufferTimeMs: number;

  /** Maksymalna liczba prób ponowienia dla nieudanych operacji pobierania. */
  readonly maxRetries: number;

  /** Podstawowe opóźnienie w ms dla wykładniczego wycofywania (exponential backoff) pomiędzy ponowieniami. */
  readonly retryDelayMs: number;

  /** Maksymalna liczba agregatów przechowywanych w cache LRU dla każdego typu. */
  readonly maxCacheSize: number;

  /** Sygnatura zdarzenia SignalR używana do aktualizacji w czasie rzeczywistym (np. 'catalog.product'). */
  readonly signalrSignature: string;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: Omit<OrchestratorConfig, 'signalrSignature'> = {
  defaultPageSize: 50,
  maxChunkSize: 100,
  bufferTimeMs: 50,
  maxRetries: 3,
  retryDelayMs: 1000,
  maxCacheSize: 1000,
} as const;

// ────────────────────────────────────────────────────────────────
// Opcje Ładowania (Eager Loading / Drzewo Zależności)
// ────────────────────────────────────────────────────────────────

/**
 * Deklaruje, które powiązane agregaty powinny być natychmiast załadowane (eagerly loaded)
 * wraz z agregatem głównym. Każdy orkiestrator może rozszerzyć ten interfejs
 * o specyficzne klucze dla swojego modułu.
 */
export interface LoadOptions {
  [key: string]: boolean | undefined;
}

// ────────────────────────────────────────────────────────────────
// Paginacja
// ────────────────────────────────────────────────────────────────

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
}

// ────────────────────────────────────────────────────────────────
// Odpowiedź z Wynikami Wyszukiwania
// ────────────────────────────────────────────────────────────────

export interface SharedSearchResponse {
  readonly uuids?: string[];
  readonly totalCount?: number;
}

// ────────────────────────────────────────────────────────────────
// Śledzenie Błędów
// ────────────────────────────────────────────────────────────────

export type OrchestratorOperation = 'load' | 'search' | 'command' | 'signalr-refresh' | 'signalr-resync';

export interface OrchestratorError {
  readonly uuid?: string;
  readonly operation: OrchestratorOperation;
  readonly message: string;
  readonly timestamp: Date;
  readonly retryCount?: number;
}

// ────────────────────────────────────────────────────────────────
// Zarządzanie Zadaniami (Command → Job UUID)
// ────────────────────────────────────────────────────────────────

export type Translatable = string | { key: string; params?: Record<string, any> };

/**
 * Status zadania masowego — lustro `NotificationJobStatus` z backendu
 * (`backend/modules/Notification/Notification.Domain/Aggregates/Jobs/NotificationJobStatus.cs`).
 *
 * Wartości tekstowe, nie liczbowe: po stronie frontendu status trafia wprost do klucza
 * tłumaczenia i do klasy CSS, a numer z bazy nic tu nie wnosi poza koniecznością mapowania
 * w drugą stronę przy każdym odczycie.
 */
export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'completedWithErrors'
  | 'failed'
  | 'cancelled';

export interface JobMeta {
  /** Klucz tłumaczenia Transloco identyfikujący komendę (np. 'product.commands.setPrice'). */
  readonly commandName: Translatable;
  readonly aggregateUuid?: string;
  readonly timestamp: Date;
}

/**
 * Zadanie masowe widziane przez UI.
 *
 * Kształt jest świadomie węższy niż stary `JobRecord` odziedziczony po mocku: pola bez pokrycia
 * w backendzie (`resultJson`, `resultType`, `exceptions`, `executionTimes`, `serviceId`,
 * `successes`) zniknęły razem ze swoimi odpowiednikami w `JobDto` — patrz komentarz przy tym
 * rekordzie po stronie backendu.
 */
export interface JobRecord {
  /** `jobUuid` zwrócony przez endpoint operacji masowej. Klucz rekordu w feedzie. */
  readonly trackingID: string;

  /** Identyfikator modalu, z którego poszła operacja. */
  readonly queueID?: string | null;

  /** Techniczna nazwa typu komendy z backendu — fallback opisu, gdy brak `meta`. */
  readonly commandType?: string | null;

  /** Metadane nadane przez frontend przy zlecaniu; przeżywają odświeżenie strony,
   * bo backend przechowuje je jako `uiMetadata` i oddaje w `JobDto`. */
  readonly meta?: JobMeta | null;

  readonly status: JobStatus;
  readonly totalCount: number;
  readonly succeededCount: number;
  readonly failedCount: number;

  /**
   * Ustawiane natychmiast po sygnale z kanału `jobs`, jeszcze zanim orkiestrator zdąży pobrać
   * świeży stan z API. Dlatego może być `true` przy `status` wciąż równym `running` — UI ma
   * wtedy pokazać „kończenie”, a nie zgadywać, czy poszło dobrze, czy źle.
   */
  readonly isComplete: boolean;

  /** Błędy zgrupowane po kodzie (np. `"price_negative: 1200"`). */
  readonly errorsSummary?: string | null;

  readonly createdAt: Date;
  readonly expireOn?: Date | null;

  /** Moment ostatniej zmiany rekordu — po nim liczy się licznik nieprzeczytanych. */
  readonly changedAt: number;

  /** Wpis powstał lokalnie i nie został jeszcze potwierdzony przez replikę serwera. */
  readonly optimistic: boolean;
}

// ────────────────────────────────────────────────────────────────
// Generyczne ograniczenie DTO
// ────────────────────────────────────────────────────────────────

/**
 * Każde DTO zarządzane przez system orkiestratora musi posiadać pole `uuid`.
 */
export interface HasUuid {
  readonly uuid: string;
}

// ────────────────────────────────────────────────────────────────
// Rozwiązane Zależności (przekazywane do mapToViewModel)
// ────────────────────────────────────────────────────────────────

/**
 * Generyczny worek rozwiązanych danych zależności, który jest przekazywany do
 * `mapToViewModel`. Każdy orkiestrator definiuje strukturę swoich własnych
 * rozwiązanych zależności za pomocą generycznego parametru.
 */
export type ResolvedDeps = Record<string, unknown>;
