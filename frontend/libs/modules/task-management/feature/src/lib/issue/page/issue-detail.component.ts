import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpEmptyStateComponent,
  ErpRichTextBuilder,
  ErpRichTextComponent,
  ErpRichTextConfig,
  ErpToastService,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import {
  IssueGraphService,
  IssueVM,
  ProjectWorkflowService,
  TaskManagementIssueOrchestrator,
  TaskManagementIssueTypeSchemeOrchestrator,
  WorkflowTransitionDto,
  IssueAttachmentContentService,
  IssueAttachmentService,
  createIssueRichTextUploadPort,
  openBlockersOf,
  openChildrenOf,
  resolveIssueRichTextHtmlAsync,
} from '@erp/task-management/data-access';
import { ISSUE_PRIORITY, WORKFLOW_STATE_CATEGORY } from '@erp/task-management/util';
import { ErpFieldPanelComponent, ErpFieldPanelConfig, ErpIssueKeyComponent, TASKMANAGEMENT_KEYS, provideTaskManagementTranslations } from '@erp/task-management/ui';

import { ISSUE_KEYS, provideIssueTranslations } from '../translation';
import { IssueAttachmentsComponent } from './content/issue-attachments.component';
import { IssueCustomFieldsComponent } from './content/issue-custom-fields.component';
import { IssueLinksComponent } from './content/issue-links.component';
import { IssueActivityComponent } from './content/issue-activity.component';

/**
 * Karta zgłoszenia — `/task-management/issue/:key`.
 *
 * <p><b>Układ dwukolumnowy wg `docs/frontend/task-management-pages.md` §9.1</b>: główna
 * kolumna niesie nagłówek, opis, załączniki, powiązania i strumień aktywności z zakotwiczonym
 * kompozytorem; `erp-field-panel` po prawej trzyma stan i przejścia na samej górze, potem typ,
 * metadane i pola niestandardowe projektu (`IssueCustomFieldsComponent` — projekcja przez
 * `<ng-content>`, bo panel w `ui` nie ma prawa znać formularza budowanego z profilu pól).</p>
 *
 * <p><b>Trasa idzie po kluczu czytelnym, nie po UUID</b> — klucze historyczne rozwiązuje
 * backend (`issue.previous_keys`), więc link sprzed przeniesienia projektu nadal działa.</p>
 */
