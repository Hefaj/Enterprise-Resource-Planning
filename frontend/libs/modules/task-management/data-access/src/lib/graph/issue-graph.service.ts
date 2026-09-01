import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { SignalrSyncService } from '@erp/shared/data-access';

import { GetIssueGraphRequest, IssueGraphDto, TaskManagementClient } from '../api-client';

/** Kanał krawędzi powiązań — musi zgadzać się co do znaku z `AggregateSignatures`. */
const LINK_SIGNATURE = 'taskmgmt.issue_link';

/**
 * Hierarchia i powiązania zgłoszenia — odczyt dla paska powiązań na karcie.
 *
 * <p><b>Zwykły serwis, nie orkiestrator</b>, z tego samego powodu co `ProjectWorkflowService`:
 * graf czyta się per zgłoszenie, jednym żądaniem, i nie ma listy do stronicowania.
 * `BaseOrchestrator` musiałby udawać wyszukiwanie, którego backend nie wystawia.</p>
 *
 * <p>Nasłuch na `taskmgmt.issue_link` jest tu <b>ręczny</b> i to jest cena tej decyzji: bez
 * niego dopięcie blokady przez drugą osobę nie odświeżyłoby paska. Kanał niesie uuid KRAWĘDZI,
 * a cache jest kluczowany zgłoszeniem, więc nie da się z niego wyliczyć, który wpis
 * unieważnić — odświeżamy wszystkie wczytane grafy. Wpisów jest tyle, ile otwartych kart,
 * czyli jeden albo dwa.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueGraphService {
  private readonly _api = inject(TaskManagementClient);
  private readonly _sync = inject(SignalrSyncService);

  private readonly _byIssue = signal<ReadonlyMap<string, IssueGraphDto>>(new Map());
  private readonly _inFlight = new Map<string, Promise<IssueGraphDto | undefined>>();

  /** Sygnały `getOne` cache’owane per uuid — jedna stała referencja `computed()` zamiast nowej
   * przy każdym wywołaniu, inaczej konsument traci pamięć poprzedniej wartości i reewaluuje się
   * od zera przy każdej zmianie `_byIssue`, nawet cudzej. */
  private readonly _graphSignals = new Map<string, Signal<IssueGraphDto | undefined>>();

  public constructor() {
    this._sync.subscribe(LINK_SIGNATURE);
    this._sync.onUpdate(LINK_SIGNATURE).pipe(takeUntilDestroyed()).subscribe(() => void this._refreshAllAsync());
    this._sync.onDelete(LINK_SIGNATURE).pipe(takeUntilDestroyed()).subscribe(() => void this._refreshAllAsync());
  }

  /** Graf zgłoszenia, jeśli jest już w cache. Nie odpala żądania — do tego jest `loadAsync`. */
  public getOne(issueUuid: string | null | undefined): Signal<IssueGraphDto | undefined> {
    if (!issueUuid) {
      return computed(() => undefined);
    }

    let entry = this._graphSignals.get(issueUuid);

    if (!entry) {
      entry = computed(() => this._byIssue().get(issueUuid));
      this._graphSignals.set(issueUuid, entry);
    }

    return entry;
  }

  public async loadAsync(issueUuid: string): Promise<IssueGraphDto | undefined> {
    if (!issueUuid) {
      return undefined;
    }

    const pending = this._inFlight.get(issueUuid);
    if (pending) {
      return pending;
    }

    const request = this._fetch(issueUuid).finally(() => this._inFlight.delete(issueUuid));
    this._inFlight.set(issueUuid, request);
    return request;
  }

  /**
   * Wymusza ponowne pobranie — po własnej komendzie zmieniającej graf.
   *
   * <p>Dzieli `_inFlight` z {@link loadAsync}: bez tego własne wywołanie po komendzie i echo
   * SignalR tej samej zmiany (backend publikuje `taskmgmt.issue_link` po zapisie) odpalały dwa
   * równoległe żądania o ten sam graf.</p>
   */
  public async refreshAsync(issueUuid: string): Promise<void> {
    const pending = this._inFlight.get(issueUuid);
    if (pending) {
      await pending;
      return;
    }

    const request = this._fetch(issueUuid).finally(() => this._inFlight.delete(issueUuid));
    this._inFlight.set(issueUuid, request);
    await request;
  }

  private async _refreshAllAsync(): Promise<void> {
    await Promise.all([...this._byIssue().keys()].map((uuid) => this._fetch(uuid)));
  }

  private async _fetch(issueUuid: string): Promise<IssueGraphDto | undefined> {
    try {
      const dto = await firstValueFrom(this._api.getIssueGraph({ issueUuid } as GetIssueGraphRequest));

      this._byIssue.update((map) => new Map(map).set(issueUuid, dto));
      return dto;
    } catch (error) {
      console.error('[IssueGraphService] Nie udało się pobrać powiązań zgłoszenia.', error);
      return undefined;
    }
  }
}
