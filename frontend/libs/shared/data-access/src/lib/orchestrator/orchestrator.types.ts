/**
 * Core types, interfaces, and configuration objects for the Orchestrator architecture.
 *
 * These types are shared across all modules and form the foundation for:
 * - BaseOrchestrator configuration
 * - DataLoader batching/retry policies
 * - IdentityMapStore LRU settings
 * - Command → Job tracking
 */

// ────────────────────────────────────────────────────────────────
// Orchestrator Configuration
// ────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  /** Default page size for search queries. */
  readonly defaultPageSize: number;

  /** Maximum number of UUIDs per single API request (chunking). */
  readonly maxChunkSize: number;

  /** Buffer window in ms for batching individual loadAsync calls. */
  readonly bufferTimeMs: number;

  /** Maximum number of retry attempts for failed fetch operations. */
  readonly maxRetries: number;

  /** Base delay in ms for exponential backoff between retries. */
  readonly retryDelayMs: number;

  /** Maximum number of aggregates kept in the LRU cache per type. */
  readonly maxCacheSize: number;

  /** SignalR event signature used for real-time updates (e.g. 'catalog.product'). */
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
// Load Options (Eager Loading / Dependency Tree)
// ────────────────────────────────────────────────────────────────

/**
 * Declares which related aggregates should be eagerly loaded
 * alongside the primary aggregate. Each orchestrator can extend
 * this with module-specific keys.
 */
export interface LoadOptions {
  [key: string]: boolean | undefined;
}

// ────────────────────────────────────────────────────────────────
// Pagination
// ────────────────────────────────────────────────────────────────

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
}

// ────────────────────────────────────────────────────────────────
// Search Results Response
// ────────────────────────────────────────────────────────────────

export interface SharedSearchResponse {
  readonly uuids?: string[];
  readonly totalCount?: number;
}

// ────────────────────────────────────────────────────────────────
// Error Tracking
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
// Job Management (Command → Job UUID)
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
// Generic DTO constraint
// ────────────────────────────────────────────────────────────────

/**
 * Every DTO managed by the orchestrator system must have a `uuid` field.
 */
export interface HasUuid {
  readonly uuid: string;
}

// ────────────────────────────────────────────────────────────────
// Resolved Dependencies (passed to mapToViewModel)
// ────────────────────────────────────────────────────────────────

/**
 * A generic bag of resolved dependency data that is passed into
 * `mapToViewModel`. Each orchestrator defines the shape of its
 * own resolved deps via the generic parameter.
 */
export type ResolvedDeps = Record<string, unknown>;
