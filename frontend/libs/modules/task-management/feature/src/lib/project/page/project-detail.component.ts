import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { ErpButtonComponent, ErpButtonConfig, ErpEmptyStateComponent, ErpTabsComponent, ErpTabsConfig, ErpTranslatePipe } from '@erp/shared/ui';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';
import { PROJECT_KIND } from '@erp/task-management/util';

import { ProjectFieldsComponent } from './content/project-fields.component';
import { ProjectSlaComponent } from './content/project-sla.component';
import { ProjectTypesComponent } from './content/project-types.component';
import { PROJECT_KEYS, provideProjectTranslations } from '../translation';

/**
 * Karta projektu — `/task-management/project/:uuid`.
 *
 * <p>Docelowo master-detail z zakładkami: pola, typy, SLA, stany, tablice, członkowie
 * (`docs/frontend/task-management-pages.md` §4.2). Zakładka SLA dochodzi w fazie 5
 * (`SLA-001`); stany, tablice i członkowie zostają zaślepką, dopóki nie wejdzie faza, która je
 * wypełnia.</p>
 */
@Component({
  selector: 'erp-task-management-project-detail',
  standalone: true,
  imports: [ErpButtonComponent, ErpEmptyStateComponent, ErpTabsComponent, ErpTranslatePipe],
  providers: [provideProjectTranslations()],
  template: `
    @let project = this.project();

    @if (this.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: PROJECT_KEYS.detail.loading }" />
    } @else if (!project) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: PROJECT_KEYS.detail.notFound }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto p-6">
        <div class="flex items-center gap-3">
          <erp-button [config]="backButton" />
          <span class="font-mono text-sm text-[var(--tui-text-secondary)]">{{ project.code }}</span>
          <span class="text-lg font-medium">{{ project.name }}</span>
          <span class="text-xs text-[var(--tui-text-tertiary)]">
            {{ this.kindLabel() | erpTranslate }}
          </span>
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
   * Master-detail z zakładkami (`docs/frontend/task-management-pages.md` §4.2) — dziś „pola"
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
              id: 'sla',
              label: PROJECT_KEYS.detail.sla.title,
              component: ProjectSlaComponent,
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
