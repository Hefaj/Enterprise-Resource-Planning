import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpEmptyStateComponent,
  ErpTabsComponent,
  ErpTabsConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';
import { PROJECT_KIND } from '@erp/task-management/util';

import { ProjectAutomationsComponent } from './content/project-automations.component';
import { ProjectFieldsComponent } from './content/project-fields.component';
import { ProjectNotificationsComponent } from './content/project-notifications.component';
import { ProjectSlaComponent } from './content/project-sla.component';
import { ProjectTagsComponent } from './content/project-tags.component';
import { ProjectTypesComponent } from './content/project-types.component';
import { ProjectWebhooksComponent } from './content/project-webhooks.component';
import { ProjectWorkflowSchemeComponent } from './content/project-workflow-scheme.component';
import { PROJECT_KEYS, provideProjectTranslations } from '../translation';

/**
 * Karta projektu — `/task-management/project/:uuid`.
 *
 * <p>Docelowo master-detail z zakładkami: pola, typy, SLA, stany, tablice, członkowie
 * (`docs/modules/task-management/screens.md` §4.2). Zakładka SLA dochodzi w fazie 5
 * (`SLA-001`); stany, tablice i członkowie zostają zaślepką, dopóki nie wejdzie faza, która je
 * wypełnia.</p>
 */
