import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Translatable } from '@erp/shared/data-access';

import {
  GetIssueActivityRequest,
  GetIssueCommentsRequest,
  IssueActivityDto,
  IssueCommentDto,
  TaskManagementClient,
} from '../api-client';
import { IssueChildCache } from '../issue-child-cache';

/** Sygnatury realtime — muszą zgadzać się co do znaku z `AggregateSignatures`. */
const COMMENT_SIGNATURE = 'taskmgmt.issue_comment';
const ISSUE_SIGNATURE = 'taskmgmt.issue';

/**
 * Wątek komentarzy zgłoszenia.
 *
 * <p>Odczyt siedzi tutaj, <b>zapis w orkiestratorze zgłoszeń</b> — i to nie jest przypadkowy
 * podział. Komendy nazywają się `IssueAddComment`, `IssueSetCommentBody`, `IssueRemoveComment`,
 * bo agregatem jest zgłoszenie; idą przez zadanie masowe jak każdy inny zapis w tym module
 * i tam mieszka `runSingleCommandAsync`. Lista wraca sama, zdarzeniem na
 * <c>taskmgmt.issue_comment</c> — także wtedy, gdy komentarz dopisał ktoś inny.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueCommentService extends IssueChildCache<IssueCommentDto> {
  protected override readonly label = 'IssueCommentService';
  protected override readonly signature = COMMENT_SIGNATURE;

  private readonly _api = inject(TaskManagementClient);

  public constructor() {
    super();
    this.watch([COMMENT_SIGNATURE]);
  }

  /** Komentarze zgłoszenia w kolejności dodania; odpowiedzi w tej samej płaskiej liście. */
  public commentsOf(issueUuid: string | null | undefined): Signal<readonly IssueCommentDto[]> {
    return this.itemsOf(issueUuid);
  }

  /** Publiczne wejście do nakładki optymistycznej z `feature` — patrz
   * `runOptimisticListCommandAsync` na klasie bazowej i `IssueActivityComponent`, jedyny dziś
   * konsument. */
  public runOptimisticCommentAsync(
    issueUuid: string,
    patch: (current: readonly IssueCommentDto[] | undefined) => readonly IssueCommentDto[] | undefined,
    dispatchAsync: () => Promise<string>,
    options?: { onRollback?: () => void; failureMessage?: Translatable },
  ): Promise<void> {
    return this.runOptimisticListCommandAsync(issueUuid, patch, dispatchAsync, options);
  }

  protected override fetchAsync(issueUuid: string): Promise<readonly IssueCommentDto[]> {
    return firstValueFrom(this._api.getIssueComments({ issueUuid } as GetIssueCommentsRequest));
  }
}

/**
 * Historia zmian zgłoszenia.
 *
 * <p><b>Słucha dwóch kanałów</b>, bo dopisuje ją i zmiana pola zgłoszenia, i komentarz —
 * a własnego kanału świadomie nie ma: osobna sygnatura oznaczałaby dwa zdarzenia realtime
 * na jedną zmianę i drugie odświeżenie karty bez nowej treści
 * (`docs/backend/task-management.md` §11).</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueActivityService extends IssueChildCache<IssueActivityDto> {
  protected override readonly label = 'IssueActivityService';
  protected override readonly signature = ISSUE_SIGNATURE;

  private readonly _api = inject(TaskManagementClient);

  public constructor() {
    super();
    this.watch([ISSUE_SIGNATURE, COMMENT_SIGNATURE]);
  }

  /** Wpisy historii, najnowsze pierwsze — tak wydaje je backend. */
  public entriesOf(issueUuid: string | null | undefined): Signal<readonly IssueActivityDto[]> {
    return this.itemsOf(issueUuid);
  }

  protected override fetchAsync(issueUuid: string): Promise<readonly IssueActivityDto[]> {
    return firstValueFrom(this._api.getIssueActivity({ issueUuid } as GetIssueActivityRequest));
  }
}
