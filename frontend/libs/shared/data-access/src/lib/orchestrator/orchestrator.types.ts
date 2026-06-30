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

export type OrchestratorOperation = 'load' | 'search' | 'command' | 'signalr-refresh';

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

export type JobStatus = 'pending' | 'completed' | 'failed';

export interface JobMeta {
  readonly commandName: string;
  readonly aggregateUuid?: string;
  readonly timestamp: Date;
}

export interface JobEntry extends JobMeta {
  readonly jobUuid: string;
  status: JobStatus;
}

export interface JobRecord {
  queueID?: string;
  trackingID?: string;
  command?: any | null;
  result?: any | null;
  executeAfter?: string;
  expireOn?: string;
  isComplete?: boolean;
  serviceId?: number;
  userId?: string;
  commandJson?: string;
  executionTimes?: number;
  resultJson?: string | null;
  resultType?: string | null;
  errors?: string | null;
  successes?: string | null;
  exceptions?: string | null;
  unRead?: boolean;
  clientId?: string | null;
  uiMetadata?: string | null;
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