@Component({
  selector: 'erp-task-management-project-detail',
  standalone: true,
  imports: [ErpButtonComponent, ErpEmptyStateComponent, ErpTabsComponent, ErpTranslatePipe, ReactiveFormsModule],
  providers: [provideProjectTranslations()],
  template: `
    @let project = this.project();

    @if (this.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: PROJECT_KEYS.detail.loading }" />
    } @else if (!project) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: PROJECT_KEYS.detail.notFound }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto p-6">
        <div class="flex flex-wrap items-center gap-3">
          <erp-button [config]="backButton" />

          @if (this.editingCode()) {
            <input
              class="w-24 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-0.5 font-mono text-sm"
              type="text"
              [formControl]="this.codeControl"
              [placeholder]="PROJECT_KEYS.detail.codePlaceholder | erpTranslate"
              (keydown.enter)="this.saveCodeAsync(project.uuid)"
            />
            <erp-button [config]="this.saveCodeButton(project.uuid)" />
            <erp-button [config]="this.cancelCodeButton" />
          } @else {
            <span class="font-mono text-sm text-[var(--tui-text-secondary)]">{{ project.code }}</span>
            <erp-button [config]="this.editCodeButton" />
          }

          <span class="text-lg font-medium">{{ project.name }}</span>
          <span class="text-xs text-[var(--tui-text-tertiary)]">
            {{ this.kindLabel() | erpTranslate }}
          </span>

          @if (project.isArchived) {
            <span class="rounded bg-[var(--tui-status-warning-pale)] px-2 py-0.5 text-xs text-[var(--tui-status-warning)]">
              {{ PROJECT_KEYS.detail.archivedBadge | erpTranslate }}
            </span>
          }

          <div class="flex-1"></div>

          <erp-button [config]="this.archiveButton(project.uuid, project.isArchived)" />
        </div>

        <erp-tabs [config]="this.tabsConfig()" />
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
export class ProjectDetailComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _orchestrator = inject(TaskManagementProjectOrchestrator);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _confirm = inject(ErpConfirmDialogService);

  protected readonly uuid = toSignal(this._route.paramMap.pipe(map((params) => params.get('uuid') ?? '')), {
    initialValue: '',
  });

  protected readonly loading = signal<boolean>(true);

  /** Projekt czytany ze wspólnego cache orkiestratora — zmiana przychodząca kanałem
   * `taskmgmt.project` odświeża kartę bez własnego nasłuchu. */
  protected readonly project = computed<ProjectVM | undefined>(() => {
    const uuid = this.uuid();

    return uuid ? this._orchestrator.getOne(uuid)() : undefined;
  });

  protected readonly kindLabel = computed(() =>
    this.project()?.kind === PROJECT_KIND.Intake ? PROJECT_KEYS.filters.kind.intake : PROJECT_KEYS.filters.kind.delivery,
  );

  /**
   * Master-detail z zakładkami (`docs/modules/task-management/screens.md` §4.2) — dziś „pola"
   * i „typy" (`TYP-001`); pozostałe (stany, tablice, członkowie, SLA) wchodzą razem z fazami,
   * które je wypełniają.
   */
  protected readonly tabsConfig = computed<ErpTabsConfig>(() => {
    const project = this.project();

    return {
      tabs: project
        ? [
            {
              id: 'fields',
              label: PROJECT_KEYS.detail.fields.title,
              component: ProjectFieldsComponent,
              inputs: { project },
            },
            {
              id: 'types',
              label: PROJECT_KEYS.detail.types.title,
              component: ProjectTypesComponent,
              inputs: { project },
            },
            {
              id: 'tags',
              label: PROJECT_KEYS.detail.tags.title,
              component: ProjectTagsComponent,
              inputs: { project },
            },
            {
              id: 'sla',
              label: PROJECT_KEYS.detail.sla.title,
              component: ProjectSlaComponent,
              inputs: { project },
            },
            {
              id: 'workflow',
              label: PROJECT_KEYS.detail.workflow.title,
              component: ProjectWorkflowSchemeComponent,
              inputs: { project },
            },
            {
              id: 'automations',
              label: PROJECT_KEYS.detail.automations.title,
              component: ProjectAutomationsComponent,
              inputs: { project },
            },
            {
              id: 'webhooks',
              label: PROJECT_KEYS.detail.webhooks.title,
              component: ProjectWebhooksComponent,
              inputs: { project },
            },
            {
              id: 'notifications',
              label: PROJECT_KEYS.detail.notifications.title,
              component: ProjectNotificationsComponent,
              inputs: { project },
            },
          ]
        : [],
      initialValue: 'fields',
    };
  });

  protected readonly backButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.back,
    appearance: 'flat',
    size: 's',
    iconStart: '@tui.arrow-left',
    fn: () => void this._router.navigate(['/task-management/project']),
  };

  // ── PRJ-003: zmiana prefiksu ──

  protected readonly editingCode = signal<boolean>(false);
  protected readonly codeControl = new FormControl<string>('', { nonNullable: true });

  protected readonly editCodeButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.editCode,
    appearance: 'flat',
    size: 'xs',
    iconStart: '@tui.pencil',
    fn: (): void => {
      this.codeControl.setValue(this.project()?.code ?? '');
      this.editingCode.set(true);
    },
  };

  protected readonly cancelCodeButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.cancel,
    appearance: 'flat',
    size: 'xs',
    fn: (): void => this.editingCode.set(false),
  };

  protected saveCodeButton(uuid: string): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.save,
      appearance: 'primary',
      size: 'xs',
      fn: (): Promise<void> => this.saveCodeAsync(uuid),
    };
  }

  protected async saveCodeAsync(uuid: string): Promise<void> {
    const code = this.codeControl.value.trim();

    if (!code) {
      return;
    }

    await this._orchestrator.setCodeAsync({ uuid, code });
    this.editingCode.set(false);
  }

  // ── PRJ-004: archiwizacja ──

  protected archiveButton(uuid: string, isArchived: boolean): ErpButtonConfig {
    return isArchived
      ? {
          label: PROJECT_KEYS.detail.unarchive,
          appearance: 'flat',
          size: 's',
          iconStart: '@tui.archive-restore',
          fn: (): Promise<void> => this._unarchiveAsync(uuid),
        }
      : {
          label: PROJECT_KEYS.detail.archive,
          appearance: 'flat',
          size: 's',
          iconStart: '@tui.archive',
          fn: (): Promise<void> => this._archiveAsync(uuid),
        };
  }

  private async _unarchiveAsync(uuid: string): Promise<void> {
    await this._orchestrator.setArchivedAsync({ uuid, isArchived: false });
  }

  private async _archiveAsync(uuid: string): Promise<void> {
    const confirmed = await this._confirm.confirmAsync({
      title: PROJECT_KEYS.detail.archiveConfirm.title,
      message: PROJECT_KEYS.detail.archiveConfirm.message,
      confirmLabel: PROJECT_KEYS.detail.archiveConfirm.confirm,
      appearance: 'warning',
    });

    if (!confirmed) {
      return;
    }

    await this._orchestrator.setArchivedAsync({ uuid, isArchived: true });
  }

  public constructor() {
    effect(() => {
      const uuid = this.uuid();

      if (!uuid) {
        return;
      }

      untracked(() => void this._loadAsync(uuid));
    });
  }

  private async _loadAsync(uuid: string): Promise<void> {
    this.loading.set(true);

    try {
      await this._orchestrator.loadAsync([uuid], {});
    } catch (error) {
      console.error('[ProjectDetailComponent] Nie udało się pobrać projektu.', error);
    } finally {
      this.loading.set(false);
    }
  }
}
