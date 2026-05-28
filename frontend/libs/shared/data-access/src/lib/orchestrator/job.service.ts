import { Injectable, signal, computed, Signal } from '@angular/core';
import { JobEntry, JobMeta, JobStatus } from './orchestrator.types';

/**
 * Centralized service for tracking background jobs spawned by command execution.
 *
 * When an orchestrator executes a command, the API returns a `jobUuid`.
 * The orchestrator registers this job here so the UI can track its status.
 *
 * Future integration: SignalR events will update job statuses in real-time.
 */
@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly _jobs = signal(new Map<string, JobEntry>());

  // ────────────────────────────────────────────────────────────────
  // Read API
  // ────────────────────────────────────────────────────────────────

  /**
   * Get a reactive signal for all tracked jobs.
   */
  public readonly allJobs: Signal<Map<string, JobEntry>> = this._jobs.asReadonly();

  /**
   * Get a reactive signal for a specific job by UUID.
   */
  public getJob(jobUuid: string): Signal<JobEntry | undefined> {
    return computed(() => this._jobs().get(jobUuid));
  }

  /**
   * Get all jobs filtered by status.
   */
  public getJobsByStatus(status: JobStatus): Signal<JobEntry[]> {
    return computed(() => {
      const all = this._jobs();
      return [...all.values()].filter(j => j.status === status);
    });
  }

  /**
   * Get all pending jobs.
   */
  public readonly pendingJobs: Signal<JobEntry[]> = computed(() =>
    [...this._jobs().values()].filter(j => j.status === 'pending'),
  );

  // ────────────────────────────────────────────────────────────────
  // Write API
  // ────────────────────────────────────────────────────────────────

  /**
   * Register a new job.
   * Called by orchestrators after a command returns a jobUuid.
   */
  public addJob(jobUuid: string, meta: JobMeta): void {
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.set(jobUuid, {
        ...meta,
        jobUuid,
        status: 'pending',
      });
      return updated;
    });
  }

  /**
   * Update the status of an existing job.
   * Used by SignalR event handlers or polling mechanisms.
   */
  public updateJobStatus(jobUuid: string, status: JobStatus): void {
    this._jobs.update(jobs => {
      const existing = jobs.get(jobUuid);
      if (!existing) return jobs;

      const updated = new Map(jobs);
      updated.set(jobUuid, { ...existing, status });
      return updated;
    });
  }

  /**
   * Remove a job from tracking.
   */
  public removeJob(jobUuid: string): void {
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.delete(jobUuid);
      return updated;
    });
  }

  /**
   * Clear all completed/failed jobs.
   */
  public clearFinished(): void {
    this._jobs.update(jobs => {
      const updated = new Map<string, JobEntry>();
      for (const [uuid, job] of jobs) {
        if (job.status === 'pending') {
          updated.set(uuid, job);
        }
      }
      return updated;
    });
  }
}