@Component({
  selector: 'erp-task-management-issue-detail',
  standalone: true,
  imports: [
    DatePipe,
    ErpButtonComponent,
    ErpEmptyStateComponent,
    ErpFieldPanelComponent,
    ErpIssueKeyComponent,
    ErpRichTextComponent,
    ErpTranslatePipe,
    IssueAttachmentsComponent,
    IssueActivityComponent,
    IssueCustomFieldsComponent,
    IssueLinksComponent,
  ],
  providers: [provideIssueTranslations(), provideTaskManagementTranslations()],
  template: `
    @let issue = this.issue();

    @if (loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: ISSUE_KEYS.detail.loading }" />
    } @else if (!issue) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: ISSUE_KEYS.detail.notFound.message }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-4 p-6">
        <div class="flex items-center gap-3">
          <erp-button [config]="backButton" />
          <erp-issue-key [config]="{ issueKey: issue.key, typeIcon: issue.typeIcon, typeName: issue.typeName, link: undefined }" />
          @if (issue.isRestricted) {
            <span class="rounded bg-[var(--tui-background-neutral-1)] px-2 py-0.5 text-xs">
              {{ ISSUE_KEYS.detail.sidebar.restricted | erpTranslate }}
            </span>
          }
        </div>

        <div class="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-6 overflow-hidden">
          <div class="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <h1 class="m-0 text-2xl font-semibold">{{ issue.title }}</h1>

            <section class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <h2 class="m-0 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">
                  {{ ISSUE_KEYS.detail.description.label | erpTranslate }}
                </h2>
                @if (!editingDescription() && canEdit()) {
                  <erp-button [config]="editDescriptionButton" />
                }
              </div>

              @if (editingDescription()) {
                <erp-rich-text [config]="descriptionEditorConfig" [control]="descriptionControl" />
                <div class="flex gap-2">
                  <erp-button [config]="saveDescriptionButton" />
                  <erp-button [config]="cancelDescriptionButton" />
                </div>
              } @else if (issue.description) {
                <erp-rich-text [config]="descriptionPreviewConfig()" />
              } @else {
                <p class="m-0 text-[var(--tui-text-secondary)]">
                  {{ ISSUE_KEYS.detail.description.empty | erpTranslate }}
                </p>
              }
            </section>

            <erp-task-management-issue-attachments [issueUuid]="issue.uuid" [canEdit]="canEdit()" />

            <erp-task-management-issue-links [issueUuid]="issue.uuid" />

            <erp-task-management-issue-activity [issueUuid]="issue.uuid" [canWrite]="canEdit()" />
          </div>

          <erp-field-panel
            [config]="this.fieldPanelConfig()"
            (transitionClick)="this.applyTransitionAsync($event)"
            (typeChange)="this.changeTypeAsync($event)"
          >
            <erp-task-management-issue-custom-fields [issue]="issue" />
          </erp-field-panel>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueDetailComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  private readonly _orchestrator = inject(TaskManagementIssueOrchestrator);
  private readonly _typeSchemes = inject(TaskManagementIssueTypeSchemeOrchestrator);
  private readonly _workflow = inject(ProjectWorkflowService);
  private readonly _permissionStore = inject(PermissionStore);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _transloco = inject(TranslocoService);
  private readonly _toasts = inject(ErpToastService);
  private readonly _attachments = inject(IssueAttachmentService);
  private readonly _content = inject(IssueAttachmentContentService);
  private readonly _graphService = inject(IssueGraphService);
  private readonly _confirm = inject(ErpConfirmDialogService);

  /**
   * Klucz czytelny z trasy. Czytany z `ActivatedRoute`, a NIE przez `input()` z wiązaniem
   * parametrów — host nie włącza `withComponentInputBinding()`.
   */
  public readonly key = toSignal(
    this._route.paramMap.pipe(map((params) => params.get('key') ?? '')),
    { initialValue: '' },
  );

  private readonly _uuid = signal<string | null>(null);

  protected readonly loading = signal<boolean>(true);

  /** Zgłoszenie czytane ze wspólnego cache orkiestratora — SignalR odświeża kartę bez
   * własnej logiki nasłuchu. */
  protected readonly issue = computed<IssueVM | undefined>(() => {
    const uuid = this._uuid();
    return uuid ? this._orchestrator.getOne(uuid)() : undefined;
  });

  protected readonly canEdit = computed(() =>
    this._permissionStore.has(ERP_PERMISSIONS.TaskManagement.IssueUpdate),
  );

  /**
   * Typy zawężone do schematu podpiętego do projektu zgłoszenia (`ProjectDto.issueTypeSchemeUuid`)
   * — wybór typu spoza tego schematu i tak odrzuciłby backend (`Issue.SetType`), więc panel nie
   * ma po co go proponować.
   */
  protected readonly typeOptions = computed(() => {
    const schemeUuid = this.issue()?.project?.issueTypeSchemeUuid;
    const scheme = schemeUuid ? this._typeSchemes.getOne(schemeUuid)() : undefined;

    return (scheme?.types ?? []).map((type) => ({ value: type.uuid, label: type.name }));
  });

  protected readonly fieldPanelConfig = computed<ErpFieldPanelConfig>(() => {
    const issue = this.issue();

    return {
      stateLabel: issue?.stateNameKey || issue?.stateCode || '',
      transitions: this.transitions(),
      transitionsEnabled: this.canEdit(),
      typeValue: issue?.typeUuid,
      typeOptions: this.canEdit() ? this.typeOptions() : undefined,
      typeEditable: this.canEdit(),
      rows: [
        { labelKey: ISSUE_KEYS.detail.sidebar.project, value: this.projectLabel() },
        { labelKey: ISSUE_KEYS.detail.sidebar.priority, value: this._transloco.translate(this.priorityKey()) },
        { labelKey: ISSUE_KEYS.detail.sidebar.assignee, value: issue?.assignee?.displayName ?? issue?.assigneeUuid ?? this._transloco.translate(ISSUE_KEYS.table.unassigned) },
        { labelKey: ISSUE_KEYS.detail.sidebar.dueAt, value: issue?.dueAt ? new Date(issue.dueAt).toLocaleDateString() : this._transloco.translate(ISSUE_KEYS.table.unassigned) },
        { labelKey: ISSUE_KEYS.detail.sidebar.updatedAt, value: issue?.updatedAt ? new Date(issue.updatedAt).toLocaleString() : '' },
      ],
    };
  });

  protected readonly projectLabel = computed(() => {
    const issue = this.issue();
    if (!issue) {
      return '';
    }

    // Sam kod projektu, dopóki nazwa nie dojedzie z sąsiedniego orkiestratora — nigdy pusto.
    return issue.project ? `${issue.project.code} — ${issue.project.name}` : issue.projectCode;
  });

  protected readonly priorityKey = computed(() => {
    switch (this.issue()?.priority) {
      case ISSUE_PRIORITY.Critical:
        return TASKMANAGEMENT_KEYS.priority.critical;
      case ISSUE_PRIORITY.High:
        return TASKMANAGEMENT_KEYS.priority.high;
      case ISSUE_PRIORITY.Low:
        return TASKMANAGEMENT_KEYS.priority.low;
      case ISSUE_PRIORITY.Lowest:
        return TASKMANAGEMENT_KEYS.priority.lowest;
      default:
        return TASKMANAGEMENT_KEYS.priority.normal;
    }
  });

  /**
   * Przejścia dostępne z bieżącego stanu — `id` niesie `toStateUuid`, bo panel pól go nie
   * odróżnia od uuid przejścia (backend przyjmuje docelowy stan, nie uuid przejścia).
   */
  protected readonly transitions = computed<{ id: string; labelKey: string }[]>(() => {
    const issue = this.issue();
    if (!issue || !this.canEdit()) {
      return [];
    }

    return this._workflow
      .transitionsFrom(issue.projectUuid, issue.stateUuid)()
      .map((transition: WorkflowTransitionDto) => ({ id: transition.toStateUuid, labelKey: transition.nameKey }));
  });

  // ── Opis: podgląd ↔ edycja ───────────────────────────────────────────────────────────────

  protected readonly editingDescription = signal<boolean>(false);

  protected readonly descriptionControl = new FormControl<string>('');

  /** Obrazy wklejone w opisie (`Ctrl+V`/`drop`) wgrywają się jako załącznik zgłoszenia
   * (`ISS-005`) — port jest współdzielony z komentarzami (`erp-task-management-issue-activity`),
   * ale każdy komponent trzyma własną instancję, bo każdy zna inną kontrolkę do podmiany `src`. */
  private readonly _descriptionUploadPort = createIssueRichTextUploadPort(
    this._attachments,
    this._content,
    () => this.issue()?.uuid,
    () => this.descriptionControl,
  );

  private readonly _resolvedDescription = signal<string>('');

  protected readonly descriptionPreviewConfig = computed<ErpRichTextConfig>(() =>
    ErpRichTextBuilder.create((b) => b.setReadOnly(true).setValue(this._resolvedDescription())),
  );

  protected readonly descriptionEditorConfig = computed<ErpRichTextConfig>(() =>
    ErpRichTextBuilder.create((b) =>
      b
        .setToolset('standard')
        .setMinHeight(220)
        .setPlaceholder(ISSUE_KEYS.detail.description.placeholder)
        .setUploadImage(this._descriptionUploadPort),
    ),
  );

  protected readonly editDescriptionButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.description.edit,
    appearance: 'flat',
    size: 'xs',
    iconStart: '@tui.pencil',
    fn: (): void => {
      this.descriptionControl.setValue(this.issue()?.description ?? '');
      this.editingDescription.set(true);
    },
  };

  protected readonly saveDescriptionButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.description.save,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._saveDescription(),
  };

  protected readonly cancelDescriptionButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.description.cancel,
    appearance: 'flat',
    size: 's',
    fn: (): void => this.editingDescription.set(false),
  };

  protected readonly backButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.backToList,
    appearance: 'flat',
    size: 's',
    iconStart: '@tui.arrow-left',
    fn: (): void => {
      void this._router.navigate(['/task-management/issue']);
    },
  };

  public constructor() {
    effect(() => {
      const key = this.key();
      untracked(() => void this._load(key));
    });

    effect(() => {
      const description = this.issue()?.description;
      untracked(() => void this._resolveDescriptionAsync(description));
    });

    void this._typeSchemes.searchAsync({}, { autoLoad: true });
  }

  private async _load(key: string): Promise<void> {
    if (!key) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    try {
      const issue = await this._orchestrator.loadByKeyAsync(key);
      this._uuid.set(issue?.uuid ?? null);

      // Schemat projektu jest potrzebny do przycisków przejść.
      if (issue?.projectUuid) {
        await this._workflow.loadAsync(issue.projectUuid);
      }
    } catch (error) {
      console.error('[IssueDetailComponent] Nie udało się wczytać zgłoszenia.', error);
      this._uuid.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /** Podmienia adresy kanoniczne załączników na `blob:` z tokenem — bez tego wklejony
   * zrzut ekranu dałby 401 po odświeżeniu strony (ISS-005 AC „po ponownym wejściu w edytor"). */
  private async _resolveDescriptionAsync(description: string | undefined): Promise<void> {
    this._resolvedDescription.set(await resolveIssueRichTextHtmlAsync(description, this._content));
  }

  private async _saveDescription(): Promise<void> {
    const issue = this.issue();
    if (!issue) {
      return;
    }

    try {
      await this._orchestrator.setDescriptionAsync({
        uuid: issue.uuid,
        description: this.descriptionControl.value || undefined,
      });
      this.editingDescription.set(false);
    } catch (error) {
      console.error('[IssueDetailComponent] Nie udało się zapisać opisu.', error);
    }
  }

  /**
   * Zastosowanie przejścia.
   *
   * <p><b>`WF-004` (modal pól wymaganych) nie jest tu wpięty end-to-end.</b> Backend nie ma dziś
   * modelu „przejście X wymaga pól Y" — `WorkflowTransition` niesie wyłącznie
   * `RequiredPermission` (`docs/backend/task-management-requirements.md` WF-003 jest 🟡,
   * częściowa), a każda mutacja w tym systemie i tak idzie przez `job`/`BulkCommandRunner`
   * i wraca `200` z `jobUuid` NATYCHMIAST — naruszenie reguły domenowej ujawniłoby się dopiero
   * asynchronicznie w `job_item`, którego kod błędu front dziś nigdzie nie odczytuje (zobacz
   * raport fazy). Ten `catch` łapie więc tylko odrzucenia na poziomie zadania
   * (`erpAwaitJobAsync` w orkiestratorze) — siecowe/transportowe, nie „brakuje pola X".</p>
   *
   * <p><b>`LNK-004`/`LNK-005` są wpięte w całości</b> — to ostrzeżenia liczone WYŁĄCZNIE na
   * froncie z grafu zgłoszenia (`docs/backend/task-management-requirements.md`: „to ostrzeżenie
   * walidacyjne, nie reguła backendu"), więc nie zależą od tego, czego backend jeszcze nie ma.</p>
   */
  protected async applyTransitionAsync(toStateUuid: string): Promise<void> {
    const issue = this.issue();
    if (!issue) {
      return;
    }

    if (!(await this._confirmGraphWarningsAsync(issue, toStateUuid))) {
      return;
    }

    try {
      await this._orchestrator.setStateAsync({ uuid: issue.uuid, stateUuid: toStateUuid });
    } catch (error) {
      console.error('[IssueDetailComponent] Nie udało się zmienić stanu zgłoszenia.', error);
      this._toasts.show({ message: ISSUE_KEYS.detail.transitionFailed, appearance: 'negative' });
    }
  }

  /**
   * `LNK-004`/`LNK-005` — ostrzeżenia grafu przed przejściem, nie blokady. Zwraca `false`,
   * gdy użytkownik anulował którekolwiek z okien (przejście się wtedy w ogóle nie wysyła).
   */
  private async _confirmGraphWarningsAsync(issue: IssueVM, toStateUuid: string): Promise<boolean> {
    const graph = this._graphService.getOne(issue.uuid)() ?? (await this._graphService.loadAsync(issue.uuid));

    // LNK-005: zgłoszenie zablokowane przez inne, jeszcze nieukończone.
    const blockers = openBlockersOf(graph);
    if (blockers.length > 0) {
      const confirmed = await this._confirm.confirmAsync({
        title: ISSUE_KEYS.detail.warnings.blocked.title,
        message: ISSUE_KEYS.detail.warnings.blocked.message,
        confirmLabel: ISSUE_KEYS.detail.warnings.blocked.confirm,
        details: blockers.map((link) => `${link.otherKey} — ${link.otherTitle}`),
        appearance: 'warning',
      });

      if (!confirmed) {
        return false;
      }
    }

    // LNK-004: zamknięcie (przejście do kategorii `Done`) zgłoszenia z otwartymi dziećmi.
    const targetCategory = this._workflow
      .statesOf(issue.projectUuid)()
      .find((state) => state.uuid === toStateUuid)?.category;

    if (targetCategory === WORKFLOW_STATE_CATEGORY.Done) {
      const openChildren = openChildrenOf(graph);
      if (openChildren.length > 0) {
        const confirmed = await this._confirm.confirmAsync({
          title: ISSUE_KEYS.detail.warnings.openChildren.title,
          message: ISSUE_KEYS.detail.warnings.openChildren.message,
          confirmLabel: ISSUE_KEYS.detail.warnings.openChildren.confirm,
          details: openChildren.map((child) => `${child.key} — ${child.title}`),
          appearance: 'warning',
        });

        if (!confirmed) {
          return false;
        }
      }
    }

    return true;
  }

  protected async changeTypeAsync(typeUuid: string): Promise<void> {
    const issue = this.issue();
    if (!issue || issue.typeUuid === typeUuid) {
      return;
    }

    try {
      await this._orchestrator.setTypeAsync({ uuid: issue.uuid, typeUuid });
    } catch (error) {
      console.error('[IssueDetailComponent] Nie udało się zmienić typu zgłoszenia.', error);
      this._toasts.show({ message: ISSUE_KEYS.detail.typeChangeFailed, appearance: 'negative' });
    }
  }
}
