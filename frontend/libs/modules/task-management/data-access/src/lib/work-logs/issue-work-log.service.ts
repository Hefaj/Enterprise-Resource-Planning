import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { GetIssueWorkLogsRequest, IssueWorkLogDto, TaskManagementClient } from '../api-client';
import { IssueChildCache } from '../issue-child-cache';

/** Sygnatura realtime — musi zgadzać się co do znaku z `AggregateSignatures.TaskManagementIssueWorkLog`. */
const WORK_LOG_SIGNATURE = 'taskmgmt.issue_work_log';

/**
 * Wpisy czasu zgłoszenia (TIME-001), wzorem `IssueCommentService`.
 *
 * <p>Odczyt siedzi tutaj, zapis w orkiestratorze zgłoszeń (`addWorkLogAsync`/
 * `removeWorkLogAsync`) — agregatem komend jest zgłoszenie, ale wpis czasu ma własny kanał
 * realtime i własną tabelę (patrz uzasadnienie przy `IssueWorkLog` w domenie backendu).</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueWorkLogService extends IssueChildCache<IssueWorkLogDto> {
  protected override readonly label = 'IssueWorkLogService';
  protected override readonly signature = WORK_LOG_SIGNATURE;

  private readonly _api = inject(TaskManagementClient);

  public constructor() {
    super();
    this.watch([WORK_LOG_SIGNATURE]);
  }

  /** Wpisy czasu zgłoszenia, najnowsze pierwsze — tak wydaje je backend. */
  public workLogsOf(issueUuid: string | null | undefined): Signal<readonly IssueWorkLogDto[]> {
    return this.itemsOf(issueUuid);
  }

  protected override fetchAsync(issueUuid: string): Promise<readonly IssueWorkLogDto[]> {
    return firstValueFrom(this._api.getIssueWorkLogs({ issueUuid } as GetIssueWorkLogsRequest));
  }
}
