import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BaseOrchestrator, BaseDto } from './base-orchestrator';
import { SignalrSyncService } from '../sync/signalr-sync.service';
import { Observable, of } from 'rxjs';
import { Injectable } from '@angular/core';

interface MockDto extends BaseDto {
  uuid: string;
  name: string;
}

interface MockViewModel {
  uuid: string;
  displayName: string;
}

@Injectable()
class TestOrchestrator extends BaseOrchestrator<MockDto, MockViewModel, unknown, unknown> {
  protected override get signature(): string { return 'TestAggregate'; }

  protected override fetchSearch(): Observable<string[]> {
    return of(['uuid-1', 'uuid-2']);
  }

  protected override fetchData(uuids: string[]): Observable<MockDto[]> {
    const data: MockDto[] = [
      { uuid: 'uuid-1', name: 'Item One' },
      { uuid: 'uuid-2', name: 'Item Two' }
    ];
    return of(data.filter(item => uuids.includes(item.uuid)));
  }

  protected override enrich(dto: MockDto): MockViewModel {
    return {
      uuid: dto.uuid,
      displayName: `Enriched: ${dto.name}`
    };
  }
}

describe('BaseOrchestrator', () => {
  let orchestrator: TestOrchestrator;
  let syncService: SignalrSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TestOrchestrator,
        SignalrSyncService
      ]
    });

    orchestrator = TestBed.inject(TestOrchestrator);
    syncService = TestBed.inject(SignalrSyncService);
  });

  it('should initialize and hold an empty cache', () => {
    expect(orchestrator).toBeTruthy();
    const vms = orchestrator.allViewModels();
    expect(vms.size).toBe(0);
  });

  it('should search aggregates and return list of uuids', () => {
    return new Promise<void>((resolve, reject) => {
      orchestrator.search({}).subscribe({
        next: uuids => {
          expect(uuids).toEqual(['uuid-1', 'uuid-2']);
          resolve();
        },
        error: reject
      });
    });
  });

  it('should load aggregates into cache and map to view models', () => {
    return new Promise<void>((resolve, reject) => {
      orchestrator.load(['uuid-1', 'uuid-2']).subscribe({
        next: vms => {
          expect(vms.length).toBe(2);
          expect(vms[0]).toEqual({ uuid: 'uuid-1', displayName: 'Enriched: Item One' });
          expect(vms[1]).toEqual({ uuid: 'uuid-2', displayName: 'Enriched: Item Two' });

          // Cache should be updated
          const cacheMap = orchestrator.allViewModels();
          expect(cacheMap.size).toBe(2);
          expect(cacheMap.get('uuid-1')).toEqual({ uuid: 'uuid-1', displayName: 'Enriched: Item One' });
          resolve();
        },
        error: reject
      });
    });
  });

  it('should provide a reactive signal via getViewModel', () => {
    const signal = orchestrator.getViewModel(['uuid-1', 'uuid-2']);
    
    // Initially empty
    expect(signal().size).toBe(0);

    // After loading, it should reactively populate
    orchestrator.load(['uuid-1']).subscribe();
    expect(signal().size).toBe(1);
    expect(signal().get('uuid-1')).toEqual({ uuid: 'uuid-1', displayName: 'Enriched: Item One' });

    orchestrator.load(['uuid-2']).subscribe();
    expect(signal().size).toBe(2);
    expect(signal().get('uuid-2')).toEqual({ uuid: 'uuid-2', displayName: 'Enriched: Item Two' });
  });

  it('should automatically reload cached aggregates when SignalR update occurs', () => {
    // 1. Load an item so it is cached
    orchestrator.load(['uuid-1']).subscribe();
    expect(orchestrator.allViewModels().size).toBe(1);

    // Spy on fetchData to see if it reloads on update
    const fetchSpy = vi.spyOn(orchestrator as unknown as { fetchData: (uuids: string[]) => Observable<MockDto[]> }, 'fetchData');

    // 2. Trigger SignalR update for this signature but with an item NOT in cache
    syncService.triggerLocalUpdate('TestAggregate', ['uuid-2']);
    expect(fetchSpy).not.toHaveBeenCalled();

    // 3. Trigger SignalR update for the cached item
    syncService.triggerLocalUpdate('TestAggregate', ['uuid-1']);
    expect(fetchSpy).toHaveBeenCalledWith(['uuid-1']);
  });
});
