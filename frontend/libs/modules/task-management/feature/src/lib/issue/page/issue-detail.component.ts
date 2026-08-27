import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpEmptyStateComponent,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import {
  IssueVM,
  ProjectWorkflowService,
  TaskManagementIssueOrchestrator,
  WorkflowTransitionDto,
} from '@erp/task-management/data-access';
import { ISSUE_PRIORITY } from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS, provideTaskManagementTranslations } from '@erp/task-management/ui';

import { ISSUE_KEYS, provideIssueTranslations } from '../translation';

/**
 * Karta zgłoszenia — `/task-management/issue/:key`.
 *
 * <p><b>Osobna strona, nie prawy panel przy tabeli</b>: opis i (od fazy 1) komentarze oraz
 * historia muszą dominować ekran, a link `/issue/DEV-412` krąży w mailach i musi otwierać pełny
 * widok (`docs/frontend/task-management-pages.md` §2.3).</p>
 *
 * <p><b>Trasa idzie po kluczu czytelnym, nie po UUID.</b> Klucze historyczne rozwiązuje backend
 * (`issue.previous_keys`), więc link sprzed przeniesienia projektu nadal otwiera właściwe
 * zgłoszenie — front nie musi o tym wiedzieć.</p>
 *
 * <p><b>Świadome odstępstwo od `feature-structure.md` §4.1:</b> ten plik leży w `page/` obok
 * `issue.component.ts`, mimo że wzorzec zakłada jeden komponent strony na agregat. Karta i lista
 * to dwie trasy tego samego agregatu, dzielące scope tłumaczeń, orkiestrator i model wiersza —
 * rozbicie ich na dwie jednostki `lib/` zdublowałoby scope i rozjechało klucze.</p>
 */
@Component({
  selector: 'erp-task-management-issue-detail',
  standalone: true,
  imports: [DatePipe, ErpButtonComponent, ErpEmptyStateComponent, ErpTranslatePipe],
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
          <span class="font-mono text-sm text-[var(--tui-text-secondary)]">{{ issue.key }}</span>
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
              <h2 class="m-0 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.description.label | erpTranslate }}
              </h2>
              <p class="m-0 whitespace-pre-wrap">
                {{ issue.description || (ISSUE_KEYS.detail.description.empty | erpTranslate) }}
              </p>
            </section>
          </div>

          <aside class="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-[var(--tui-border-normal)] pl-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.state | erpTranslate }}
              </span>
              <span class="font-medium">{{ stateLabel() | erpTranslate }}</span>
            </div>

            <div class="flex flex-col gap-2">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.transitions | erpTranslate }}
              </span>
              @if (transitionButtons().length === 0) {
                <span class="text-sm text-[var(--tui-text-secondary)]">
                  {{ ISSUE_KEYS.detail.sidebar.noTransitions | erpTranslate }}
                </span>
              } @else {
                <div class="flex flex-wrap gap-2">
                  @for (button of transitionButtons(); track button.id) {
                    <erp-button [config]="button.config" />
                  }
                </div>
              }
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.project | erpTranslate }}
              </span>
              <span>{{ projectLabel() }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.priority | erpTranslate }}
              </span>
              <span>{{ priorityKey() | erpTranslate }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.assignee | erpTranslate }}
              </span>
              <span>{{ issue.assigneeUuid || (ISSUE_KEYS.table.unassigned | erpTranslate) }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.dueAt | erpTranslate }}
              </span>
              <span>{{ issue.dueAt ? (issue.dueAt | date: 'short') : (ISSUE_KEYS.table.unassigned | erpTranslate) }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
                {{ ISSUE_KEYS.detail.sidebar.updatedAt | erpTranslate }}
              </span>
              <span>{{ issue.updatedAt | date: 'short' }}</span>
            </div>
          </aside>
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
  private readonly _workflow = inject(ProjectWorkflowService);
  private readonly _permissionStore = inject(PermissionStore);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  /**
   * Klucz czytelny z trasy. Czytany z `ActivatedRoute`, a NIE przez `input()` z wiązaniem
   * parametrów — host nie włącza `withComponentInputBinding()`, a włączanie go globalnie dla
   * jednej strony zmieniłoby sposób wiązania parametrów i `data` we wszystkich modułach naraz.
   */
  public readonly key = toSignal(
    this._route.paramMap.pipe(map((params) => params.get('key') ?? '')),
    { initialValue: '' },
  );

  private readonly _uuid = signal<string | null>(null);

  protected readonly loading = signal<boolean>(true);

  /** Zgłoszenie czytane ze wspólnego cache orkiestratora — dzięki temu zmiana przychodząca
   * przez SignalR odświeża kartę bez własnej logiki nasłuchu. */
  protected readonly issue = computed<IssueVM | undefined>(() => {
    const uuid = this._uuid();
    return uuid ? this._orchestrator.getOne(uuid)() : undefined;
  });

  protected readonly stateLabel = computed(() => {
    const issue = this.issue();
    if (!issue) {
      return '';
    }
    return issue.stateNameKey || issue.stateCode;
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
   * Przyciski przejść — wyłącznie te, które schemat projektu wystawia z bieżącego stanu.
   * Backend i tak odrzuci przejście spoza schematu (`taskmgmt.transition_not_allowed`); tutaj
   * chodzi o to, żeby użytkownik nie musiał zgadywać, klikając i czytając błąd.
   */
  protected readonly transitionButtons = computed<{ id: string; config: ErpButtonConfig }[]>(() => {
    const issue = this.issue();
    if (!issue || !this._permissionStore.has(ERP_PERMISSIONS.TaskManagement.IssueUpdate)) {
      return [];
    }

    return this._workflow
      .transitionsFrom(issue.projectUuid, issue.stateUuid)()
      .map((transition: WorkflowTransitionDto) => ({
        id: transition.uuid,
        config: {
          label: transition.nameKey,
          appearance: 'secondary',
          size: 's',
          fn: (): Promise<void> => this._applyTransition(issue.uuid, transition.toStateUuid),
        } satisfies ErpButtonConfig,
      }));
  });

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

      // Schemat projektu jest potrzebny do przycisków przejść — bez niego karta wyświetliłaby
      // stan bez żadnej możliwości jego zmiany.
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

  private async _applyTransition(uuid: string, stateUuid: string): Promise<void> {
    try {
      await this._orchestrator.setStateAsync({ uuid, stateUuid });
    } catch (error) {
      console.error('[IssueDetailComponent] Nie udało się zmienić stanu zgłoszenia.', error);
    }
  }
}
