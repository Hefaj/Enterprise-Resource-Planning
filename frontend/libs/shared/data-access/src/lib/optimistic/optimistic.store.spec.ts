import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { JobService } from '../orchestrator/job.service';
import { JobRecord } from '../orchestrator/orchestrator.types';
import { ErpOptimisticStore } from './optimistic.store';

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    trackingID: 'job-1',
    queueID: null,
    commandType: 'Test',
    meta: null,
    status: 'completed',
    totalCount: 1,
    succeededCount: 1,
    failedCount: 0,
    isComplete: true,
    errorsSummary: null,
    createdAt: new Date(),
    expireOn: null,
    resultRef: null,
    changedAt: Date.now(),
    optimistic: false,
    ...overrides,
  };
}

/** Zastępuje `JobService` — bez tego konstruktor prawdziwego serwisu otworzyłby połączenie
 * SignalR (`SignalrSyncService`), którego test nie potrzebuje i nie ma z czym rozmawiać. */
class FakeJobService {
  private readonly _signals = new Map<string, WritableSignal<JobRecord | undefined>>();

  public jobSignal(trackingID: string): WritableSignal<JobRecord | undefined> {
    let entry = this._signals.get(trackingID);
    if (!entry) {
      entry = signal<JobRecord | undefined>(undefined);
      this._signals.set(trackingID, entry);
    }
    return entry;
  }

  public getJob(trackingID: string): WritableSignal<JobRecord | undefined> {
    return this.jobSignal(trackingID);
  }
}

function setup(): { store: ErpOptimisticStore; jobs: FakeJobService } {
  const jobs = new FakeJobService();

  TestBed.configureTestingModule({
    providers: [ErpOptimisticStore, { provide: JobService, useValue: jobs }],
  });

  return { store: TestBed.inject(ErpOptimisticStore), jobs: TestBed.inject(JobService) as unknown as FakeJobService };
}

describe('ErpOptimisticStore', () => {
  it('sukces zdejmuje nakładkę dopiero po settleAsync', async () => {
    const { store, jobs } = setup();
    const order: string[] = [];

    const run = store.runAsync<{ value: string }>({
      scope: 'test',
      key: 'a',
      patch: () => ({ value: 'optimistic' }),
      dispatchAsync: async () => {
        queueMicrotask(() => {
          order.push('job-completed');
          jobs.jobSignal('job-1').set(makeJob());
        });
        return 'job-1';
      },
      settleAsync: async () => {
        order.push('settle');
      },
    });

    expect(store.project('test', 'a', undefined)).toEqual({ value: 'optimistic' });
    expect(store.isPending('test', 'a')()).toBe(true);

    await run;

    expect(order).toEqual(['job-completed', 'settle']);
    expect(store.project('test', 'a', undefined)).toBeUndefined();
    expect(store.isPending('test', 'a')()).toBe(false);
  });

  it('porażka zadania woła onRollback i emituje na rollbacks$', async () => {
    const { store, jobs } = setup();

    let rolledBack = false;
    const rollbacks: unknown[] = [];
    store.rollbacks$.subscribe((rollback) => rollbacks.push(rollback));

    const run = store.runAsync<{ value: string }>({
      scope: 'test',
      key: 'b',
      patch: () => ({ value: 'optimistic' }),
      dispatchAsync: async () => {
        queueMicrotask(() =>
          jobs.jobSignal('job-2').set(makeJob({ trackingID: 'job-2', status: 'failed', errorsSummary: 'boom: 1' })),
        );
        return 'job-2';
      },
      settleAsync: async () => {
        /* no-op */
      },
      onRollback: () => {
        rolledBack = true;
      },
    });

    await run;

    expect(rolledBack).toBe(true);
    expect(rollbacks).toEqual([{ scope: 'test', key: 'b', errorsSummary: 'boom: 1', failureMessage: undefined }]);
    expect(store.isPending('test', 'b')()).toBe(false);
  });

  it('rzut z dispatchAsync cofa natychmiast, bez czekania na zadanie', async () => {
    const { store } = setup();
    let rolledBack = false;

    await store.runAsync<{ value: string }>({
      scope: 'test',
      key: 'c',
      patch: () => ({ value: 'optimistic' }),
      dispatchAsync: async () => {
        throw new Error('400 Bad Request');
      },
      settleAsync: async () => {
        throw new Error('settleAsync nie powinien być wołany, gdy dispatchAsync rzucił.');
      },
      onRollback: () => {
        rolledBack = true;
      },
    });

    expect(rolledBack).toBe(true);
    expect(store.isPending('test', 'c')()).toBe(false);
  });

  it('dwie nakładki na ten sam klucz składają się w kolejności zgłoszenia', () => {
    const { store } = setup();

    const neverSettles = (): Promise<never> => new Promise<never>(() => undefined);

    void store.runAsync<{ value: string; touchedBy: string[] }>({
      scope: 'test',
      key: 'd',
      patch: (current) => ({ value: 'first', touchedBy: [...(current?.touchedBy ?? []), 'first'] }),
      dispatchAsync: neverSettles as unknown as () => Promise<string>,
      settleAsync: async () => {
        /* no-op */
      },
    });

    void store.runAsync<{ value: string; touchedBy: string[] }>({
      scope: 'test',
      key: 'd',
      patch: (current) => ({ value: 'second', touchedBy: [...(current?.touchedBy ?? []), 'second'] }),
      dispatchAsync: neverSettles as unknown as () => Promise<string>,
      settleAsync: async () => {
        /* no-op */
      },
    });

    expect(store.project('test', 'd', { value: 'base', touchedBy: [] })).toEqual({
      value: 'second',
      touchedBy: ['first', 'second'],
    });
  });

  it('project zwraca base bez zmian, gdy nie ma aktywnej nakładki', () => {
    const { store } = setup();

    expect(store.project('test', 'nope', { value: 42 })).toEqual({ value: 42 });
    expect(store.project('test', 'nope', undefined)).toBeUndefined();
  });
});
