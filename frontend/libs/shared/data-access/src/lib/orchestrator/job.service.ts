import { Injectable, signal, computed, Signal, inject } from '@angular/core';
import { JobRecord, JobMeta, JobStatus } from './orchestrator.types';
import { SignalrSyncService } from '../sync/signalr-sync.service';

/**
 * Zdecentralizowany serwis do śledzenia zadań w tle (jobs) uruchamianych przez wykonywanie poleceń (commands).
 *
 * Kiedy orkiestrator wykonuje polecenie, API zwraca `jobUuid` (trackingID).
 * Orkiestrator rejestruje to zadanie tutaj, powiązane z pierwotnym identyfikatorem modalu (queueID).
 *
 * Zdarzenia SignalR (z sygnaturą 'jobs') powiadamiają ten serwis o zmianach statusu za pomocą trackingID.
 */
@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly _signalrSync = inject(SignalrSyncService);
  private readonly _jobs = signal(new Map<string, JobRecord>());

  public constructor() {
    // Nasłuchuj zdarzeń aktualizacji statusu zadań w czasie rzeczywistym za pomocą trackingID
    this._signalrSync.onUpdate('jobs').subscribe(trackingIDs => {
      this._jobs.update(jobs => {
        const updated = new Map(jobs);
        for (const trackingID of trackingIDs) {
          const existing = updated.get(trackingID);
          if (existing) {
            updated.set(trackingID, {
              ...existing,
              isComplete: true,
            });
          }
        }
        return updated;
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  // API Odczytu
  // ────────────────────────────────────────────────────────────────

  /**
   * Pobierz reaktywny sygnał dla wszystkich śledzonych zadań.
   */
  public readonly allJobs: Signal<Map<string, JobRecord>> = this._jobs.asReadonly();

  /**
   * Pobierz reaktywny sygnał dla konkretnego zadania po trackingID.
   */
  public getJob(trackingID: string): Signal<JobRecord | undefined> {
    return computed(() => this._jobs().get(trackingID));
  }

  /**
   * Pobierz wszystkie zadania przefiltrowane według statusu.
   */
  public getJobsByStatus(status: JobStatus): Signal<JobRecord[]> {
    return computed(() => {
      const all = [...this._jobs().values()];
      if (status === 'pending') {
        return all.filter(j => !j.isComplete);
      } else if (status === 'completed') {
        return all.filter(j => j.isComplete && !j.errors && !j.exceptions);
      } else {
        return all.filter(j => j.isComplete && (j.errors || j.exceptions));
      }
    });
  }

  /**
   * Pobierz wszystkie zadania wywołane przez konkretny modal (queueID).
   */
  public getJobsByQueueID(queueID: string): Signal<JobRecord[]> {
    return computed(() => {
      return [...this._jobs().values()].filter(j => j.queueID === queueID);
    });
  }

  /**
   * Pobierz wszystkie oczekujące zadania.
   */
  public readonly pendingJobs: Signal<JobRecord[]> = computed(() =>
    [...this._jobs().values()].filter(j => !j.isComplete),
  );

  // ────────────────────────────────────────────────────────────────
  // API Zapisu
  // ────────────────────────────────────────────────────────────────

  /**
   * Zarejestruj nowe zadanie.
   * Wywoływane przez orkiestratorów po tym, jak polecenie zwróci jobUuid (trackingID).
   *
   * @param trackingID Zwrócony przez endpoint jobUuid
   * @param queueID Identyfikator wywołującego modalu
   * @param meta Opcjonalne metadane śledzenia
   */
  public addJob(trackingID: string, queueID?: string, meta?: JobMeta): void {
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.set(trackingID, {
        trackingID,
        queueID,
        isComplete: false,
        unRead: true,
        uiMetadata: meta ? JSON.stringify(meta) : null,
      });
      return updated;
    });
  }

  /**
   * Zarejestruj pełny lub częściowy rekord JobRecord bezpośrednio.
   */
  public registerJob(job: JobRecord): void {
    if (!job.trackingID) return;
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.set(job.trackingID!, {
        unRead: true,
        isComplete: false,
        ...job,
      });
      return updated;
    });
  }

  /**
   * Zaktualizuj określone pola istniejącego zadania za pomocą jego trackingID.
   */
  public updateJob(trackingID: string, patch: Partial<JobRecord>): void {
    this._jobs.update(jobs => {
      const existing = jobs.get(trackingID);
      if (!existing) return jobs;

      const updated = new Map(jobs);
      updated.set(trackingID, {
        ...existing,
        ...patch,
      });
      return updated;
    });
  }

  /**
   * Zaktualizuj status istniejącego zadania za pomocą jego trackingID.
   * Utrzymuje kompatybilność wsteczną z JobStatus.
   */
  public updateJobStatus(trackingID: string, status: JobStatus): void {
    this.updateJob(trackingID, {
      isComplete: status !== 'pending',
      errors: status === 'failed' ? 'Zadanie nie powiodło się' : null,
    });
  }

  /**
   * Usuń zadanie ze śledzenia za pomocą jego trackingID.
   */
  public removeJob(trackingID: string): void {
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.delete(trackingID);
      return updated;
    });
  }

  /**
   * Wyczyść wszystkie zakończone lub nieudane zadania.
   */
  public clearFinished(): void {
    this._jobs.update(jobs => {
      const updated = new Map<string, JobRecord>();
      for (const [uuid, job] of jobs) {
        if (!job.isComplete) {
          updated.set(uuid, job);
        }
      }
      return updated;
    });
  }
}
