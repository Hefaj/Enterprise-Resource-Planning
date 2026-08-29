import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpModalService,
  erpBuildBatchTargets,
  erpSelectionScopeCount,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, ErpAuthService, PermissionStore } from '@erp/shared/auth';
import {
  BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
  BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
  IssueCreateCommand,
  IssueVM,
  SearchIssueRequest,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import {
  ISSUE_CREATE_MODAL_ID,
  ISSUE_PRIORITY,
  ISSUE_SET_ASSIGNEE_MODAL_ID,
  ISSUE_SET_STATE_MODAL_ID,
} from '@erp/task-management/util';

import { IssueStore } from '../issue.store';
import { ISSUE_LIST_PRESET } from '../issue-list-preset';
import { IssueSetStateMetadata } from '../../modal/issue-set-state/issue-set-state.definition';
import { TaskManagementIssueTableComponent } from '../../components/tables/task-management-issue-table/task-management-issue-table.component';
import { ISSUE_KEYS } from '../../translation';

/**
 * Pasek akcji + tabela listy zgłoszeń.
 *
 * <p>Zaznaczenie z tabeli trafia do store'a, nie zostaje lokalne — to jedyna droga, którą zasięg
 * (`ErpSelectionScope`) dociera do akcji masowych. Cele buduje `erpBuildBatchTargets(scope)`,
 * nigdy ręczne składanie `targetUuids` (`docs/frontend/selection-scope.md` §3).</p>
 *
 * <p><b>Przypisanie ma trzy drogi, bo to trzy różne czynności.</b> „Przypisz do mnie" i „zdejmij
 * przypisanie" idą wprost komendą — osoby nie trzeba wybierać, więc modal byłby tylko klikiem
 * więcej. Wskazanie <i>innej</i> osoby otwiera modal z pickerem zasilanym wspólnym katalogiem
 * użytkowników (`ERP_USER_DIRECTORY`); moduł nadal nie zna Identity — kontrakt katalogu leży
 * w `@erp/shared/util`, a implementację wstrzykuje aplikacja.</p>
 */
@Component({
  selector: 'erp-task-management-issue-tab',
  standalone: true,
  imports: [
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    TaskManagementIssueTableComponent,
  ],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div class="flex-1 min-h-0 flex flex-col gap-2" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
        <erp-action-toolbar [config]="actionToolbar" />

        <div class="flex-1 min-h-0">
          <erp-task-management-issue-table
            [stateKey]="listStateKey"
            [filters]="store.filters()"
            (loadingChange)="store.setLoading($event)"
            (selectionChange)="store.setSelection($event)"
            (sortsChange)="store.setSorts($event)"
            (rowActivated)="openIssue($event)"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueTabComponent {
  protected readonly store = inject(IssueStore);

  private readonly _orchestrator = inject(TaskManagementIssueOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _permissionStore = inject(PermissionStore);
  private readonly _auth = inject(ErpAuthService);
  private readonly _router = inject(Router);
  private readonly _preset = inject(ISSUE_LIST_PRESET, { optional: true });

  private readonly _table = viewChild(TaskManagementIssueTableComponent);

  protected readonly selectionCount = computed(() => erpSelectionScopeCount(this.store.scope()));
  protected readonly listStateKey = this._preset?.stateKey ?? 'taskmgmt-issue-list';
  protected readonly listLabel = this._preset?.label ?? ISSUE_KEYS.title;

  private readonly _canCreate = computed(() => !this._permissionStore.has(ERP_PERMISSIONS.TaskManagement.IssueCreate));
  private readonly _canUpdate = computed(() => !this._permissionStore.has(ERP_PERMISSIONS.TaskManagement.IssueUpdate));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('taskmgmt-issue-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('issue-default')
          .setLabel(this.listLabel)
          .setIcon('@tui.list-checks')
          .addAction((a) =>
            a
              .setId('create-issue')
              .setLabel(ISSUE_KEYS.commands.create.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(this._canCreate)
              .setFn(() => this._openCreateModal()),
          ),
      )
      .addSelectionGroup((g) =>
        g
          .setId('issue-bulk')
          .setLabel(this.listLabel)
          .setIcon('@tui.list-checks')
          .addAction((a) =>
            a
              .setId('set-state')
              .setLabel(ISSUE_KEYS.commands.setState.label)
              .setIcon('@tui.git-branch')
              .setAppearance('success')
              .setHidden(this._canUpdate)
              .setFn(() => this._openSetStateModal()),
          )
          .addAction((a) =>
            a
              .setId('set-assignee')
              .setLabel(ISSUE_KEYS.commands.setAssignee.label)
              .setIcon('@tui.user')
              .setHidden(this._canUpdate)
              .setFn(() => this._openSetAssignee()),
          )
          .addAction((a) =>
            a
              .setId('assign-to-me')
              .setLabel(ISSUE_KEYS.commands.assignToMe.label)
              .setIcon('@tui.user-check')
              .setHidden(this._canUpdate)
              .setFn(() => this._setAssignee(this._auth.$currentUser()?.id)),
          )
          .addAction((a) =>
            a
              .setId('unassign')
              .setLabel(ISSUE_KEYS.commands.unassign.label)
              .setIcon('@tui.user-minus')
              .setHidden(this._canUpdate)
              .setFn(() => this._setAssignee(undefined)),
          )
          .addAction((a) =>
            a
              .setId('raise-priority')
              .setLabel(ISSUE_KEYS.commands.setPriority.label)
              .setIcon('@tui.chevrons-up')
              .setAppearance('warning')
              .setHidden(this._canUpdate)
              .setFn(() => this._raisePriority()),
          ),
      )
      .setSelectionCount(this.selectionCount)
      .setSelectionScope(this.store.scopeKind)
      .setSelectionLabel(this.listLabel)
      .setOnClearSelection(() => {
        this.store.clearSelection();
        this._table()?.clearSelection();
      })
      .setPinnedActionIds(['create-issue', 'set-state', 'assign-to-me']),
  );

  /** Dwuklik w wiersz otwiera kartę — po KLUCZU czytelnym, nie po uuid, bo ta sama trasa krąży
   * w mailach i commitach (`docs/frontend/task-management-pages.md` §2.3). */
  protected openIssue(issue: IssueVM): void {
    void this._router.navigate(['/task-management/issue', issue.key]);
  }

  /** Projekt z kontekstu listy podpowiada się w formularzu — najczęściej to właśnie w nim
   * użytkownik zakłada zgłoszenie. */
  private _openCreateModal(): void {
    this._modalService.open<IssueCreateCommand, Record<string, never>>(ISSUE_CREATE_MODAL_ID, {
      projectUuid: this.store.projectUuid() ?? undefined,
      priority: ISSUE_PRIORITY.Normal,
    } as IssueCreateCommand);
  }

  /** Kontekst projektu jedzie w metadanych, bo to on wyznacza zbiór stanów do wyboru. */
  private _openSetStateModal(): void {
    this._modalService.open<BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, IssueSetStateMetadata>(
      ISSUE_SET_STATE_MODAL_ID,
      erpBuildBatchTargets<SearchIssueRequest>(this.store.scope()),
      { targetCount: this.selectionCount(), projectUuid: this.store.projectUuid() ?? undefined },
    );
  }

  /** Wybór osoby z katalogu — jedyna z trzech dróg przypisania, która potrzebuje modalu. */
  private _openSetAssignee(): void {
    this._modalService.open<BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest>(
      ISSUE_SET_ASSIGNEE_MODAL_ID,
      erpBuildBatchTargets<SearchIssueRequest>(this.store.scope()),
      { targetCount: this.selectionCount() },
    );
  }

  private _setAssignee(assigneeUuid: string | undefined): void {
    void this._orchestrator
      .setAssigneeMultipleAsync({
        ...erpBuildBatchTargets<SearchIssueRequest>(this.store.scope()),
        templateCommand: { assigneeUuid },
      })
      .catch((err: unknown) => console.error('[IssueTabComponent] Nie udało się przypisać zgłoszeń.', err));
  }

  private _raisePriority(): void {
    void this._orchestrator
      .setPriorityMultipleAsync({
        ...erpBuildBatchTargets<SearchIssueRequest>(this.store.scope()),
        templateCommand: { priority: ISSUE_PRIORITY.High },
      })
      .catch((err: unknown) => console.error('[IssueTabComponent] Nie udało się zmienić priorytetu zgłoszeń.', err));
  }
}
