import { Injectable, signal, computed, Signal, inject } from '@angular/core';
import { JobRecord, JobMeta, JobStatus } from './orchestrator.types';
import { SignalrSyncService } from '../sync/signalr-sync.service';

/**
 * Centralized service for tracking background jobs spawned by command execution.
 *
 * When an orchestrator executes a command, the API returns a `jobUuid` (trackingID).
 * The orchestrator registers this job here, associated with its originating modal ID (queueID).
 *
 * SignalR events (with 'jobs' signature) notify this service of status changes using the trackingID.
 */
@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly _signalrSync = inject(SignalrSyncService);
  private readonly _jobs = signal(new Map<string, JobRecord>());

  constructor() {
    // Listen for real-time status update events for jobs using trackingID
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
  // Read API
  // ────────────────────────────────────────────────────────────────

  /**
   * Get a reactive signal for all tracked jobs.
   */
  public readonly allJobs: Signal<Map<string, JobRecord>> = this._jobs.asReadonly();

  /**
   * Get a reactive signal for a specific job by trackingID.
   */
  public getJob(trackingID: string): Signal<JobRecord | undefined> {
    return computed(() => this._jobs().get(trackingID));
  }

  /**
   * Get all jobs filtered by status.
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
   * Get all jobs triggered by a specific modal (queueID).
   */
  public getJobsByQueueID(queueID: string): Signal<JobRecord[]> {
    return computed(() => {
      return [...this._jobs().values()].filter(j => j.queueID === queueID);
    });
  }

  /**
   * Get all pending jobs.
   */
  public readonly pendingJobs: Signal<JobRecord[]> = computed(() =>
    [...this._jobs().values()].filter(j => !j.isComplete),
  );

  // ────────────────────────────────────────────────────────────────
  // Write API
  // ────────────────────────────────────────────────────────────────

  /**
   * Register a new job.
   * Called by orchestrators after a command returns a jobUuid (trackingID).
   *
   * @param trackingID The jobUuid returned by the endpoint
   * @param queueID The identifier of the triggering modal
   * @param meta Optional tracking metadata
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
   * Register a full/partial JobRecord directly.
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
   * Update specific fields of an existing job by its trackingID.
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
   * Update the status of an existing job by its trackingID.
   * Maintains backward compatibility with JobStatus.
   */
  public updateJobStatus(trackingID: string, status: JobStatus): void {
    this.updateJob(trackingID, {
      isComplete: status !== 'pending',
      errors: status === 'failed' ? 'Job failed' : null,
    });
  }

  /**
   * Remove a job from tracking by its trackingID.
   */
  public removeJob(trackingID: string): void {
    this._jobs.update(jobs => {
      const updated = new Map(jobs);
      updated.delete(trackingID);
      return updated;
    });
  }

  /**
   * Clear all completed/failed jobs.
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
